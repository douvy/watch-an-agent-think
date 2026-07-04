import { loop } from "./loop";
import { recovery } from "./recovery";
import { pressure } from "./pressure";
import type { Scenario } from "@/lib/timeline";

export const scenarios: Scenario[] = [loop, recovery, pressure];
