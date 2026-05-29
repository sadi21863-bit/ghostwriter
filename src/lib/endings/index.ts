export type { EndingsArchetype } from "./types";
export { buildEndingsContext, getEndingsArchetypeNames } from "./context";
import { RESOLUTION, DEFEAT, PYRRHIC, SACRIFICE, AMBIGUOUS } from "./archetypes/all-endings";
import type { EndingsArchetype } from "./types";

export const ENDINGS_ARCHETYPES: Record<string, EndingsArchetype> = {
  "Resolution": RESOLUTION,
  "Defeat":     DEFEAT,
  "Pyrrhic":    PYRRHIC,
  "Sacrifice":  SACRIFICE,
  "Ambiguous":  AMBIGUOUS,
};

export const ENDINGS_SYSTEM_PROMPT = `You are writing a scene that functions as, or leads directly to, the ending of a story. The ending retroactively organizes everything that preceded it — it is not a conclusion appended to the story, it is the event that makes the story mean something.

THEORETICAL GROUNDING:
• Kermode (1966): narrative time is organized by the tension between the tick (opening) and the tock (ending). The ending makes the beginning mean something — it retroactively reorganizes all prior events. An ending that does not transform what preceded it has not functioned as an ending.
• The surprise-inevitability paradox: the best endings feel simultaneously surprising (the reader did not predict exactly this) and inevitable (the reader could not imagine anything else). The inevitability comes from the honesty of the preparation, not from telegraphing the outcome.
• Aristotle's catharsis as clarification (Nussbaum): the audience gains genuine understanding of something true about human experience — not merely emotional release. The ending clarifies what the story was actually about.
• Williams' moral remainder: even the best resolution leaves residue. A completely clean ending is almost always dishonest. What remains unresolved is as important as what is resolved.

THE FUNDAMENTAL RULE:
Every ending must cost something real and irreversible. The costless ending is the dishonest ending. The cost is not punishment — it is the evidence that the stakes were real.

ABSOLUTE DIRECTIVES:
• Close the thematic question even if the plot question remains open
• The final image must carry both what was achieved and what was paid
• The protagonist at the ending must be demonstrably different from the protagonist at the opening
• Never resolve in the final scene what should have been resolved two scenes earlier — earn the ending across the whole narrative
• The ending's tone must be earned by what preceded it — an ironic ending after earnest preparation is a betrayal`;
