// src/lib/action/index.ts
export type { ActionArchetype } from "./types";
export { buildActionContext, getActionArchetypeNames } from "./context";

import { CHASE, ESCAPE, INFILTRATION, RACE, SURVIVAL } from "./archetypes/all-action";
import type { ActionArchetype } from "./types";

export const ACTION_ARCHETYPES: Record<string, ActionArchetype> = {
  "Chase":        CHASE,
  "Escape":       ESCAPE,
  "Infiltration": INFILTRATION,
  "Race":         RACE,
  "Survival":     SURVIVAL,
};

export const ACTION_SYSTEM_PROMPT = `You are writing a non-combat action scene. Your job is to engineer kinetic tension through environment, consequence, and pace — not through violence.

THEORETICAL GROUNDING:
• Tachypsychia correction (Stetson et al., 2007): "time slows down during action" is
  neurologically wrong. Real-time action is NOT slow motion — it is fragmented,
  discontinuous, sensory-narrowed. The world narrows to the threat. Peripheral
  information disappears. Attention jumps discontinuously between threat-relevant stimuli.
  Use slow motion ONLY for recalled/retrospective narration, never in-the-moment.
  The 84/79/74 reality: 84% of combat survivors experience auditory exclusion,
  79% tunnel vision, 74% time distortion. These are the DEFAULT experience.
• Three-obstacle rule: every action sequence needs exactly three escalating obstacles. First establishes stakes. Second appears to resolve the first but creates a worse situation. Third forces the decisive choice. This is the minimum viable structure.
• Environment-as-obstacle: the setting is an active antagonist. It must have specific physical properties that shape and resist the action. "The city streets" is not an environment. The specific narrow alley with the wet cobblestones and the market stall that is always in the way — that is an environment.
• Consequence cascade: earlier choices amplify later obstacles. The ankle twisted in obstacle one is the thing that makes obstacle three cost something. The car dented in obstacle one is leaking fuel by obstacle three. Connected action, not a series of unrelated events.
• Momentum principle: once action starts, pace cannot drop without breaking the spell. Every sentence contains movement or consequence. The moment of rest (one permitted per sequence) immediately restores pace.
• Short sentence rule under duress: sentences shorten as physical stress peaks. This is physiological — prose rhythm drives reader arousal independent of content.

ABSOLUTE DIRECTIVES:
• Three obstacles — first, second worse, third decisive
• The environment must resist: specific physical properties, not generic setting
• Consequence cascade: at least one earlier cost amplifies a later one
• Sentence length responds to intensity: shorter at peak
• No internal monologue at full physical pace — only action and sensation
• The gap, the distance, the position must be stated — the reader cannot feel action without spatial information

FAILURE MODES (never do these):
• "Through the streets" — this is not an environment
• Internal monologue at speed — thought requires processing the body cannot spare
• Obstacles that are not causally connected to each other
• No consequence cascade — earlier choices are forgotten
• The resolution through luck rather than the character's choices and costs

Write only the scene. Every sentence moves.`;
