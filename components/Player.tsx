"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Check,
  Play,
  Pause,
  RotateCcw,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import { scenarioSets, type Mode } from "@/data";
import { Creature, CreatureTriumph } from "@/components/Creature";
import { FinaleBurst } from "@/components/FinaleBurst";
import { Plan } from "@/components/Plan";
import { Scrubber } from "@/components/Scrubber";
import { StreamBlock } from "@/components/StreamBlock";
import { chirp, ratchet, unlock } from "@/lib/sound";
import { clamp01, enterStyle, gentle, reducedMotion, settle } from "@/lib/anim";
import {
  stateAt,
  resolveChoices,
  eventActive,
  isChapterBeat,
  CONTEXT_BUDGET,
  type Block,
  type Choices,
  type Scenario,
} from "@/lib/timeline";

// Each run's character, forecast as a tab dot in the palette the player
// already teaches: mint = clean, orange = a plan dies, yellow = memory
// pressure. Derived from the script, not hand-tagged.
function runDot(scenario: Scenario): string {
  if (scenario.events.some((e) => e.type === "plan_dead")) return "bg-accent-negative";
  if (scenario.events.some((e) => e.type === "compact")) return "bg-warning";
  return "bg-accent";
}

// Decision beats: the run plays continuously, but a `choice` event parks
// the clock at its settle point (at + HOLD_MS) and waits on the reader.
// Their pick flips branch-tagged beats on; everything downstream is a pure
// function of (scenario, ms, choices). An unanswered question is a hard
// wall — no input moves time past it. Answered ones never wall again, so
// replays run free.
const HOLD_MS = 800;

// The done card staggers its verdict and takeaway in over ~2s; the closing
// narration waits for the card to finish, so even the last read is a
// sequential handoff — card settles, then the header speaks.
const DONE_SETTLE_MS = 2200;

// Branch-rewrite choreography (wall-clock, one-shot): flipping an answered
// choice while paused doesn't blink the new future in — the old one
// unravels bottom-up back toward the choice, the new one cascades top-down,
// and the memory gauge re-springs last. Any input cancels straight to the
// pure state; playing or prefers-reduced-motion skips it entirely.
const REWRITE = {
  hold: 100, // chip flips, a beat of stillness
  exitStagger: 40, // old future unravels bottom-up
  enterAt: 300, // new future starts cascading top-down
  enterStagger: 40,
  gaugeAt: 550, // memory is the last thing the rewrite touches
  total: 950,
};

// Chapters derive from the script — the beats worth jumping to. Only the
// reader's current path counts; the other branch's beats don't exist here.
function chaptersOf(
  scenario: Scenario,
  resolved: Choices,
): { at: number; label: string }[] {
  const out: { at: number; label: string }[] = [];
  for (const e of scenario.events) {
    if (!eventActive(e, resolved)) continue;
    if (e.type === "plan") out.push({ at: e.at, label: out.length ? "replan" : "plan" });
    else if (e.type === "plan_dead") out.push({ at: e.at, label: "plan dies" });
    else if (e.type === "compact") out.push({ at: e.at, label: "compact" });
    else if (e.type === "choice") out.push({ at: e.at, label: "decision" });
    else if (e.type === "tool_result" && !e.ok) out.push({ at: e.at, label: "setback" });
    else if (e.type === "done") out.push({ at: e.at, label: "done" });
  }
  return out;
}

// The active chapter's number speaks the beat's own color — the same
// palette the tab dots and mascot already teach. Quiet beats stay mint.
const CHAPTER_TONES: Record<string, string> = {
  setback: "text-accent-negative",
  "plan dies": "text-accent-negative",
  compact: "text-warning",
  decision: "text-human",
};

// Narration — the documentary voiceover, in the mascot's first-person
// voice. It speaks only at chapter turns, and only at the beat's settle
// point (at + HOLD_MS) — after the transcript block has landed and gone
// still, which is exactly when the dwell parks the clock. The strict
// handoff: the terminal moves, then freezes, then the header speaks into
// the silence. At no instant are both surfaces changing — the reader is
// never asked to read two places at once. A line persists until the next
// chapter replaces it; everything between chapters speaks as
// face-captions inside the transcript. Pure f(ms), so scrubbing rewrites
// it like captions.
// Fact 0, in the mascot's voice. "Press play" is the whole CTA — the h1
// already promises the watching, so the tail would only echo it.
const INTRO_NARRATION =
  "I'm an AI agent — an AI in a loop with tools. Press play.";

function narrationOf(
  scenario: Scenario,
  ms: number,
  resolved: Choices,
): { at: number; text: string } {
  let out = { at: 0, text: INTRO_NARRATION };
  for (const e of scenario.events) {
    const settleAt = Math.min(
      e.at + (e.type === "done" ? DONE_SETTLE_MS : HOLD_MS),
      scenario.durationMs,
    );
    if (settleAt > ms) break;
    if (e.narration && isChapterBeat(e) && eventActive(e, resolved))
      out = { at: settleAt, text: e.narration };
  }
  return out;
}

