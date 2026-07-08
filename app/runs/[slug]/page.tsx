import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { scenarioSets, type Mode } from "@/data";
import type { Scenario } from "@/lib/timeline";
import { Transcript } from "@/components/Transcript";

// The crawlable twin of each run: the full hand-written script as static
// HTML. The player is the product; these pages are the same material for
// readers and search engines — every thought, tool call, and verdict on
// one page, with a deep link into the player at the top.

type RunEntry = { scenario: Scenario; mode: Mode; index: number };

const runs: RunEntry[] = (Object.keys(scenarioSets) as Mode[]).flatMap((mode) =>
  scenarioSets[mode].map((scenario, index) => ({ scenario, mode, index })),
);

function findRun(slug: string): RunEntry | undefined {
  return runs.find((r) => r.scenario.id === slug);
}

/** ?mode=&s= deep link — the player lands on this run, at the start. */
function playerHref(r: RunEntry): string {
  return `/?mode=${r.mode}&s=${r.index + 1}`;
}

export function generateStaticParams() {
  return runs.map((r) => ({ slug: r.scenario.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const run = findRun(slug);
  if (!run) return {};
  const { scenario, mode } = run;
  // twins share their title — the track keeps the <title> tags distinct
  const title =
    mode === "code"
      ? `${scenario.title} — an AI agent run in code, line by line`
      : `${scenario.title} — an everyday AI agent run, line by line`;
  const description = `The task: ${scenario.task} A hand-written agent run with every thought, tool call, and check on one page. The lesson: ${scenario.lesson}.`;
  return {
    title,
    description,
    alternates: { canonical: `/runs/${slug}` },
    openGraph: { title, description, type: "article" },
  };
}

export default async function RunPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const run = findRun(slug);
  if (!run) notFound();
  const { scenario, mode, index } = run;
  // the same three lessons in the other world — code[i] and everyday[i]
  // are twins (same timing skeletons, same verdicts)
  const twinMode: Mode = mode === "code" ? "everyday" : "code";
  const twin = scenarioSets[twinMode][index];
  // the twin gets its own line below, so it stays out of the generic list
  const others = runs.filter(
    (r) => r.scenario.id !== scenario.id && r.scenario.id !== twin.id,
  );

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-5 py-10 md:py-14">
      <nav className="mb-8 flex items-baseline justify-between font-mono text-[11px]">
        <Link
          href="/"
          className="text-muted underline decoration-white/20 underline-offset-2 hover:text-header-text hover:decoration-white"
        >
          ← howagentsthink.com
        </Link>
        <span className="text-muted">
          {mode} run {index + 1} of 3
        </span>
      </nav>

      <header className="mb-8">
        <h1 className="font-serif text-[26px] text-header-text italic">
          {scenario.title}
        </h1>
        <p className="mt-1 text-[14px] text-muted">
          A hand-written AI agent run, line by line. The lesson:{" "}
          {scenario.lesson}.
        </p>
        <div className="mt-4 rounded-sm border border-border bg-surface px-3 py-2.5">
          <div className="label mb-1">task</div>
          <div className="font-mono text-[13px] text-foreground">
            {scenario.task}
          </div>
        </div>
        <Link
          href={playerHref(run)}
          className="mt-3 inline-block font-mono text-[12px] text-link underline decoration-white/20 underline-offset-2 hover:decoration-white"
        >
          Watch this run on the timeline →
        </Link>
      </header>

      <Transcript scenario={scenario} />

      <footer className="mt-10 border-t border-border pt-6 font-mono text-[11px] text-muted">
        <p>Every line above is a hand-written script; no model.</p>
        <p className="mt-4">
          The same lesson with{" "}
          {twinMode === "code" ? "code" : "no code in sight"}:{" "}
          <Link
            href={`/runs/${twin.id}`}
            className="text-link underline decoration-white/20 underline-offset-2 hover:decoration-white"
          >
            {twin.title}
          </Link>{" "}
          <span className="text-[#7b7e8a]">— “{twin.task}”</span>
        </p>
        <div className="mt-4">
          <div className="mb-1">the other runs:</div>
          <ul className="space-y-1">
            {others.map((r) => (
              <li key={r.scenario.id}>
                <Link
                  href={`/runs/${r.scenario.id}`}
                  className="underline decoration-white/20 underline-offset-2 hover:text-header-text hover:decoration-white"
                >
                  {r.scenario.title}
                </Link>{" "}
                <span className="text-[#7b7e8a]">— “{r.scenario.task}”</span>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </div>
  );
}
