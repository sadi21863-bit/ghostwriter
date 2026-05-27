// src/lib/emotional/types.ts
// Types for the GhostWriter Emotional Scene Library.
// Grounded in:
//   FACS  — Ekman & Friesen Facial Action Coding System (1978/2002)
//   SMH   — Damasio's Somatic Marker Hypothesis (1994/2004)
//   PVT   — Porges' Polyvagal Theory (1995/2011)
//   JL    — James-Lange theory: body response precedes conscious feeling

export type PolyvagalState =
  | "ventral_vagal"   // Social engagement: safe, connected, open
  | "sympathetic"     // Fight/flight: mobilized, defended, urgent
  | "dorsal_vagal";   // Freeze/shutdown: collapsed, dissociated, hollow

export interface FacsSignature {
  // Ekman Action Units (AU numbers) active in this emotional state
  primaryAUs: string[];          // e.g. ["AU1 (inner brow raise)", "AU15 (lip corner pull)"]
  secondaryAUs: string[];        // present but not diagnostic
  suppressedDisplay: string;     // what people do when hiding this emotion (FACS concealment)
}

export interface SomaticSignature {
  // Damasio SMH: physiological fingerprint — the body's signal before the conscious label
  heartRate: string;             // change pattern (elevated, slowed, arrhythmic, etc.)
  breathing: string;             // pattern change
  muscleState: string;           // tension, collapse, tremor, stillness
  skinResponse: string;          // flush, pallor, sweat, goosebumps
  digestive: string;             // nausea, hollowness, weight, warmth
  motorControl: string;          // fine motor change, coordination, freeze, agitation
}

export interface EmotionArchetype {
  name: string;
  polyvagalState: PolyvagalState;
  coreDescription: string;

  // The scientific grounding
  facs: FacsSignature;
  somatic: SomaticSignature;

  // How the emotion unfolds over time in a scene
  onset: string;          // how it arrives (sudden, creeping, wave)
  peak: string;           // what peak looks like in the body
  recession: string;      // how it withdraws (crash, slow drain, sudden lift)

  // What the character perceives in another person showing this emotion
  externalReads: string[];

  // Rules for writing this emotion without naming it
  showDontNameRules: string[];

  // What AI consistently does wrong
  failureModes: string[];

  // System directives injected into the prompt
  systemDirectives: string[];

  writingNotes: string;
}
