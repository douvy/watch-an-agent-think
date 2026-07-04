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
} from "lucide-react";
import { scenarios } from "@/data";
import { createSpring, presets } from "@/lib/spring";
import {
  stateAt,
  CONTEXT_BUDGET,
  type Block,
  type PlanView,
  type Scenario,
} from "@/lib/timeline";

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

function Corners() {
  const pos = [
    "-top-[5px] -left-[5px]",
    "-top-[5px] -right-[5px]",
    "-bottom-[5px] -left-[5px]",
    "-bottom-[5px] -right-[5px]",
  ];
  return (
    <>
      {pos.map((p) => (
        <span
          key={p}
          aria-hidden
          className={`pointer-events-none absolute ${p} font-mono text-[9px] leading-none text-[#3d3d3d] select-none`}
        >
          +
        </span>
      ))}
    </>
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
                    : "text-[#5c6070]"
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
              <span className={st === "done" ? "line-through decoration-[#3d3d3d]" : ""}>
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

  const wrap: React.CSSProperties =
    absorbedAt !== undefined
      ? {
          opacity: clamp01(squeeze),
          maxHeight: `${clamp01(squeeze) * 120}px`,
          overflow: "hidden",
        }
      : enterStyle(ms, block.at);

  if (block.kind === "thought") {
    return (
      <div
        style={wrap}
        className="border-l border-border py-0.5 pl-3 text-[13px] leading-relaxed text-foreground"
      >
        {block.text}
      </div>
    );
  }

  if (block.kind === "tool") {
    const Icon = TOOL_ICONS[block.tool] ?? Terminal;
    return (
      <div style={wrap} className="font-mono text-[12px] leading-relaxed">
        <div className="flex items-center gap-2 text-muted">
          <Icon size={12} className="shrink-0 text-[#5c6070]" />
          <span className="text-[#5c6070]">{block.tool}</span>
          <span className="truncate text-foreground">{block.input}</span>
        </div>
        {block.pending ? (
          <div className="mt-1 pl-5 text-[11px] text-[#5c6070]">running…</div>
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
        className="relative border border-border bg-surface px-3 py-2.5"
      >
        <Corners />
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
      className="relative border border-accent/30 bg-surface px-3 py-2.5"
    >
      <Corners />
      <div className="label mb-1">done</div>
      <div className="font-mono text-[13px] text-header-text">{block.verdict}</div>
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
      {/* event ticks */}
      {ticks.map((t, i) => (
        <div
          key={i}
          className="absolute top-1/2 h-[5px] w-px -translate-y-1/2 bg-[#3d3d3d]"
          style={{ left: `${(t / duration) * 100}%` }}
        />
      ))}
      {/* progress */}
      <div
        className="absolute top-1/2 left-0 h-px -translate-y-1/2 bg-accent"
        style={{ width: `${(ms / duration) * 100}%` }}
      />
      {/* playhead */}
      <div
        className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-header-text"
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
  const streamRef = useRef<HTMLDivElement>(null);
  const ended = ms >= scenario.durationMs;

  // Auto-play on load — the share loop lands on a page already thinking.
  useEffect(() => {
    const t = setTimeout(() => setPlaying(true), 400);
    return () => clearTimeout(t);
  }, []);

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
    <div className="w-full">
      {/* Scenario tabs */}
      <div className="flex items-center gap-1 border-x border-t border-border">
        {scenarios.map((sc, i) => (
          <button
            key={sc.id}
            onClick={() => select(i)}
            className={`flex items-center gap-2 px-4 py-2.5 font-mono text-[11px] tracking-wide uppercase transition-colors ${
              i === idx
                ? "text-header-text"
                : "text-[#5c6070] hover:bg-hover-bg hover:text-muted"
            }`}
          >
            <kbd
              className={`inline-flex h-4 w-4 items-center justify-center border text-[9px] ${
                i === idx ? "border-accent/50 text-accent" : "border-border text-[#5c6070]"
              }`}
            >
              {i + 1}
            </kbd>
            {sc.title}
          </button>
        ))}
      </div>

      {/* Player shell */}
      <div className="relative border border-border">
        <Corners />

        {/* Task bar */}
        <div className="border-b border-border px-4 py-3">
          <span className="label mr-3">task</span>
          <span className="font-mono text-[13px] text-header-text">{scenario.task}</span>
        </div>

        <div className="grid md:grid-cols-[260px_1fr_200px] md:divide-x md:divide-[#252525] max-md:divide-y max-md:divide-[#252525]">
          {/* Mind */}
          <section className="min-h-[160px] p-4 max-md:order-1 md:min-h-[440px]">
            <div className="label mb-4">mind</div>
            <div className="space-y-5">
              {state.plans.map((plan, i) => (
                <Plan
                  key={plan.planId}
                  plan={plan}
                  ms={ms}
                  label={state.plans.length > 1 ? `plan ${"ab"[i]}` : "plan"}
                />
              ))}
              {state.plans.length === 0 && (
                <div className="font-mono text-[12px] text-[#5c6070]">—</div>
              )}
            </div>
          </section>

          {/* Action stream */}
          <section
            ref={streamRef}
            className="max-h-[300px] min-h-[200px] overflow-y-auto p-4 max-md:order-3 md:max-h-[440px] md:min-h-[440px]"
          >
            <div className="label mb-4">action stream</div>
            <div className="space-y-3">
              {state.blocks.map((b, i) => (
                <StreamBlock key={`${b.kind}-${b.at}-${i}`} block={b} ms={ms} />
              ))}
              {state.blocks.length === 0 && (
                <div className="font-mono text-[12px] text-[#5c6070]">waiting…</div>
              )}
            </div>
          </section>

          {/* Context gauge — vertical panel on desktop, slim strip on mobile */}
          <section className="p-3 max-md:order-2 md:p-4">
            <div className="flex items-center gap-3 md:block">
              <div className="label md:mb-4">context</div>
              <div className="font-mono text-[15px] leading-none text-header-text md:text-[26px]">
                {displayTokens.toLocaleString()}
              </div>
              <div className="font-mono text-[10px] text-[#5c6070] md:mt-1 md:text-[11px]">
                / {CONTEXT_BUDGET.toLocaleString()}
              </div>
              <div className="h-1 flex-1 bg-hover-bg md:mt-3 md:w-full md:flex-none">
                <div className={`h-full ${gaugeColor}`} style={{ width: `${pct * 100}%` }} />
              </div>
              <div className="font-mono text-[10px] text-muted md:mt-2 md:text-[11px]">
                {Math.round(pct * 100)}%
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
            className="flex h-7 w-7 shrink-0 items-center justify-center border border-border text-muted hover:border-[#3d3d3d] hover:text-header-text"
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
          <span className="w-20 shrink-0 text-right font-mono text-[11px] text-muted">
            {(ms / 1000).toFixed(1)} / {(scenario.durationMs / 1000).toFixed(0)}s
          </span>
          <kbd className="hidden h-4 items-center border border-border px-1 font-mono text-[9px] text-[#5c6070] md:inline-flex">
            space
          </kbd>
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
                  active ? "text-header-text" : "text-[#5c6070] hover:text-muted"
                }`}
              >
                <span className={active ? "text-accent" : ""}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {ch.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
