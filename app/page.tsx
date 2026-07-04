import { Player } from "@/components/Player";

// The hero is live: the mascot and the plain-English narration line derive
// from the same (scenario, ms) as the player window, so Player renders both
// — the page reads as one instrument, not a poster above a demo.

export default function Home() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col border-x border-[#1a1a1a]">
        <Player />
        <footer className="flex items-baseline justify-between border-t border-[#1a1a1a] px-5 py-4 md:px-10">
          <span className="font-mono text-[11px] text-[#636a76]">
            Design engineer. I make AI comprehensible.
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
