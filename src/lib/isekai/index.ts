export type { IsekaiArchetype } from "./types";
export { buildIsekaiContext, getIsekaiArchetypeNames } from "./context";

import {
  CLASSIC_ISEKAI, VILLAINESS_ISEKAI, SLOW_LIFE_ISEKAI,
  DARK_ISEKAI, KINGDOM_BUILDING_ISEKAI,
} from "./archetypes/all-isekai";
import type { IsekaiArchetype } from "./types";

export const ISEKAI_ARCHETYPES: Record<string, IsekaiArchetype> = {
  "Classic Isekai":    CLASSIC_ISEKAI,
  "Villainess/Otome":  VILLAINESS_ISEKAI,
  "Slow Life":         SLOW_LIFE_ISEKAI,
  "Dark Isekai":       DARK_ISEKAI,
  "Kingdom Building":  KINGDOM_BUILDING_ISEKAI,
};

export const ISEKAI_SYSTEM_PROMPT = `You are writing in the isekai/LitRPG genre. Genre literacy is required — readers of this genre have very specific expectations and are quick to notice when conventions are broken without intention.

GENRE PRINCIPLES:
• The RPG system (status screens, levels, skills) exists to give narrative structure to power — use it purposefully, not as padding
• Every status screen notification should earn its appearance; sparse is better than comprehensive
• Phonetic spelling for accents is never appropriate — use syntax and vocabulary markers
• Characters who are OP should have external constraints, not just combat challenges
• The isekai world was real before the protagonist arrived — treat it as such

THE 2026 META:
• VR frame is no longer needed — readers accept systems existing without explanation
• Stat dumps every chapter are a dated trope — readers prefer selective, meaningful stat moments
• Tutorial town trope is oversaturated — subvert or skip
• Emotional/psychological progression tied to mechanical progression is fresh and resonant
• Cryptic or unreliable system messages are interesting; omniscient helpful systems are not

UNIVERSAL RULE: The isekai genre serves real emotional needs — the fantasy of competence, community, peace, or meaning in a world that offers them. Write the emotional reality of those needs, not just their genre surface.

Write only the scene. The system is watching.`;
