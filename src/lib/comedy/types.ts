// src/lib/comedy/types.ts
export interface ComedyArchetype {
  name: string;
  theoreticalBasis: string;
  coreDescription: string;
  setupRequirement: string;
  benignCondition: string;
  timingPrinciple: string;
  mechanicalRules: string[];
  failureModes: string[];
  systemDirectives: string[];
  writingNotes: string;
}
