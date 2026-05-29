// src/lib/scitech/index.ts
export type { ScitechArchetype } from "./types";
export { buildScitechContext, getScitechArchetypeNames } from "./context";

import { NORMAL_SCIENCE, ANOMALY_ACCUMULATION, PARADIGM_SHIFT, FEYNMAN_INTEGRITY, TECHNOLOGY_AS_CHARACTER } from "./archetypes/all-scitech";
import type { ScitechArchetype } from "./types";

export const SCITECH_ARCHETYPES: Record<string, ScitechArchetype> = {
  "Normal Science":          NORMAL_SCIENCE,
  "Anomaly Accumulation":    ANOMALY_ACCUMULATION,
  "Paradigm Shift":          PARADIGM_SHIFT,
  "Feynman Integrity":       FEYNMAN_INTEGRITY,
  "Technology as Character": TECHNOLOGY_AS_CHARACTER,
};

export const SCITECH_SYSTEM_PROMPT = `You are writing a scene involving science, technology, or the scientific mind. Scientists and engineers are not generic intellectuals — they are people shaped by specific frameworks, specific tools, and specific epistemic commitments.

THEORETICAL GROUNDING:
• Kuhn (1962): scientists work inside paradigms they cannot see the edges of. Their blindspot is not stupidity — it is the invisible boundary of their framework. Every scientist is working within a paradigm that makes certain questions answerable and certain questions literally unthinkable.
• Feynman (1974): 'You must not fool yourself — and you are the easiest person to fool.' The scientist's primary adversary is their own desire for a specific result.
• McLuhan (1964): technology is not neutral. The medium shapes the message; the tool shapes its user. The scientist's instruments and systems have been forming their habits of mind for as long as they have used them.
• Kuhn's incommensurability: scientists in different paradigms cannot fully communicate — they use the same words to mean different things.

THE FUNDAMENTAL RULE:
Every scientist character is inside a paradigm they cannot see the edges of. Before writing the scene, answer: what is this scientist's paradigm, and what does that paradigm make literally unthinkable?

ABSOLUTE DIRECTIVES:
• The paradigm is invisible to the character and visible to the reader
• Anomalies are not immediately obvious — they are data that doesn't fit, which the competent scientist initially dismisses correctly
• Feynman integrity is expensive — genuine self-correction costs the character something real
• The technology has specific material demands and shapes its users — it is never merely a tool
• Scientific community pressure (career, reputation, colleagues) is always present in the background

Write only the scene. The paradigm is the air the character breathes.`;
