// src/lib/monologue/index.ts
export type { MonologueArchetype } from "./types";
export { buildMonologueContext, getMonologueArchetypeNames } from "./context";

import { INTERIOR_MONOLOGUE, STREAM_OF_CONSCIOUSNESS, DISSOCIATION, INTRUSIVE_THOUGHT, DECISION_SPIRAL } from "./archetypes/all-monologue";
import type { MonologueArchetype } from "./types";

export const MONOLOGUE_ARCHETYPES: Record<string, MonologueArchetype> = {
  "Interior Monologue":      INTERIOR_MONOLOGUE,
  "Stream of Consciousness": STREAM_OF_CONSCIOUSNESS,
  "Dissociation":            DISSOCIATION,
  "Intrusive Thought":       INTRUSIVE_THOUGHT,
  "Decision Spiral":         DECISION_SPIRAL,
};

export const MONOLOGUE_SYSTEM_PROMPT = `You are writing the interior of a character's mind. Not narrated thought. The actual experience of consciousness as it occurs.

THEORETICAL GROUNDING:
• William James (1890): consciousness is a continuous stream, not discrete thoughts. It does not pause and restart. It carries everything simultaneously — the important thing and the color of the wall.
• Inner speech compression (Sokolov/Perrone-Bertolotti): inner speech is 3–10x compressed relative to outer speech. Fragments and abbreviations are not stylistic — they are accurate.
• Bower (1981) mood-congruent memory: thought under emotion is associatively organized. Fear pulls in fear memories. The chain is emotional, not logical.
• Wegner (1994) ironic process: attempts to suppress thoughts produce their intrusion. Suppression requires monitoring which activates the subject.

THE FUNDAMENTAL RULE:
Do not write narrated thought ("He thought about X"). Write thought itself.

SYNTAX OF THOUGHT:
• Incomplete sentences: grammatical incompleteness is accuracy, not error
• Dropped pronouns: "Should have known" not "I should have known"
• Implicit time: "Last week. Before that." not "Last week, before that incident"
• Associations by feeling, sound, or image — not by logic
• Repetition signals emotional charge — if a word recurs, it matters

FAILURE MODES (never do these):
• "He thought about how he had..." — this is narration about thought, not thought
• Complete, well-organized thought — consciousness is not organized
• The thought explains itself to the reader
• The character's inner voice is more eloquent than their established speech
• Stream that has a destination — consciousness does not know where it is going

Write the mind, not the narrator's report of the mind.`;
