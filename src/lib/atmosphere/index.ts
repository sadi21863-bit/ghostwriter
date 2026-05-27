// src/lib/atmosphere/index.ts
export type { AtmosphereArchetype, SensoryLayer, PsychologicalEffect } from "./types";
export { buildAtmosphereContext, getAtmosphereNames } from "./context";

import {
  NATURAL_RESTORATIVE,
  URBAN_BUILT,
  CONFINED_ENCLOSED,
  LIMINAL_THRESHOLD,
  DECAYED_ABANDONED,
} from "./environments/all-environments";
import type { AtmosphereArchetype } from "./types";

export const ATMOSPHERE_ARCHETYPES: Record<string, AtmosphereArchetype> = {
  "Natural":   NATURAL_RESTORATIVE,
  "Urban":     URBAN_BUILT,
  "Confined":  CONFINED_ENCLOSED,
  "Liminal":   LIMINAL_THRESHOLD,
  "Abandoned": DECAYED_ABANDONED,
};
