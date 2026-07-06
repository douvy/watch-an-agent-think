import { test } from "node:test";
import assert from "node:assert/strict";
import { stateAt, eventActive, resolveChoices } from "./timeline.ts";
import { loop } from "../data/loop.ts";
import { recovery } from "../data/recovery.ts";
import { pressure } from "../data/pressure.ts";
import { fridge } from "../data/fridge.ts";
import { productive } from "../data/productive.ts";
import { apartments } from "../data/apartments.ts";

const all = [loop, recovery, pressure, fridge, productive, apartments];

test("t=0: plan visible, nothing else", () => {
  const s = stateAt(loop, 0);
  assert.equal(s.plans.length, 1);
  assert.equal(s.blocks.length, 0);
  assert.equal(s.tokens, 600);
  assert.equal(s.done, null);
});

test("mid-run: tool call resolves, steps progress", () => {
  const s = stateAt(loop, 18900);
  const t2 = s.blocks.find((b) => b.kind === "tool" && b.id === "t2");
  assert.ok(t2 && t2.kind === "tool" && !t2.pending && t2.ok);
  assert.equal(s.plans[0].status[0], "done");
  assert.equal(s.plans[0].status[1], "active");
});

test("pending tool call before its result arrives", () => {
  const s = stateAt(loop, 7000); // t1 called at 5600, result at 9100
  const t1 = s.blocks.find((b) => b.kind === "tool" && b.id === "t1");
  assert.ok(t1 && t1.kind === "tool" && t1.pending);
});

test("recovery: plan A dies, plan B replaces it", () => {
  const before = stateAt(recovery, 39000);
  assert.equal(before.plans.length, 1);
  assert.equal(before.plans[0].deadAt, undefined);

  const after = stateAt(recovery, 45500);
  assert.equal(after.plans.length, 2);
  assert.equal(after.plans[0].deadAt, 40600);
  assert.equal(after.plans[0].deadReason, "built on a misread symptom");
  assert.equal(after.plans[1].deadAt, undefined);
});

test("recovery: ends done with verdict", () => {
  const s = stateAt(recovery, recovery.durationMs);
  assert.equal(s.done, "recovery means distrusting your plan");
  assert.ok(s.plans[1].status.every((st) => st === "done"));
});

test("pressure: compaction absorbs prior blocks and drops tokens", () => {
  const before = stateAt(pressure, 46500);
  assert.equal(before.tokens, 6900);
  assert.ok(
    before.blocks.every(
      (b) =>
        (b.kind !== "thought" && b.kind !== "tool") || b.absorbedAt === undefined,
    ),
  );

  const after = stateAt(pressure, 48500);
  assert.equal(after.tokens, 1900);
  assert.equal(after.tokensPrev, 6900);
  const compactBlock = after.blocks.find((b) => b.kind === "compact");
  assert.ok(compactBlock);
  const live = after.blocks.filter(
    (b) =>
      (b.kind === "thought" || b.kind === "tool") && b.absorbedAt === undefined,
  );
  assert.equal(live.length, 0);
});

test("scrubbing backward is free: same ms, same state", () => {
  const a = JSON.stringify(stateAt(recovery, 43000));
  stateAt(recovery, recovery.durationMs); // jump to end
  const b = JSON.stringify(stateAt(recovery, 43000)); // jump back
  assert.equal(a, b);
});

test("unanswered choice resolves to the first option", () => {
  // recovery's canonical path is "reproduce" — the logs branch (t10) never fires
  const s = stateAt(recovery, recovery.durationMs);
  assert.ok(!s.blocks.some((b) => b.kind === "tool" && b.id === "t10"));
  assert.equal(s.done, "recovery means distrusting your plan");
});

test("picking the other branch fires its beats — and rejoins the spine", () => {
  const s = stateAt(recovery, recovery.durationMs, { "recovery-pivot": "logs" });
  const t10 = s.blocks.find((b) => b.kind === "tool" && b.id === "t10");
  assert.ok(t10 && t10.kind === "tool" && !t10.pending && t10.ok);
  // both paths end at the identical verdict
  assert.equal(s.done, "recovery means distrusting your plan");
  assert.equal(s.plans[0].deadAt, 40600);
});

test("loop: the offbyone branch swaps the evidence end-to-end", () => {
  const s = stateAt(loop, loop.durationMs, { "loop-bug": "offbyone" });
  // branched results share callIds with the date path — exactly one fires
  const t1 = s.blocks.find((b) => b.kind === "tool" && b.id === "t1");
  assert.ok(t1 && t1.kind === "tool" && !t1.pending && t1.ok === false);
  assert.match(t1.output ?? "", /paginate/);
  const t3 = s.blocks.find((b) => b.kind === "tool" && b.id === "t3");
  assert.ok(t3 && t3.kind === "tool" && !t3.pending && t3.ok);
  assert.match(t3.output ?? "", /slice/);
  // same spine either way: full plan done, same verdict
  assert.equal(s.done, "think → act → observe → repeat");
  assert.ok(s.plans[0].status.every((st) => st === "done"));
  // and the default path shows the date evidence instead
  const d = stateAt(loop, loop.durationMs);
  const d1 = d.blocks.find((b) => b.kind === "tool" && b.id === "t1");
  assert.ok(d1 && d1.kind === "tool");
  assert.match(d1.output ?? "", /Invalid Date/);
});

