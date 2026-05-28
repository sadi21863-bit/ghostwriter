// src/lib/sports/types.ts
export interface SportsArchetype {
  name: string;
  theoreticalBasis: string;
  coreDescription: string;
  psychologicalState: string;
  bodyMechanics: string;
  performanceStructure: string;
  teamDimension?: string;
  stakesRequirement: string;
  failureModes: string[];
  systemDirectives: string[];
  writingNotes: string;
}
