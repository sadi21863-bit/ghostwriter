// src/lib/romance/types.ts
export interface RomanceArchetype {
  name: string;
  theoreticalBasis: string;
  coreDescription: string;
  fisherStage: "lust" | "attraction" | "attachment" | "transition";
  neurochemistry: string;
  dopamineMechanic: string;
  structuralRequirement: string;
  physicalSignals: string[];
  forbiddenMoves: string[];
  failureModes: string[];
  systemDirectives: string[];
  writingNotes: string;
}
