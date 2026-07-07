"use client";

import { Check } from "lucide-react";
import { CreatureTriumph } from "@/components/Creature";
import type { Scenario } from "@/lib/timeline";
import { enterStyle, settle } from "@/lib/anim";

// The trilogy finale — the machine's own end screen. Once the set is
// complete, every done end-frame folds the three working panels away and
// this fills their region. No modal on purpose: the ending lives inside
// the window and inside the timeline like everything else, so dragging
// the scrubber back un-happens it — meta-fact M1, made physical.
//
// The contents are the course receipt: the three lessons (the masthead's
// syllabus chips, earned), the six words, the handoff line. Staggers key
// off the done beat and the last one settles by +1900ms — the tightest
// run parks 2.0s after done, and a frozen mid-fade at the end frame
// reads as a bug.

// The vocabulary promise from docs/curriculum.md, paid on the way out.
// Each word was named once mid-run ("this is called X") — recognition.
// This second pass at the exit is the one that makes it recall.
const VOCAB = [
  "agent",
  "tool",
  "agentic loop",
  "hallucination",
  "context window",
  "compacting",
];

export function Finale({
  ms,
  at,
  scenarios,
  whatIf,
}: {
  ms: number;
  /** the done beat — every stagger below keys off it */
  at: number;
  scenarios: Scenario[];
  /** the current run's unpicked branch: flip it and replay from the fork */
  whatIf?: { label: string; flip: () => void };
}) {
  return (
    <section className="flex min-w-0 flex-col">
      {/* same header anatomy as plan/actions/memory — the finale is a
          panel of the machine, not a poster over it */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-1.5">
        <span className="label">finale</span>
        <span className="font-mono text-[10px] text-[#a9adb6]">3/3 runs</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 text-center md:min-h-[315px] md:px-6">
        {/* trophy pops on the stamp spring — the marquee twin wears the
            same crown, so the two surfaces celebrate in unison */}
        <span style={{ transform: `scale(${settle(ms, at + 550)})` }}>
          <CreatureTriumph size={56} />
        </span>
        <span style={enterStyle(ms, at + 600)} className="label mt-2 text-accent">
          all three watched
        </span>
        {/* the lesson receipt — left-aligned rows, one check per run,
            stamped one-two-three. These are the three promises from the
            masthead's syllabus line, earned. */}
        <div className="mt-4 flex flex-col items-start gap-2">
          {scenarios.map((s, i) => (
            <span
              key={s.id}
              style={enterStyle(ms, at + 720 + i * 140)}
              className="flex items-start gap-2.5 text-left font-mono text-[13px] text-header-text"
            >
              {/* top-aligned, not centered — on a phone a lesson wraps to
                  two lines and a centered check floats between them */}
              <span className="mt-[2px] flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[3px] border border-accent/40 bg-accent/15 text-accent">
                <Check size={9} strokeWidth={3} />
              </span>
              {s.lesson}
            </span>
          ))}
        </div>
        {/* the vocab receipt — same chip anatomy as the masthead's
            syllabus chips, minus the checks: words are owned, not done */}
        <div style={enterStyle(ms, at + 1140)} className="mt-5">
          <div className="label mb-2">words you now own</div>
          <div className="flex max-w-[26rem] flex-wrap items-center justify-center gap-1.5">
            {VOCAB.map((w) => (
              <span
                key={w}
                className="rounded-[3px] bg-accent/10 px-1.5 py-0.5 font-mono text-xs text-header-text"
              >
                {w}
              </span>
            ))}
          </div>
        </div>
        <p
          style={enterStyle(ms, at + 1340)}
          className="mt-5 max-w-[28rem] font-serif text-[15px] leading-snug text-accent-light"
        >
          That&apos;s how an agent thinks, start to finish. Nothing was
          skipped. Next time an AI is working for you, you&apos;ll know
          what it&apos;s actually doing.
        </p>
        {/* the exits — one raised button (the branch they never saw) and
            the scrub-back invitation. The last beat belongs to the reader. */}
        <div
          style={enterStyle(ms, at + 1520)}
          className="mt-5 flex flex-col items-center gap-2.5"
        >
          {whatIf && (
            <button
              onClick={whatIf.flip}
              className="flex items-center gap-3 rounded-sm border border-[#565b66] bg-hover-bg px-3 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:border-accent/60 hover:bg-[#3e434e]"
            >
              <span>
                <span className="label block">what if</span>
                <span className="font-serif text-[14px] text-accent-light">
                  {/* option labels can carry their own em-dash annotation
                      ("compress — trade detail for room"); only the name
                      before it belongs on this button, or the dashes chain */}
                  {whatIf.label.split(" — ")[0]} — replay from the choice
                </span>
              </span>
              <span aria-hidden className="font-mono text-accent">
                ↺
              </span>
            </button>
          )}
          <span className="font-mono text-[11px] text-[#a9adb9]">
            or drag the timeline back — every step is still there
          </span>
        </div>
      </div>
    </section>
  );
}
