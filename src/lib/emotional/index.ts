// src/lib/emotional/index.ts
export type { EmotionArchetype, PolyvagalState, FacsSignature, SomaticSignature } from "./types";
export { buildEmotionalContext, getEmotionNames } from "./context";

import { GRIEF, RAGE, FEAR } from "./emotions/grief-rage-fear";
import { SHAME, JOY, INTIMACY, DESPAIR } from "./emotions/shame-joy-intimacy-despair";
import type { EmotionArchetype } from "./types";

export const EMOTIONAL_ARCHETYPES: Record<string, EmotionArchetype> = {
  "Grief":     GRIEF,
  "Rage":      RAGE,
  "Fear":      FEAR,
  "Shame":     SHAME,
  "Joy":       JOY,
  "Intimacy":  INTIMACY,
  "Despair":   DESPAIR,
};
