// The mascot's voice — tiny chiptune blips synthesized in WebAudio, no
// audio files. Square waves and quick pitch slides, pacman/mario register.
// Sound is inherently temporal, so unlike everything else it can't be a
// pure function of scrub position: it fires on event edges during playback
// only. One lazy AudioContext (created on the toggle click, which
// satisfies the browser's gesture rule), whisper-quiet master gain.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ensure(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function blip(
  freq: number,
  at: number,
  dur: number,
  peak: number,
  glideTo?: number,
  type: OscillatorType = "square",
) {
  const c = ensure();
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  // the slide is the whole personality — waka up, waka down
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  // fast attack, exponential tail — rounded little pips, no clicks
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master!);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export type Chirp = "move" | "ok" | "fail" | "ask" | "compact" | "done";

// Footsteps random-walk a pentatonic scale — every step lands on a
// different note, so he hums his way through the run instead of
// repeating one waka. Pentatonic = no wrong notes, whatever the walk does.
const SCALE = [392, 440, 523, 587, 659, 784];
let stepIdx = 2;

export function chirp(kind: Chirp) {
  switch (kind) {
    case "move": {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const leap = Math.random() < 0.25 ? 2 : 1;
      stepIdx = Math.max(0, Math.min(SCALE.length - 1, stepIdx + dir * leap));
      const f = SCALE[stepIdx];
      blip(f, 0, 0.06, 0.035, f * 1.2);
      break;
    }
    case "ok": // a quieter little confirm — up a third
      blip(523, 0, 0.05, 0.025);
      blip(659, 0.05, 0.07, 0.025);
      break;
    case "fail": // a low oof, falling — mario-takes-a-hit
      blip(330, 0, 0.16, 0.03, 147);
      break;
    case "ask": // rising, like a question
      blip(440, 0, 0.12, 0.04, 660);
      break;
    case "compact": // a little exhale, sliding down soft
      blip(523, 0, 0.18, 0.04, 262, "sine");
      break;
    case "done": // 1-up arpeggio
      blip(523, 0, 0.07, 0.04);
      blip(659, 0.07, 0.07, 0.04);
      blip(784, 0.14, 0.07, 0.04);
      blip(1046, 0.21, 0.16, 0.04);
      break;
  }
}
