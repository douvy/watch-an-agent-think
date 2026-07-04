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