export function Player() {
  // Two tracks, one machine: `mode` swaps which trilogy the tabs hold.
  // Everyday is the default — the broadest audience lands soft; coders
  // are one click away. Precedence at load is URL > stored > default
  // (see the mount effect); the toggle writes the preference. Everything
  // downstream — tabs, deep links, watched stamps — reads the current set.
  const [mode, setMode] = useState<Mode>("everyday");
  // First-visit invitation on the toggle — cleared the moment the reader
  // uses it (which also stores their preference, so it never re-appears).
  const [modeHint, setModeHint] = useState(false);
  const scenarios = scenarioSets[mode];
  const [idx, setIdx] = useState(0);
  const [ms, setMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  // The reader's picks. Everything on screen is stateAt(scenario, ms, choices)
  // — flipping a pick rewrites all downstream state instantly, for free.
  const [choices, setChoices] = useState<Choices>({});
  // Branch-rewrite in flight: the outgoing future, captured at the flip so
  // it can unravel while the new one cascades in. rewriteT is wall-clock ms
  // since the flip. Null = pure state, no wrappers, no cost.
  const [rewrite, setRewrite] = useState<{
    prevBlocks: Block[];
    prevTokens: number;
  } | null>(null);
  const [rewriteT, setRewriteT] = useState(0);
  // The mascot's voice — on by default. The AudioContext can't start
  // itself: unlock() runs inside the gestures that begin playback (play
  // button, tab select, the toggle), which is what iOS Safari requires.
  // Toggle lives in the status bar.
  const [sound, setSound] = useState(true);
  // Where the last ratchet comparison ended — a ref, not closure ms, so
  // several pointermoves inside one frame can't re-cross the same tick.
  const scrubRef = useRef(0);
  useEffect(() => {
    scrubRef.current = ms;
  }, [ms]);
  // Which runs this reader has seen through to done — session memory for
  // the tab ticks, so the trilogy reads as collectible. Meta-state like the
  // sound toggle, deliberately outside the pure (ms, choices) world.
  // Keyed by scenario id, not index — progress survives a mode flip and
  // the two tracks never collide.
  const [watched, setWatched] = useState<string[]>([]);
  // The current set is complete — the ticks' promised payoff.
  const trilogy = scenarios.every((sc) => watched.includes(sc.id));
  const scenario = scenarios[idx];
  const resolved = useMemo(() => resolveChoices(scenario, choices), [scenario, choices]);
  const state = useMemo(() => stateAt(scenario, ms, choices), [scenario, ms, choices]);
  const chapters = useMemo(() => chaptersOf(scenario, resolved), [scenario, resolved]);
  const narration = useMemo(
    () => narrationOf(scenario, ms, resolved),
    [scenario, ms, resolved],
  );
  // Only the reader's path exists on the strip and in the counters — the
  // other branch's events don't tick, don't count.
  const activeEvents = useMemo(
    () => scenario.events.filter((e) => eventActive(e, resolved)),
    [scenario, resolved],
  );
  const firedCount = useMemo(
    () => activeEvents.filter((e) => e.at <= ms).length,
    [activeEvents, ms],
  );
  // The stream under rewrite: a union of the outgoing future (exit delays
  // bottom-up — the timeline unravels back toward the choice) and the
  // incoming one (enter delays top-down), interleaved by timestamp so each
  // exit collapses exactly where its replacement grows. Choice cards are
  // matched by id — the reader's marks never exit. Long-absorbed blocks are
  // skipped: they render null and would only stretch the wave.
  const streamItems = useMemo(() => {
    const items: {
      key: string;
      block: Block;
      exitDelay?: number;
      enterDelay?: number;
    }[] = state.blocks.map((b, i) => ({ key: `${b.kind}-${b.at}-${i}`, block: b }));
    if (!rewrite) return items;
    const sig = (b: Block) =>
      b.kind === "choice" ? `choice:${b.choiceId}` : JSON.stringify(b);
    const gone = (b: Block) =>
      (b.kind === "thought" || b.kind === "tool") &&
      b.absorbedAt !== undefined &&
      ms - b.absorbedAt > 1000;
    const newSigs = new Set(state.blocks.map(sig));
    const oldSigs = new Set(rewrite.prevBlocks.map(sig));
    const exiting = rewrite.prevBlocks.filter((b) => !newSigs.has(sig(b)) && !gone(b));
    const entering = state.blocks.filter((b) => !oldSigs.has(sig(b)) && !gone(b));
    exiting.forEach((b, i) => {
      items.push({
        key: `x-${b.kind}-${b.at}-${i}`,
        block: b,
        exitDelay: REWRITE.hold + (exiting.length - 1 - i) * REWRITE.exitStagger,
      });
    });
    const enterDelays = new Map(
      entering.map((b, i) => [b, REWRITE.enterAt + i * REWRITE.enterStagger] as const),
    );
    for (const it of items) {
      const d = enterDelays.get(it.block);
      if (d !== undefined) it.enterDelay = d;
    }
    items.sort(
      (a, b) =>
        a.block.at - b.block.at ||
        (a.exitDelay !== undefined ? 0 : 1) - (b.exitDelay !== undefined ? 0 : 1),
    );
    return items;
  }, [state.blocks, rewrite, ms]);
  const streamRef = useRef<HTMLDivElement>(null);
  const ended = ms >= scenario.durationMs;
  // A question is live and unanswered — it's the reader's turn. The chrome
  // flips to the human's cream so the handoff is unmissable.
  const yourCall =
    !ended && state.blocks.some((b) => b.kind === "choice" && b.picked === undefined);
  // Cover frame: every scenario plans at t=0, so without this the opener
  // would be overwritten before anyone reads it. Until first play, the
  // storyteller introduces itself instead.
  const pristine = ms === 0 && !playing;
  const shownNarration = pristine ? { at: 0, text: INTRO_NARRATION } : narration;

  // Answering the live gate resumes the run — even if you scrubbed back a
  // touch first. Flipping an already-answered question rewrites history and
  // stays put — staged by the REWRITE choreography when paused, instant
  // while playing or under reduced motion.
  const pick = useCallback(
    (choiceId: string, option: string) => {
      const isGate = !(choiceId in choices);
      if (!isGate && choices[choiceId] === option) return;
      if (!isGate && !playing && !reducedMotion) {
        setRewrite({ prevBlocks: state.blocks, prevTokens: state.tokens });
        setRewriteT(0);
      }
      setChoices((c) => ({ ...c, [choiceId]: option }));
      if (!playing && isGate) setPlaying(true);
      if (sound) chirp("move"); // he acknowledges your pick
    },
    [playing, choices, state.blocks, state.tokens, sound],
  );

  // The earliest unanswered decision is a hard wall on the timeline: no
  // input — play, scrub, arrows, chapters, deep links — moves time past it
  // until the reader answers. Once answered it never walls again, so
  // replays and re-scrubs run free.
  const maxMs = useMemo(() => {
    for (const e of scenario.events) {
      if (e.type === "choice" && !(e.choiceId in choices)) {
        return Math.min(e.at + HOLD_MS, scenario.durationMs);
      }
    }
    return scenario.durationMs;
  }, [scenario, choices]);
  // Parked at the wall — the only way forward is answering.
  const blocked = ms >= maxMs && maxMs < scenario.durationMs;

  // Deep link in: ?s=2&t=34 lands on that scenario at that second, paused —
  // capped at the first decision, which the arriving reader must answer
  // themselves. URL params only exist client-side; a lazy initializer would
  // mismatch hydration, so this must be a mount effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    // Mode precedence: URL > stored preference > default everyday. A
    // shared ?mode=code link must land in code even for a reader whose
    // own preference is everyday.
    const um = p.get("mode");
    const stored = localStorage.getItem("watm-mode");
    const m: Mode =
      um === "everyday" || um === "code"
        ? um
        : stored === "everyday" || stored === "code"
          ? stored
          : "everyday";
    if (m !== "everyday") setMode(m);
    // no preference on record — the toggle wears its invitation
    if (m === "everyday" && !stored) setModeHint(true);
    const set = scenarioSets[m];
    const s = Number(p.get("s"));
    const si = s >= 1 && s <= set.length ? s - 1 : 0;
    if (si) setIdx(si);
    const t = Number(p.get("t"));
    if (t > 0) {
      const firstChoice = set[si].events.find((e) => e.type === "choice");
      const cap = firstChoice ? firstChoice.at + HOLD_MS : set[si].durationMs;
      setMs(Math.min(t * 1000, set[si].durationMs, cap));
    }
  }, []);

  // A run counts as watched once its verdict is on screen.
  useEffect(() => {
    if (state.done)
      setWatched((w) => (w.includes(scenario.id) ? w : [...w, scenario.id]));
  }, [state.done, scenario.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Deep link out: while paused, the URL captures the frame you're looking at.
  // Debounced — Safari throttles replaceState.
  useEffect(() => {
    if (playing) return;
    const timer = setTimeout(() => {
      const parts: string[] = [];
      if (mode === "code") parts.push("mode=code");
      if (ms > 0) parts.push(`s=${idx + 1}`, `t=${(ms / 1000).toFixed(1)}`);
      const url = parts.length ? `?${parts.join("&")}` : window.location.pathname;
      history.replaceState(null, "", url);
    }, 300);
    return () => clearTimeout(timer);
  }, [playing, ms, idx, mode]);

  // Playback clock — rAF advances ms; everything else derives from it.
  // Unanswered choices are gates: the clock parks at at + HOLD_MS (the
  // beat's settle point) and waits. Answering removes the gate, so the
  // effect re-arms with one fewer stop.
  //
  // Chapter dwells — motion always wins the eye, so exactly one text
  // surface may change at any instant. The handoff: the transcript block
  // lands and settles (header still shows the previous line), the clock
  // parks at at + HOLD_MS, and only then does the new line enter — the
  // sole moving thing on a frozen screen (narrationOf takes effect at the
  // settle point; its entrance is wall-clock CSS). The park lasts the
  // entrance plus the reading (400 + words × 300ms). Wall-clock only —
  // scrubbing never dwells, and ms-purity is untouched. Choices park via
  // gates; done ends the clock, so neither dwells.
  //
  // Thoughts dwell too, on their own text. They never reach the marquee,
  // so without the park a forty-word thought (fact 4 rides one) gets two
  // seconds before the next block takes the eye. Same formula: the words
  // set the wait.
  useEffect(() => {
    if (!playing) return;
    const gates = scenario.events
      .filter((e) => e.type === "choice" && !(e.choiceId in choices))
      .map((e) => Math.min(e.at + HOLD_MS, scenario.durationMs));
    const resolved = resolveChoices(scenario, choices);
    const dwells = scenario.events
      .filter(
        (e) =>
          (e.type === "thought" ||
            (e.narration &&
              isChapterBeat(e) &&
              e.type !== "choice" &&
              e.type !== "done")) &&
          eventActive(e, resolved),
      )
      .map((e) => {
        const read = e.type === "thought" ? e.text : e.narration!;
        return {
          at: Math.min(e.at + HOLD_MS, scenario.durationMs),
          wait: Math.max(
            1200,
            400 + read.split(/\s+/).filter((w) => /\w/.test(w)).length * 300,
          ),
        };
      });
    let dwellUntil = 0;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // rAF hands us the frame's vsync timestamp, which can precede the
      // performance.now() captured when scheduling — an unguarded negative
      // first dt would drive ms below zero (NaN pixel frames in the mascot).
      const dt = Math.max(0, now - last);
      last = now;
      if (now < dwellUntil) {
        raf = requestAnimationFrame(tick);
        return;
      }
      setMs((m) => {
        const next = m + dt;
        const gate = gates.find((g) => m < g && next >= g);
        if (gate !== undefined) {
          setPlaying(false);
          return gate;
        }
        const dwell = dwells.find((d) => m < d.at && next >= d.at);
        if (dwell) {
          dwellUntil = now + dwell.wait;
          return dwell.at;
        }
        if (next >= scenario.durationMs) {
          setPlaying(false);
          return scenario.durationMs;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, scenario, choices]);

  // Rewrite clock — a short wall-clock rAF that drives the unravel/cascade,
  // then hands back to the pure state and unmounts itself.
  useEffect(() => {
    if (!rewrite) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = now - start;
      if (t >= REWRITE.total) {
        setRewrite(null);
        setRewriteT(0);
        return;
      }
      setRewriteT(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rewrite]);

  // The mascot's footsteps: a chirp as each event lands — playback only,
  // never while scrubbing, only when the reader opted in. Simultaneous
  // events collapse into one frame, so at most one chirp per beat.
  const prevEventRef = useRef(-1);
  useEffect(() => {
    const prev = prevEventRef.current;
    prevEventRef.current = state.lastEventIndex;
    if (!sound || !playing || state.lastEventIndex <= prev) return;
    const e = scenario.events[state.lastEventIndex];
    if (!e) return;
    // step_active/step_done are bookkeeping — silent, or every beat
    // would double-chirp and the voice turns into a metronome
    if (e.type === "step_active" || e.type === "step_done") return;
    chirp(
      (e.type === "tool_result" && !e.ok) || e.type === "plan_dead"
        ? "fail"
        : e.type === "tool_result"
          ? "ok"
          : e.type === "choice"
            ? "ask"
            : e.type === "compact"
              ? "compact"
              : e.type === "done"
                ? // this done completes the trilogy — the 1-up gets an answer.
                  // `watched` here is still the pre-completion set: setWatched
                  // lands next render, where the lastEventIndex guard above
                  // keeps this from chirping twice.
                  scenarios.filter((sc) => watched.includes(sc.id)).length ===
                      scenarios.length - 1 && !watched.includes(scenario.id)
                  ? "fanfare"
                  : "done"
                : "move",
    );
  }, [state.lastEventIndex, sound, playing, scenario, scenarios, watched]);

  // Per-run session memory — editor-tab semantics: switching away parks a
  // run where you left it (position and picks); coming back restores it
  // paused instead of restarting. Only unvisited runs start fresh and play.
  // Replay is one click if you want the top. A ref, not state: it's only
  // read at switch time. Keyed by scenario id so both tracks share it.
  const parkedRef = useRef<Record<string, { ms: number; choices: Choices }>>({});
  const select = useCallback(
    (i: number, play = false) => {
      if (i === idx) return;
      if (sound) unlock(); // this tap is the audio-unlock gesture
      setRewrite(null);
      parkedRef.current[scenario.id] = { ms, choices };
      const parked = parkedRef.current[scenarios[i].id];
      setIdx(i);
      setMs(parked?.ms ?? 0);
      setChoices(parked?.choices ?? {});
      // a tab picks an episode, not play: fresh runs inherit your play
      // state (pre-play stays at the door), parked runs restore paused —
      // but the end-card's `play` is an explicit "roll the next one".
      setPlaying(play || (parked ? false : playing));
    },
    [idx, scenario.id, scenarios, ms, choices, sound, playing],
  );

  // The mode flip — same editor-tab semantics as select(), across sets:
  // park the current run, land on the other track's first tab, restore it
  // paused if visited, inherit the play state if fresh. Using the toggle
  // stores the preference and retires the first-visit hint.
  const switchMode = useCallback(
    (m: Mode) => {
      if (m === mode) return;
      if (sound) unlock();
      setRewrite(null);
      localStorage.setItem("watm-mode", m);
      setModeHint(false);
      parkedRef.current[scenario.id] = { ms, choices };
      const first = scenarioSets[m][0];
      const parked = parkedRef.current[first.id];
      setMode(m);
      setIdx(0);
      setMs(parked?.ms ?? 0);
      setChoices(parked?.choices ?? {});
      // the toggle picks a language, not play: a fresh track inherits your
      // play state (mid-play keeps momentum, pre-play stays at the door);
      // a parked track always restores paused for inspection.
      setPlaying(parked ? false : playing);
    },
    [mode, scenario.id, ms, choices, sound, playing],
  );

  // Keyboard: ←/→ scrub ±2s, space toggles play, 1-3 pick a run.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // never eat browser shortcuts — cmd+← is back, not scrub
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " ") {
        e.preventDefault();
        setRewrite(null);
        if (ms >= scenario.durationMs) {
          setMs(0);
          setPlaying(true);
        } else if (!blocked) {
          setPlaying((p) => !p);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setRewrite(null);
        setPlaying(false);
        setMs(Math.min(ms + 2000, maxMs));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setRewrite(null);
        setPlaying(false);
        setMs(Math.max(0, ms - 2000));
      } else {
        const n = Number(e.key);
        if (n >= 1 && n <= scenarios.length) select(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ms, playing, blocked, maxMs, scenario.durationMs, scenarios.length, select]);

  // Chat-style follow: the stream tracks the newest block while the reader
  // sits pinned near the bottom — playing, scrubbing, or mid-rewrite alike —
  // and lets go the moment they scroll up to read.
  const pinnedRef = useRef(true);
  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    const onScroll = () => {
      pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  // No dep array on purpose: any frame can change the stream's height
  // (playback, scrubbing, rewrite collapse), and following costs one
  // property set when nothing moved.
  useEffect(() => {
    const el = streamRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  });

  // Gauge: spring from tokensPrev toward tokens since the last event.
  // During a rewrite it holds the old reading, then re-springs to the new
  // one last — memory is the final thing the rewrite touches.
  const gaugeProgress = clamp01(settle(ms, state.lastEventAt, gentle));
  const displayTokens = rewrite
    ? Math.round(
        rewrite.prevTokens +
          (state.tokens - rewrite.prevTokens) *
            clamp01(settle(rewriteT, REWRITE.gaugeAt)),
      )
    : Math.round(state.tokensPrev + (state.tokens - state.tokensPrev) * gaugeProgress);
  // The opening gate's escape hatch — a reader parked at :03 who doesn't
  // care about this task has no visible exit unless they've found the
  // tabs, so the gate itself offers the other two runs. Mid-run gates
  // never get one: forty seconds in, the reader is invested, and an exit
  // there only invites leaving. Links use tab semantics (select), so the
  // abandoned run parks and play state carries over.
  const escapeFor = (b: Block) =>
    b.kind === "choice" && b.at < 10000
      ? scenarios
          .map((s, i) => ({ title: s.title, task: s.task, go: () => select(i) }))
          .filter((_, i) => i !== idx)
      : undefined;

  const pct = clamp01(displayTokens / CONTEXT_BUDGET);
  const gaugeColor =
    pct > 0.9 ? "bg-accent-negative" : pct > 0.75 ? "bg-warning" : "bg-accent";

  // "Watch the gauge" — a narration never names a surface without the
  // surface answering. Beats tagged cue: "memory" blink an accent frame
  // around the panel as the caption lands: three blinks, the same steps()
  // vocabulary as the red-zone bar. Pure f(ms), so scrubbing back through
  // the beat replays the wink; reduced motion holds the frame steady.
  let cueT = Infinity;
  for (const e of scenario.events) {
    if (e.at > ms) break;
    if (e.cue === "memory" && eventActive(e, resolved)) cueT = ms - e.at;
  }
  const cueOn =
    cueT < 2200 && (reducedMotion || Math.floor(cueT / 370) % 2 === 0);

  return (
    <>
      {/* Hero — live. The mascot and the narration line run off the same
          (scenario, ms) as the window below; the display type stays still. */}
      <header className="relative px-5 py-3 md:px-10 md:pt-4 md:pb-3">
        {/* the bottom rule runs full-bleed past the page rails — Zed's
            drafting-table grid: horizontal and vertical lines cross */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/2 h-px w-screen -translate-x-1/2 bg-[#1d1e22]"
        />
        {/* bordered pixel nodes on the crossings where the rule meets the
            walls — a size up from the outer-rail dots, page fill inside a
            1px gray border, like a rivet seated over the grid */}
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-[2px] -left-[2px] z-10 hidden h-[4px] w-[4px] border border-[#3a3f4a] bg-[#111318] md:block"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-[2px] -bottom-[2px] z-10 hidden h-[4px] w-[4px] border border-[#3a3f4a] bg-[#111318] md:block"
        />
        {/* the same nodes where this rule crosses the stitched outer
            rails — every intersection on the page gets the same rivet */}
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-[2px] z-10 hidden h-[4px] w-[4px] border border-[#3a3f4a] bg-[#111318] xl:block"
          style={{ left: "calc(-3rem - 3px)" }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-[2px] z-10 hidden h-[4px] w-[4px] border border-[#3a3f4a] bg-[#111318] xl:block"
          style={{ right: "calc(-3rem - 3px)" }}
        />
        {/* Masthead — serif italic, sentence case, natural tracking: an
            invitation in the storyteller's voice, Zed-headline style. The
            marquee below is still the biggest type; the brand stays quiet. */}
        <h1 className="text-center font-serif text-[18px] text-[#a9adb6] italic md:text-[20px]">
          Watch how an AI agent thinks
        </h1>
        {/* Syllabus line — the one static string on the page: names what
            the three tabs add up to, so the toy reads as a course. Never
            changes (the marquee below owns all moving words). The three
            items are Zed-style inline chips — mono on a mint tint, each
            wearing the same check the finale receipt pays off: the
            promise at the door, the receipt on the way out. */}
        <p className="mx-auto mt-1.5 flex max-w-lg flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[15px] tracking-tight text-muted md:max-w-none">
          Three things everyone should know about AI agents:
          {["how they work", "how they recover", "why they forget"].map(
            (t) => (
              <span
                key={t}
                className="flex items-center gap-1 rounded-[3px] bg-accent/10 px-1 py-0.5 font-mono text-xs text-header-text"
              >
                <Check
                  size={10}
                  strokeWidth={2}
                  className="text-accent opacity-80"
                />
                {t}
              </span>
            ),
          )}
        </p>

        {/* Live marquee — desktop only: on phones the storyteller folds
            into the window (see the mobile strip below the task bar), so
            narration and the stream it describes share one screen. The
            text column fills the space between the mascot and its twin,
            so the group's width never changes — no sliding as the line
            length changes, and long lines get the whole rail. */}
        <div className="mt-3 hidden items-center justify-center gap-3 md:flex">
          {/* trilogy done: the storyteller wears the finale card's crown —
              same rule as the card, only while parked at the end frame */}
          {state.done && trilogy ? (
            <CreatureTriumph size={56} />
          ) : (
            <Creature state={state} ms={ms} size={56} />
          )}
          {/* min-h reserves two lines so the layout doesn't bounce as the
              line wraps differently each beat */}
          {/* the marquee speaks mint in the agent's voice; when the question
              is the reader's, it speaks the human's cream */}
          {/* keyed on the text: the entrance is wall-clock CSS (see
              globals.css) because the line only ever changes while the
              clock is parked — f(ms) motion would freeze mid-fade */}
          <p
            key={shownNarration.text}
            className={`narrate-enter min-h-[2.6em] flex-1 text-center font-serif text-[17px] leading-snug md:min-h-[1.3em] md:text-[24px] ${
              yourCall ? "text-human" : "text-accent-light"
            }`}
          >
            {shownNarration.text}
          </p>
          {/* invisible twin of the mascot — balances the flex row so the
              text column (and the line within it) sits dead center */}
          <span aria-hidden className="hidden w-14 shrink-0 md:block" />
        </div>
      </header>

      <div className="flex-1 px-4 pt-3 pb-6 md:px-10 md:pt-3 md:pb-6">
      {/* Player shell — window anatomy: title bar, tabs, task, panels, status.
          Chrome on surface, content wells on well: the window reads as a
          warm tonal object on the black page, Zed-style. */}
      {/* overflow-clip, not hidden: clip still trims children to the
          rounded corners, but unlike hidden it doesn't create a scroll
          container — which would silently kill the mobile sticky transport */}
      <div className="relative overflow-clip rounded-lg border border-border bg-well">
        {/* Title bar — chrome rows are surface, content wells stay black:
            the banding does the sectioning so text doesn't have to */}
        {/* inset highlight on the top edge — the machined-metal glint dark
            windows use for depth; a drop shadow is invisible on pure black */}
        <div className="relative flex items-stretch border-b border-border bg-[#3c414c] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          {/* left section is exactly the plan column's width, so the title
              bar's dividers line up with the grid below — Zed's trick */}
          <div className="flex items-stretch bg-well md:w-[260px] md:border-r md:border-border">
            <div className="flex items-center gap-1.5 border-r border-border px-3 py-2" aria-hidden>
              <span className="h-[8px] w-[8px] rounded-full bg-[#ff5f57]" />
              <span className="h-[8px] w-[8px] rounded-full bg-[#febc2e]" />
              <span className="h-[8px] w-[8px] rounded-full bg-[#28c840]" />
            </div>
            <div
              aria-hidden
              className="hidden flex-1 items-center gap-1.5 px-3 font-mono text-[10px] text-[#aaafbb] sm:flex"
            >
              <Search size={10} />
              Search…
            </div>
          </div>
          {/* the code track keeps the filename fiction; everyday viewers
              get the plain run name — a .ts path is the one piece of coder
              set-dressing they'd otherwise meet */}
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[10px] text-[#dcdfe3]">
            {mode === "code" ? `data/${scenario.id}.ts` : scenario.id}
          </span>
          <div className="ml-auto flex items-center justify-end">
            {/* the avatar is the agent itself — same face, same clock */}
            <div className="flex items-center px-2.5 py-1.5">
              <span
                aria-hidden
                className="flex h-5 w-5 items-center justify-center rounded-full border border-[#4d525e] bg-well"
              >
                <Creature state={state} ms={ms} size={13} />
              </span>
            </div>
          </div>
        </div>

        {/* Scenario tabs — the editor-tab illusion done properly: the active
            tab has no bottom border, so its well bg pours straight into the
            row below. Inactive tabs (and the empty rail after them) carry
            the border line. Numbers are quiet keyboard hints, not chips. */}
        <div className="flex items-stretch bg-surface">
          {scenarios.map((sc, i) => (
            <button
              key={sc.id}
              onClick={() => select(i)}
              className={`relative flex items-center gap-2 border-r border-b px-4 py-2.5 font-mono text-[12px] transition-colors ${
                i === idx
                  ? "border-r-border border-b-transparent bg-well text-header-text"
                  : "border-r-border border-b-border text-[#a9adb6] hover:bg-hover-bg hover:text-header-text"
              }`}
            >
              {i === idx && (
                <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-accent" />
              )}
              <span
                aria-hidden
                className={`h-[5px] w-[5px] rounded-full ${runDot(sc)} ${
                  i === idx ? "" : "opacity-40"
                }`}
              />
              <span
                aria-hidden
                className={`text-[9px] tracking-[0.08em] uppercase ${
                  i === idx ? "text-[#a9adb6]" : "text-[#636a76]"
                }`}
              >
                run {String(i + 1).padStart(2, "0")}
              </span>
              <span className="max-sm:hidden">{sc.title}</span>
              {/* watched stamp — the trilogy is collectible. A chip, not a
                  bare tick, so it reads at tab-rail distance; on the run
                  being completed it springs in with an overshoot pop while
                  a mint wash crosses the tab and fades. Pure f(ms): the
                  ceremony replays on every landing, un-happens on scrub. */}
              {watched.includes(sc.id) && (
                <span
                  className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[3px] border border-accent/40 bg-accent/15 text-accent"
                  style={{
                    transform: `scale(${
                      i === idx && state.done
                        ? settle(ms, state.lastEventAt + 250)
                        : 1
                    })`,
                  }}
                >
                  <Check size={9} strokeWidth={3} />
                </span>
              )}
              {i === idx && state.done && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-accent"
                  style={{
                    opacity:
                      0.15 * (1 - clamp01(settle(ms, state.lastEventAt + 250, gentle))),
                  }}
                />
              )}
            </button>
          ))}
          <div aria-hidden className="flex-1 border-b border-border" />
          {/* Track toggle — everyday is the front door, code is the real
              material one click away. Rides the tab rail's empty rail; on a
              first visit with no stored preference it wears a small
              invitation so devs know the real thing is here. */}
          <div className="flex items-center gap-2 border-b border-border pr-2 pl-3">
            {modeHint && mode === "everyday" && (
              <span className="hidden font-mono text-[10px] text-human sm:block">
                coder? →
              </span>
            )}
            <div className="flex items-center gap-px rounded-sm border border-border bg-well p-px font-mono text-[10px]">
              {(["everyday", "code"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  aria-pressed={mode === m}
                  className={`rounded-[2px] px-2 py-1 transition-colors ${
                    mode === m
                      ? "bg-hover-bg text-header-text"
                      : "text-[#636a76] hover:text-muted"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Task bar — the human rendered as a Zed collaborator: their
            cursor sits at the head of the line wearing a name flag, and
            their selection tints the task. Cream is the human's player
            color — the same warm paper as their text selection; mint
            stays the agent's. */}
        <div className="flex items-center border-b border-border px-4 pt-4 pb-3">
          <div className="relative min-w-0">
            <span
              aria-hidden
              className="absolute -top-[12px] -left-px flex items-center gap-[3px] rounded-[2px] rounded-bl-none bg-human px-[5px] font-mono text-[9px] leading-[13px] font-semibold tracking-[0.06em] text-[#16181d] uppercase"
            >
              <User size={8} strokeWidth={2.75} />
              human
            </span>
            <span aria-hidden className="absolute top-0 bottom-0 -left-px w-[2px] bg-human" />
            {/* mobile wraps the full task — nothing the human said gets cut;
                desktop has the width to keep it on one line */}
            {/* quoted: the flag says who, the quotes say *said* — without
                them the line reads as a filename to anyone who doesn't
                know Zed's collaborator idiom. Dimmer than the words, like
                punctuation should be. */}
            <span className="block bg-human/10 py-[3px] pr-1.5 pl-2 font-mono text-[14px] text-[#f0f2f5] md:truncate">
              <span className="text-human/60">&ldquo;</span>
              {scenario.task}
              <span className="text-human/60">&rdquo;</span>
            </span>
          </div>
          <span className="ml-auto hidden shrink-0 pl-3 font-mono text-[10px] text-[#a9adb9] md:block">
            {(scenario.durationMs / 1000).toFixed(0)}s · {activeEvents.length} events
          </span>
        </div>

        {/* Mobile storyteller — the hero marquee, folded into the machine:
            mascot and narration sit directly above the stream so the story
            reads as one column on a phone. Same (state, ms) as everything. */}
        {/* sticky: the voice brackets the phone with the transport —
            narration locked top, controls locked bottom, story scrolling
            between them */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-well px-4 py-2.5 md:hidden">
          {state.done && trilogy ? (
            <CreatureTriumph size={32} />
          ) : (
            <Creature state={state} ms={ms} size={32} />
          )}
          {/* min-h reserves two lines so the strip doesn't bounce as lines
              wrap; flex items-center keeps one-liners vertically centered
              inside that reserved box */}
          <p
            key={shownNarration.text}
            className={`narrate-enter flex min-h-[2.5em] flex-1 items-center font-serif text-[14px] leading-tight ${
              yourCall ? "text-human" : "text-accent-light"
            }`}
          >
            {shownNarration.text}
          </p>
        </div>

        <div className="grid md:grid-cols-[260px_1fr_200px] md:divide-x md:divide-border max-md:divide-y max-md:divide-border">
          {/* Mind */}
          {/* min-w-0 on every grid section: grid children default to
              min-width auto, so one long tool line would blow the tracks
              out past the player border */}
          {/* mobile order: the stream is the story, so it leads; memory
              rides under it; the plan — narrated by the stream anyway —
              goes last and hugs its content */}
          <section className="flex min-w-0 flex-col max-md:order-3">
            <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-1.5">
              <span className="label">plan</span>
              <span className="font-mono text-[10px] text-[#a9adb6]">
                {state.plans.length === 0
                  ? "—"
                  : `${state.plans.length} plan${state.plans.length > 1 ? "s" : ""}`}
              </span>
            </div>
            <div className="flex-1 space-y-5 p-4 md:min-h-[320px]">
              {state.plans.map((plan, i) => (
                <Plan
                  key={plan.planId}
                  plan={plan}
                  ms={ms}
                  label={state.plans.length > 1 ? `plan ${"ab"[i]}` : "plan"}
                />
              ))}
              {state.plans.length === 0 && (
                <div className="font-mono text-[12px] text-[#a9adb9]">—</div>
              )}
            </div>
          </section>

          {/* Action stream */}
          <section className="flex min-w-0 flex-col max-md:order-1">
            <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-1.5">
              <span className="label">actions</span>
              <span className="font-mono text-[10px] text-[#a9adb6]">
                {firedCount}/{activeEvents.length} events
              </span>
            </div>
            <div
              ref={streamRef}
              className="max-h-[45vh] min-h-[180px] space-y-3 overflow-y-auto p-4 md:max-h-[320px] md:min-h-[320px]"
            >
              {streamItems.map((it) =>
                it.exitDelay !== undefined ? (
                  <StreamBlock
                    key={it.key}
                    block={it.block}
                    ms={ms}
                    exitFactor={1 - clamp01(settle(rewriteT, it.exitDelay))}
                  />
                ) : it.enterDelay !== undefined ? (
                  <div key={it.key} style={enterStyle(rewriteT, it.enterDelay)}>
                    <StreamBlock
                      block={it.block}
                      ms={ms}
                      onPick={pick}
                      escape={escapeFor(it.block)}
                    />
                  </div>
                ) : (
                  <StreamBlock
                    key={it.key}
                    block={it.block}
                    ms={ms}
                    onPick={pick}
                    escape={escapeFor(it.block)}
                  />
                ),
              )}
              {state.blocks.length === 0 && (
                <div className="font-mono text-[12px] text-[#a9adb9]">waiting…</div>
              )}
              {/* End-card — the teachable moment is completion, not arrival:
                  when a run finishes, point at the next story. Pure f(ms):
                  scrub back before done and it unrenders. Once the trilogy
                  is complete the nudge retires — the finale takes its slot. */}
              {/* clickable end-cards get the raised secondary-button look —
                  lighter bg + the machined top glint — while the done
                  verdict above them is an unboxed statement: boxes that
                  lift are pressable, bars are the agent speaking */}
              {state.done && !trilogy && idx < scenarios.length - 1 && (
                <button
                  onClick={() => select(idx + 1, true)}
                  style={enterStyle(ms, state.lastEventAt + 600)}
                  className="flex w-full items-center justify-between rounded-sm border border-[#565b66] bg-hover-bg px-3 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:border-accent/60 hover:bg-[#3e434e]"
                >
                  <span>
                    <span className="label block">next run</span>
                    <span className="font-serif text-[15px] text-accent-light">
                      {scenarios[idx + 1].title}
                    </span>
                  </span>
                  <span aria-hidden className="font-mono text-accent">
                    →
                  </span>
                </button>
              )}
              {/* Trilogy finale — the ticks promised a payoff; this is it.
                  Fires on whichever run completes the set and greets every
                  end frame after: the collection acknowledged in the voice
                  that carried the piece, right when the reader decides
                  whether this was worth sharing. */}
              {state.done && trilogy && (
                <div
                  style={enterStyle(ms, state.lastEventAt + 500)}
                  className="flex w-full flex-col items-center rounded-sm border border-accent/30 bg-surface px-4 py-3 text-center"
                >
                  {/* trophy sprite pops on the stamp's spring overshoot —
                      40px here (the marquee twin wears the 56 crown); the
                      verdict rows below bought their room from this card */}
                  <span
                    style={{
                      transform: `scale(${settle(ms, state.lastEventAt + 700)})`,
                    }}
                  >
                    <CreatureTriumph size={40} />
                  </span>
                  <span className="label mt-1 text-accent">
                    all three watched
                  </span>
                  {/* the collection receipt — one check per run, stamped
                      one-two-three, but each carries its verdict, not its
                      title (the tabs above still wear the titles and
                      ticks). This is what the reader takes out the door:
                      the three promises from the masthead's syllabus
                      line, earned. The rows' height came out of the trophy
                      and the paddings, so the whole card still fits the
                      stream without cropping the crown (the stream pins
                      to its bottom edge). Timing: the tightest run parks
                      2.0s after done, so every entrance below must settle
                      by +2000ms or it freezes mid-fade at the end frame. */}
                  <span className="mt-1 flex flex-col items-center gap-0.5">
                    {scenarios.map((s, i) => (
                      <span
                        key={s.id}
                        style={enterStyle(ms, state.lastEventAt + 900 + i * 180)}
                        className="flex items-center gap-2 font-mono text-[12px] text-header-text"
                      >
                        <span className="flex h-[15px] w-[15px] items-center justify-center rounded-[3px] border border-accent/40 bg-accent/15 text-accent">
                          <Check size={9} strokeWidth={3} />
                        </span>
                        {s.lesson}
                      </span>
                    ))}
                  </span>
                  <span
                    style={enterStyle(ms, state.lastEventAt + 1450)}
                    className="mt-2 block max-w-[28rem] font-serif text-[15px] leading-snug text-accent-light"
                  >
                    That&apos;s how an agent thinks, start to finish. Nothing
                    was skipped. Next time an AI is working for you,
                    you&apos;ll know what it&apos;s actually doing.
                  </span>
                </div>
              )}
              {/* What-if — hands the reader the branch flip they'd otherwise
                  never find: from the end frame, one click rewrites the whole
                  visible story (pick() runs the unravel/cascade in place).
                  Flips back and forth forever. */}
              {state.done &&
                (() => {
                  const gate = state.blocks.find((b) => b.kind === "choice");
                  const other =
                    gate?.kind === "choice"
                      ? gate.options.find((o) => o.id !== choices[gate.choiceId])
                      : undefined;
                  return gate?.kind === "choice" && other ? (
                    <button
                      onClick={() => pick(gate.choiceId, other.id)}
                      style={enterStyle(ms, state.lastEventAt + 700)}
                      className="flex w-full items-center justify-between rounded-sm border border-[#565b66] bg-hover-bg px-3 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:border-accent/60 hover:bg-[#3e434e]"
                    >
                      <span>
                        <span className="label block">what if</span>
                        <span className="font-serif text-[15px] text-accent-light">
                          {other.label} — watch the story rewrite
                        </span>
                      </span>
                      <span aria-hidden className="font-mono text-accent">
                        ↺
                      </span>
                    </button>
                  ) : null;
                })()}
            </div>
          </section>

          {/* Context gauge — stats cell */}
          <section className="relative flex min-w-0 flex-col max-md:order-2">
            {cueOn && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 z-10 border border-accent"
              />
            )}
            <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-1.5">
              <span className="label">memory</span>
              <span className="font-mono text-[10px] text-[#a9adb6]">
                {Math.round(pct * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-3 p-4 max-md:py-2.5 md:block">
              <div className="font-mono text-[15px] leading-none text-header-text md:text-[26px]">
                {displayTokens.toLocaleString()}
              </div>
              <div className="font-mono text-[10px] text-[#a9adb9] md:mt-1 md:text-[11px]">
                / {CONTEXT_BUDGET.toLocaleString()} tokens
              </div>
              <div className="relative h-1 flex-1 bg-hover-bg md:mt-3 md:w-full md:flex-none">
                {/* in the red the bar blinks — a steps() beat computed from
                    ms, so it stays pure and freezes honestly when paused.
                    Dread before the compact's relief; the mascot panics on
                    the same climb. */}
                <div
                  className={`h-full ${gaugeColor}`}
                  style={{
                    width: `${pct * 100}%`,
                    opacity:
                      pct > 0.9 && !reducedMotion && ms % 460 > 230 ? 0.4 : 1,
                  }}
                />
                {/* threshold notches: warning at 75%, danger at 90% */}
                <span aria-hidden className="absolute top-0 left-3/4 h-full w-px bg-[#4d525e]" />
                <span aria-hidden className="absolute top-0 left-[90%] h-full w-px bg-[#4d525e]" />
              </div>
            </div>
          </section>
        </div>

        {/* Transport — ▶ is the one input. The run parks itself at each
            decision; while a question waits, play disables and the
            scrubber clamps. Answering is the only way forward. Sticky on
            mobile: play is on screen at landing and stays in thumb reach
            while the story scrolls. */}
        <div className="flex items-center gap-2 border-t border-border px-4 py-2 max-md:sticky max-md:bottom-0 max-md:z-20 max-md:bg-well">
          <button
            onClick={() => {
              if (sound) unlock(); // iOS: the context must start in this tap
              setRewrite(null);
              if (ended) {
                setMs(0);
                setPlaying(true);
              } else if (!blocked) {
                setPlaying((p) => !p);
              }
            }}
            disabled={blocked}
            className="flex h-8 shrink-0 items-center gap-2 rounded-sm border-b-2 border-[#5fad74] bg-accent pr-1.5 pl-3 font-mono text-[12px] font-medium text-[#16181d] transition-colors enabled:hover:bg-[#5fad74] disabled:opacity-40"
            aria-label={ended ? "replay" : playing ? "pause" : "play"}
          >
            {ended ? <RotateCcw size={13} /> : playing ? <Pause size={13} /> : <Play size={13} />}
            {ended ? "replay" : playing ? "pause" : "play"}
            {/* the shortcut rides inside the button, Zed style — no keyboard
                on touch, so the chip stays desktop-only */}
            <kbd className="rounded-[3px] border border-[#16181d]/35 px-[5px] py-px text-[10px] leading-none max-md:hidden">
              space
            </kbd>
          </button>
          <Scrubber
            ms={ms}
            duration={scenario.durationMs}
            ticks={activeEvents.map((e) => e.at)}
            onScrub={(m) => {
              const next = Math.min(m, maxMs);
              // the ratchet: one soft click when this move crosses event
              // ticks (collapsed — a fast fling is one click, not a chord),
              // pitch stepping up scrubbing forward, down dragging back.
              // Scrub-only by construction: playback never lands here.
              const prev = scrubRef.current;
              if (sound && next !== prev) {
                const lo = Math.min(prev, next);
                const hi = Math.max(prev, next);
                if (activeEvents.some((e) => e.at > lo && e.at <= hi))
                  ratchet(next > prev ? 1 : -1);
              }
              scrubRef.current = next;
              setRewrite(null);
              setPlaying(false);
              setMs(next);
            }}
          />
          {/* current time bright, total dim — the number that moves leads */}
          <span className="w-20 shrink-0 text-right font-mono text-[11px]">
            <span className="text-[#dcdfe3]">{(ms / 1000).toFixed(1)}</span>
            <span className="text-[#a9adb9]"> / {(scenario.durationMs / 1000).toFixed(0)}s</span>
          </span>
        </div>

        {/* Chapters */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2">
          {chapters.map((ch, i) => {
            const next = chapters[i + 1]?.at ?? Infinity;
            const active = ms >= ch.at && ms < next;
            // beyond the unanswered decision: future you haven't earned yet
            const reachable = ch.at <= maxMs;
            return (
              <button
                key={`${ch.at}-${ch.label}`}
                disabled={!reachable}
                onClick={() => {
                  // land held just past the beat so its entrance has settled;
                  // never past the wall — the decision must be answered here
                  setRewrite(null);
                  setPlaying(false);
                  setMs(Math.min(ch.at + HOLD_MS, scenario.durationMs, maxMs));
                }}
                className={`flex items-center gap-1.5 py-1 font-mono text-[10px] tracking-wide uppercase ${
                  active
                    ? "text-header-text"
                    : reachable
                      ? "text-[#7b8290] hover:text-[#a9adb9]"
                      : "cursor-default text-[#4a4f59]"
                }`}
              >
                <span className={active ? (CHAPTER_TONES[ch.label] ?? "text-accent") : ""}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {ch.label}
              </button>
            );
          })}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between border-t border-border bg-[#3c414c] px-3 py-1.5 font-mono text-[10px] text-[#dde0e5]">
          <div className="flex items-center gap-3">
            <span
              className={`flex items-center gap-1.5 ${
                yourCall && !playing ? "text-human" : "text-[#dde0e5]"
              }`}
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${
                  ended
                    ? "border border-accent"
                    : yourCall && !playing
                      ? "bg-human"
                      : playing
                        ? "bg-accent"
                        : "bg-[#636a76]"
                }`}
              />
              {ended
                ? "done"
                : yourCall && !playing
                  ? "your call"
                  : playing
                    ? "playing"
                    : "paused"}
            </span>
            <span aria-hidden className="text-[#4d525e]">
              ·
            </span>
            <span className="text-[#dde0e5]">
              run {String(idx + 1).padStart(2, "0")} /{" "}
              {String(scenarios.length).padStart(2, "0")}
            </span>
            <span aria-hidden className="text-[#4d525e]">
              ·
            </span>
            {/* the mascot's voice — the toggle click is the user gesture
                that lets the AudioContext start; a hello-chirp confirms
                it's audible the moment it's on */}
            <button
              onClick={() => {
                if (!sound) {
                  unlock();
                  chirp("ask");
                }
                setSound(!sound);
              }}
              aria-pressed={sound}
              className={`flex items-center gap-1 transition-colors ${
                sound ? "text-accent" : "text-[#636a76] hover:text-muted"
              }`}
            >
              {sound ? <Volume2 size={11} /> : <VolumeX size={11} />}
              sound
            </button>
          </div>
          {/* keyboard hints, Zed palette style: key in a chip, action in dim
              text, hairline dividers between groups */}
          <div className="hidden items-center gap-2.5 md:flex">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded-[2px] bg-hover-bg px-1.5 py-px text-[10px] text-[#dde0e5]">
                ← →
              </kbd>
              <span className="text-[#dde0e5]">scrub</span>
            </span>
            <span aria-hidden className="h-3 w-px bg-border" />
            <span className="flex items-center gap-1.5">
              <kbd className="rounded-[2px] bg-hover-bg px-1.5 py-px text-[10px] text-[#dde0e5]">
                1–3
              </kbd>
              <span className="text-[#dde0e5]">runs</span>
            </span>
          </div>
        </div>

        {state.done && trilogy && (
          <FinaleBurst ms={ms} at={state.lastEventAt} />
        )}
      </div>
      </div>
    </>
  );
}
