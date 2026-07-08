import { test } from "node:test";
import assert from "node:assert/strict";
import { beats, branchLabels } from "./transcript.ts";
import { loop } from "../data/loop.ts";
import { recovery } from "../data/recovery.ts";
import { pressure } from "../data/pressure.ts";
import { fridge } from "../data/fridge.ts";
import { productive } from "../data/productive.ts";
import { apartments } from "../data/apartments.ts";

const all = [loop, recovery, pressure, fridge, productive, apartments];

// The transcript pages promise the whole hand-written script on the page.
// These tests hold that promise against the data: nothing may fall
// through the grouping.

test("beats account for every transcript event exactly once", () => {
  for (const s of all) {
    const content = s.events.filter(
      (e) => e.type !== "step_active" && e.type !== "step_done",
    );
    const seen: unknown[] = [];
    for (const b of beats(s.events)) {
      if (b.kind === "event") seen.push(b.e);
      else seen.push(...b.calls, ...b.results);
    }
    assert.equal(seen.length, content.length, s.id);
    assert.equal(new Set(seen).size, content.length, s.id);
  }
});

test("every call beat carries evidence: no orphan calls or results", () => {
  for (const s of all) {
    for (const b of beats(s.events)) {
      if (b.kind !== "call") continue;
      const id = b.calls[0].id;
      assert.ok(b.calls.length >= 1, `${s.id}: ${id}`);
      assert.ok(b.results.length >= 1, `${s.id}: ${id} has no result`);
      // twins share the id and split by branch option — never duplicates
      if (b.calls.length > 1) {
        const options = b.calls.map((c) => c.branch?.option);
        assert.ok(options.every(Boolean), `${s.id}: ${id} untagged twin`);
        assert.equal(new Set(options).size, b.calls.length, `${s.id}: ${id}`);
      }
      if (b.results.length > 1) {
        const options = b.results.map((r) => r.branch?.option);
        assert.ok(options.every(Boolean), `${s.id}: ${id} untagged result`);
        assert.equal(new Set(options).size, b.results.length, `${s.id}: ${id}`);
      }
    }
  }
});

test("every branch tag resolves to a declared option's label", () => {
  for (const s of all) {
    const labels = branchLabels(s.events);
    for (const e of s.events) {
      if (!e.branch) continue;
      assert.ok(
        labels.has(`${e.branch.choice}:${e.branch.option}`),
        `${s.id}: ${e.branch.choice}:${e.branch.option}`,
      );
    }
  }
});
