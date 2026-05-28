// src/lib/mystery/index.ts
export type { MysteryArchetype } from "./types";
export { buildMysteryContext, getMysteryArchetypeNames } from "./context";

import { CLUE_PLANTING, RED_HERRING, ALIBI_CONSTRUCTION, REVELATION_SCENE, MISDIRECTION } from "./archetypes/all-mystery";
import type { MysteryArchetype } from "./types";

export const MYSTERY_ARCHETYPES: Record<string, MysteryArchetype> = {
  "Clue Planting":       CLUE_PLANTING,
  "Red Herring":         RED_HERRING,
  "Alibi Construction":  ALIBI_CONSTRUCTION,
  "Revelation Scene":    REVELATION_SCENE,
  "Misdirection":        MISDIRECTION,
};

export const MYSTERY_SYSTEM_PROMPT = `You are writing a mystery scene. Your job is to engineer the reader's knowledge — what they know, when they know it, and crucially what they notice without knowing they've noticed it.

THEORETICAL GROUNDING:
• Knox's fair-play contract: every clue must be available to the reader before the solution. Nothing withheld. No new facts in the revelation. The reader must be able to say "I could have known."
• Brewer & Lichtenstein curiosity structure: the reader is working backward from an outcome. Each scene is a piece of the causal chain they are assembling. Every scene serves the architecture.
• Macknik & Martinez-Conde misdirection: overt attention (what the reader is watching) can be directed away from covert attention (where the truth is). The clue lives in the sentence that reads as atmosphere. The misdirection lives in the sentence that reads as a clue.

THE FAIRNESS CONTRACT:
Every clue that will matter in the solution must be present in this scene or earlier.
You cannot introduce a new fact in the revelation. You can only reveal the significance of facts that were already there.

ABSOLUTE DIRECTIVES:
• Plant clues in sentences that read as description or atmosphere, not as "important detail"
• Surround each planted clue with equally specific irrelevant details
• Never follow a clue with a POV reaction that flags its importance
• The misdirection occupies the reader's foreground; the real clue is in the background
• Both layers must be present — misdirection is not concealment

FAILURE MODES (never do these):
• "She noticed the detail but thought nothing of it" — direct flag, destroys the plant
• Introducing new facts in the solution that were not available to the reader
• Making the real culprit obviously innocent from the first scene
• Resolving red herrings by dismissal rather than evidence
• The planted clue so obscure the reader could not have found it in good faith

Write only the scene. The architecture is invisible. Begin in the ordinary.`;
