// src/lib/monologue/types.ts
export interface MonologueArchetype {
  name: string;
  theoreticalBasis: string;
  coreDescription: string;
  compressionLevel: string;
  associativePattern: string;
  suppressionBehavior?: string;
  syntaxRules: string[];
  sensoryIntrusion: string;
  failureModes: string[];
  systemDirectives: string[];
  writingNotes: string;
}
