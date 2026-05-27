// src/lib/atmosphere/types.ts
// Types for the GhostWriter Atmosphere Library.
// Grounded in:
//   SRT  — Ulrich's Stress Recovery Theory (1983/1991) — nature vs built environments
//           and their differential physiological effects
//   ART  — Kaplan & Kaplan Attention Restoration Theory (1989) — soft vs hard fascination
//   PRF  — Proust phenomenon (Herz & Schooler, 2002; Herz et al., 2004) — olfactory
//           memory bypasses thalamic relay, directly activates amygdala/hippocampus;
//           smell-evoked memories are older, more vivid, more emotional than
//           vision- or word-evoked memories (LOVER: Limbic, Old, Vivid, Emotional, Rare)
//   EPH  — Merleau-Ponty's embodied phenomenology — the body as the primary organ
//           of environmental perception

export interface SensoryLayer {
  dominant: string;       // the leading sense in this environment type
  visual: string;         // what the eye finds (light quality, movement, depth)
  auditory: string;       // sound profile (what is present, what is absent)
  olfactory: string;      // smell profile + memory-activation potential (PRF)
  tactile: string;        // temperature, texture, air movement, pressure
  proprioceptive: string; // how the body orients in this space
}

export interface PsychologicalEffect {
  // Based on Ulrich SRT and Kaplan ART research
  cognitiveState: string;       // directed attention (draining) vs soft fascination (restorative)
  stressResponse: string;       // SRT: does environment elevate or reduce cortisol
  attentionalDemand: string;    // ART: how much directed attention the environment requires
  restorationPotential: string; // Kaplan's four properties: away, extent, compatibility, fascination
}

export interface AtmosphereArchetype {
  name: string;
  coreDescription: string;
  psychologicalEffect: PsychologicalEffect;
  sensoryLayers: SensoryLayer;

  // How this environment changes over time within a scene
  temporalQualities: string;

  // How this environment can be made to serve the scene's emotional purpose
  emotionalApplications: {
    grief: string;
    fear: string;
    joy: string;
    tension: string;
    intimacy: string;
  };

  // The olfactory entry point — which smell activates the strongest memory/emotion response
  olfactoryKey: string;

  // Common writing failures for this environment
  failureModes: string[];

  // System directives injected into the prompt
  systemDirectives: string[];

  writingNotes: string;
}
