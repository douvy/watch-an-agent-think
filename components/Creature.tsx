"use client";

import { useState } from "react";
import { CONTEXT_BUDGET, type TimelineState } from "@/lib/timeline";

// The agent's face. Every frame is a pure function of (state, ms) —
// discrete pixel frames, no easing. Scrub backward and it un-winces.
//
// States read at silhouette level, not eye level:
//   idle       — thought-dots rise above its head, eyes scan
//   focus      — a tool is running: arms type, squint down at the work
//   setback    — a tool just failed: red !, ears flatten, red wince
//   compacting — right after a compact: eyes squeezed shut, ears flat
//   asking     — a choice is live: yellow ?, ears up, steady eyes on you
//   panic      — memory near the ceiling: trembling, arms flailing, sweat
//   done       — ears up, eyes open, small smile

type Mood =
  | "done"
  | "setback"
  | "compacting"
  | "asking"
  | "panic"
  | "focus"
  | "idle";

const BODY = "#3a3f4a";
const PATCH = "#555b68";
const GREEN = "#84f0a1";
const RED = "#d45a2b";
const YELLOW = "#ffffc9";
const DOT = "#7b7e8a";

function moodOf(state: TimelineState, ms: number): Mood {
  if (state.done) return "done";
  for (const b of state.blocks) {
    if (
      b.kind === "tool" &&
      b.ok === false &&
      b.resultAt !== undefined &&
      ms - b.resultAt < 2200
    ) {
      return "setback";
    }
  }
  for (const b of state.blocks) {
    if (b.kind === "compact" && ms - b.at < 2200) return "compacting";
  }
  if (state.blocks.some((b) => b.kind === "choice" && b.picked === undefined))
    return "asking";
  // He starts sweating just before the meter goes red — the worker feels
  // the ceiling before the gauge admits it. Outranks focus: you can't
  // type calmly at 90% memory.
  if (state.tokens > CONTEXT_BUDGET * 0.88) return "panic";
  if (state.blocks.some((b) => b.kind === "tool" && b.pending)) return "focus";
  return "idle";
}

// The finale face — the trilogy-complete payoff. Arms up, pit vipers on,
// a crown, sparkles. The pose is static (this only renders while the clock
// is parked at an end frame, where f(ms) motion would freeze); the
// sparkles twinkle on a CSS steps() beat — see globals.css — so the
// pixels still move frame-by-frame, never ease.
export function CreatureTriumph({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={(size * 21) / 16}
      viewBox="0 -5 16 21"
      shapeRendering="crispEdges"
      aria-hidden
    >
      {/* sparkles — two plus-stars and two motes, on alternating beats */}
      <g fill={GREEN}>
        <g className="twinkle">
          <rect x="1" y="-4" width="1" height="1" />
          <rect x="0" y="-3" width="3" height="1" />
          <rect x="1" y="-2" width="1" height="1" />
        </g>
        <g className="twinkle-late">
          <rect x="14" y="-4" width="1" height="1" />
          <rect x="13" y="-3" width="3" height="1" />
          <rect x="14" y="-2" width="1" height="1" />
        </g>
        <rect className="twinkle-late" x="5" y="-1" width="1" height="1" />
        <rect className="twinkle" x="10" y="-2" width="1" height="1" />
      </g>
      {/* crown — seated between the ears */}
      <g fill={YELLOW}>
        <rect x="6" y="2" width="1" height="1" />
        <rect x="9" y="2" width="1" height="1" />
        <rect x="6" y="3" width="4" height="1" />
      </g>
      <g fill={BODY}>
        {/* ears up */}
        <rect x="3" y="1" width="1" height="1" />
        <rect x="3" y="2" width="2" height="1" />
        <rect x="3" y="3" width="3" height="1" />
        <rect x="12" y="1" width="1" height="1" />
        <rect x="11" y="2" width="2" height="1" />
        <rect x="10" y="3" width="3" height="1" />
        {/* body */}
        <rect x="2" y="4" width="12" height="8" />
        {/* arms raised */}
        <rect x="0" y="1" width="2" height="3" />
        <rect x="14" y="1" width="2" height="3" />
        {/* legs */}
        <rect x="2" y="12" width="2" height="1" />
        <rect x="5" y="12" width="2" height="1" />
        <rect x="9" y="12" width="2" height="1" />
        <rect x="12" y="12" width="2" height="1" />
      </g>
      <rect x="3" y="5" width="10" height="4" fill={PATCH} />
      {/* pit vipers — the trophy shades. Black frame bar, rainbow mirror
          lens banding in to the hot orange core, nose notch, and end caps
          a pixel past the head on each side: they wrap, that's the brand.
          One white glint rides the sparkles' twinkle beat. */}
      <g>
        <rect x="1" y="5" width="14" height="1" fill="#16181d" />
        <rect x="0" y="6" width="1" height="1" fill="#16181d" />
        <rect x="15" y="6" width="1" height="1" fill="#16181d" />
        <rect x="1" y="6" width="1" height="2" fill="#4f9cf0" />
        <rect x="14" y="6" width="1" height="2" fill="#4f9cf0" />
        <rect x="2" y="6" width="1" height="2" fill={GREEN} />
        <rect x="13" y="6" width="1" height="2" fill={GREEN} />
        <rect x="3" y="6" width="1" height="2" fill="#ffce3f" />
        <rect x="12" y="6" width="1" height="2" fill="#ffce3f" />
        <rect x="4" y="6" width="8" height="2" fill="#ff7a1e" />
        <rect x="6" y="6" width="4" height="2" fill="#e04616" />
        <rect x="7" y="7" width="2" height="1" fill="#16181d" />
        <rect
          className="twinkle-late"
          x="11"
          y="6"
          width="1"
          height="1"
          fill="#ffffff"
        />
      </g>
      <rect x="6" y="8" width="4" height="1" fill={BODY} />
    </svg>
  );
}

