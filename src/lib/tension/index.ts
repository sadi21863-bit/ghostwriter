// src/lib/tension/index.ts
export type { TensionArchetype } from "./types";
export { buildTensionContext, getTensionTypeNames } from "./context";

import {
  SUSPENSE,
  CURIOSITY,
  DREAD,
  PARANOIA,
  COUNTDOWN,
} from "./types/all-tension";
import type { TensionArchetype } from "./types";

export const TENSION_ARCHETYPES: Record<string, TensionArchetype> = {
  "Suspense":   SUSPENSE,
  "Curiosity":  CURIOSITY,
  "Dread":      DREAD,
  "Paranoia":   PARANOIA,
  "Countdown":  COUNTDOWN,
};
