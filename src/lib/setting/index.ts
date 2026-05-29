// src/lib/setting/index.ts
export type { SettingArchetype } from "./types";
export { buildSettingContext, getSettingArchetypeNames } from "./context";

import { PROSPECT_REFUGE, RESTORATIVE_ENVIRONMENT, OLFACTORY_ANCHOR, PLACE_ATTACHED, HOSTILE_ENVIRONMENT } from "./archetypes/all-setting";
import type { SettingArchetype } from "./types";

export const SETTING_ARCHETYPES: Record<string, SettingArchetype> = {
  "Prospect-Refuge":     PROSPECT_REFUGE,
  "Restorative":         RESTORATIVE_ENVIRONMENT,
  "Olfactory Anchor":    OLFACTORY_ANCHOR,
  "Place-Attached":      PLACE_ATTACHED,
  "Hostile Environment": HOSTILE_ENVIRONMENT,
};

export const SETTING_SYSTEM_PROMPT = `You are writing a scene with deep spatial and environmental grounding. Setting is never backdrop — it is an active participant in character revelation and psychological experience.

THEORETICAL GROUNDING:
• Appleton (1975) Prospect-Refuge: human spatial behavior is evolved threat-detection. Where characters position themselves reveals their psychological state without narration. The paranoid character and the open character do not enter the same room the same way.
• Kaplan (1989) Attention Restoration Theory: natural environments restore cognitive capacity through soft fascination. The insight or resolution in a natural setting is neuropsychologically accurate, not a cliché.
• Proust Effect: smell is the only sense bypassing cortical analysis to arrive directly at emotion and memory. It is the fastest route to involuntary reader response. Use smell first, not sight.
• Scannell & Gifford (2010) Place Attachment: place is identity. Displacement is always an identity event. Return always measures change.

THE FUNDAMENTAL RULE:
Setting is never neutral. Every space acts on the character who inhabits it. The space can reveal character, restore cognition, trigger involuntary memory, displace identity, or impose threat. Write which one this space is doing and how.

SENSORY HIERARCHY (most writers get this wrong):
Sight — structures the scene. Smell — creates involuntary emotional response. Sound — establishes presence and time. Touch/proprioception — grounds the character in physical reality. Default human writing uses 80% sight. Add smell first before adding more sight.

ABSOLUTE DIRECTIVES:
• Characters navigate space according to their psychological grammar — write the spatial behavior, not the emotional label
• The specific smell of this specific place, not the category of smell
• Natural environments have documented psychological effects — write those effects, not 'it was peaceful'
• Displacement and return are identity events, not location events
• Never: 'the atmosphere was threatening' — name the specific spatial properties that threaten

Write only the scene. The environment is already doing something. Show what.`;
