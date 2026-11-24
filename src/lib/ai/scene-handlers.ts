/**
 * Phase 1 / v4 item 9 — two-character scene handler registry.
 *
 * `generateDialogue`, `generateInterrogation` and `generateChase` were three
 * near-identical 25-line functions. v4 names them explicitly: "Dialogue/
 * interrogation/chase duplicates collapse into the same path." They differ only
 * in five things: the mode key, the two toast strings, how the resolved
 * characters feed their context builder, and the fallback prompt.
 *
 * This mirrors `library-handlers.ts` deliberately — same shape, same reasoning.
 * The one thing that genuinely differs from the library modes is that these push
 * an undo entry before replacing the chapter text, because they overwrite a
 * drafted scene rather than appending a mode's output; the runner handles that
 * explicitly rather than pretending the two families are identical.
 */

export interface SceneCharacter {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface ScenePlan {
  /** Library-specific block prepended to the static context. */
  contextPrefix: string;
  /** Fallback prompt when the caller supplied none. */
  defaultPrompt: string;
}

export interface SceneHandler {
  /** MODE_REGISTRY key sent to /api/ai/generate. */
  readonly mode: string;
  /** Caller args after the two character ids. */
  readonly extraArgCount: 0 | 1 | 2;
  /** Toast when either character id is missing. Exact current wording. */
  readonly missingCharactersMessage: string;
  /** Toast when the model call fails. Exact current wording. */
  readonly errorMessage: string;
  /**
   * Build the context prefix and fallback prompt for the resolved characters.
   * Async because each mode's context builder is dynamically imported.
   */
  readonly plan: (a: SceneCharacter, b: SceneCharacter, rest: string[]) => Promise<ScenePlan>;
}

export const SCENE_HANDLERS: Record<string, SceneHandler> = {
  dialogue: {
    mode: "dialogue",
    extraArgCount: 1,
    // The only one of the three whose missing-character copy names the feature.
    missingCharactersMessage: "Select both characters before generating dialogue.",
    errorMessage: "Dialogue generation failed. Please try again.",
    plan: async (charA, charB, rest) => {
      const { buildDialogueContext } = await import("@/lib/dialogue");
      const archetypeName = rest[0] || "Argument";
      return {
        // The only handler that takes whole character records, not names.
        contextPrefix: buildDialogueContext(charA as never, charB as never, archetypeName) + "\n---\n",
        defaultPrompt: `Write a ${archetypeName.toLowerCase()} scene between ${charA.name} and ${charB.name}.`,
      };
    },
  },

  interrogation: {
    mode: "interrogation",
    extraArgCount: 1,
    missingCharactersMessage: "Select both characters before generating.",
    errorMessage: "Interrogation generation failed. Please try again.",
    plan: async (interrogator, subject, rest) => {
      const { buildInterrogationContext } = await import("@/lib/modes/interrogation");
      const goal = rest[0] || "";
      return {
        contextPrefix:
          buildInterrogationContext(interrogator.name, subject.name, "", "", goal) + "\n---\n",
        defaultPrompt: `Write an interrogation scene where ${interrogator.name} interrogates ${subject.name}.`,
      };
    },
  },

  chase: {
    mode: "chase",
    extraArgCount: 2,
    missingCharactersMessage: "Select both characters before generating.",
    errorMessage: "Chase generation failed. Please try again.",
    plan: async (pursued, pursuer, rest) => {
      const { buildChaseContext } = await import("@/lib/modes/chase");
      const terrain = rest[0] || "unknown terrain";
      const stakes = rest[1] || "capture";
      return {
        contextPrefix:
          buildChaseContext(pursued.name, pursuer.name, terrain, "unknown", "unknown", stakes) +
          "\n---\n",
        // Note the roles: the SECOND argument is the pursuer, so this reads
        // "pursuer pursues pursued" — preserved exactly as written.
        defaultPrompt: `Write a chase scene where ${pursuer.name} pursues ${pursued.name}.`,
      };
    },
  },
};

export function sceneHandler(mode: string): SceneHandler | undefined {
  return SCENE_HANDLERS[mode];
}