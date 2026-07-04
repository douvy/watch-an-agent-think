import { Player } from "@/components/Player";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-16">
      <header className="mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element -- pixel SVG, no optimization wanted */}
        <img src="/icon.svg" alt="" width={40} height={40} className="mb-4" />
        <p className="label mb-3">interactive explainer</p>
        <h1 className="mb-3 text-3xl font-semibold tracking-tight text-header-text md:text-4xl">
          Watch an AI agent think
        </h1>
        <p className="max-w-xl font-mono text-[13px] leading-relaxed text-muted">
          Three agent runs on a scrubbable timeline — planning, tool calls,
          failure, recovery, context pressure. No model behind this page;
          every run is a script you can scrub.
        </p>
      </header>

      <Player />

      <footer className="mt-10 flex items-baseline justify-between border-t border-border pt-4">
        <span className="font-mono text-[11px] text-[#5c6070]">
          Design engineer. I make AI comprehensible.
        </span>
        <a
          href="https://github.com/douvy/watch-an-agent-think"
          className="font-mono text-[11px] text-muted hover:text-header-text"
        >
          source
        </a>
      </footer>
    </div>
  );
}
