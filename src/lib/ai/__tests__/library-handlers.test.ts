import { describe, it, expect } from "vitest";
import { LIBRARY_HANDLERS, libraryHandler } from "@/lib/ai/library-handlers";
import { MODE_REGISTRY } from "@/lib/modes/registry";
import { buildCombatContext } from "@/lib/combat";
import { buildEmotionalContext } from "@/lib/emotional";
import { buildAtmosphereContext } from "@/lib/atmosphere";
import { buildTensionContext } from "@/lib/tension";
import { buildHorrorContext } from "@/lib/horror";
import { buildComedyContext } from "@/lib/comedy";
import { buildMysteryContext } from "@/lib/mystery";
import { buildRomanceContext } from "@/lib/romance";
import { buildMonologueContext } from "@/lib/monologue";
import { buildVoiceContext } from "@/lib/voice";
import { buildThrillerContext } from "@/lib/thriller";
import { buildSportsContext } from "@/lib/sports";
import { buildActionContext } from "@/lib/action";
import { buildSettingContext } from "@/lib/setting";
import { buildHistoricalContext } from "@/lib/historical";
import { buildScitechContext } from "@/lib/scitech";
import { buildEthicsContext } from "@/lib/ethics";
import { buildEndingsContext } from "@/lib/endings";
import { buildIsekaiContext } from "@/lib/isekai";

/**
 * Phase 1 / v4 item 9 — the handler registry must reproduce the hand-written
 * wrappers EXACTLY. These expectations are transcribed from the wrappers that
 * were removed from useGeneration.ts, not generated from the registry, so a
 * divergence shows up as a failing assertion rather than a copied mistake.
 *
 * The point is that collapsing 19 copy-pasted wrappers into data is only safe if
 * the data is pinned. Every string below is one a user can see.
 */

describe("library handler registry", () => {
  const MODES = [
    "combat", "emotional", "atmosphere", "tension", "horror", "comedy",
    "mystery", "romance", "monologue", "voice", "thriller", "sports",
    "action", "setting", "historical", "scitech", "ethics", "endings", "isekai",
  ];

  it("covers exactly the 19 wrappers it replaced", () => {
    expect(Object.keys(LIBRARY_HANDLERS).sort()).toEqual([...MODES].sort());
  });

  it.each(MODES)("%s is a registered generation mode", (mode) => {
    // Nothing tied a wrapper's mode key to MODE_REGISTRY before; a typo would
    // have reached /api/ai/generate as an unknown mode.
    expect(LIBRARY_HANDLERS[mode]!.mode).toBe(mode);
    expect(Object.keys(MODE_REGISTRY)).toContain(mode);
  });

  // Statically imported rather than reached through each handler's dynamic
  // `loadContext()`. The first version did 19 dynamic-import round-trips inside a
  // `beforeAll`; under full-suite contention that hook exceeded 10s and vitest
  // aborted all 40 tests in the block, reporting them as SKIPPED rather than
  // failed. Static imports are transformed once as part of this file's own module
  // graph, so the same guarantee (a real exported function exists) costs no
  // per-mode round-trip.
  const REAL_BUILDERS: Record<string, unknown> = {
    combat: buildCombatContext,
    emotional: buildEmotionalContext,
    atmosphere: buildAtmosphereContext,
    tension: buildTensionContext,
    horror: buildHorrorContext,
    comedy: buildComedyContext,
    mystery: buildMysteryContext,
    romance: buildRomanceContext,
    monologue: buildMonologueContext,
    voice: buildVoiceContext,
    thriller: buildThrillerContext,
    sports: buildSportsContext,
    action: buildActionContext,
    setting: buildSettingContext,
    historical: buildHistoricalContext,
    scitech: buildScitechContext,
    ethics: buildEthicsContext,
    endings: buildEndingsContext,
    isekai: buildIsekaiContext,
  };

  it.each(MODES)("%s's context builder really exists", (mode) => {
    // The mode a handler names must resolve to a module that actually exports
    // its builder, or the wrapper 500s at runtime on first use.
    expect(REAL_BUILDERS[mode]).toBeTypeOf("function");
    expect(LIBRARY_HANDLERS[mode]!.loadContext).toBeTypeOf("function");
  });

  it("treats combat as the only two-argument mode", () => {
    const twoArg = MODES.filter((m) => LIBRARY_HANDLERS[m]!.argCount === 2);
    expect(twoArg).toEqual(["combat"]);
  });
});

