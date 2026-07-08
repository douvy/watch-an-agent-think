import type { Metadata } from "next";
import Link from "next/link";
import { CreatureGhost } from "@/components/Creature";
import { Player } from "@/components/Player";

// The player rewrites the URL with ?s=&t= while paused (deep links), so
// shared frame-links must all resolve to the one canonical page.
export const metadata: Metadata = { alternates: { canonical: "/" } };

// The hero is live: the mascot and the plain-English narration line derive
// from the same (scenario, ms) as the player window, so Player renders both
// — the page reads as one instrument, not a poster above a demo.

export default function Home() {
  // overflow-x-clip, not -hidden: hidden forces overflow-y to auto, which
  // makes this div a scroll container and silently disables the transport's
  // position:sticky on mobile. clip just clips.
  return (
    <div className="min-h-screen overflow-x-clip">
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col bg-[#111318]">
        {/* the inner container's vertical walls — drawn as line elements
            (same pattern as the stitched rails) so nothing can eat them */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-px bg-[#1d1e22]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-px bg-[#1d1e22]"
        />
        {/* Drafting-table margins — a layered edge, not a single container
            line: the solid inner rail is the wall, and 48px out a stitched
            construction line runs parallel (dashed lines are drafting
            vocabulary for guides, not walls). Every intersection where a
            horizontal rule crosses a vertical carries the same bordered
            pixel node — a rivet, one vocabulary for the whole grid.

            Three fills, Zed's real trick — the lines separate planes
            instead of decorating one. Zed's structure, our hue: their
            trio is near-neutral; ours leans into the terminal surfaces'
            blue cast (#30343d family) with a whisper ladder — #101216
            void (globals.css --background), #111316 gutter a half-step
            up with the blue reined in, and #111318 table catching the
            most light. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-full hidden w-12 bg-[#111316] xl:block"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-full hidden w-12 bg-[#111316] xl:block"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-full mr-12 hidden w-px xl:block"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, #232323 0 3px, transparent 3px 8px)",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-full ml-12 hidden w-px xl:block"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, #232323 0 3px, transparent 3px 8px)",
          }}
        />
        <Player />
        {/* the mascot's flat twin on the empty stretch of table below the
            machine — border-colored so he belongs to the page's line work,
            blinking every few seconds so he's alive. Normal flow (flex-1
            absorbs the free space), so it can never sit under text. */}
        <div className="hidden flex-1 items-center justify-center py-4 md:flex">
          <CreatureGhost scale={6} />
        </div>
        <footer className="relative flex items-baseline justify-between px-5 py-4 md:px-10">
          {/* top rule runs full-bleed past the rails, matching the header —
              the page grid's horizontal lines cross its verticals */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 left-1/2 h-px w-screen -translate-x-1/2 bg-[#1d1e22]"
          />
          {/* the same bordered nodes as the header's crossings — one
              rivet vocabulary for every intersection on the page */}
          <span
            aria-hidden
            className="pointer-events-none absolute -top-[2px] -left-[2px] z-10 h-[4px] w-[4px] border border-[#3a3f4a] bg-[#111318]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -top-[2px] -right-[2px] z-10 h-[4px] w-[4px] border border-[#3a3f4a] bg-[#111318]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -top-[2px] z-10 hidden h-[4px] w-[4px] border border-[#3a3f4a] bg-[#111318] xl:block"
            style={{ left: "calc(-3rem - 3px)" }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -top-[2px] z-10 hidden h-[4px] w-[4px] border border-[#3a3f4a] bg-[#111318] xl:block"
            style={{ right: "calc(-3rem - 3px)" }}
          />
          {/* the disclosure — the site's one honesty line, same fact as the
              meta description: nothing here is generated live */}
          <span className="font-mono text-[11px] text-[#7b8290] max-sm:hidden">
            Every run is a{" "}
            <Link
              href="/runs/loop"
              className="underline decoration-white/20 underline-offset-2 hover:text-header-text hover:decoration-white"
            >
              hand-written script
            </Link>
            ; no model.
          </span>
          <a
            href="https://github.com/douvy/how-agents-think"
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit font-mono text-[11px] text-muted underline decoration-white/20 underline-offset-2 hover:decoration-white"
          >
            Star on GitHub<span className="ml-2 text-white/50">↗</span>
          </a>
        </footer>
      </div>
    </div>
  );
}
