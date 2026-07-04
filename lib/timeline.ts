// Timeline event schema. Everything on screen is a pure function of
// (scenario, timeline position). Errors are tool_results with ok: false;
// replans are plan_dead + a new plan — no separate event types.

export const CONTEXT_BUDGET = 8000;

export type TimelineEvent = { at: number; tokensAfter: number } & (
  | { type: "plan"; planId: string; steps: string[] }
  | { type: "step_active"; planId: string; step: number }
  | { type: "step_done"; planId: string; step: number }
  | { type: "thought"; text: string }
  | { type: "tool_call"; id: string; tool: string; input: string }
  | { type: "tool_result"; callId: string; ok: boolean; output: string }
  | { type: "plan_dead"; planId: string; reason: string }
  | { type: "compact"; summary: string }
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
      pending: boolean;
      resultAt?: number;
      ok?: boolean;
      output?: string;
      absorbedAt?: number;
    }
  | { kind: "compact"; at: number; summary: string }
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

export function stateAt(scenario: Scenario, ms: number): TimelineState {
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
      case "compact":
        for (const b of blocks) {
          if ((b.kind === "thought" || b.kind === "tool") && b.absorbedAt === undefined) {
            b.absorbedAt = e.at;
          }
        }
        blocks.push({ kind: "compact", at: e.at, summary: e.summary });
        break;
      case "done":
        done = e.verdict;
        blocks.push({ kind: "done", at: e.at, verdict: e.verdict });
        break;
    }
  }

  return { plans, blocks, tokens, tokensPrev, lastEventAt, done, lastEventIndex };
}
