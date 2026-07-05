import { Player } from "@/components/Player";

// The hero is live: the mascot and the plain-English narration line derive
// from the same (scenario, ms) as the player window, so Player renders both
// — the page reads as one instrument, not a poster above a demo.

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col border-x border-[#1a1a1a]">
        <Player />
        <footer className="relative flex items-baseline justify-between px-5 py-4 md:px-10">
          {/* top rule runs full-bleed past the rails, matching the header —
              the page grid's horizontal lines cross its verticals */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 left-1/2 h-px w-screen -translate-x-1/2 bg-[#1a1a1a]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -top-[7px] -left-[4px] font-mono text-[9px] leading-none text-[#4d525e] select-none"
          >
            +
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute -top-[7px] -right-[4px] font-mono text-[9px] leading-none text-[#4d525e] select-none"
          >
            +
          </span>
          <span className="font-mono text-[11px] text-[#636a76]">
            Design engineer. I make AI comprehensible.
          </span>
          <span className="hidden font-mono text-[11px] tracking-[0.14em] text-[#636a76] uppercase md:block">
            hand-scripted · no live model
          </span>
          <a
            href="https://github.com/douvy/watch-an-agent-think"
            className="font-mono text-[11px] text-muted hover:text-header-text"
          >
            source ↗
          </a>
        </footer>
      </div>
    </div>
  );
}
