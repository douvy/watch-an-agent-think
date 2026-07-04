import { Player } from "@/components/Player";

// The page is a drafting sheet: blueprint grid behind, hairline rails
// framing a single column, sections as ruled cells. Zed structure,
// pokeport palette.

function RuleMarks() {
  return (
    <>
      <span
        aria-hidden
        className="absolute -bottom-[7px] -left-[4px] font-mono text-[9px] leading-none text-[#3d3d3d] select-none"
      >
        +
      </span>
      <span
        aria-hidden
        className="absolute -right-[4px] -bottom-[7px] font-mono text-[9px] leading-none text-[#3d3d3d] select-none"
      >
        +
      </span>
    </>
  );
}

export default function Home() {
  return (
    <div className="blueprint min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col border-x border-[#1a1a1a]">
        <header className="relative border-b border-[#1a1a1a] px-5 py-10 md:px-10 md:py-14">
          <RuleMarks />
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

        <div className="flex-1 px-4 py-10 md:px-10">
          <Player />
        </div>

        <footer className="flex items-baseline justify-between border-t border-[#1a1a1a] px-5 py-4 md:px-10">
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
    </div>
  );
}
