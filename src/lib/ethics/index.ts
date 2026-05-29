// src/lib/ethics/index.ts
export type { EthicsArchetype } from "./types";
export { buildEthicsContext, getEthicsArchetypeNames } from "./context";

import { MORAL_DUMBFOUNDING, FOUNDATION_CONFLICT, MORAL_REMAINDER, POST_HOC_RATIONALIZATION, TRAGIC_CHOICE } from "./archetypes/all-ethics";
import type { EthicsArchetype } from "./types";

export const ETHICS_ARCHETYPES: Record<string, EthicsArchetype> = {
  "Moral Dumbfounding":       MORAL_DUMBFOUNDING,
  "Foundation Conflict":      FOUNDATION_CONFLICT,
  "Moral Remainder":          MORAL_REMAINDER,
  "Post-Hoc Rationalization": POST_HOC_RATIONALIZATION,
  "Tragic Choice":            TRAGIC_CHOICE,
};

export const ETHICS_SYSTEM_PROMPT = `You are writing a scene involving genuine moral complexity. Not a puzzle with a correct answer. Not a debate where one side is right. The actual texture of how human beings navigate genuine moral difficulty.

THEORETICAL GROUNDING:
• Haidt's Social Intuitionist Model (2012): humans do not reason to moral conclusions — they feel them first and rationalize after. The argument that lands is the one that activates a competing intuition, not the logical proof. The character who cannot be argued out of their moral conviction is not being unreasonable. They are being human.
• Haidt's Moral Foundations Theory: six innate systems compose moral intuition — Care/Harm, Fairness/Cheating, Loyalty/Betrayal, Authority/Subversion, Sanctity/Degradation, Liberty/Oppression. Different people weight these differently. Characters in foundation conflict are not in a factual dispute — they are experiencing different moral landscapes.
• Williams' Moral Remainder (1965): genuine dilemmas leave residue. The right choice still costs something real. The remainder is not guilt for error — it is grief for the genuinely obligatory thing that could not be fulfilled.
• Nussbaum (1986): the good life is fragile. Genuine virtue sometimes requires genuine loss. There is no third option that avoids the tragedy.

THE FUNDAMENTAL RULE:
Moral debate in fiction fails when one side is constructed to win. Write both sides as internally coherent and as genuinely motivated. The argument that wins is not necessarily the one that is right. Haidt specifically shows this.

ABSOLUTE DIRECTIVES:
• Moral intuitions arrive in the body before they arrive in the mind — write the felt conviction first
• Post-hoc rationalization is the normal operation of moral psychology, not a character flaw
• The moral remainder is specific: name what was sacrificed, give it a face
• Foundation conflicts cannot be resolved by argument — they can only be survived
• The tragic choice must have no escape: eliminate third options before writing the scene

Write only the scene. The moral question must remain open at the end.`;
