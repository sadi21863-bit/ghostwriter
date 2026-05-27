// src/lib/tension/types.ts
// Grounded in:
//   SAT  — Brewer & Lichtenstein (1982) Structural Affect Theory:
//           suspense (postpone outcome), curiosity (outcome before events),
//           surprise (unexpected event). Confirmed: suspense works even when
//           reader knows the ending.
//   INFO — Information management theory of narrative tension: the reader's
//           knowledge relative to the character's knowledge
//           (Hitchcock's bomb-under-the-table principle)
//   LRW  — Lazarus (1991) appraisal theory: threat requires perceived
//           significance + uncertainty about outcome

export interface TensionArchetype {
  name: string;
  theoreticalBasis: string;
  coreDescription: string;

  // Brewer & Lichtenstein structural mechanics
  discourseStructure: string;

  // Information management — who knows what
  informationState: {
    readerKnows: string;
    characterKnows: string;
    gap: string;  // the space between — this is where tension lives
  };

  // How tension is built and sustained
  buildMechanics: string;
  sustainMechanics: string;
  releaseOrWithhold: string;  // whether tension releases or accumulates without release

  // Pacing — how sentence/scene rhythm serves the tension type
  pacingRules: string;

  // What kills this tension type
  tensionKillers: string[];

  // System directives
  systemDirectives: string[];

  // Common AI failures
  failureModes: string[];

  writingNotes: string;
}
