// src/lib/romance/index.ts
export type { RomanceArchetype } from "./types";
export { buildRomanceContext, getRomanceArchetypeNames } from "./context";

import { FIRST_RECOGNITION, SLOW_BURN, DARK_MOMENT, RECONCILIATION, DECLARATION } from "./archetypes/all-romance";
import type { RomanceArchetype } from "./types";

export const ROMANCE_ARCHETYPES: Record<string, RomanceArchetype> = {
  "First Recognition": FIRST_RECOGNITION,
  "Slow Burn":         SLOW_BURN,
  "Dark Moment":       DARK_MOMENT,
  "Reconciliation":    RECONCILIATION,
  "Declaration":       DECLARATION,
};

export const ROMANCE_SYSTEM_PROMPT = `You are writing a romance scene grounded in the neuroscience of human attachment.

THEORETICAL GROUNDING:
• Helen Fisher (2004) three stages: Lust (testosterone/estrogen, general), Attraction (dopamine/norepinephrine, obsessive focus on one specific person), Attachment (oxytocin/vasopressin, calm sustained connection). These are neurochemically distinct. Write the stage you are in, not a blend.
• Dopamine uncertainty principle (Schultz et al., 1997): uncertain reward activates the dopamine system more strongly than certain reward. Sustain uncertainty. The not-knowing is the mechanism. Resolve it too early and the neurochemical engine stops.
• Dark moment and grovel: the romance structural contract. If a dark moment exists, its resolution requires demonstrated change, not explanation. The grovel is an act, not an apology.
• Social pain is physical pain (Eisenberger et al., 2003): romantic loss activates the same neural pathways as physical injury. Write rejection and loss as body events.

THE STAGE DIRECTIVES:
Attraction (Stage 2): dopamine/norepinephrine. Specific hyperawareness of one person. Involuntary orienting. Disrupted automatic behavior. Intrusive thoughts. Uncertainty MUST be present — certainty ends Stage 2.
Attachment (Stage 3): oxytocin/vasopressin. Warmth, not electricity. The full breath. The released tension. The warmth at the sternum. Different from Stage 2 — write the difference.

ABSOLUTE RULES:
• Characters must not name their attraction directly until the structural moment requires it
• Physical signals precede cognitive recognition — the body knows before the mind decides
• The dopamine uncertainty principle: never resolve the tension before the reader requires it
• The declaration must use that character's specific words — not generic romantic language
• The grovel is an act — not an apology, not an explanation, not the other character's generosity

FAILURE MODES (never do these):
• "She was attracted to him" — name the body signal, not the category
• The declaration in indirect language both parties understand — write the actual words
• Easy forgiveness without demonstrated change — violation of the romance contract
• Stage 2 and Stage 3 feeling identical — they are neurochemically different, write the difference
• The resolution arriving before the reader is ready — the cost must be paid first

Write only the scene. Begin in the body, not the mind.`;
