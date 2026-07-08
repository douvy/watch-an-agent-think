import {
  Terminal,
  FileText,
  Pencil,
  Search,
  Archive,
  MessageCircle,
} from "lucide-react";
import type { Scenario, TimelineEvent } from "@/lib/timeline";
import {
  beats,
  branchLabels,
  type ToolResultEvent,
  type TranscriptBeat,
} from "@/lib/transcript";

// The static twin of the player's stream: same events, same visual
// vocabulary (mono tool lines, serif thoughts, hairline borders), no
// clock and no client JS. Server-rendered so the whole script is in the
// HTML. Differences from StreamBlock are deliberate:
//   - results render attached to their call (no pending state to animate)
//   - branch beats appear in script order tagged with the pick that fires
//     them — the player runs one path; the page shows the whole script
//   - failing results keep their narration inline (the player sends it to
//     the marquee, which doesn't exist here)

const TOOL_ICONS: Record<string, typeof Terminal> = {
  bash: Terminal,
  read: FileText,
  edit: Pencil,
  grep: Search,
  look: Search,
  do: Pencil,
  ask: MessageCircle,
};

function Narration({ text }: { text: string }) {
  return (
    <div className="font-serif text-[13px] leading-snug text-foreground italic">
      {text}
    </div>
  );
}

/** The pick that fires this beat, e.g. `if you picked “a date that won't parse”`. */
function BranchTag({
  e,
  labels,
}: {
  e: { branch?: { choice: string; option: string } };
  labels: Map<string, string>;
}) {
  if (!e.branch) return null;
  const label = labels.get(`${e.branch.choice}:${e.branch.option}`);
  return (
    <div className="mb-1 font-mono text-[10px] text-human/70">
      if you picked “{label}”
    </div>
  );
}

function Result({
  r,
  labels,
}: {
  r: ToolResultEvent;
  labels: Map<string, string>;
}) {
  return (
    <div
      className={`mt-1 ml-1.5 border-l pl-3 text-[12px] ${
        r.ok ? "border-border text-muted" : "border-accent-negative/60 text-foreground"
      }`}
    >
      <BranchTag e={r} labels={labels} />
      {r.output}
      {r.narration && (
        <div className="mt-1">
          <Narration text={r.narration} />
        </div>
      )}
    </div>
  );
}

function EventBlock({
  e,
  labels,
}: {
  e: TimelineEvent;
  labels: Map<string, string>;
}) {
  switch (e.type) {
    case "plan":
      return (
        <div className="rounded-sm border border-border bg-surface px-3 py-2.5">
          <div className="label mb-1.5">plan</div>
          {e.narration && (
            <div className="mb-2">
              <Narration text={e.narration} />
            </div>
          )}
          <ol className="list-decimal space-y-0.5 pl-5 font-mono text-[12px] leading-relaxed text-muted">
            {e.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      );

    case "thought":
      return (
        <div className="border-l border-border py-0.5 pl-3">
          <BranchTag e={e} labels={labels} />
          <div className="font-serif text-[15px] leading-relaxed text-foreground italic">
            {e.text}
          </div>
        </div>
      );

    case "choice":
      return (
        <div className="relative rounded-sm border border-border bg-surface px-3 py-2.5">
          <span
            aria-hidden
            className="absolute top-0 bottom-0 left-0 w-[2px] bg-human/40"
          />
          <div className="label mb-1.5 text-human">your call</div>
          {e.narration && (
            <div className="mb-1.5">
              <Narration text={e.narration} />
            </div>
          )}
          <div className="font-serif text-[15px] leading-snug text-header-text italic">
            {e.prompt}
          </div>
          <div className="mt-2 font-mono text-[11px] text-muted">
            {e.options.map((o) => `“${o.label}”`).join(" or ")}
          </div>
          <div className="mt-1 font-mono text-[11px] text-muted">
            The script writes both paths. Beats tagged with a pick happen only
            on that path.
          </div>
        </div>
      );

    case "plan_dead":
      return (
        <div className="border-l-2 border-accent-negative/60 py-0.5 pl-3">
          <div className="label mb-1 text-accent-negative">
            plan dead — {e.reason}
          </div>
          {e.narration && <Narration text={e.narration} />}
        </div>
      );

    case "compact":
      return (
        <div className="rounded-sm border border-border bg-surface px-3 py-2.5">
          <div className="mb-1 flex items-center gap-2">
            <Archive size={11} className="text-warning" />
            <span className="label">compacted</span>
          </div>
          {e.narration && (
            <div className="mb-1">
              <Narration text={e.narration} />
            </div>
          )}
          <div className="font-mono text-[12px] leading-relaxed text-muted">
            {e.summary}
          </div>
        </div>
      );

    case "done":
      return (
        <div className="border-l-2 border-accent py-0.5 pl-3">
          <div className="label mb-1 text-accent">done</div>
          <div className="font-serif text-[17px] text-header-text italic">
            {e.verdict}
          </div>
          {e.takeaway && (
            <ul className="mt-2 space-y-1">
              {e.takeaway.map((t) => (
                <li
                  key={t}
                  className="flex gap-2 font-serif text-[13px] leading-snug text-foreground"
                >
                  <span className="shrink-0 text-accent">·</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );

    default:
      return null;
  }
}

function CallBeat({
  beat,
  labels,
}: {
  beat: Extract<TranscriptBeat, { kind: "call" }>;
  labels: Map<string, string>;
}) {
  return (
    <div className="font-mono text-[12px] leading-relaxed">
      {beat.calls.map((c, i) => {
        const Icon = TOOL_ICONS[c.tool] ?? Terminal;
        return (
          <div key={i} className={i > 0 ? "mt-2" : undefined}>
            <BranchTag e={c} labels={labels} />
            <div className="flex items-center gap-2 text-muted">
              <Icon size={12} className="shrink-0 text-link/70" />
              <span className="text-link">{c.tool}</span>
              <span className="text-muted">{c.input}</span>
            </div>
            {(c.narration ?? c.why) && (
              <div className="mt-1 pl-5">
                <Narration text={(c.narration ?? c.why)!} />
              </div>
            )}
          </div>
        );
      })}
      {beat.results.map((r, i) => (
        <Result key={i} r={r} labels={labels} />
      ))}
    </div>
  );
}

export function Transcript({ scenario }: { scenario: Scenario }) {
  const labels = branchLabels(scenario.events);
  return (
    <div className="space-y-4">
      {beats(scenario.events).map((b, i) =>
        b.kind === "call" ? (
          <CallBeat key={i} beat={b} labels={labels} />
        ) : (
          <EventBlock key={i} e={b.e} labels={labels} />
        ),
      )}
    </div>
  );
}
