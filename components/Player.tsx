"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { scenarios } from "@/data";
import { Creature } from "@/components/Creature";
import { createSpring, presets } from "@/lib/spring";
import {
  stateAt,
  CONTEXT_BUDGET,
  type Block,
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

// Chapters derive from the script — the beats worth jumping to.
function chaptersOf(scenario: Scenario): { at: number; label: string }[] {
  const out: { at: number; label: string }[] = [];
  for (const e of scenario.events) {
    if (e.type === "plan") out.push({ at: e.at, label: out.length ? "replan" : "plan" });
    else if (e.type === "plan_dead") out.push({ at: e.at, label: "plan dies" });
    else if (e.type === "compact") out.push({ at: e.at, label: "compact" });
    else if (e.type === "tool_result" && !e.ok) out.push({ at: e.at, label: "setback" });
    else if (e.type === "done") out.push({ at: e.at, label: "done" });
  }
  return out;
}

// Narration — the storyteller track, in the mascot's first-person voice.
// Its face already mirrors the run, so the line is the agent talking to you,
// not a caption about it. Each scenario hand-writes its own lines
// (event.narration); these generics are only the fallback. Derived from the
// last narratable event, so scrubbing rewrites it like captions.
const INTRO_NARRATION = "I'm an agent. Press play and watch me work.";

const TOOL_NARRATION: Record<string, string> = {
  bash: "I run a command and wait on the machine.",
  read: "I open a file to see what's actually there.",
  edit: "I change the code.",
  grep: "I search the codebase for clues.",
};

function narrationOf(
  scenario: Scenario,
  lastEventIndex: number,
): { at: number; text: string } {
  let plans = 0;
  let out = { at: 0, text: INTRO_NARRATION };
  for (let i = 0; i <= lastEventIndex; i++) {
    const e = scenario.events[i];
    if (e.type === "plan") plans++;
    if (e.narration) {
      out = { at: e.at, text: e.narration };
      continue;
    }
    switch (e.type) {
      case "plan":
        out = {
          at: e.at,
          text:
            plans === 1
              ? "First, I write myself a plan."
              : "I write a new plan — a different approach this time.",
        };
        break;
      case "thought":
        out = { at: e.at, text: "I reason out loud before I act." };
        break;
      case "tool_call":
        out = { at: e.at, text: TOOL_NARRATION[e.tool] ?? "I reach for a tool." };
        break;
      case "tool_result":
        out = {
          at: e.at,
          text: e.ok
            ? "The result comes back clean. I keep moving."
            : "That didn't work. Watch my face.",
        };
        break;
      case "plan_dead":
        out = { at: e.at, text: "My plan was built on a bad guess — I'm dropping it." };
        break;
      case "compact":
        out = {
          at: e.at,
          text: "My memory is nearly full, so I compress what I know.",
        };
        break;
      case "done":
        out = { at: e.at, text: "Done. Scrub back to see how I got here." };
        break;
    }
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

/** 0 → 1 settle progress since a timestamp; 1 when settled or never fired. */
function settle(ms: number, since: number | undefined, spring = snappy): number {
  if (since === undefined) return 1;
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

function StreamBlock({ block, ms }: { block: Block; ms: number }) {
  // Absorption (compaction): block squeezes to nothing as the spring settles.
  const absorbedAt =
    block.kind === "thought" || block.kind === "tool" ? block.absorbedAt : undefined;
  const squeeze = 1 - settle(ms, absorbedAt, gentle); // 1 → 0
  if (absorbedAt !== undefined && squeeze <= 0.001) return null;

  // Teleprompter: a block recedes a few seconds after its moment passes so
  // the eye always knows where "now" is. Pure function of ms — scrub back
  // and it re-brightens. The done card never recedes.
  const lastActivity =
    block.kind === "tool" ? (block.resultAt ?? block.at) : block.at;
  const recede =
    block.kind === "done" ? 0 : clamp01((ms - lastActivity - 5000) / 1200);
  const dim = 1 - 0.5 * recede;

  const wrap: React.CSSProperties =
    absorbedAt !== undefined
      ? {
          opacity: clamp01(squeeze),
          maxHeight: `${clamp01(squeeze) * 120}px`,
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
      <div style={wrap} className="font-mono text-[12px] leading-relaxed">
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

  return (
    <div
      style={enterStyle(ms, block.at)}
      className="rounded-sm border border-accent/30 bg-surface px-3 py-2.5"
    >
      <div className="label mb-1">done</div>
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
      className="group relative h-8 flex-1 cursor-pointer touch-none select-none"
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
  const scenario = scenarios[idx];
  const state = useMemo(() => stateAt(scenario, ms), [scenario, ms]);
  const chapters = useMemo(() => chaptersOf(scenario), [scenario]);
  const narration = useMemo(
    () => narrationOf(scenario, state.lastEventIndex),
    [scenario, state.lastEventIndex],
  );
  const streamRef = useRef<HTMLDivElement>(null);
  const ended = ms >= scenario.durationMs;
  // Cover frame: every scenario plans at t=0, so without this the opener
  // would be overwritten before anyone reads it. Until first play, the
  // storyteller introduces itself instead.
  const pristine = ms === 0 && !playing;
  const shownNarration = pristine ? { at: 0, text: INTRO_NARRATION } : narration;

  // Deep link in: ?s=2&t=34 lands on that scenario at that second, then plays —
  // the sharer picked the moment, so arriving mid-thought is the point.
  // Cold loads hold the cover frame (task + plan + narration at 0) and wait
  // for the viewer to press play: read first, then watch.
  // URL params only exist client-side; a lazy initializer would mismatch
  // hydration, so this must be a mount effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = Number(p.get("s"));
    const si = s >= 1 && s <= scenarios.length ? s - 1 : 0;
    if (si) setIdx(si);
    const t = Number(p.get("t"));
    if (t > 0) setMs(Math.min(t * 1000, scenarios[si].durationMs));
    if (si || t > 0) {
      const timer = setTimeout(() => setPlaying(true), 400);
      return () => clearTimeout(timer);
    }
  }, []);
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
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setMs((m) => {
        const next = m + dt;
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
  }, [playing, scenario]);

  // Keyboard: space play/pause, 1-3 scenarios, arrows nudge.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => (ms >= scenario.durationMs ? (setMs(0), true) : !p));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        setPlaying(false);
        setMs((m) =>
          Math.max(0, Math.min(scenario.durationMs, m + (e.key === "ArrowLeft" ? -2000 : 2000))),
        );
      } else {
        const n = Number(e.key);
        if (n >= 1 && n <= scenarios.length) {
          setIdx(n - 1);
          setMs(0);
          setPlaying(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ms, scenario.durationMs]);

  // Keep the stream pinned to the latest block during playback.
  useEffect(() => {
    if (playing && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [playing, state.lastEventIndex]);

  // Gauge: spring from tokensPrev toward tokens since the last event.
  const gaugeProgress = clamp01(settle(ms, state.lastEventAt, gentle));
  const displayTokens = Math.round(
    state.tokensPrev + (state.tokens - state.tokensPrev) * gaugeProgress,
  );
  const pct = clamp01(displayTokens / CONTEXT_BUDGET);
  const gaugeColor =
    pct > 0.9 ? "bg-accent-negative" : pct > 0.75 ? "bg-warning" : "bg-accent";

  const select = (i: number) => {
    setIdx(i);
    setMs(0);
    setPlaying(true);
  };

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

        {/* Live marquee — centered as a unit. Mobile stacks (mascot, chip,
            line); desktop puts the mascot inline with the text. The text
            column is fixed-width on desktop so the centered group never
            changes width — no sliding as the line length changes. */}
        <div className="mt-3 flex flex-col items-center gap-2.5 md:mt-4 md:flex-row md:justify-center md:gap-6">
          <Creature state={state} ms={ms} size={56} />
          {/* min-h reserves two lines so the layout doesn't bounce as the
              line wraps differently each beat */}
          <p
            className="min-h-[2.6em] max-w-xl text-center font-serif text-[17px] leading-snug text-header-text md:min-h-[1.3em] md:w-[36rem] md:text-left md:text-[24px]"
            style={shownNarration.at > 0 ? enterStyle(ms, shownNarration.at) : undefined}
          >
            {shownNarration.text}
          </p>
        </div>
      </header>

      <div className="flex-1 px-4 pt-3 pb-6 md:px-10 md:py-6">
      {/* Player shell — window anatomy: title bar, tabs, task, panels, status.
          Chrome on surface, content wells on well: the window reads as a
          warm tonal object on the black page, Zed-style. */}
      <div className="overflow-hidden rounded-lg border border-border bg-well">
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
            </button>
          ))}
          <div aria-hidden className="flex-1 border-b border-border" />
        </div>

        {/* Task bar — the human rendered as a Zed collaborator: their
            cursor sits at the head of the line wearing a name flag, and
            their selection tints the task. Blue is the human's player
            color; mint stays the agent's. */}
        <div className="flex items-center border-b border-border px-4 pt-4 pb-3">
          <div className="relative min-w-0">
            <span
              aria-hidden
              className="absolute -top-[12px] -left-px flex items-center gap-[3px] rounded-[2px] rounded-bl-none bg-link px-[5px] font-mono text-[9px] leading-[13px] font-semibold tracking-[0.06em] text-[#0b1520] uppercase"
            >
              <User size={8} strokeWidth={2.75} />
              human
            </span>
            <span aria-hidden className="absolute top-0 bottom-0 -left-px w-[2px] bg-link" />
            <span className="block truncate bg-link/15 py-[3px] pr-1.5 pl-2 font-mono text-[14px] text-[#f0f2f5]">
              {scenario.task}
            </span>
          </div>
          <span className="ml-auto hidden shrink-0 pl-3 font-mono text-[10px] text-[#636a76] md:block">
            {(scenario.durationMs / 1000).toFixed(0)}s · {scenario.events.length} events
          </span>
        </div>

        <div className="grid md:grid-cols-[260px_1fr_200px] md:divide-x md:divide-border max-md:divide-y max-md:divide-border">
          {/* Mind */}
          {/* min-w-0 on every grid section: grid children default to
              min-width auto, so one long tool line would blow the tracks
              out past the player border */}
          <section className="flex min-w-0 flex-col max-md:order-1">
            <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-1.5">
              <span className="label">plan</span>
              <span className="font-mono text-[10px] text-[#a9adb6]">
                {state.plans.length === 0
                  ? "—"
                  : `${state.plans.length} plan${state.plans.length > 1 ? "s" : ""}`}
              </span>
            </div>
            <div className="min-h-[120px] flex-1 space-y-5 p-4 md:min-h-[320px]">
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
          <section className="flex min-w-0 flex-col max-md:order-3">
            <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-1.5">
              <span className="label">actions</span>
              <span className="font-mono text-[10px] text-[#a9adb6]">
                {state.lastEventIndex + 1}/{scenario.events.length} events
              </span>
            </div>
            <div
              ref={streamRef}
              className="max-h-[240px] min-h-[160px] space-y-3 overflow-y-auto p-4 md:max-h-[320px] md:min-h-[320px]"
            >
              {state.blocks.map((b, i) => (
                <StreamBlock key={`${b.kind}-${b.at}-${i}`} block={b} ms={ms} />
              ))}
              {state.blocks.length === 0 && (
                <div className="font-mono text-[12px] text-[#636a76]">waiting…</div>
              )}
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

        {/* Transport */}
        <div className="flex items-center gap-3 border-t border-border px-4 py-2">
          <button
            onClick={() => {
              if (ended) {
                setMs(0);
                setPlaying(true);
              } else {
                setPlaying((p) => !p);
              }
            }}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border transition-colors ${
              playing
                ? "border-border text-muted hover:border-[#4d525e] hover:text-header-text"
                : pristine
                  ? "border-accent bg-accent text-[#16181d] hover:bg-accent/80"
                  : "border-accent/60 text-accent hover:border-accent hover:bg-accent hover:text-[#16181d]"
            }`}
            aria-label={ended ? "replay" : playing ? "pause" : "play"}
          >
            {ended ? <RotateCcw size={12} /> : playing ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <Scrubber
            ms={ms}
            duration={scenario.durationMs}
            ticks={scenario.events.map((e) => e.at)}
            onScrub={(m) => {
              setPlaying(false);
              setMs(m);
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
            return (
              <button
                key={`${ch.at}-${ch.label}`}
                onClick={() => {
                  setMs(ch.at);
                  setPlaying(true);
                }}
                className={`flex items-center gap-1.5 py-1 font-mono text-[10px] tracking-wide uppercase ${
                  active ? "text-header-text" : "text-[#636a76] hover:text-muted"
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
            <span className="flex items-center gap-1.5 text-[#dcdfe3]">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${
                  ended
                    ? "border border-accent"
                    : playing
                      ? "bg-accent"
                      : "bg-[#636a76]"
                }`}
              />
              {ended ? "done" : playing ? "playing" : "paused"}
            </span>
            <span aria-hidden className="text-[#4d525e]">
              ·
            </span>
            <span className="text-[#a9adb6]">
              run {String(idx + 1).padStart(2, "0")} /{" "}
              {String(scenarios.length).padStart(2, "0")}
            </span>
          </div>
          <span className="hidden text-[#a9adb6] md:block">
            space play · ← → scrub · 1–3 runs
          </span>
        </div>
      </div>
      </div>
    </>
  );
}
