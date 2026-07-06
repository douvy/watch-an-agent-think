import type { Scenario } from "@/lib/timeline";

// Scenario 3 — The Pressure. Context gauge fills to ~85%, then a `choice`
// hands the call to the reader: compress now, or keep every detail. The
// keep branch is the honest wall — the next edit fails with a context
// overflow, and the work is lost — so both paths arrive at the same
// compact. Refusing to forget costs a file; the lesson survives either
// pick. Both branches are hand-written into the same time window.
// Middle batched per review (3 files shown, counter implies the rest).
// `narration` = the mascot's hand-written line per beat — it speaks in the
// marquee at chapter turns, and as a face-caption on action beats.

export const pressure: Scenario = {
  id: "pressure",
  title: "Memory Fills Up",
  task: "Rename getUser → fetchUser across the codebase — 14 files.",
  lesson: "long tasks are won by forgetting well",
  durationMs: 91000,
  events: [
    { at: 0, tokensAfter: 800, type: "plan", planId: "p1",
      narration: "Fourteen files. Not hard, just long. Everything I read has to fit in my memory — my context window.",
      steps: [
      "Find every call site",
      "Rename across 14 files",
      "Update the barrel exports",
      "Verify the build",
    ]},
    { at: 2800, tokensAfter: 810, type: "step_active", planId: "p1", step: 0 },
    { at: 4200, tokensAfter: 860, type: "tool_call", id: "t1", tool: "grep", input: "getUser\\( — src/**",
      why: "scope the whole job before starting it" },
    { at: 7700, tokensAfter: 1600, type: "tool_result", callId: "t1", ok: true,
      narration: "53 changes to make. Everything I read from here on stays in my memory. Watch the gauge.",
      output: "53 call sites across 14 files" },
    { at: 9100, tokensAfter: 1610, type: "step_done", planId: "p1", step: 0 },
    { at: 9800, tokensAfter: 1620, type: "step_active", planId: "p1", step: 1 },
    { at: 11900, tokensAfter: 1670, type: "tool_call", id: "t2", tool: "edit",
      why: "one file at a time, verified as I go",
      input: "api/session.ts — 6 call sites" },
    { at: 14700, tokensAfter: 2300, type: "tool_result", callId: "t2", ok: true, output: "renamed (1/14)",
      narration: "Every edit I make, I also have to remember." },
    { at: 16800, tokensAfter: 2350, type: "tool_call", id: "t3", tool: "edit",
      input: "hooks/useUser.ts — 5 call sites" },
    { at: 19600, tokensAfter: 3000, type: "tool_result", callId: "t3", ok: true, output: "renamed (2/14)" },
    { at: 21700, tokensAfter: 3050, type: "tool_call", id: "t4", tool: "edit",
      input: "components/Profile.tsx — 4 call sites" },
    { at: 24500, tokensAfter: 3700, type: "tool_result", callId: "t4", ok: true, output: "renamed (3/14)" },
    { at: 27300, tokensAfter: 3750, type: "thought",
      text: "Eleven files to go. Same pattern every time — and my memory gauge keeps climbing." },
    { at: 30100, tokensAfter: 3800, type: "tool_call", id: "t5", tool: "edit",
      why: "same edit five times — batching buys speed with memory",
      input: "auth.ts, cart.ts, nav.tsx, search.ts, feed.tsx — 17 call sites" },
    { at: 34300, tokensAfter: 6400, type: "tool_result", callId: "t5", ok: true, output: "renamed (8/14)",
      narration: "Faster on files, heavier on memory." },
    { at: 37800, tokensAfter: 6800, type: "choice", choiceId: "pressure-memory",
      narration: "85% full. Your call: compress, or keep every detail?",
      prompt: "Memory is at 85% with six files left. What do I do?",
      options: [
        { id: "compress", label: "compress — trade detail for room" },
        { id: "keep", label: "keep every detail" },
      ]},
    // -- both branches live interleaved in the same window, sorted by `at`;
    //    only the picked one fires. keep = the honest wall: the next edit
    //    overflows and its work is lost. Both paths arrive at the compact.
    { at: 39900, tokensAfter: 6850, type: "thought",
      branch: { choice: "pressure-memory", option: "compress" },
      text: "Good — I fold the finished work into a summary and free the room." },
    { at: 39900, tokensAfter: 7100, type: "tool_call", id: "t10", tool: "edit",
      branch: { choice: "pressure-memory", option: "keep" },
      narration: "We keep everything. I push on, nearly full.",
      input: "billing.ts + admin.ts — 6 call sites" },
    { at: 43400, tokensAfter: 7900, type: "tool_result", callId: "t10", ok: false,
      branch: { choice: "pressure-memory", option: "keep" },
      narration: "Too full to finish the edit. When memory overflows I don't slow down — I lose work mid-thought.",
      output: "context overflow — response truncated, edit incomplete" },
    { at: 43700, tokensAfter: 6900, type: "thought",
      branch: { choice: "pressure-memory", option: "compress" },
      text: "What's finished can live as one line each. What's left is six file names." },
    { at: 45900, tokensAfter: 7950, type: "thought",
      branch: { choice: "pressure-memory", option: "keep" },
      text: "I hit the ceiling mid-edit and the work was lost. Compacting isn't optional — it's how I keep going." },
    // -- spine rejoins: both paths compact, still at 8/14. Same beat, same
    //    summary — only the storyteller line differs, so the compact is
    //    branch-tagged in a pair like the tool results above.
    { at: 47600, tokensAfter: 1900, type: "compact",
      branch: { choice: "pressure-memory", option: "compress" },
      narration: "This is called compacting. I rewrite my own memory: finished work folds to a summary, and room comes back.",
      summary: "8/14 files renamed — call-site detail summarized. Remaining: billing.ts, admin.ts, jobs/sync.ts, cli.ts, tests ×2" },
    { at: 47600, tokensAfter: 1900, type: "compact",
      branch: { choice: "pressure-memory", option: "keep" },
      narration: "I lost work, and now I have to compact anyway. The forgetting was always going to happen.",
      summary: "8/14 files renamed — call-site detail summarized. Remaining: billing.ts, admin.ts, jobs/sync.ts, cli.ts, tests ×2" },
    { at: 51100, tokensAfter: 1950, type: "thought",
      text: "Working from my summary now — the details are gone. That's the trade." },
    { at: 54600, tokensAfter: 2000, type: "tool_call", id: "t6", tool: "edit",
      why: "the summary holds everything I still need",
      input: "billing.ts, admin.ts, jobs/sync.ts — 9 call sites" },
    { at: 58800, tokensAfter: 2900, type: "tool_result", callId: "t6", ok: true, output: "renamed (11/14)" },
    { at: 61600, tokensAfter: 2950, type: "tool_call", id: "t7", tool: "edit",
      input: "cli.ts + tests — 12 call sites" },
    { at: 65800, tokensAfter: 3800, type: "tool_result", callId: "t7", ok: true, output: "renamed (14/14)",
      narration: "All fourteen done, on a fraction of the memory." },
    { at: 67900, tokensAfter: 3810, type: "step_done", planId: "p1", step: 1 },
    { at: 68600, tokensAfter: 3820, type: "step_active", planId: "p1", step: 2 },
    { at: 70000, tokensAfter: 3870, type: "tool_call", id: "t8", tool: "edit",
      why: "the exports carry the old name too",
      input: "index.ts — export fetchUser" },
    { at: 72800, tokensAfter: 4100, type: "tool_result", callId: "t8", ok: true, output: "barrel updated" },
    { at: 74200, tokensAfter: 4110, type: "step_done", planId: "p1", step: 2 },
    { at: 74900, tokensAfter: 4120, type: "step_active", planId: "p1", step: 3 },
    { at: 76300, tokensAfter: 4170, type: "tool_call", id: "t9", tool: "bash",
      narration: "Last step: prove the build still works.",
      input: "tsc --noEmit && npm test" },
    { at: 81900, tokensAfter: 4800, type: "tool_result", callId: "t9", ok: true, output: "0 errors, 47 passed",
      narration: "Everything passes. The rename is real." },
    { at: 84000, tokensAfter: 4810, type: "step_done", planId: "p1", step: 3 },
    { at: 87500, tokensAfter: 4850, type: "done", verdict: "long tasks are won by forgetting well",
      narration: "All fourteen done. I only had room to finish because I compacted.",
      takeaway: [
        "Memory is finite — everything I read or edit stays until I drop it.",
        "Compacting traded finished detail for room to keep working.",
        "Keeping everything hits the wall mid-edit and loses work.",
      ] },
  ],
};
