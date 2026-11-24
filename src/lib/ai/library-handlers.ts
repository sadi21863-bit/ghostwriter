/**
 * Phase 1 / v4 item 9 — library-mode handler registry.
 *
 * `useGeneration.ts` carried 19 hand-written wrappers (`generateHorror`,
 * `generateCombat`, `generateIsekai`, …) that were identical apart from four
 * things: which context builder to load, which mode key to send, what prompt to
 * fall back on, and the wording of two toasts. That is ~220 lines of copy-paste
 * where a typo in one wrapper is invisible — nothing tied a wrapper's mode key to
 * MODE_REGISTRY, or its error copy to its sibling.
 *
 * This module turns them into data. It is deliberately pure and React-free so it
 * can be unit-tested directly, which the wrappers themselves never were.
 *
 * The user-facing strings are reproduced EXACTLY, including the inconsistencies:
 *   - most archetypes interpolate `archetypeName.toLowerCase()` into the prompt,
 *     but `isekai` deliberately does not, and `setting`/`historical`/`scitech`/
 *     `ethics`/`endings` use "using the X ..." phrasing instead;
 *   - `combat` takes two arguments, every other mode takes one;
 *   - "Select an emotion before generating." vs "Select a horror archetype.".
 *
 * `library-handlers.test.ts` pins all of it, so the collapse to a registry is
 * provably behaviour-preserving rather than a silent copy edit.
 */

export interface LibraryHandler {
  /** MODE_REGISTRY key sent to /api/ai/generate. */
  readonly mode: string;
  /** How many leading arguments the caller must supply (1 for all but combat). */
  readonly argCount: 1 | 2;
  /** Toast shown when a required argument is missing. Exact current wording. */
  readonly missingArgsMessage: string;
  /**
   * Loads the context builder. Kept dynamic so bundling still code-splits.
   *
   * The four-parameter signature is the widest shape any builder uses — only
   * `buildCombatContext` takes more than one argument (it also accepts optional
   * owner names for the style-binding fix). Single-argument builders are
   * assignable to it, and the runner simply ignores trailing arguments.
   */
  readonly loadContext: () => Promise<(a: string, b: string, c?: string, d?: string) => string>;
  /** Default prompt when the user supplied none. Receives the caller's args. */
  readonly defaultPrompt: (args: readonly string[]) => string;
  /** Toast shown when the model call fails. Exact current wording. */
  readonly errorMessage: string;
}

/** "Write a <arg.toLowerCase()> <kind> scene." */
const scene = (kind: string) => (a: readonly string[]) =>
  `Write a ${a[0]!.toLowerCase()} ${kind} scene.`;

/** "Write a scene using the <arg> <phrase>." */
const using = (phrase: string) => (a: readonly string[]) =>
  `Write a scene using the ${a[0]} ${phrase}.`;

/** "<Mode> generation failed. Please try again." */
const failed = (label: string) => `${label} generation failed. Please try again.`;

