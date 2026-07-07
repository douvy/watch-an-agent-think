import { test } from "node:test";
import assert from "node:assert/strict";
import { stateAt, isChapterBeat } from "./timeline.ts";
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
  assert.equal(s.done, "when memory fills up, summarize and keep going");
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

// The pacing contract, dwell edition: playback parks the world at every
// narrated chapter beat for words × 300ms (see Player's clock), so a line's
// reading time no longer depends on timeline gaps — it depends on its own
// length. The cap keeps any single freeze under six seconds; past that the
// pause reads as a hang, not a beat. Choice beats park on the reader's own
// patience and done ends the clock, but the same cap keeps their register.
test("every marquee line fits its dwell", () => {
  const MAX_WORDS = 20;
  const words = (s: string) => s.split(/\s+/).filter((w) => /\w/.test(w)).length;
  for (const sc of all) {
    for (const e of sc.events) {
      if (!e.narration || !isChapterBeat(e)) continue;
      assert.ok(
        words(e.narration) <= MAX_WORDS,
        `${sc.id} @${e.at} "${e.narration}" runs ${words(e.narration)} words`,
      );
    }
  }
});

// The marquee is the documentary voiceover: it speaks exactly when the
// chapter strip advances, and is silent between chapters — those beats
// belong to the transcript. So every chapter turn must carry a line, and
// thoughts must never narrate (the thought text IS the transcript line;
// narrating it too is reading the same sentence in two places).
test("the marquee speaks at every chapter turn and only there", () => {
  for (const sc of all) {
    for (const e of sc.events) {
      if (isChapterBeat(e)) {
        assert.ok(e.narration, `${sc.id} at ${e.at}: silent chapter turn (${e.type})`);
      }
      if (e.type === "thought") {
        assert.ok(!e.narration, `${sc.id} at ${e.at}: thought carries dead narration`);
      }
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

// One voice per beat: a tool call's caption shows its narration or its
// why, never both — carrying both means one line is dead weight. Sole
// exception: the beat right after a gate may carry both, because the
// first-action contract below still wants its why in the data even when
// the pick-acknowledgment narration wins the caption.
test("action beats speak with one voice", () => {
  for (const sc of all) {
    const gates = sc.events.filter((e) => e.type === "choice");
    for (const e of sc.events) {
      if (e.type !== "tool_call" || !e.narration || !e.why) continue;
      const afterGate = gates.some((g) => e.at > g.at && e.at - g.at <= 2800);
      assert.ok(afterGate, `${sc.id} at ${e.at}: narration and why on one beat`);
    }
  }
});

// The educational close: every run must end with a recap — two or three
// concrete lines pointing back at things the reader just watched, so the
// verdict lands as reasoning, not a slogan. Lines stay caption-short.
test("every run ends with a short, concrete takeaway", () => {
  for (const sc of all) {
    const done = sc.events.find((e) => e.type === "done");
    assert.ok(done && done.type === "done" && done.takeaway, `${sc.id}: no takeaway`);
    assert.ok(
      done.takeaway.length >= 2 && done.takeaway.length <= 3,
      `${sc.id}: ${done.takeaway.length} takeaway lines`,
    );
    for (const t of done.takeaway) {
      assert.ok(t.length <= 72, `${sc.id}: takeaway runs long — "${t}"`);
    }
  }
});

// The vocabulary promise, enforced: the README and curriculum promise the
// viewer walks away owning the words, and rule 3 (show the thing, then
// name it) means each run must literally say its terms. Run 2 promises no
// new vocab — its lesson is a mechanic, not a word — so it has no row.
// Terms live in narrations and thoughts; branches may duplicate them, but
// every twin's script must contain each of its terms somewhere.
test("every run names the vocabulary it promises", () => {
  const promises = [
    [[loop, fridge], ["agentic loop", "hallucination"]],
    [[pressure, apartments], ["context window", "compacting"]],
  ] as const;
  for (const [runs, terms] of promises) {
    for (const sc of runs) {
      const text = JSON.stringify(sc.events).toLowerCase();
      for (const term of terms) {
        assert.ok(text.includes(term), `${sc.id} never says "${term}"`);
      }
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
