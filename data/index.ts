import { loop } from "./loop";
import { recovery } from "./recovery";
import { pressure } from "./pressure";
import { fridge } from "./fridge";
import { productive } from "./productive";
import { apartments } from "./apartments";
import type { Scenario } from "@/lib/timeline";

// Two tracks, one thesis: the code set is the real material; the everyday
// set teaches the identical three lessons with no code in sight — same
// timing skeletons, same verdicts, different world. The reader flips
// between them with the mode toggle in the tab rail.
export type Mode = "code" | "everyday";

export const scenarioSets: Record<Mode, Scenario[]> = {
  code: [loop, recovery, pressure],
  everyday: [fridge, productive, apartments],
};
