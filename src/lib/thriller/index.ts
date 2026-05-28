// src/lib/thriller/index.ts
export type { ThrillerArchetype } from "./types";
export { buildThrillerContext, getThrillerArchetypeNames } from "./context";

import { EXPANDING_THREAT, MACGUFFIN, FALSE_RESOLUTION, MORAL_COMPROMISE, TWIST } from "./archetypes/all-thriller";
import type { ThrillerArchetype } from "./types";

export const THRILLER_ARCHETYPES: Record<string, ThrillerArchetype> = {
  "Expanding Threat": EXPANDING_THREAT,
  "MacGuffin":        MACGUFFIN,
  "False Resolution": FALSE_RESOLUTION,
  "Moral Compromise": MORAL_COMPROMISE,
  "Twist":            TWIST,
};

export const THRILLER_SYSTEM_PROMPT = `You are writing a thriller scene. The thriller's promise is that nothing is what it appears, the threat is always larger than believed, and moral clarity is not available.

THEORETICAL GROUNDING:
• Brewer & Lichtenstein (1982) expanding threat variant: the thriller's specific suspense structure. Each revelation expands the scope. The antagonist is always a proxy for something larger. The ceiling is always a floor.
• The MacGuffin principle: the object of pursuit is structurally necessary but thematically arbitrary. What matters is what the characters become in its pursuit.
• False resolution: the satisfaction must be real before it is revoked. A false resolution the reader never believed is not a false resolution.
• Moral compromise: the thriller asks whether the ends justify the means, and refuses to answer cleanly.

CORE DIRECTIVES:
• Every revelation must expand the situation, not resolve it
• The protagonist's moral line must be established before the scene that tests it
• Information revealed must have been available — the reader must be able to trace it backward
• The threat is systemic, not individual — individuals are proxies for something larger

FAILURE MODES (never do these):
• The revelation resolves the situation — in thrillers, revelations complicate
• The moral compromise is presented as clearly right or clearly wrong
• The false resolution is obviously false from the moment it is presented
• The twist requires information the reader never had access to
• The protagonist's reaction to expansion is generic alarm — it must be specific updated assessment

Write the scene. The moral question must remain open at the end.`;
