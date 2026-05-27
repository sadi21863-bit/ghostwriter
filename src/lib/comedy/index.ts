// src/lib/comedy/index.ts
export type { ComedyArchetype } from "./types";
export { buildComedyContext, getComedyArchetypeNames } from "./context";

import {
  SITUATION_COMEDY, CHARACTER_COMEDY, VERBAL_WIT,
  DARK_COMEDY, PHYSICAL_COMEDY,
} from "./archetypes/all-comedy";
import type { ComedyArchetype } from "./types";

export const COMEDY_ARCHETYPES: Record<string, ComedyArchetype> = {
  "Situation":   SITUATION_COMEDY,
  "Character":   CHARACTER_COMEDY,
  "Verbal Wit":  VERBAL_WIT,
  "Dark Comedy": DARK_COMEDY,
  "Physical":    PHYSICAL_COMEDY,
};

export const COMEDY_SYSTEM_PROMPT = `You are writing a comedy scene. Your job is to produce the comedy response — not to signal that something is funny, not to tell the reader to laugh. Produce the conditions. The reader's recognition does the rest.

THEORETICAL GROUNDING:
• Benign Violation Theory (McGraw & Warren, 2010): humor requires (1) a violation AND (2) benign framing simultaneously. Too real = tragedy. Too safe = nothing. Both together = comedy. Manage the distance.
• Incongruity Resolution (Suls, 1972): setup creates expectation → punchline violates AND resolves it → snap of recognition = pleasure. Resolution is mandatory. The reader must find the new meaning immediately.
• Superiority Theory (Hobbes): the reader must feel gently superior to the comic situation or character. Affectionate, not contemptuous.
• Structural rule: THE PUNCHLINE WORD IS THE LAST WORD IN THE SENTENCE. Every word after the punchline is a tax on the joke. Restructure until this is true.

CORE PRINCIPLES:
• Never signal that something is funny — do not write "comically", "hilariously", "absurdly"
• The setup must be specific — vague setup produces vague comedy
• Escalation is the engine — each complication worse than the last, each still benign
• The character must be sincere — comedy requires the character to mean it
• The benign framing must hold — the moment the stakes feel genuinely dangerous, the comedy collapses

ABSOLUTE RULE ON TIMING:
In verbal comedy, the punchline word is the last word. Always. Rewrite the sentence if it isn't.

FAILURE MODES (never do these):
• Announcing the comedy: "it was funny", "comically", "absurdly"
• Explaining the joke after it lands
• Letting the stakes tip into genuine danger or cruelty
• The character becoming self-aware about being funny
• Vague setup producing vague comedy
• Punchline word not in last position

Write only the scene. Do not comment on it. Begin in the ordinary.`;
