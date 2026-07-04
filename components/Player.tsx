"use client";

import { useEffect, useMemo, useState } from "react";
import { Terminal, FileText, Pencil, Search, Archive, Check } from "lucide-react";
import { scenarios } from "@/data";
import {
  stateAt,
  CONTEXT_BUDGET,
  type Block,
  type PlanView,
} from "@/lib/timeline";

const TOOL_ICONS: Record<string, typeof Terminal> = {
  bash: Terminal,
  read: FileText,
  edit: Pencil,
  grep: Search,
};

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

function Plan({ plan, label }: { plan: PlanView; label: string }) {
  return (
    <div className={plan.dead ? "opacity-40" : ""}>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="label">{label}</span>
        {plan.dead && (
          <span className="font-mono text-[10px] text-accent-negative">
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
                st === "active" && !plan.dead
                  ? "text-header-text"
                  : st === "done"
                    ? "text-muted"
                    : "text-[#5c6070]"
              }`}
            >
              <span className="mt-px w-3 shrink-0">
                {st === "done" ? (
                  <Check size={11} className="text-accent" strokeWidth={2.5} />
                ) : st === "active" && !plan.dead ? (
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

function StreamBlock({ block }: { block: Block }) {
  if (block.kind === "thought") {
    return (
      <div className="border-l border-border py-0.5 pl-3 text-[13px] leading-relaxed text-foreground">
        {block.text}
      </div>
    );
  }
  if (block.kind === "tool") {
    const Icon = TOOL_ICONS[block.tool] ?? Terminal;
    return (
      <div className="font-mono text-[12px] leading-relaxed">
        <div className="flex items-center gap-2 text-muted">
          <Icon size={12} className="shrink-0 text-[#5c6070]" />
          <span className="text-[#5c6070]">{block.tool}</span>
          <span className="truncate text-foreground">{block.input}</span>
        </div>
        {block.pending ? (
          <div className="mt-1 pl-5 text-[11px] text-[#5c6070]">running…</div>
        ) : (
          <div
            className={`mt-1 border-l pl-3 ml-1.5 text-[12px] ${
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
      <div className="relative border border-border bg-surface px-3 py-2.5">
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
    <div className="relative border border-accent/30 bg-surface px-3 py-2.5">
      <Corners />
      <div className="label mb-1 text-accent!">done</div>
      <div className="font-mono text-[13px] text-header-text">{block.verdict}</div>
    </div>
  );
}

export function Player() {
  const [idx, setIdx] = useState(0);
  const [ms, setMs] = useState(0);
  const scenario = scenarios[idx];
  const state = useMemo(() => stateAt(scenario, ms), [scenario, ms]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= scenarios.length) {
        setIdx(n - 1);
        setMs(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pct = Math.min(state.tokens / CONTEXT_BUDGET, 1);
  const gaugeColor =
    pct > 0.9 ? "bg-accent-negative" : pct > 0.75 ? "bg-warning" : "bg-accent";
  const visibleBlocks = state.blocks.filter(
    (b) => b.kind === "compact" || b.kind === "done" || !b.absorbed,
  );

  return (
    <div className="w-full">
      {/* Scenario tabs */}
      <div className="flex items-center gap-1 border-x border-t border-border">
        {scenarios.map((sc, i) => (
          <button
            key={sc.id}
            onClick={() => {
              setIdx(i);
              setMs(0);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 font-mono text-[11px] tracking-wide uppercase transition-colors ${
              i === idx
                ? "text-header-text"
                : "text-[#5c6070] hover:bg-hover-bg hover:text-muted"
            }`}
          >
            <kbd
              className={`inline-flex h-4 w-4 items-center justify-center border text-[9px] ${
                i === idx
                  ? "border-accent/50 text-accent"
                  : "border-border text-[#5c6070]"
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
          <span className="font-mono text-[13px] text-header-text">
            {scenario.task}
          </span>
        </div>

        <div className="grid md:grid-cols-[260px_1fr_200px] md:divide-x md:divide-[#252525] max-md:divide-y max-md:divide-[#252525]">
          {/* Mind */}
          <section className="min-h-[200px] p-4 md:min-h-[440px]">
            <div className="label mb-4">mind</div>
            <div className="space-y-5">
              {state.plans.map((plan, i) => (
                <Plan
                  key={plan.planId}
                  plan={plan}
                  label={state.plans.length > 1 ? `plan ${"ab"[i]}` : "plan"}
                />
              ))}
              {state.plans.length === 0 && (
                <div className="font-mono text-[12px] text-[#5c6070]">—</div>
              )}
            </div>
          </section>

          {/* Action stream */}
          <section className="min-h-[240px] p-4 md:min-h-[440px]">
            <div className="label mb-4">action stream</div>
            <div className="space-y-3">
              {visibleBlocks.map((b, i) => (
                <StreamBlock key={`${b.kind}-${b.at}-${i}`} block={b} />
              ))}
              {visibleBlocks.length === 0 && (
                <div className="font-mono text-[12px] text-[#5c6070]">
                  waiting…
                </div>
              )}
            </div>
          </section>

          {/* Context gauge */}
          <section className="p-4">
            <div className="label mb-4">context</div>
            <div className="font-mono text-[26px] leading-none text-header-text">
              {state.tokens.toLocaleString()}
            </div>
            <div className="mt-1 font-mono text-[11px] text-[#5c6070]">
              / {CONTEXT_BUDGET.toLocaleString()} tokens
            </div>
            <div className="mt-3 h-1 w-full bg-hover-bg">
              <div
                className={`h-full ${gaugeColor}`}
                style={{ width: `${pct * 100}%` }}
              />
            </div>
            <div className="mt-2 font-mono text-[11px] text-muted">
              {Math.round(pct * 100)}%
            </div>
          </section>
        </div>

        {/* Scrubber (dev: raw range — the H3 player replaces this) */}
        <div className="flex items-center gap-3 border-t border-border px-4 py-3">
          <input
            type="range"
            min={0}
            max={scenario.durationMs}
            step={50}
            value={ms}
            onChange={(e) => setMs(Number(e.target.value))}
            className="h-1 w-full appearance-none bg-hover-bg accent-[#22c55e]"
          />
          <span className="w-14 shrink-0 text-right font-mono text-[11px] text-muted">
            {(ms / 1000).toFixed(1)}s
          </span>
        </div>
      </div>
    </div>
  );
}
