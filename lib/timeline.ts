// Timeline event schema. Everything on screen is a pure function of
// (scenario, timeline position, the reader's choices). Errors are
// tool_results with ok: false; replans are plan_dead + a new plan —
// no separate event types.

export const CONTEXT_BUDGET = 8000;

// Decision beats: a `choice` event parks the clock and asks the reader.
// Beats tagged with `branch` fire only when their choice resolved their
// way — both branches are hand-written into the same time window, so the
// timeline's duration and rhythm never depend on what the reader picked.
export type ChoiceOption = { id: string; label: string };

/** The reader's picks, keyed by choiceId. Unanswered choices resolve to
    the first option — the canonical path — so the world is always fully
    determined: same (ms, choices) in, same frame out. */
export type Choices = Record<string, string>;

// `narration` is the storyteller line for the hero marquee — hand-written
// per beat, in the mascot's first-person voice. Events without one fall
// back to a generic line per event type.
export type TimelineEvent = {
  at: number;
  tokensAfter: number;
  narration?: string;
  /** Branch beats fire only when the named choice resolved to this option. */
  branch?: { choice: string; option: string };
} & (
  | { type: "plan"; planId: string; steps: string[] }
  | { type: "step_active"; planId: string; step: number }
  | { type: "step_done"; planId: string; step: number }
  | { type: "thought"; text: string }
  /** `why` is the agent's stated reason for reaching for this tool — the
      transcript's own voice, independent of the storyteller line. */
  | { type: "tool_call"; id: string; tool: string; input: string; why?: string }
  | { type: "tool_result"; callId: string; ok: boolean; output: string }
  | { type: "plan_dead"; planId: string; reason: string }
  | { type: "compact"; summary: string }
  | { type: "choice"; choiceId: string; prompt: string; options: ChoiceOption[] }
  | { type: "done"; verdict: string }
);

export interface Scenario {
  id: string;
  title: string;
  task: string;
  lesson: string;
  durationMs: number;
  events: TimelineEvent[];
}

/** Fill unanswered choices with their first option — the canonical path. */
export function resolveChoices(scenario: Scenario, choices: Choices): Choices {
  const resolved: Choices = { ...choices };
  for (const e of scenario.events) {
    if (e.type === "choice" && !(e.choiceId in resolved)) {
      resolved[e.choiceId] = e.options[0].id;
    }
  }
  return resolved;
}

/** A branch-tagged event fires only when its choice resolved its way. */
export function eventActive(e: TimelineEvent, resolved: Choices): boolean {
  return !e.branch || resolved[e.branch.choice] === e.branch.option;
}

// ---------------------------------------------------------------------------
// Derived state. stateAt(scenario, ms) is a pure function — the scrubber just
// calls it with a different ms. No accumulated animation state anywhere.

export type StepStatus = "pending" | "active" | "done";

// Views carry the timestamps of the transitions that produced them, so all
// motion can be computed as a pure function of (ms - timestamp) through the
// spring solver. Play and scrub render through the identical path.

export interface PlanView {
  planId: string;
  at: number;
  steps: string[];
  status: StepStatus[];
  deadAt?: number;
  deadReason?: string;
}

export type Block =
  | { kind: "thought"; at: number; text: string; absorbedAt?: number }
  | {
      kind: "tool";
      at: number;
      id: string;
      tool: string;
      input: string;
      why?: string;
      pending: boolean;
      resultAt?: number;
      ok?: boolean;
      output?: string;
      absorbedAt?: number;
    }
  | { kind: "compact"; at: number; summary: string }
  | {
      kind: "choice";
      at: number;
      choiceId: string;
      prompt: string;
      options: ChoiceOption[];
      /** The reader's explicit pick; undefined while the question is live. */
      picked?: string;
    }
  | { kind: "done"; at: number; verdict: string };

export interface TimelineState {
  plans: PlanView[];
  blocks: Block[];
  /** tokensAfter of the last fired event (step function — spring-smoothed for display). */
  tokens: number;
  /** tokens before the last fired event, for interpolating the gauge. */
  tokensPrev: number;
  lastEventAt: number;
  done: string | null;
  lastEventIndex: number;
}

export function stateAt(scenario: Scenario, ms: number, choices: Choices = {}): TimelineState {
  const resolved = resolveChoices(scenario, choices);
  const plans: PlanView[] = [];
  const blocks: Block[] = [];
  let tokens = 0;
  let tokensPrev = 0;
  let lastEventAt = 0;
  let done: string | null = null;
  let lastEventIndex = -1;

  for (let i = 0; i < scenario.events.length; i++) {
    const e = scenario.events[i];
    if (e.at > ms) break;
    if (!eventActive(e, resolved)) continue;
    lastEventIndex = i;
    tokensPrev = tokens;
    tokens = e.tokensAfter;
    lastEventAt = e.at;

    switch (e.type) {
      case "plan":
        plans.push({
          planId: e.planId,
          at: e.at,
          steps: e.steps,
          status: e.steps.map(() => "pending"),
        });
        break;
      case "step_active":
      case "step_done": {
        const plan = plans.find((p) => p.planId === e.planId);
        if (plan) plan.status[e.step] = e.type === "step_active" ? "active" : "done";
        break;
      }
      case "thought":
        blocks.push({ kind: "thought", at: e.at, text: e.text });
        break;
      case "tool_call":
        blocks.push({
          kind: "tool",
          at: e.at,
          id: e.id,
          tool: e.tool,
          input: e.input,
          why: e.why,
          pending: true,
        });
        break;
      case "tool_result": {
        const call = blocks.find((b) => b.kind === "tool" && b.id === e.callId);
        if (call && call.kind === "tool") {
          call.pending = false;
          call.resultAt = e.at;
          call.ok = e.ok;
          call.output = e.output;
        }
        break;
      }
      case "plan_dead": {
        const plan = plans.find((p) => p.planId === e.planId);
        if (plan) {
          plan.deadAt = e.at;
          plan.deadReason = e.reason;
        }
        break;
      }
      case "compact": {
        // Absorption folds top-down — oldest memory first — as a wave, not a
        // blink. The stagger lives in timeline time, so it scrubs both
        // directions for free and purity holds. Whole wave ≤ 600ms.
        const live = blocks.filter(
          (b) => (b.kind === "thought" || b.kind === "tool") && b.absorbedAt === undefined,
        );
        const stagger = live.length ? Math.min(60, 600 / live.length) : 0;
        live.forEach((b, i) => {
          if (b.kind === "thought" || b.kind === "tool") b.absorbedAt = e.at + i * stagger;
        });
        blocks.push({ kind: "compact", at: e.at, summary: e.summary });
        break;
      }
      case "choice":
        blocks.push({
          kind: "choice",
          at: e.at,
          choiceId: e.choiceId,
          prompt: e.prompt,
          options: e.options,
          picked: choices[e.choiceId],
        });
        break;
      case "done":
        done = e.verdict;
        blocks.push({ kind: "done", at: e.at, verdict: e.verdict });
        break;
    }
  }

  return { plans, blocks, tokens, tokensPrev, lastEventAt, done, lastEventIndex };
}
