// Static-transcript grouping. The run pages (/runs/[slug]) render the same
// hand-written events the player animates, as plain HTML for readers and
// crawlers. The scripts twin their branches rather than sectioning them:
// a spine tool_call can carry one branch-tagged result per option (loop's
// t1), and branch-tagged calls can share one id and one spine result
// (loop's t4) — so the page keeps script order and labels branch beats
// with their pick, instead of splitting the run into path sections that
// would tear calls from their evidence.

import type { TimelineEvent } from "@/lib/timeline";

export type ToolCallEvent = Extract<TimelineEvent, { type: "tool_call" }>;
export type ToolResultEvent = Extract<TimelineEvent, { type: "tool_result" }>;

export type TranscriptBeat =
  /** One call id with all its variants and all its evidence. */
  | { kind: "call"; calls: ToolCallEvent[]; results: ToolResultEvent[] }
  | { kind: "event"; e: TimelineEvent };

/** Script-order beats. Calls collapse to one beat per id (branch twins
    share ids); results attach to their call; step ticks are animation
    beats the plan block already covers, so they carry no transcript. */
export function beats(events: TimelineEvent[]): TranscriptBeat[] {
  const out: TranscriptBeat[] = [];
  const seenCalls = new Set<string>();
  for (const e of events) {
    if (e.type === "tool_result") continue; // attached to its call below
    if (e.type === "step_active" || e.type === "step_done") continue;
    if (e.type === "tool_call") {
      if (seenCalls.has(e.id)) continue; // a branch twin already collected
      seenCalls.add(e.id);
      out.push({
        kind: "call",
        calls: events.filter(
          (x): x is ToolCallEvent => x.type === "tool_call" && x.id === e.id,
        ),
        results: events.filter(
          (x): x is ToolResultEvent => x.type === "tool_result" && x.callId === e.id,
        ),
      });
    } else {
      out.push({ kind: "event", e });
    }
  }
  return out;
}

/** "choiceId:optionId" → the option's human label, for tagging branch beats. */
export function branchLabels(events: TimelineEvent[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of events) {
    if (e.type !== "choice") continue;
    for (const o of e.options) map.set(`${e.choiceId}:${o.id}`, o.label);
  }
  return map;
}
