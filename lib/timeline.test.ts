import { test } from "node:test";
import assert from "node:assert/strict";
import { stateAt } from "./timeline.ts";
import { loop } from "../data/loop.ts";
import { recovery } from "../data/recovery.ts";
import { pressure } from "../data/pressure.ts";

test("t=0: plan visible, nothing else", () => {
  const s = stateAt(loop, 0);
  assert.equal(s.plans.length, 1);
  assert.equal(s.blocks.length, 0);
  assert.equal(s.tokens, 600);
  assert.equal(s.done, null);
});

test("mid-run: tool call resolves, steps progress", () => {
  const s = stateAt(loop, 13500);
  const t2 = s.blocks.find((b) => b.kind === "tool" && b.id === "t2");
  assert.ok(t2 && t2.kind === "tool" && !t2.pending && t2.ok);
  assert.equal(s.plans[0].status[0], "done");
  assert.equal(s.plans[0].status[1], "active");
});

test("pending tool call before its result arrives", () => {
  const s = stateAt(loop, 5000); // t1 called at 4000, result at 6500
  const t1 = s.blocks.find((b) => b.kind === "tool" && b.id === "t1");
  assert.ok(t1 && t1.kind === "tool" && t1.pending);
});

test("recovery: plan A dies, plan B replaces it", () => {
  const before = stateAt(recovery, 28000);
  assert.equal(before.plans.length, 1);
  assert.equal(before.plans[0].deadAt, undefined);

  const after = stateAt(recovery, 32500);
  assert.equal(after.plans.length, 2);
  assert.equal(after.plans[0].deadAt, 29000);
  assert.equal(after.plans[0].deadReason, "built on a misread symptom");
  assert.equal(after.plans[1].deadAt, undefined);
});

test("recovery: ends done with verdict", () => {
  const s = stateAt(recovery, recovery.durationMs);
  assert.equal(s.done, "recovery means distrusting your plan");
  assert.ok(s.plans[1].status.every((st) => st === "done"));
});

test("pressure: compaction absorbs prior blocks and drops tokens", () => {
  const before = stateAt(pressure, 33500);
  assert.equal(before.tokens, 6900);
  assert.ok(
    before.blocks.every(
      (b) =>
        (b.kind !== "thought" && b.kind !== "tool") || b.absorbedAt === undefined,
    ),
  );

  const after = stateAt(pressure, 35500);
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
  const a = JSON.stringify(stateAt(recovery, 31000));
  stateAt(recovery, recovery.durationMs); // jump to end
  const b = JSON.stringify(stateAt(recovery, 31000)); // jump back
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
  assert.equal(s.plans[0].deadAt, 29000);
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
  const live = stateAt(recovery, 22000);
  const q = live.blocks.find((b) => b.kind === "choice");
  assert.ok(q && q.kind === "choice");
  assert.equal(q.picked, undefined);

  const answered = stateAt(recovery, 22000, { "recovery-pivot": "logs" });
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
  const a = JSON.stringify(stateAt(pressure, 40000, pick));
  stateAt(pressure, pressure.durationMs); // default path, end
  stateAt(pressure, 5000, pick); // early
  const b = JSON.stringify(stateAt(pressure, 40000, pick));
  assert.equal(a, b);
});

test("tokens never exceed context budget in any script", () => {
  for (const sc of [loop, recovery, pressure]) {
    for (const e of sc.events) {
      assert.ok(e.tokensAfter <= 8000, `${sc.id} at ${e.at}: ${e.tokensAfter}`);
    }
  }
});

test("event timestamps are monotonic and within duration", () => {
  for (const sc of [loop, recovery, pressure]) {
    let prev = -1;
    for (const e of sc.events) {
      assert.ok(e.at >= prev, `${sc.id}: ${e.at} after ${prev}`);
      assert.ok(e.at <= sc.durationMs);
      prev = e.at;
    }
  }
});

test("every branch tag names a real choice and option", () => {
  for (const sc of [loop, recovery, pressure]) {
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
