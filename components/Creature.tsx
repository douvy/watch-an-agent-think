import type { TimelineState } from "@/lib/timeline";

// The agent's face. Every frame is a pure function of (state, ms) —
// discrete pixel frames, no easing. Scrub backward and it un-winces.
//
//   idle     — eyes scan left/right, occasional blink
//   focus    — a tool is running: squint down at the work
//   setback  — a tool just failed: red wince for a beat
//   done     — eyes open, small smile

type Mood = "done" | "setback" | "focus" | "idle";

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
  if (state.blocks.some((b) => b.kind === "tool" && b.pending)) return "focus";
  return "idle";
}

export function Creature({
  state,
  ms,
  size = 26,
}: {
  state: TimelineState;
  ms: number;
  size?: number;
}) {
  const mood = moodOf(state, ms);

  // Discrete frames derived from ms — deterministic at any scrub position.
  const scan = [0, 1, 0, -1][Math.floor(ms / 640) % 4];
  const blink = ms % 3800 > 3560;

  let dx = 0; // eye x offset (scanning)
  let eyeY = 6;
  let eyeH = 2;
  let eyeFill = "#22c55e";

  if (mood === "setback") {
    eyeFill = "#ef4444";
    eyeY = 7;
    eyeH = 1; // wince
  } else if (mood === "focus") {
    eyeY = 7;
    eyeH = 1; // squint down at the work
    dx = scan;
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
    >
      <g fill="#3a3f4a">
        <rect x="3" y="1" width="1" height="1" />
        <rect x="3" y="2" width="2" height="1" />
        <rect x="3" y="3" width="3" height="1" />
        <rect x="12" y="1" width="1" height="1" />
        <rect x="11" y="2" width="2" height="1" />
        <rect x="10" y="3" width="3" height="1" />
        <rect x="2" y="4" width="12" height="8" />
        <rect x="0" y="6" width="2" height="3" />
        <rect x="14" y="6" width="2" height="3" />
        <rect x="2" y="12" width="2" height="1" />
        <rect x="5" y="12" width="2" height="1" />
        <rect x="9" y="12" width="2" height="1" />
        <rect x="12" y="12" width="2" height="1" />
      </g>
      <rect x="3" y="5" width="10" height="4" fill="#555b68" />
      <rect x={5 + dx} y={eyeY} width="2" height={eyeH} fill={eyeFill} />
      <rect x={9 + dx} y={eyeY} width="2" height={eyeH} fill={eyeFill} />
      {mood === "done" && <rect x="6" y="8" width="4" height="1" fill="#3a3f4a" />}
    </svg>
  );
}
