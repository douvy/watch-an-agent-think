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

// The finale face — the trilogy-complete payoff. Arms up, star eyes, a
// crown, sparkles. The pose is static (this only renders while the clock
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
      {/* star eyes — plus-shaped, the pixel idiom for delight */}
      <g fill={GREEN}>
        <rect x="6" y="5" width="1" height="1" />
        <rect x="5" y="6" width="3" height="1" />
        <rect x="6" y="7" width="1" height="1" />
        <rect x="10" y="5" width="1" height="1" />
        <rect x="9" y="6" width="3" height="1" />
        <rect x="10" y="7" width="1" height="1" />
      </g>
      <rect x="6" y="8" width="4" height="1" fill={BODY} />
    </svg>
  );
}

// The blueprint — the hero's centerpiece, Zed-style: one giant faint
// hand drawing behind the text, not a tiled texture. It's the mascot's
// own schematic on the drafting table — silhouette traced in outline on
// his 16px grid, dashed construction guides extending off his key edges
// (ear tips, shoulders, feet, body walls), eyes as faint mint fills. The
// live sprite stands in front of his own drawing.
export function CreatureBlueprint({ scale = 7 }: { scale?: number }) {
  const INK = "#7b7e8a";
  return (
    <svg
      width={30 * scale}
      height={16 * scale}
      viewBox="-7 -1.5 30 16"
      shapeRendering="crispEdges"
      aria-hidden
    >
      {/* construction guides — the stitch idiom, extended off the drawing */}
      <g
        stroke={INK}
        strokeOpacity={0.1}
        strokeDasharray="0.43 0.71"
      >
        <line x1={-7} y1={1} x2={23} y2={1} vectorEffect="non-scaling-stroke" />
        <line x1={-7} y1={4} x2={23} y2={4} vectorEffect="non-scaling-stroke" />
        <line x1={-7} y1={13} x2={23} y2={13} vectorEffect="non-scaling-stroke" />
        <line x1={2} y1={-1.5} x2={2} y2={14.5} vectorEffect="non-scaling-stroke" />
        <line x1={14} y1={-1.5} x2={14} y2={14.5} vectorEffect="non-scaling-stroke" />
      </g>
      {/* silhouette — one closed stepped outline, ears/arms/legs and all */}
      <path
        d="M3 1 H4 V2 H5 V3 H6 V4 H10 V3 H11 V2 H12 V1 H13 V4 H14 V6 H16 V9 H14 V13 H12 V12 H11 V13 H9 V12 H7 V13 H5 V12 H4 V13 H2 V9 H0 V6 H2 V4 H3 Z"
        fill="none"
        stroke={INK}
        strokeOpacity={0.28}
        vectorEffect="non-scaling-stroke"
      />
      {/* face patch */}
      <rect
        x={3}
        y={5}
        width={10}
        height={4}
        fill="none"
        stroke={INK}
        strokeOpacity={0.16}
        vectorEffect="non-scaling-stroke"
      />
      {/* eyes — the only color on the sheet */}
      <g fill={GREEN} fillOpacity={0.16}>
        <rect x={5} y={6} width={2} height={2} />
        <rect x={9} y={6} width={2} height={2} />
      </g>
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