// The table mascot — the live sprite itself, at rest, pinned on the
// drafting grid under the terminal. Not a blueprint abstraction: same
// body, face patch, and green eyes as the player's creature, at figure
// scale — the construction lines around him carry the drafted look, the
// figure stays true. He blinks, twice a cycle hops sideways and leans
// on one foot, and clicks alternate two tricks: a backflip, then a
// coffee raised to you — all wall-clock CSS (see .blink/.bobble/
// .backflip/.cheers-* in globals.css), the same sanctioned bend as the
// twinkle: he lives on the table, not on the timeline. The flip class
// replaces the bobble for its 0.9s; the coffee rides along inside the
// svg, so he keeps bobbling while he drinks.
export function CreatureGhost({ scale = 6 }: { scale?: number }) {
  const [trick, setTrick] = useState<"backflip" | "cheers" | null>(null);
  const [clicks, setClicks] = useState(0);
  return (
    <svg
      width={16 * scale}
      height={12 * scale}
      viewBox="0 1 16 12"
      shapeRendering="crispEdges"
      aria-hidden
      className={`cursor-pointer ${trick === "backflip" ? "backflip" : "bobble"}`}
      onClick={() => {
        if (trick) return; // let the current trick finish
        // no animation under reduced motion means no animationend to
        // clear the trick — skip the easter egg entirely
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
          return;
        setTrick(clicks % 2 ? "cheers" : "backflip");
        setClicks(clicks + 1);
      }}
      // blink's animationend bubbles up from the eyes — only a trick
      // ending should hand the element back to the bobble
      onAnimationEnd={(e) => {
        if (e.animationName === "backflip" || e.animationName === "cheers-cup")
          setTrick(null);
      }}
    >
      {/* the at-rest frame — same cells as the live sprite in idle */}
      <g fill={BODY}>
        {/* ears */}
        <rect x="3" y="1" width="1" height="1" />
        <rect x="3" y="2" width="2" height="1" />
        <rect x="3" y="3" width="3" height="1" />
        <rect x="12" y="1" width="1" height="1" />
        <rect x="11" y="2" width="2" height="1" />
        <rect x="10" y="3" width="3" height="1" />
        {/* body */}
        <rect x="2" y="4" width="12" height="8" />
        {/* arms at rest */}
        <rect x="0" y="6" width="2" height="3" />
        <rect x="14" y="6" width="2" height="3" />
        {/* legs */}
        <rect x="2" y="12" width="2" height="1" />
        <rect x="5" y="12" width="2" height="1" />
        <rect x="9" y="12" width="2" height="1" />
        <rect x="12" y="12" width="2" height="1" />
      </g>
      <rect x="3" y="5" width="10" height="4" fill={PATCH} />
      {/* eyes — open is two rows; the blink drops the top row, leaving
          the live sprite's half-closed frame */}
      <g fill={GREEN}>
        <rect x="5" y="7" width="2" height="1" />
        <rect x="9" y="7" width="2" height="1" />
        <g className="blink">
          <rect x="5" y="6" width="2" height="1" />
          <rect x="9" y="6" width="2" height="1" />
        </g>
      </g>
      {/* the coffee trick — cup in the human's warm paper (it came from
          you), drawn at the mouth and carried out to his hand by the
          keyframes; steam reuses the twinkle beat and rides with the
          cup. Mounted only while the trick runs. */}
      {trick === "cheers" && (
        <>
          {/* the drinking pose — one toggle: rest arm covered in the
              table fill, a raised arm reaching across to the cup, eyes
              shut. Synced to the cup's trip by .cheers-hold. */}
          <g className="cheers-hold">
            <rect x="14" y="6" width="2" height="3" fill="#111318" />
            <rect x="14" y="7" width="1.5" height="1.5" fill={BODY} />
            <rect x="9" y="8" width="5" height="1" fill={BODY} />
            <rect x="5" y="6" width="2" height="2" fill={PATCH} />
            <rect x="9" y="6" width="2" height="2" fill={PATCH} />
          </g>
          <g className="cheers-cup">
            <g fill="#eceae0">
              <rect x="7" y="7.5" width="2" height="1.5" />
              <rect x="6.5" y="7.75" width="0.5" height="1" />
            </g>
            <g fill={DOT}>
              <rect
                className="twinkle"
                x="7.25"
                y="6.5"
                width="0.5"
                height="0.5"
              />
              <rect
                className="twinkle-late"
                x="8.5"
                y="6.75"
                width="0.5"
                height="0.5"
              />
            </g>
          </g>
        </>
      )}
    </svg>
  );
}

