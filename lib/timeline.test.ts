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
  const s = stateAt(loop, 12000);
  const t2 = s.blocks.find((b) => b.kind === "tool" && b.id === "t2");
  assert.ok(t2 && t2.kind === "tool" && !t2.pending && t2.ok);
  assert.equal(s.plans[0].status[0], "done");
  assert.equal(s.plans[0].status[1], "active");
});

test("pending tool call before its result arrives", () => {
  const s = stateAt(loop, 3000); // t1 called at 2500, result at 5000
  const t1 = s.blocks.find((b) => b.kind === "tool" && b.id === "t1");
  assert.ok(t1 && t1.kind === "tool" && t1.pending);
});

test("recovery: plan A dies, plan B replaces it", () => {
  const before = stateAt(recovery, 24000);
  assert.equal(before.plans.length, 1);
  assert.equal(before.plans[0].deadAt, undefined);

  const after = stateAt(recovery, 28000);
  assert.equal(after.plans.length, 2);
  assert.equal(after.plans[0].deadAt, 24500);
  assert.equal(after.plans[0].deadReason, "built on a misread symptom");
  assert.equal(after.plans[1].deadAt, undefined);
});

test("recovery: ends done with verdict", () => {
  const s = stateAt(recovery, recovery.durationMs);
  assert.equal(s.done, "recovery means distrusting your plan");
  assert.ok(s.plans[1].status.every((st) => st === "done"));
});

test("pressure: compaction absorbs prior blocks and drops tokens", () => {
  const before = stateAt(pressure, 28000);
  assert.equal(before.tokens, 6800);
  assert.ok(
    before.blocks.every(
      (b) =>
        (b.kind !== "thought" && b.kind !== "tool") || b.absorbedAt === undefined,
    ),
  );

  const after = stateAt(pressure, 30000);
  assert.equal(after.tokens, 1900);
  assert.equal(after.tokensPrev, 6800);
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
  stateAt(recovery, 58000); // jump to end
  const b = JSON.stringify(stateAt(recovery, 31000)); // jump back
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
