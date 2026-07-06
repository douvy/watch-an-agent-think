"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Terminal,
  FileText,
  Pencil,
  Search,
  Archive,
  Check,
  Play,
  Pause,
  RotateCcw,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import { scenarios } from "@/data";
import { Creature, CreatureTriumph } from "@/components/Creature";
import { chirp, unlock } from "@/lib/sound";
import { createSpring, presets } from "@/lib/spring";
import {
  stateAt,
  resolveChoices,
  eventActive,
  CONTEXT_BUDGET,
  type Block,
  type Choices,
  type PlanView,
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

// Narration — the storyteller track, in the mascot's first-person voice.
// Only hand-written lines speak: a line persists until the author replaces
// it, so quiet beats stay quiet and the marquee keeps a reading rhythm
// (enforced by the legibility test in lib/timeline.test.ts). Derived from
// the last narrated event, so scrubbing rewrites it like captions.
const INTRO_NARRATION = "I'm an agent. Press play and watch me work.";

function narrationOf(
  scenario: Scenario,
  lastEventIndex: number,
  resolved: Choices,
): { at: number; text: string } {
  let out = { at: 0, text: INTRO_NARRATION };
  for (let i = 0; i <= lastEventIndex; i++) {
    const e = scenario.events[i];
    if (e.narration && eventActive(e, resolved)) out = { at: e.at, text: e.narration };
  }
  return out;
}

const TOOL_ICONS: Record<string, typeof Terminal> = {
  bash: Terminal,
  read: FileText,
  edit: Pencil,
  grep: Search,
};

// All motion below is a pure function of (ms - eventTimestamp) through the
// solver. Play and scrub render through the identical code path — scrubbing
// slowly is literally slow-motion.
const snappy = createSpring(presets.snappy);
const gentle = createSpring(presets.gentle);

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// prefers-reduced-motion collapses every spring to an instant cut — same
// states, no easing. Read once at load; `ms > since` (not >=) keeps the
// first server-rendered frame identical, so hydration never mismatches.
const reducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 0 → 1 settle progress since a timestamp; 1 when settled or never fired. */
function settle(ms: number, since: number | undefined, spring = snappy): number {
  if (since === undefined) return 1;
  if (reducedMotion) return ms > since ? 1 : 0;
  const age = (ms - since) / 1000;
  if (age <= 0) return 0;
  return 1 - spring.at(age); // may overshoot past 1 — that's the point
}

function enterStyle(ms: number, at: number): React.CSSProperties {
  const p = settle(ms, at);
  return {
    opacity: clamp01(p),
    transform: `translateY(${(1 - p) * 10}px)`,
  };
}

// The trilogy landing: a window-wide mint flash and a two-second rain of
// pixel confetti when the set-completing done fires. Pure f(ms) like all
// motion here — pieces step down a coarse grid (discrete frames, no
// easing), their positions hashed from their index, so scrubbing back
// un-confettis. Renders only during the burst; the parked end frame
// afterward belongs to the trophy card.
const CONFETTI = Array.from({ length: 26 }, (_, i) => {
  const h = (n: number) => {
    const s = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  return {
    x: 3 + h(1) * 94, // % across the window
    delay: h(2) * 500,
    fall: 1100 + h(3) * 500,
    drift: (h(4) - 0.5) * 26, // px of sideways wander over the fall
    size: 3 + Math.round(h(5) * 3),
    color: ["#84f0a1", "#ffffc9", "#eceae0"][i % 3],
  };
});

function FinaleBurst({ ms, at }: { ms: number; at: number }) {
  const t = ms - at;
  if (t <= 0 || t >= 2200) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
    >
      {/* the tab ceremony's flash at window scale — the biggest wash in
          the app, reserved for the biggest moment */}
      <div
        className="absolute inset-0 bg-accent"
        style={{ opacity: 0.09 * (1 - clamp01(settle(ms, at + 150, gentle))) }}
      />
      {!reducedMotion &&
        CONFETTI.map((c, i) => {
          const p = (t - c.delay) / c.fall;
          if (p <= 0 || p >= 1) return null;
          const f = Math.floor(p * 16) / 16; // stepped, pixel-frame fall
          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${c.x}%`,
                top: `${f * 104}%`,
                width: c.size,
                height: c.size,
                background: c.color,
                transform: `translateX(${f * c.drift}px)`,
              }}
            />
          );
        })}
    </div>
  );
}

function Plan({ plan, label, ms }: { plan: PlanView; label: string; ms: number }) {
  const death = 1 - settle(ms, plan.deadAt, gentle); // 1 → 0 as death settles
  const dead = plan.deadAt !== undefined;
  return (
    <div
      style={{
        ...enterStyle(ms, plan.at),
        ...(dead
          ? {
              opacity: 0.35 + 0.65 * clamp01(death),
              transform: `scale(${0.97 + 0.03 * clamp01(death)})`,
              transformOrigin: "top left",
            }
          : {}),
      }}
    >
      <div className="mb-2 flex items-baseline gap-2">
        <span className="label">{label}</span>
        {dead && (
          <span
            className="font-mono text-[10px] text-accent-negative"
            style={{ opacity: clamp01(settle(ms, plan.deadAt)) }}
          >
            † {plan.deadReason}
          </span>
        )}
      </div>
      <ol className="space-y-1.5">
        {plan.steps.map((step, i) => {
          const st = plan.status[i];
          return (
            <li
              key={i}
              className={`flex items-start gap-2 font-mono text-[12px] leading-snug ${
                st === "active" && !dead
                  ? "text-header-text"
                  : st === "done"
                    ? "text-muted"
                    : "text-[#636a76]"
              }`}
            >
              <span className="mt-px w-3 shrink-0">
                {st === "done" ? (
                  <Check size={11} className="text-accent" strokeWidth={2.5} />
                ) : st === "active" && !dead ? (
                  <span className="text-accent">▸</span>
                ) : (
                  <span>·</span>
                )}
              </span>
              <span className={st === "done" ? "line-through decoration-[#4d525e]" : ""}>
                {step}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StreamBlock({
  block,
  ms,
  onPick,
  exitFactor,
}: {
  block: Block;
  ms: number;
  onPick?: (choiceId: string, option: string) => void;
  /** Branch-rewrite exit: 1 → 0 as the old future unravels. */
  exitFactor?: number;
}) {
  // Absorption (compaction): block squeezes to nothing as the spring settles.
  const absorbedAt =
    block.kind === "thought" || block.kind === "tool" ? block.absorbedAt : undefined;
  // Measured while live so the squeeze starts from the block's real height —
  // a hard-coded cap would clip tall tool outputs the instant absorption
  // starts. Fallback only matters if you deep-link into the middle of a
  // squeeze, where the block is already near-gone. Exiting blocks render
  // naturally until their stagger slot arrives (exitFactor stays 1), so the
  // measurement lands before the collapse needs it.
  const measureRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(120);
  useEffect(() => {
    if (
      absorbedAt === undefined &&
      (exitFactor === undefined || exitFactor >= 1) &&
      measureRef.current
    ) {
      const h = measureRef.current.offsetHeight;
      if (h !== measured) setMeasured(h);
    }
  }, [absorbedAt, measured, block, exitFactor]);
  const squeeze = 1 - settle(ms, absorbedAt, gentle); // 1 → 0
  if (absorbedAt !== undefined && squeeze <= 0.001) return null;
  if (exitFactor !== undefined && exitFactor <= 0.001) return null;

  // Teleprompter: a block recedes a few seconds after its moment passes so
  // the eye always knows where "now" is. Pure function of ms — scrub back
  // and it re-brightens. The done card never recedes; choice cards stay
  // bright forever because they stay interactive forever.
  const lastActivity =
    block.kind === "tool" ? (block.resultAt ?? block.at) : block.at;
  const recede =
    block.kind === "done" || block.kind === "choice"
      ? 0
      : clamp01((ms - lastActivity - 5000) / 1200);
  const dim = 1 - 0.5 * recede;

  const wrap: React.CSSProperties =
    exitFactor !== undefined && exitFactor < 1
      ? {
          opacity: clamp01(exitFactor),
          maxHeight: `${clamp01(exitFactor) * measured}px`,
          overflow: "hidden",
        }
      : absorbedAt !== undefined
      ? {
          opacity: clamp01(squeeze),
          maxHeight: `${clamp01(squeeze) * measured}px`,
          overflow: "hidden",
        }
      : (() => {
          const s = enterStyle(ms, block.at);
          return { ...s, opacity: (s.opacity as number) * dim };
        })();

  if (block.kind === "thought") {
    // Inner monologue — the human register, serif italic against tool mono.
    return (
      <div
        ref={measureRef}
        style={wrap}
        className="border-l border-border py-0.5 pl-3 font-serif text-[15px] leading-relaxed text-foreground italic"
      >
        {block.text}
      </div>
    );
  }

  if (block.kind === "tool") {
    const Icon = TOOL_ICONS[block.tool] ?? Terminal;
    return (
      <div ref={measureRef} style={wrap} className="font-mono text-[12px] leading-relaxed">
        {/* Machine voice gets the second hue — blue tool names let the eye
            skip action-to-action without reading every line */}
        <div className="flex items-center gap-2 text-muted">
          <Icon size={12} className="shrink-0 text-link/70" />
          <span className="text-link">{block.tool}</span>
          <span className="truncate text-muted">{block.input}</span>
        </div>
        {block.pending ? (
          <div className="mt-1 pl-5 text-[11px] text-[#636a76]">running…</div>
        ) : (
          <div
            style={enterStyle(ms, block.resultAt ?? block.at)}
            className={`mt-1 ml-1.5 border-l pl-3 text-[12px] ${
              block.ok
                ? "border-border text-muted"
                : "border-accent-negative/60 text-foreground"
            }`}
          >
            {block.output}
          </div>
        )}
      </div>
    );
  }

  if (block.kind === "choice") {
    // The reader's beat — rendered as the human's collaborator cursor
    // arriving in the agent's stream: cream caret on the left edge +
    // selection tint, the exact anatomy the task bar taught. Live = full
    // tint; answered = the caret stays (this block is the human's mark)
    // but the wash settles. Options are Zed inline chips; the picked one
    // carries a check. Answered cards stay clickable forever — flipping
    // the pick rewrites everything downstream.
    const pending = block.picked === undefined;
    return (
      <div
        style={enterStyle(ms, block.at)}
        className={`relative overflow-hidden rounded-sm px-3 py-2.5 ${
          pending ? "bg-human/10" : "border border-border bg-surface"
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-0 bottom-0 left-0 w-[2px] ${
            pending ? "bg-human" : "bg-human/40"
          }`}
        />
        <div className="mb-1.5 flex items-center justify-between">
          <span
            className={`text-[10px] font-medium tracking-[0.09em] uppercase ${
              pending ? "text-human" : "text-[#dcdfe3]"
            }`}
          >
            your call
          </span>
          {pending && (
            <span className="font-mono text-[10px] text-human">waiting on you</span>
          )}
        </div>
        <div className="mb-2.5 font-serif text-[15px] leading-snug text-header-text italic">
          {block.prompt}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {block.options.map((o) => {
            const isPicked = block.picked === o.id;
            return (
              <button
                key={o.id}
                onClick={() => onPick?.(block.choiceId, o.id)}
                className={`flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[12px] transition-colors max-md:px-2 max-md:py-1.5 ${
                  isPicked
                    ? "bg-human/25 text-[#f7f6f0]"
                    : pending
                      ? "bg-human/10 text-human hover:bg-human/20"
                      : "bg-human/10 text-[#9b998c] hover:bg-human/20 hover:text-human"
                }`}
              >
                {isPicked && <Check size={10} className="opacity-80" />}
                {o.label}
              </button>
            );
          })}
        </div>
        {!pending && (
          <div className="mt-2 font-mono text-[10px] text-[#636a76]">
            switch anytime — everything after rewrites
          </div>
        )}
      </div>
    );
  }

  if (block.kind === "compact") {
    return (
      <div
        style={enterStyle(ms, block.at)}
        className="rounded-sm border border-border bg-surface px-3 py-2.5"
      >
        <div className="mb-1 flex items-center gap-2">
          <Archive size={11} className="text-warning" />
          <span className="label">compacted</span>
        </div>
        <div className="font-mono text-[12px] leading-relaxed text-muted">
          {block.summary}
        </div>
      </div>
    );
  }

  // The verdict — unboxed on purpose: a mint bar and the final spoken
  // line, echoing the thought blocks' anatomy so it can't be mistaken
  // for the raised buttons that follow it at the end frame.
  return (
    <div
      style={enterStyle(ms, block.at)}
      className="border-l-2 border-accent py-0.5 pl-3"
    >
      <div className="label mb-1 text-accent">done</div>
      <div className="font-serif text-[17px] text-header-text italic">
        {block.verdict}
      </div>
    </div>
  );
}

function Scrubber({
  ms,
  duration,
  ticks,
  onScrub,
}: {
  ms: number;
  duration: number;
  ticks: number[];
  onScrub: (ms: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const toMs = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    return clamp01((clientX - rect.left) / rect.width) * duration;
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="timeline"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration / 1000)}
      aria-valuenow={Math.round(ms / 1000)}
      aria-valuetext={`${(ms / 1000).toFixed(1)} of ${Math.round(duration / 1000)} seconds`}
      className="group relative h-8 flex-1 cursor-pointer touch-none select-none max-md:h-11"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onScrub(toMs(e.clientX));
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) onScrub(toMs(e.clientX));
      }}
    >
      {/* track */}
      <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-border" />
      {/* event ticks — consumed ticks warm to mint, so the strip itself
          records what you've already watched */}
      {ticks.map((t, i) => (
        <div
          key={i}
          className={`absolute top-1/2 h-[5px] w-px -translate-y-1/2 ${
            t <= ms ? "bg-accent/40" : "bg-[#4d525e]"
          }`}
          style={{ left: `${(t / duration) * 100}%` }}
        />
      ))}
      {/* progress */}
      <div
        className="absolute top-1/2 left-0 h-px -translate-y-1/2 bg-accent"
        style={{ width: `${(ms / duration) * 100}%` }}
      />
      {/* playhead — a real grabbable handle, not a hairline; grows on hover */}
      <div
        className="absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-header-text group-hover:h-4"
        style={{ left: `${(ms / duration) * 100}%` }}
      />
    </div>
  );
}

export function Player() {
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
  // Which runs this reader has seen through to done — session memory for
  // the tab ticks, so the trilogy reads as collectible. Meta-state like the
  // sound toggle, deliberately outside the pure (ms, choices) world.
  const [watched, setWatched] = useState<number[]>([]);
  // The set is complete — the ticks' promised payoff.
  const trilogy = watched.length === scenarios.length;
  const scenario = scenarios[idx];
  const resolved = useMemo(() => resolveChoices(scenario, choices), [scenario, choices]);
  const state = useMemo(() => stateAt(scenario, ms, choices), [scenario, ms, choices]);
  const chapters = useMemo(() => chaptersOf(scenario, resolved), [scenario, resolved]);
  const narration = useMemo(
    () => narrationOf(scenario, state.lastEventIndex, resolved),
    [scenario, state.lastEventIndex, resolved],
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
    const s = Number(p.get("s"));
    const si = s >= 1 && s <= scenarios.length ? s - 1 : 0;
    if (si) setIdx(si);
    const t = Number(p.get("t"));
    if (t > 0) {
      const firstChoice = scenarios[si].events.find((e) => e.type === "choice");
      const cap = firstChoice ? firstChoice.at + HOLD_MS : scenarios[si].durationMs;
      setMs(Math.min(t * 1000, scenarios[si].durationMs, cap));
    }
  }, []);

  // A run counts as watched once its verdict is on screen.
  useEffect(() => {
    if (state.done) setWatched((w) => (w.includes(idx) ? w : [...w, idx]));
  }, [state.done, idx]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Deep link out: while paused, the URL captures the frame you're looking at.
  // Debounced — Safari throttles replaceState.
  useEffect(() => {
    if (playing) return;
    const timer = setTimeout(() => {
      const url =
        ms > 0
          ? `?s=${idx + 1}&t=${(ms / 1000).toFixed(1)}`
          : window.location.pathname;
      history.replaceState(null, "", url);
    }, 300);
    return () => clearTimeout(timer);
  }, [playing, ms, idx]);

  // Playback clock — rAF advances ms; everything else derives from it.
  // Unanswered choices are gates: the clock parks at at + HOLD_MS (the
  // beat's settle point) and waits. Answering removes the gate, so the
  // effect re-arms with one fewer stop.
  useEffect(() => {
    if (!playing) return;
    const gates = scenario.events
      .filter((e) => e.type === "choice" && !(e.choiceId in choices))
      .map((e) => Math.min(e.at + HOLD_MS, scenario.durationMs));
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // rAF hands us the frame's vsync timestamp, which can precede the
      // performance.now() captured when scheduling — an unguarded negative
      // first dt would drive ms below zero (NaN pixel frames in the mascot).
      const dt = Math.max(0, now - last);
      last = now;
      setMs((m) => {
        const next = m + dt;
        const gate = gates.find((g) => m < g && next >= g);
        if (gate !== undefined) {
          setPlaying(false);
          return gate;
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
                  watched.length === scenarios.length - 1 && !watched.includes(idx)
                  ? "fanfare"
                  : "done"
                : "move",
    );
  }, [state.lastEventIndex, sound, playing, scenario, watched, idx]);

  // Per-run session memory — editor-tab semantics: switching away parks a
  // run where you left it (position and picks); coming back restores it
  // paused instead of restarting. Only unvisited runs start fresh and play.
  // Replay is one click if you want the top. A ref, not state: it's only
  // read at switch time.
  const parkedRef = useRef<Record<number, { ms: number; choices: Choices }>>({});
  const select = useCallback(
    (i: number) => {
      if (i === idx) return;
      if (sound) unlock(); // unvisited runs autoplay — this tap is the gesture
      setRewrite(null);
      parkedRef.current[idx] = { ms, choices };
      const parked = parkedRef.current[i];
      setIdx(i);
      setMs(parked?.ms ?? 0);
      setChoices(parked?.choices ?? {});
      setPlaying(!parked);
    },
    [idx, ms, choices, sound],
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
  }, [ms, playing, blocked, maxMs, scenario.durationMs, select]);

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
  const pct = clamp01(displayTokens / CONTEXT_BUDGET);
  const gaugeColor =
    pct > 0.9 ? "bg-accent-negative" : pct > 0.75 ? "bg-warning" : "bg-accent";

  return (
    <>
      {/* Hero — live. The mascot and the narration line run off the same
          (scenario, ms) as the window below; the display type stays still. */}
      <header className="relative px-5 py-3 md:px-10 md:py-5">
        {/* the bottom rule runs full-bleed past the page rails — Zed's
            drafting-table grid: horizontal and vertical lines cross */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/2 h-px w-screen -translate-x-1/2 bg-[#1a1a1a]"
        />
        {/* registration marks on the bottom rule — drafting-table signature */}
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-[7px] -left-[4px] font-mono text-[9px] leading-none text-[#4d525e] select-none"
        >
          +
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute -right-[4px] -bottom-[7px] font-mono text-[9px] leading-none text-[#4d525e] select-none"
        >
          +
        </span>
        {/* Masthead — one centered mono spec-sheet line, same voice as the
            machine's labels. The storyteller marquee below is the biggest
            type on the page; the brand stays quiet. */}
        <h1 className="text-center font-mono text-[11px] font-medium tracking-[0.14em] text-[#a9adb6] uppercase md:text-[12px]">
          Watch how an AI agent thinks
        </h1>

        {/* Live marquee — desktop only: on phones the storyteller folds
            into the window (see the mobile strip below the task bar), so
            narration and the stream it describes share one screen. The
            text column is fixed-width so the centered group never changes
            width — no sliding as the line length changes. */}
        <div className="mt-4 hidden items-center justify-center gap-3 md:flex">
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
          <p
            className={`min-h-[2.6em] max-w-xl text-center font-serif text-[17px] leading-snug md:min-h-[1.3em] md:w-[36rem] md:text-[24px] ${
              yourCall ? "text-human" : "text-accent-light"
            }`}
            style={
              rewrite
                ? enterStyle(rewriteT, REWRITE.enterAt)
                : shownNarration.at > 0
                  ? enterStyle(ms, shownNarration.at)
                  : undefined
            }
          >
            {shownNarration.text}
          </p>
          {/* invisible twin of the mascot — balances the flex row so the
              text column (and the line within it) sits dead center */}
          <span aria-hidden className="hidden w-14 shrink-0 md:block" />
        </div>
      </header>

      <div className="flex-1 px-4 pt-3 pb-6 md:px-10 md:py-6">
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
        <div className="relative flex items-stretch border-b border-border bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
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
              className="hidden flex-1 items-center gap-1.5 px-3 font-mono text-[10px] text-[#636a76] sm:flex"
            >
              <Search size={10} />
              Search…
            </div>
          </div>
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[10px] text-[#dcdfe3]">
            data/{scenario.id}.ts
          </span>
          {/* right section mirrors the memory column below (200px, border-l),
              so the window's vertical seams run top to bottom — Zed's frame
              is one set of continuous lines, not per-row dividers */}
          <div className="ml-auto flex items-center justify-end md:w-[200px] md:justify-between md:border-l md:border-border">
            <span className="hidden px-3 font-mono text-[9px] tracking-[0.09em] text-[#4d525e] uppercase md:block">
              read-only
            </span>
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
              {watched.includes(i) && (
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
            <span className="block bg-human/10 py-[3px] pr-1.5 pl-2 font-mono text-[14px] text-[#f0f2f5] md:truncate">
              {scenario.task}
            </span>
          </div>
          <span className="ml-auto hidden shrink-0 pl-3 font-mono text-[10px] text-[#636a76] md:block">
            {(scenario.durationMs / 1000).toFixed(0)}s · {activeEvents.length} events
          </span>
        </div>

        {/* Mobile storyteller — the hero marquee, folded into the machine:
            mascot and narration sit directly above the stream so the story
            reads as one column on a phone. Same (state, ms) as everything. */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 md:hidden">
          {state.done && trilogy ? (
            <CreatureTriumph size={32} />
          ) : (
            <Creature state={state} ms={ms} size={32} />
          )}
          {/* min-h reserves two lines so the strip doesn't bounce as lines
              wrap; flex items-center keeps one-liners vertically centered
              inside that reserved box */}
          <p
            className={`flex min-h-[2.5em] flex-1 items-center font-serif text-[14px] leading-tight ${
              yourCall ? "text-human" : "text-accent-light"
            }`}
            style={
              rewrite
                ? enterStyle(rewriteT, REWRITE.enterAt)
                : shownNarration.at > 0
                  ? enterStyle(ms, shownNarration.at)
                  : undefined
            }
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
                <div className="font-mono text-[12px] text-[#636a76]">—</div>
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
                    <StreamBlock block={it.block} ms={ms} onPick={pick} />
                  </div>
                ) : (
                  <StreamBlock key={it.key} block={it.block} ms={ms} onPick={pick} />
                ),
              )}
              {state.blocks.length === 0 && (
                <div className="font-mono text-[12px] text-[#636a76]">waiting…</div>
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
                  onClick={() => select(idx + 1)}
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
                  className="flex w-full flex-col items-center rounded-sm border border-accent/30 bg-surface px-4 py-4 text-center"
                >
                  {/* trophy sprite pops on the stamp's spring overshoot */}
                  <span
                    style={{
                      transform: `scale(${settle(ms, state.lastEventAt + 700)})`,
                    }}
                  >
                    <CreatureTriumph size={56} />
                  </span>
                  <span className="label mt-2 text-accent">
                    all three watched
                  </span>
                  {/* the collection receipt — the tabs' stamps, assembled
                      one-two-three, left to right. Kept horizontal so the
                      whole trophy fits the stream well without cropping
                      the crown (the stream pins to its bottom edge).
                      Timing: the tightest run parks 2.0s after done, so
                      every entrance below must settle by +2000ms or it
                      freezes mid-fade at the end frame. */}
                  <span className="mt-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
                    {scenarios.map((s, i) => (
                      <span
                        key={s.title}
                        style={enterStyle(ms, state.lastEventAt + 900 + i * 180)}
                        className="flex items-center gap-2 font-mono text-[12px] text-header-text"
                      >
                        <span className="flex h-[15px] w-[15px] items-center justify-center rounded-[3px] border border-accent/40 bg-accent/15 text-accent">
                          <Check size={9} strokeWidth={3} />
                        </span>
                        {s.title}
                      </span>
                    ))}
                  </span>
                  <span
                    style={enterStyle(ms, state.lastEventAt + 1450)}
                    className="mt-2.5 block max-w-[28rem] font-serif text-[15px] leading-snug text-accent-light"
                  >
                    That&apos;s all three ways I think — plan, recover,
                    forget. Now you know what you&apos;re watching when you
                    watch a real one.
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
          <section className="flex min-w-0 flex-col max-md:order-2">
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
              <div className="font-mono text-[10px] text-[#636a76] md:mt-1 md:text-[11px]">
                / {CONTEXT_BUDGET.toLocaleString()} tokens
              </div>
              <div className="relative h-1 flex-1 bg-hover-bg md:mt-3 md:w-full md:flex-none">
                <div className={`h-full ${gaugeColor}`} style={{ width: `${pct * 100}%` }} />
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
              setRewrite(null);
              setPlaying(false);
              setMs(Math.min(m, maxMs));
            }}
          />
          {/* current time bright, total dim — the number that moves leads */}
          <span className="w-20 shrink-0 text-right font-mono text-[11px]">
            <span className="text-[#dcdfe3]">{(ms / 1000).toFixed(1)}</span>
            <span className="text-[#636a76]"> / {(scenario.durationMs / 1000).toFixed(0)}s</span>
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
                      ? "text-[#636a76] hover:text-muted"
                      : "cursor-default text-[#3f434d]"
                }`}
              >
                <span className={active ? "text-accent" : ""}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {ch.label}
                {active && (
                  <span className="text-[#636a76]">@{(ch.at / 1000).toFixed(1)}s</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between border-t border-border bg-surface px-3 py-1.5 font-mono text-[10px]">
          <div className="flex items-center gap-3">
            <span
              className={`flex items-center gap-1.5 ${
                yourCall && !playing ? "text-human" : "text-[#dcdfe3]"
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
            <span className="text-[#a9adb6]">
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
              <kbd className="rounded-[2px] bg-hover-bg px-1.5 py-px text-[10px] text-[#dcdfe3]">
                ← →
              </kbd>
              <span className="text-[#a9adb6]">scrub</span>
            </span>
            <span aria-hidden className="h-3 w-px bg-border" />
            <span className="flex items-center gap-1.5">
              <kbd className="rounded-[2px] bg-hover-bg px-1.5 py-px text-[10px] text-[#dcdfe3]">
                1–3
              </kbd>
              <span className="text-[#a9adb6]">runs</span>
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