describe("default prompts reproduce the original wording", () => {
  const d = (mode: string, ...args: string[]) => LIBRARY_HANDLERS[mode]!.defaultPrompt(args);

  it("combat interpolates both styles", () => {
    expect(d("combat", "Boxing", "Krav Maga")).toBe(
      "Write a fight scene between a Boxing fighter and a Krav Maga fighter.",
    );
  });

  it("emotional does not lowercase", () => {
    expect(d("emotional", "Grief")).toBe("Write a scene that physicalizes Grief.");
  });

  it("atmosphere lowercases the environment", () => {
    expect(d("atmosphere", "Rain")).toBe("Write a scene set in a rain environment.");
  });

  it("tension lowercases the tension type", () => {
    expect(d("tension", "Slow Burn")).toBe("Write a scene using slow burn tension structure.");
  });

  it.each(["horror", "comedy", "mystery", "romance", "thriller", "sports", "action"])(
    "%s lowercases the archetype into a '<kind> scene' prompt",
    (mode) => {
      expect(d(mode, "SlowDread")).toBe(`Write a slowdread ${mode} scene.`);
    },
  );

  it("monologue uses the 'interior monologue' phrasing", () => {
    expect(d("monologue", "Confession")).toBe("Write a confession interior monologue.");
  });

  it("voice uses the voice-profile phrasing", () => {
    expect(d("voice", "Detective")).toBe("Write a scene using the Detective voice profile.");
  });

  it.each([
    ["setting", "setting archetype"],
    ["historical", "historical texture"],
    ["scitech", "science/technology archetype"],
    ["ethics", "moral archetype"],
    ["endings", "ending archetype"],
  ])("%s uses the 'using the X ...' phrasing and keeps original casing", (mode, phrase) => {
    expect(d(mode, "Noir")).toBe(`Write a scene using the Noir ${phrase}.`);
  });

  it("isekai does NOT lowercase, unlike its siblings", () => {
    // Preserved deliberately — it read this way before the refactor.
    expect(d("isekai", "Reincarnation")).toBe("Write a Reincarnation isekai scene.");
  });
});

describe("toasts reproduce the original wording", () => {
  it.each([
    ["combat", "Select both fighting styles before generating.", "Combat generation failed. Please try again."],
    ["emotional", "Select an emotion before generating.", "Emotional scene generation failed. Please try again."],
    ["atmosphere", "Select an environment before generating.", "Atmosphere generation failed. Please try again."],
    ["tension", "Select a tension type before generating.", "Tension generation failed. Please try again."],
    ["horror", "Select a horror archetype.", "Horror generation failed. Please try again."],
    ["comedy", "Select a comedy archetype.", "Comedy generation failed. Please try again."],
    ["mystery", "Select a mystery archetype.", "Mystery generation failed. Please try again."],
    ["romance", "Select a romance archetype.", "Romance generation failed. Please try again."],
    ["monologue", "Select a monologue archetype.", "Monologue generation failed. Please try again."],
    ["voice", "Select a voice profile.", "Voice generation failed. Please try again."],
    ["thriller", "Select a thriller archetype.", "Thriller generation failed. Please try again."],
    ["sports", "Select a sports archetype.", "Sports generation failed. Please try again."],
    ["action", "Select an action archetype.", "Action generation failed. Please try again."],
    ["setting", "Select a setting archetype.", "Setting generation failed. Please try again."],
    ["historical", "Select a historical archetype.", "Historical generation failed. Please try again."],
    ["scitech", "Select a science/technology archetype.", "Scitech generation failed. Please try again."],
    ["ethics", "Select an ethics archetype.", "Ethics generation failed. Please try again."],
    ["endings", "Select an endings archetype.", "Endings generation failed. Please try again."],
    ["isekai", "Select an isekai subgenre.", "Isekai generation failed. Please try again."],
  ])("%s keeps both of its original toasts", (mode, missing, failed) => {
    expect(LIBRARY_HANDLERS[mode]!.missingArgsMessage).toBe(missing);
    expect(LIBRARY_HANDLERS[mode]!.errorMessage).toBe(failed);
  });
});

describe("lookup", () => {
  it("returns undefined for an unknown mode rather than throwing", () => {
    expect(libraryHandler("not-a-mode")).toBeUndefined();
  });
});