// Head-only crop of the sprite — an avatar, not a character. It marks the
// `why` annotations in the transcript as the mascot's own voice, so his
// reasoning reads as speech instead of floating metadata.
export function CreatureFace({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={(size * 9) / 12}
      viewBox="2 1 12 9"
      shapeRendering="crispEdges"
      aria-hidden
    >
      <g fill={BODY}>
        {/* ears */}
        <rect x="3" y="1" width="1" height="1" />
        <rect x="3" y="2" width="2" height="1" />
        <rect x="3" y="3" width="3" height="1" />
        <rect x="12" y="1" width="1" height="1" />
        <rect x="11" y="2" width="2" height="1" />
        <rect x="10" y="3" width="3" height="1" />
        {/* head */}
        <rect x="2" y="4" width="12" height="6" />
      </g>
      <rect x="3" y="5" width="10" height="4" fill={PATCH} />
      <rect x="5" y="6" width="2" height="2" fill={GREEN} />
      <rect x="9" y="6" width="2" height="2" fill={GREEN} />
    </svg>
  );
}

export function Creature({
  state,
  ms,
  size = 30,
}: {
  state: TimelineState;
  ms: number;
  size?: number;
}) {
  const mood = moodOf(state, ms);

  // Discrete frames derived from ms — deterministic at any scrub position.
  const scan = [0, 1, 0, -1][Math.floor(ms / 640) % 4];
  const blink = ms % 3800 > 3560;
  const dotCount = (Math.floor(ms / 450) % 3) + 1; // 1..3 thought dots
  const armDown = Math.floor(ms / 280) % 2; // typing cadence

  // Movement — same discrete pixel frames as the face, whole-sprite. A hop
  // as each event lands, a flinch down when one fails, a double-bounce at
  // the end, and a slow idle bob between beats. Pure f(ms): scrub back and
  // he un-hops.
  let dy = 0;
  const eventAge = ms - state.lastEventAt;
  const doneAt = state.blocks.find((b) => b.kind === "done")?.at;
  if (mood === "done" && doneAt !== undefined) {
    const a = ms - doneAt;
    dy = a < 640 ? [-1, 0, -1, 0][Math.floor(a / 160)] : 0;
  } else if (mood === "setback") {
    dy = eventAge >= 0 && eventAge < 240 ? 1 : 0;
  } else if (ms > 0 && eventAge >= 0 && eventAge < 180) {
    dy = -1;
  } else if (mood === "idle" || mood === "asking") {
    dy = Math.floor(ms / 820) % 2;
  }

  const earsFlat =
    mood === "setback" || mood === "compacting" || mood === "panic";

  // Panic runs on faster clocks than everything else — a 90ms whole-body
  // tremble and a 140ms arm flail, out of phase so he reads as scrambling,
  // not vibrating. Same discrete frames, still pure f(ms).
  const shake = mood === "panic" ? (Math.floor(ms / 90) % 2 ? 1 : -1) : 0;
  const flail = Math.floor(ms / 140) % 2 === 0;

  let dx = 0;
  let eyeY = 6;
  let eyeH = 2;
  let eyeFill = GREEN;
  let leftArmY = 6;
  let rightArmY = 6;

  if (mood === "setback") {
    eyeFill = RED;
    eyeY = 7;
    eyeH = 1;
  } else if (mood === "compacting") {
    eyeY = 7;
    eyeH = 1;
  } else if (mood === "panic") {
    // eyes blown wide, arms flailing overhead
    eyeY = 5;
    eyeH = 3;
    leftArmY = flail ? 1 : 3;
    rightArmY = flail ? 3 : 1;
  } else if (mood === "focus") {
    eyeY = 7;
    eyeH = 1;
    dx = scan;
    leftArmY = 6 + armDown;
    rightArmY = 7 - armDown;
  } else if (mood === "idle") {
    dx = scan;
    if (blink) {
      eyeY = 7;
      eyeH = 1;
    }
  }
  // done: eyes open and still, smile below

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden
      style={{ overflow: "visible" }} // hops cross the viewBox top by 1px
    >
      <g transform={`translate(${shake} ${dy})`}>
      {/* thought dots, rising up-right while idle — but not at the parked
          landing frame: frozen at ms=0 a single dot reads as a stray pixel
          on his head, not a thought. He waits clean-headed; the dots start
          rising the moment time moves. */}
      {mood === "idle" && ms > 0 && (
        <g fill={DOT}>
          {dotCount >= 1 && <rect x="6" y="2" width="1" height="1" />}
          {dotCount >= 2 && <rect x="8" y="1" width="1" height="1" />}
          {dotCount >= 3 && <rect x="10" y="0" width="1" height="1" />}
        </g>
      )}

      {/* setback: red exclamation above the head */}
      {mood === "setback" && (
        <g fill={RED}>
          <rect x="8" y="0" width="1" height="2" />
          <rect x="8" y="3" width="1" height="1" />
        </g>
      )}

      {/* panic: sweat flicking off alternating sides of his head */}
      {mood === "panic" && (
        <g fill="#eceae0">
          {flail ? (
            <rect x="2" y="1" width="1" height="1" />
          ) : (
            <rect x="13" y="0" width="1" height="1" />
          )}
        </g>
      )}

      {/* asking: yellow question mark — it's waiting on you */}
      {mood === "asking" && (
        <g fill={YELLOW}>
          <rect x="7" y="0" width="2" height="1" />
          <rect x="9" y="1" width="1" height="1" />
          <rect x="8" y="2" width="1" height="1" />
        </g>
      )}

      <g fill={BODY}>
        {/* ears — full triangles up, flattened stubs when hit */}
        {earsFlat ? (
          <>
            <rect x="3" y="3" width="3" height="1" />
            <rect x="10" y="3" width="3" height="1" />
          </>
        ) : (
          <>
            <rect x="3" y="1" width="1" height="1" />
            <rect x="3" y="2" width="2" height="1" />
            <rect x="3" y="3" width="3" height="1" />
            <rect x="12" y="1" width="1" height="1" />
            <rect x="11" y="2" width="2" height="1" />
            <rect x="10" y="3" width="3" height="1" />
          </>
        )}
        {/* body */}
        <rect x="2" y="4" width="12" height="8" />
        {/* arms — type while a tool runs */}
        <rect x="0" y={leftArmY} width="2" height="3" />
        <rect x="14" y={rightArmY} width="2" height="3" />
        {/* legs */}
        <rect x="2" y="12" width="2" height="1" />
        <rect x="5" y="12" width="2" height="1" />
        <rect x="9" y="12" width="2" height="1" />
        <rect x="12" y="12" width="2" height="1" />
      </g>
      <rect x="3" y="5" width="10" height="4" fill={PATCH} />
      <rect x={5 + dx} y={eyeY} width="2" height={eyeH} fill={eyeFill} />
      <rect x={9 + dx} y={eyeY} width="2" height={eyeH} fill={eyeFill} />
      {mood === "done" && <rect x="6" y="8" width="4" height="1" fill={BODY} />}
      {/* panic: little open mouth under the blown-wide eyes */}
      {mood === "panic" && <rect x="7" y="8" width="2" height="1" fill={BODY} />}
      </g>
    </svg>
  );
}
