// src/lib/dialogue/types.ts — UPGRADED
// Psychological layer added, grounded in:
//   PVT  — Porges' Polyvagal Theory: nervous system state determines
//           voice quality, facial engagement, and social availability
//   FACS — Ekman Action Units: which muscles are active during this
//           scene type for each party
//   SMH  — Damasio: somatic markers present in the body during the exchange
//   SAT  — Brewer & Lichtenstein: information dynamics of the scene

import type { PolyvagalState } from "@/lib/emotional/types";

export type { PolyvagalState };

export interface VoicePhysiology {
  // Porges' social engagement system: the vagus nerve controls both
  // the face and the voice via the same neural pathway. Polyvagal state
  // directly produces measurable voice changes.
  pitch: string;         // higher in sympathetic, lower in ventral vagal
  rate: string;          // faster in fear/rage, slower in dorsal vagal
  volume: string;        // elevated in fight, reduced in freeze
  prosody: string;       // modulation range collapses under stress
  breathSupport: string; // full in ventral, shallow in sympathetic, absent in dorsal
}

export interface DialoguePsychologicalLayer {
  // Nervous system states for each party at scene start
  partyAState: PolyvagalState;
  partyBState: PolyvagalState;
  stateShift: string; // how and when the states change during the scene

  // Voice physiology (Porges: face-heart connection — voice is vagally controlled)
  partyAVoice: VoicePhysiology;
  partyBVoice: VoicePhysiology;

  // FACS signals active during this scene type
  activeFacsSignals: string[];

  // Somatic markers present in the room (Damasio)
  somaticPresence: string;

  // Information dynamics (Brewer & Lichtenstein SAT)
  informationDynamics: {
    structure: "suspense" | "curiosity" | "both" | "paranoia";
    readerKnows: string;
    characterKnows: string;
    gap: string;
  };

  // Additional system directives from the psychological layer
  psychologicalDirectives: string[];
}

export interface DialogueArchetype {
  name: string;
  description: string;
  underlyingConflict: string;
  powerDynamic: string;
  sceneStructure: string;
  subtextRules: string[];
  rhythmPattern: string;
  openingPrinciple: string;
  escalationMechanics: string;
  breakingPoint: string;
  failureModes: string[];
  systemDirectives: string[];
  writingNotes: string;

  // UPGRADED: psychological layer grounded in PVT + FACS + SMH + SAT
  psychological: DialoguePsychologicalLayer;
}