export const LIBRARY_HANDLERS: Record<string, LibraryHandler> = {
  combat: {
    mode: "combat",
    argCount: 2,
    missingArgsMessage: "Select both fighting styles before generating.",
    loadContext: async () => (await import("@/lib/combat")).buildCombatContext,
    defaultPrompt: (a) => `Write a fight scene between a ${a[0]} fighter and a ${a[1]} fighter.`,
    errorMessage: failed("Combat"),
  },

  emotional: {
    mode: "emotional",
    argCount: 1,
    missingArgsMessage: "Select an emotion before generating.",
    loadContext: async () => (await import("@/lib/emotional")).buildEmotionalContext,
    defaultPrompt: (a) => `Write a scene that physicalizes ${a[0]}.`,
    errorMessage: failed("Emotional scene"),
  },

  atmosphere: {
    mode: "atmosphere",
    argCount: 1,
    missingArgsMessage: "Select an environment before generating.",
    loadContext: async () => (await import("@/lib/atmosphere")).buildAtmosphereContext,
    defaultPrompt: (a) => `Write a scene set in a ${a[0]!.toLowerCase()} environment.`,
    errorMessage: failed("Atmosphere"),
  },

  tension: {
    mode: "tension",
    argCount: 1,
    missingArgsMessage: "Select a tension type before generating.",
    loadContext: async () => (await import("@/lib/tension")).buildTensionContext,
    defaultPrompt: (a) => `Write a scene using ${a[0]!.toLowerCase()} tension structure.`,
    errorMessage: failed("Tension"),
  },

  horror: {
    mode: "horror",
    argCount: 1,
    missingArgsMessage: "Select a horror archetype.",
    loadContext: async () => (await import("@/lib/horror")).buildHorrorContext,
    defaultPrompt: scene("horror"),
    errorMessage: failed("Horror"),
  },

  comedy: {
    mode: "comedy",
    argCount: 1,
    missingArgsMessage: "Select a comedy archetype.",
    loadContext: async () => (await import("@/lib/comedy")).buildComedyContext,
    defaultPrompt: scene("comedy"),
    errorMessage: failed("Comedy"),
  },

  mystery: {
    mode: "mystery",
    argCount: 1,
    missingArgsMessage: "Select a mystery archetype.",
    loadContext: async () => (await import("@/lib/mystery")).buildMysteryContext,
    defaultPrompt: scene("mystery"),
    errorMessage: failed("Mystery"),
  },

  romance: {
    mode: "romance",
    argCount: 1,
    missingArgsMessage: "Select a romance archetype.",
    loadContext: async () => (await import("@/lib/romance")).buildRomanceContext,
    defaultPrompt: scene("romance"),
    errorMessage: failed("Romance"),
  },

  monologue: {
    mode: "monologue",
    argCount: 1,
    missingArgsMessage: "Select a monologue archetype.",
    loadContext: async () => (await import("@/lib/monologue")).buildMonologueContext,
    // "interior monologue" reads as a noun phrase, not "<kind> scene".
    defaultPrompt: (a) => `Write a ${a[0]!.toLowerCase()} interior monologue.`,
    errorMessage: failed("Monologue"),
  },

  voice: {
    mode: "voice",
    argCount: 1,
    missingArgsMessage: "Select a voice profile.",
    loadContext: async () => (await import("@/lib/voice")).buildVoiceContext,
    defaultPrompt: (a) => `Write a scene using the ${a[0]} voice profile.`,
    errorMessage: failed("Voice"),
  },

  thriller: {
    mode: "thriller",
    argCount: 1,
    missingArgsMessage: "Select a thriller archetype.",
    loadContext: async () => (await import("@/lib/thriller")).buildThrillerContext,
    defaultPrompt: scene("thriller"),
    errorMessage: failed("Thriller"),
  },

  sports: {
    mode: "sports",
    argCount: 1,
    missingArgsMessage: "Select a sports archetype.",
    loadContext: async () => (await import("@/lib/sports")).buildSportsContext,
    defaultPrompt: scene("sports"),
    errorMessage: failed("Sports"),
  },

  action: {
    mode: "action",
    argCount: 1,
    missingArgsMessage: "Select an action archetype.",
    loadContext: async () => (await import("@/lib/action")).buildActionContext,
    defaultPrompt: scene("action"),
    errorMessage: failed("Action"),
  },

  setting: {
    mode: "setting",
    argCount: 1,
    missingArgsMessage: "Select a setting archetype.",
    loadContext: async () => (await import("@/lib/setting")).buildSettingContext,
    defaultPrompt: using("setting archetype"),
    errorMessage: failed("Setting"),
  },

  historical: {
    mode: "historical",
    argCount: 1,
    missingArgsMessage: "Select a historical archetype.",
    loadContext: async () => (await import("@/lib/historical")).buildHistoricalContext,
    defaultPrompt: using("historical texture"),
    errorMessage: failed("Historical"),
  },

  scitech: {
    mode: "scitech",
    argCount: 1,
    missingArgsMessage: "Select a science/technology archetype.",
    loadContext: async () => (await import("@/lib/scitech")).buildScitechContext,
    defaultPrompt: using("science/technology archetype"),
    errorMessage: failed("Scitech"),
  },

  ethics: {
    mode: "ethics",
    argCount: 1,
    missingArgsMessage: "Select an ethics archetype.",
    loadContext: async () => (await import("@/lib/ethics")).buildEthicsContext,
    defaultPrompt: using("moral archetype"),
    errorMessage: failed("Ethics"),
  },

  endings: {
    mode: "endings",
    argCount: 1,
    missingArgsMessage: "Select an endings archetype.",
    loadContext: async () => (await import("@/lib/endings")).buildEndingsContext,
    defaultPrompt: using("ending archetype"),
    errorMessage: failed("Endings"),
  },

  isekai: {
    mode: "isekai",
    argCount: 1,
    missingArgsMessage: "Select an isekai subgenre.",
    loadContext: async () => (await import("@/lib/isekai")).buildIsekaiContext,
    // Deliberately NOT lower-cased, unlike the other archetype modes.
    defaultPrompt: (a) => `Write a ${a[0]} isekai scene.`,
    errorMessage: failed("Isekai"),
  },
};

export function libraryHandler(mode: string): LibraryHandler | undefined {
  return LIBRARY_HANDLERS[mode];
}