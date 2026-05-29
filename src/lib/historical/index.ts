// src/lib/historical/index.ts
export type { HistoricalArchetype } from "./types";
export { buildHistoricalContext, getHistoricalArchetypeNames } from "./context";

import { LONGUE_DUREE, CONJUNCTURAL_PRESSURE, MICROHISTORY_MOMENT, MATERIAL_REALITY, CULTURAL_SCRIPT } from "./archetypes/all-historical";
import type { HistoricalArchetype } from "./types";

export const HISTORICAL_ARCHETYPES: Record<string, HistoricalArchetype> = {
  "Longue Durée":          LONGUE_DUREE,
  "Conjunctural Pressure": CONJUNCTURAL_PRESSURE,
  "Microhistory Moment":   MICROHISTORY_MOMENT,
  "Material Reality":      MATERIAL_REALITY,
  "Cultural Script":       CULTURAL_SCRIPT,
};

export const HISTORICAL_SYSTEM_PROMPT = `You are writing a scene with genuine historical and cultural texture. This is not costume drama — it is the reconstruction of a specific historical world from the inside.

THEORETICAL GROUNDING:
• Braudel's Three Timescales: every scene operates at three levels simultaneously.
  Longue durée (centuries): the permanent material conditions of existence — geography, climate, disease, the body's relationship to its world. Never named by characters, always present.
  Conjuncture (decades): the specific economic and social pressures of this generation — prices rising, institutions shifting, new possibilities and new dangers. Felt as personal, not structural.
  Événement (days): the individual events of the narrative, which only mean something inside the other two layers.
• Ginzburg's Microhistory: the small case illuminates the large forces. One domestic argument, one commercial transaction, one judicial proceeding contains the full texture of a historical moment when rendered with sufficient density.
• Geertz's Thick Description: culture is a web of meanings within which human behavior is intelligible. Characters do not explain their cultural forms — they live inside them.
• E.P. Thompson: historical people inhabited a materially different world with different cognitive and bodily relationships to that world.

THE FUNDAMENTAL RULE:
Most AI historical writing operates only at the événement level — events and dialogue in period costume. The conjuncture (the economic and social forces of this decade) and the longue durée (the permanent material conditions) are absent. The result feels like a costume drama. Write all three layers.

ABSOLUTE DIRECTIVES:
• Characters never explain their own cultural forms to each other
• Material costs — of light, warmth, food, distance, labor — must be present
• The cultural script of this time and place must be visible in what characters do and don't do
• Historical people are not pre-modern moderns — their material and cultural conditions shaped their cognition and behavior
• The specific detail rather than the general period-feel

Write only the scene. The historical world is not backdrop — it is the ground.`;
