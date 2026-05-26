import { ARGUMENT } from "./archetypes/argument";
import { INTERROGATION, CONFESSION, REUNION } from "./archetypes/interrogation-confession-reunion";
import { NEGOTIATION, SEDUCTION, FAREWELL, GROUP_SCENE } from "./archetypes/negotiation-seduction-farewell-group";
import type { DialogueArchetype } from "./types";

export const DIALOGUE_ARCHETYPES: Record<string, DialogueArchetype> = {
  "Argument": ARGUMENT,
  "Interrogation": INTERROGATION,
  "Confession": CONFESSION,
  "Reunion": REUNION,
  "Negotiation": NEGOTIATION,
  "Seduction": SEDUCTION,
  "Farewell": FAREWELL,
  "Group Scene": GROUP_SCENE,
};
