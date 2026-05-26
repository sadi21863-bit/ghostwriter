// src/lib/combat/types.ts
export interface Stance {
  name: string;
  bodyPosition: string;
  weightDistribution: string;
  strengths: string;
  weaknesses: string;
}

export interface Technique {
  name: string;
  mechanics: string;
  setup: string;
  execution: string;
  recovery: string;
  counter: string;
}

export interface CombatStyle {
  name: string;
  origin: string;
  era: string;
  corePhilosophy: string;
  bodyMechanics: string;
  distancePreference: string;
  footworkPrinciple: string;
  stances: Stance[];
  strikes: Technique[];
  defenses: Technique[];
  strengthAgainst: string[];
  weakAgainst: string[];
  signatureTells: string[];
  pacing: string;
  writingNotes: string;
}