test("choice block is pending until the reader answers", () => {
  const live = stateAt(recovery, 30800);
  const q = live.blocks.find((b) => b.kind === "choice");
  assert.ok(q && q.kind === "choice");
  assert.equal(q.picked, undefined);

  const answered = stateAt(recovery, 30800, { "recovery-pivot": "logs" });
  const qa = answered.blocks.find((b) => b.kind === "choice");
  assert.ok(qa && qa.kind === "choice");
  assert.equal(qa.picked, "logs");
});

test("pressure keep path: the overflow fails, then both paths compact", () => {
  const s = stateAt(pressure, pressure.durationMs, { "pressure-memory": "keep" });
  const wall = s.blocks.find((b) => b.kind === "tool" && b.id === "t10");
  assert.ok(wall && wall.kind === "tool" && wall.ok === false);
  assert.ok(s.blocks.some((b) => b.kind === "compact"));
  assert.equal(s.done, "long tasks are won by forgetting well");
});

test("choices are pure: same (ms, choices), same state", () => {
  const pick = { "pressure-memory": "keep" };
  const a = JSON.stringify(stateAt(pressure, 56000, pick));
  stateAt(pressure, pressure.durationMs); // default path, end
  stateAt(pressure, 7000, pick); // early
  const b = JSON.stringify(stateAt(pressure, 56000, pick));
  assert.equal(a, b);
});

test("tokens never exceed context budget in any script", () => {
  for (const sc of all) {
    for (const e of sc.events) {
      assert.ok(e.tokensAfter <= 8000, `${sc.id} at ${e.at}: ${e.tokensAfter}`);
    }
  }
});

test("event timestamps are monotonic and within duration", () => {
  for (const sc of all) {
    let prev = -1;
    for (const e of sc.events) {
      assert.ok(e.at >= prev, `${sc.id}: ${e.at} after ${prev}`);
      assert.ok(e.at <= sc.durationMs);
      prev = e.at;
    }
  }
});

// The pacing contract: a storyteller line must live long enough to read
// (~250wpm) before the next line replaces it. "Feels too fast" becomes a
// named beat, not a vibe — and every future scenario inherits the meter.
// Choice beats park the clock, so their lines get the reader's own patience.
test("every narration line lives long enough to read", () => {
  const MS_PER_WORD = 240;
  const words = (s: string) => s.split(/\s+/).filter((w) => /\w/.test(w)).length;
  for (const sc of all) {
    const gates = sc.events.filter((e) => e.type === "choice");
    // one path per option — each covers the full spine plus one branch.
    // Gate-less scripts (the everyday track) still get their one path.
    const paths = gates.length
      ? gates.flatMap((g) =>
          g.type === "choice" ? g.options.map((o) => ({ [g.choiceId]: o.id })) : [],
        )
      : [{} as Record<string, string>];
    for (const picks of paths) {
      const resolved = resolveChoices(sc, picks);
      const lines = sc.events.filter((e) => e.narration && eventActive(e, resolved));
      lines.forEach((e, i) => {
        if (e.type === "choice") return; // the clock parks here
        const lives = (lines[i + 1]?.at ?? sc.durationMs) - e.at;
        const needs = words(e.narration!) * MS_PER_WORD;
        assert.ok(
          lives >= needs,
          `${sc.id}(${Object.values(picks)}) @${e.at} "${e.narration}" lives ${lives}ms, needs ${needs}ms`,
        );
      });
    }
  }
});

// The everyday track's contract: one gate per run, same verdicts as its
// code twin — the lesson is the constant, only the material changes, and
// both answers to the gate land on the same verdict.
test("everyday runs mirror their code twins: one gate, same verdicts", () => {
  const twins = [
    [fridge, loop],
    [productive, recovery],
    [apartments, pressure],
  ] as const;
  for (const [everyday, code] of twins) {
    assert.equal(everyday.events.filter((e) => e.type === "choice").length, 1);
    assert.equal(everyday.lesson, code.lesson);
    const s = stateAt(everyday, everyday.durationMs);
    assert.equal(s.done, everyday.lesson);
    const q = everyday.events.find((e) => e.type === "choice");
    assert.ok(q && q.type === "choice");
    const alt = stateAt(everyday, everyday.durationMs, {
      [q.choiceId]: q.options[1].id,
    });
    assert.equal(alt.done, everyday.lesson);
  }
});

// The transcript's second voice: tool calls may carry a `why` — the agent's
// stated reason for reaching for that tool. Whys read as annotations, so
// they stay one-breath short; and every run's first action opens with one,
// so the decision → action → evidence rhythm is set from the top.
test("whys are one-breath short and every run opens with one", () => {
  for (const sc of all) {
    const calls = sc.events.filter((e) => e.type === "tool_call");
    assert.ok(
      calls[0].type === "tool_call" && calls[0].why,
      `${sc.id}: first tool call carries no why`,
    );
    for (const c of calls) {
      if (c.type !== "tool_call" || !c.why) continue;
      assert.ok(c.why.length <= 72, `${sc.id} at ${c.at}: why runs long`);
    }
  }
});

test("every branch tag names a real choice and option", () => {
  for (const sc of all) {
    for (const e of sc.events) {
      if (!e.branch) continue;
      const q = sc.events.find(
        (c) => c.type === "choice" && c.choiceId === e.branch!.choice,
      );
      assert.ok(q && q.type === "choice", `${sc.id} at ${e.at}: unknown choice`);
      assert.ok(
        q.options.some((o) => o.id === e.branch!.option),
        `${sc.id} at ${e.at}: unknown option ${e.branch.option}`,
      );
      assert.ok(e.at > q.at, `${sc.id} at ${e.at}: branch beat before its choice`);
    }
  }
});
