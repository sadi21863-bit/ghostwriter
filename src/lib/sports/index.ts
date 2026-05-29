// src/lib/sports/index.ts
export type { SportsArchetype } from "./types";
export { buildSportsContext, getSportsArchetypeNames } from "./context";

import { FLOW_STATE, PRESSURE_PERFORMANCE, TEAM_DYNAMICS, THE_COMEBACK, DEFEAT } from "./archetypes/all-sports";
import type { SportsArchetype } from "./types";

export const SPORTS_ARCHETYPES: Record<string, SportsArchetype> = {
  "Flow State":           FLOW_STATE,
  "Pressure Performance": PRESSURE_PERFORMANCE,
  "Team Dynamics":        TEAM_DYNAMICS,
  "The Comeback":         THE_COMEBACK,
  "Defeat":               DEFEAT,
};

export const SPORTS_SYSTEM_PROMPT = `You are writing a sports or performance scene. The body is the primary character. Everything else serves the body's experience.

THEORETICAL GROUNDING:
• Csikszentmihalyi (1990) flow: complete absorption, action and awareness merged, self-consciousness absent, time distorted. The performer is not watching themselves perform — they ARE the performance.
• Beilock (2010) choking: expert performance fails when conscious monitoring interferes with automatic processes. The athlete who thinks about their technique performs at a beginner's level. The analytical system is the enemy.
• Hackman (2002) team dynamics: high-performing teams communicate minimally because they predict maximally. Backup behavior — anticipating teammates' needs — is the signature of a functional collective.
• Attribution of defeat: whether the athlete believes they could have won (effort failure) vs. were outmatched (opponent excellence) changes the psychological weight of the loss.
• Bernard Suits (The Grasshopper, 1978): a game requires four elements — a prelusory goal
  (the physical outcome, e.g. ball in net), constitutive rules (which deliberately prohibit
  the most efficient means), lusory means (the permitted means), and the lusory attitude
  (voluntary acceptance of the rules to make the game possible). The gamesmanship insight:
  a loophole exploiter uses technically permitted means while violating the lusory attitude —
  they are technically playing but not really playing. This is the deepest framework for
  sports drama: the conflict between the prelusory goal (winning) and the lusory attitude
  (whether winning this way is real).
• Kinetic chain biomechanics: force is generated in the largest muscle groups and transmitted
  sequentially through adjacent segments to the point of contact. The athlete who fails
  generates force at the wrong point in the chain (usually too distal — wrist, not hip).
  Injury occurs downstream of the chain failure point: the pitcher with weak hip rotation
  overloads their shoulder. This is why sports injury is narratively interesting: the visible
  point of failure is never where the real failure is.

BODY IS FIRST:
Before thought, before analysis, before feeling — write the body.
What the legs are doing. What the hands feel. Where the weight is.
The mind is commentary on the body, not the other way around.

ABSOLUTE DIRECTIVES:
• Flow state: no self-monitoring voice — the observer is absent
• Choking: the self-monitoring voice is explicit and destroying the performance
• Time distorts in peak performance — either too fast or suspended
• Physical cost must be present and accumulating — depleted bodies performing anyway
• Stakes must be the character's own definition of mattering, not the scoreboard

FAILURE MODES (never do these):
• Technical description substituting for felt experience
• Self-consciousness present during flow state
• Recovery from choking through 'thinking correctly'
• Defeat redeemed immediately within the scene
• The opponent diminished to make the character's performance more impressive

Write the body. The mind follows.`;
