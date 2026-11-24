import { describe, it, expect } from "vitest";
import { SCENE_HANDLERS, sceneHandler } from "@/lib/ai/scene-handlers";
import { buildDialogueContext } from "@/lib/dialogue";
import { buildInterrogationContext } from "@/lib/modes/interrogation";
import { buildChaseContext } from "@/lib/modes/chase";

/**
 * Phase 1 / v4 item 9 — "Dialogue/interrogation/chase duplicates collapse into
 * the same path." These pin the collapsed trio against the three functions it
 * replaced, including the details that are easy to lose in a collapse:
 *
 *  - dialogue is the only one whose missing-character copy names the feature;
 *  - dialogue takes whole character RECORDS, the other two take NAMES;
 *  - chase's roles are (pursued, pursuer) while its prompt reads
 *    "pursuer pursues pursued";
 *  - interrogation and chase pad missing context with literal "unknown".
 */

// buildDialogueContext takes the full Character record; the handler's own
// SceneCharacter is intentionally loose, so cast at the call site.
import type { Character } from "@/types";

const MARA = { id: "c1", name: "Mara", role: "protagonist" };
const KESSLER = { id: "c2", name: "Kessler", role: "antagonist" };
const asCharacter = (c: typeof MARA) => c as unknown as Character;

describe("scene handler registry", () => {
  it("covers exactly the three collapsed functions", () => {
    expect(Object.keys(SCENE_HANDLERS).sort()).toEqual(["chase", "dialogue", "interrogation"]);
  });

  it.each(["dialogue", "interrogation", "chase"])("%s keys the registry by its mode", (mode) => {
    expect(SCENE_HANDLERS[mode]!.mode).toBe(mode);
  });

  it("sceneHandler returns undefined for an unknown mode", () => {
    expect(sceneHandler("duel")).toBeUndefined();
  });

  it("declares the right number of extra caller args", () => {
    expect(SCENE_HANDLERS.dialogue!.extraArgCount).toBe(1); // archetypeName
    expect(SCENE_HANDLERS.interrogation!.extraArgCount).toBe(1); // goal
    expect(SCENE_HANDLERS.chase!.extraArgCount).toBe(2); // terrain, stakes
  });
});

describe("toasts", () => {
  it("only dialogue names the feature in its missing-character copy", () => {
    expect(SCENE_HANDLERS.dialogue!.missingCharactersMessage).toBe(
      "Select both characters before generating dialogue.",
    );
    expect(SCENE_HANDLERS.interrogation!.missingCharactersMessage).toBe(
      "Select both characters before generating.",
    );
    expect(SCENE_HANDLERS.chase!.missingCharactersMessage).toBe(
      "Select both characters before generating.",
    );
  });

  it.each([
    ["dialogue", "Dialogue generation failed. Please try again."],
    ["interrogation", "Interrogation generation failed. Please try again."],
    ["chase", "Chase generation failed. Please try again."],
  ])("%s keeps its failure copy", (mode, msg) => {
    expect(SCENE_HANDLERS[mode]!.errorMessage).toBe(msg);
  });
});

describe("fallback prompts", () => {
  it("dialogue lowercases the archetype and names both characters", async () => {
    const p = await SCENE_HANDLERS.dialogue!.plan(MARA as never, KESSLER as never, ["SlowDread"]);
    expect(p.defaultPrompt).toBe("Write a slowdread scene between Mara and Kessler.");
  });

  it("dialogue defaults to Argument when none is supplied", async () => {
    const p = await SCENE_HANDLERS.dialogue!.plan(MARA as never, KESSLER as never, []);
    expect(p.defaultPrompt).toBe("Write a argument scene between Mara and Kessler.");
  });

  it("interrogation ignores the goal in its prompt", async () => {
    const p = await SCENE_HANDLERS.interrogation!.plan(MARA as never, KESSLER as never, ["get the map"]);
    expect(p.defaultPrompt).toBe("Write an interrogation scene where Mara interrogates Kessler.");
  });

  it("chase names pursuer SECOND — the roles read backwards from the ids", async () => {
    // generateChase(pursuedId, pursuerId, ...): first arg is the pursued one.
    const p = await SCENE_HANDLERS.chase!.plan(MARA as never, KESSLER as never, ["rooftops", "capture"]);
    expect(p.defaultPrompt).toBe("Write a chase scene where Kessler pursues Mara.");
  });
});

describe("context prefixes delegate to the real builders", () => {
  it("dialogue passes whole character records, not names", async () => {
    const p = await SCENE_HANDLERS.dialogue!.plan(MARA as never, KESSLER as never, ["Argument"]);
    expect(p.contextPrefix).toBe(buildDialogueContext(asCharacter(MARA), asCharacter(KESSLER), "Argument") + "\n---\n");
  });

  it("interrogation passes names and empty placeholders", async () => {
    const p = await SCENE_HANDLERS.interrogation!.plan(MARA as never, KESSLER as never, ["the map"]);
    expect(p.contextPrefix).toBe(
      buildInterrogationContext("Mara", "Kessler", "", "", "the map") + "\n---\n",
    );
  });

  it("chase passes names with unknown-terrain/stakes padding", async () => {
    const p = await SCENE_HANDLERS.chase!.plan(MARA as never, KESSLER as never, ["rooftops", "capture"]);
    expect(p.contextPrefix).toBe(
      buildChaseContext("Mara", "Kessler", "rooftops", "unknown", "unknown", "capture") + "\n---\n",
    );
  });

  it("every prefix ends with the \\n---\\n separator that splits library from story context", async () => {
    for (const mode of ["dialogue", "interrogation", "chase"]) {
      const p = await SCENE_HANDLERS[mode]!.plan(MARA as never, KESSLER as never, ["x", "y"]);
      expect(p.contextPrefix.endsWith("\n---\n")).toBe(true);
    }
  });
});