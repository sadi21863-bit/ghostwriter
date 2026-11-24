import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildContextForGeneration } from "@/lib/ai/context-shadow";
import {
  CONTEXT_POLICY_VERSION,
  CONTEXT_POLICY_VERSIONS,
  isContextPolicyVersion,
  setContextShadowSink,
  type ContextShadowDiff,
} from "@/lib/ai/context-policy-version";
import { buildStaticContextDetailed, buildDynamicContext } from "@/lib/ai/context-builder";
import type { ContextProject } from "@/lib/ai/context-builder";

/**
 * Phase 0 / v4 §5 — ContextPolicy shadow rollout.
 *
 * The mode-aware policy existed and was unit-tested but was inert in production
 * because the generation path never passed `mode`. Turning it on is a BEHAVIOURAL
 * change, so v4 §5 mandates shadow-first. These tests pin the two properties that
 * make that safe:
 *
 *   1. In "shadow" the ACTIVE context is byte-identical to the legacy text.
 *   2. The diff is emitted and is meaningful (registered mode, real deltas).
 *
 * If (1) ever breaks, the "observability only" claim is false and the rollout is
 * no longer safe to keep running in production.
 */

function project(overrides: Partial<ContextProject> = {}): ContextProject {
  const chapters = [
    { id: "ch1", projectId: "p1", title: "One", sortOrder: 0, content: "", summary: "s", wordCount: 900 },
    { id: "ch2", projectId: "p1", title: "Two", sortOrder: 1, content: "", summary: "s", wordCount: 900 },
  ] as any[];
  const characters = [
    { id: "c1", projectId: "p1", name: "Riya", role: "Protagonist", age: "31", appearance: "Weathered.", personality: "Guarded.", thinkingStyle: "", behavior: "", habits: "", fears: "", desires: "", speechPattern: "", backstory: "Docks.", arc: "Accepts help.", portraitUrl: "", sortOrder: 0, alwaysInContext: true, linkedLocationIds: [], linkedPlotThreadIds: [] },
    { id: "c2", projectId: "p1", name: "Arjun", role: "Antagonist", age: "44", appearance: "Immaculate.", personality: "Precise.", thinkingStyle: "", behavior: "", habits: "", fears: "", desires: "", speechPattern: "", backstory: "Station Authority.", arc: "Humbles.", portraitUrl: "", sortOrder: 1, alwaysInContext: true, linkedLocationIds: [], linkedPlotThreadIds: [] },
  ] as any[];
  return {
    id: "p1", name: "The Long Count", format: "Novel", skillLevel: "expert",
    genres: ["Science Fiction"], notes: "",
    characters,
    locations: [{ id: "l1", projectId: "p1", name: "Meridian Station", description: "Relay.", rules: "Low gravity.", sortOrder: 0, alwaysInContext: true }] as any[],
    plotThreads: [{ id: "t1", projectId: "p1", name: "The signal", description: "Someone answers.", status: "Active", alwaysInContext: true, sortOrder: 0 }] as any[],
    worldEntities: [{ id: "w1", projectId: "p1", kind: "object", name: "Black notebook", summary: "Unexplained.", alwaysInContext: true }] as any[],
    storyMemories: [{ id: "m1", projectId: "p1", chapterId: "ch1", category: "event", fact: "The signal repeated.", keyEvents: [], objectsIntroduced: [], knowledgeShifts: [], decisions: [], consequences: [], emotionalState: {}, openPromisesCreated: [], createdAt: new Date(0) }] as any[],
    storyPromises: [{ id: "sp1", projectId: "p1", setup: "Notebook opened", status: "open", priority: "A" }] as any[],
    chapters,
    referenceWorks: [],
    activeChapter: "ch1",
    currentPrompt: "Write the scene.",
    ...overrides,
  } as any;
}

let captured: ContextShadowDiff[] = [];

beforeEach(() => {
  captured = [];
  setContextShadowSink((d) => captured.push(d));
});
afterEach(() => {
  setContextShadowSink(null);
  captured = [];
});

describe("ContextPolicy switch", () => {
  it("is currently in shadow, so no behaviour change is possible yet", () => {
    expect(CONTEXT_POLICY_VERSION).toBe("shadow");
  });

  it("only permits the three documented stages", () => {
    expect([...CONTEXT_POLICY_VERSIONS].sort()).toEqual(["legacy", "mode-aware", "shadow"]);
    expect(isContextPolicyVersion("shadow")).toBe(true);
    expect(isContextPolicyVersion("nope")).toBe(false);
    expect(isContextPolicyVersion(undefined)).toBe(false);
  });
});

describe("shadow mode — behaviour preservation", () => {
  it("returns byte-identical static and dynamic context to the no-mode legacy build", () => {
    for (const mode of ["write", "dialogue", "combat", "atmosphere", "voice", "mystery", "horror"]) {
      const p = project();
      const built = buildContextForGeneration(p, mode, "all_access");
      // Legacy is defined as "no mode", which resolves FULL_CONTEXT_POLICY.
      const legacyStatic = buildStaticContextDetailed(p, undefined, "all_access").text;
      const legacyDynamic = buildDynamicContext(p, undefined);

      expect(built.staticCtx, `${mode} static must equal legacy`).toBe(legacyStatic);
      expect(built.dynamicCtx, `${mode} dynamic must equal legacy`).toBe(legacyDynamic);
      expect(built.policyVersion).toBe("shadow");
    }
  });

  it("keeps skipped sections from the ACTIVE build so headroom rescue still works", () => {
    const built = buildContextForGeneration(project(), "write", "all_access");
    expect(Array.isArray(built.skipped)).toBe(true);
  });
});

describe("shadow mode — diff quality", () => {
  it("emits exactly one diff per build", () => {
    buildContextForGeneration(project(), "combat");
    expect(captured).toHaveLength(1);
  });

  it("marks registered modes as registered and unregistered ones as not", () => {
    buildContextForGeneration(project(), "combat");
    expect(captured[0].modeIsRegistered).toBe(true);

    captured = [];
    buildContextForGeneration(project(), "not-a-real-mode");
    expect(captured[0].modeIsRegistered).toBe(false);
  });

  it("never drops character canon — the one surface that must stay intact", () => {
    // Regression guard for the Phase-0 finding: an inverted default had
    // `needsWorldEntities`/`needsRealism` off for most modes.
    for (const mode of ["write", "mystery", "romance", "thriller", "endings", "setting", "atmosphere", "scitech"]) {
      captured = [];
      const built = buildContextForGeneration(project(), mode, "all_access");
      expect(built.modeAware!.staticCtx, `${mode} must keep characters`).toContain("CHARACTERS:");
    }
  });

  it("keeps world elements for every mode after the base-policy correction", () => {
    for (const mode of ["write", "mystery", "romance", "thriller", "endings", "setting", "atmosphere", "dialogue"]) {
      captured = [];
      const built = buildContextForGeneration(project(), mode, "all_access");
      expect(built.modeAware!.staticCtx, `${mode} must receive WORLD ELEMENTS`).toContain("WORLD ELEMENTS:");
    }
  });

  it("reports character depth changes for brief modes", () => {
    captured = [];
    buildContextForGeneration(project(), "atmosphere");
    expect(captured[0].charDepth.modeAware).toBe("brief");

    captured = [];
    buildContextForGeneration(project(), "write");
    expect(captured[0].charDepth.modeAware).toBe("full");
  });

  it("records which sections the policy removes", () => {
    captured = [];
    // dialogue sets needsLocations:false
    buildContextForGeneration(project(), "dialogue");
    expect(captured[0].droppedByPolicy).toContain("locations");
  });

  it("reports token accounting that is internally consistent", () => {
    captured = [];
    const built = buildContextForGeneration(project(), "atmosphere", "all_access");
    const d = captured[0];
    expect(d.chars.saved).toBe(d.chars.legacy - d.chars.modeAware);
    expect(d.estimatedTokens.saved).toBe(d.estimatedTokens.legacy - d.estimatedTokens.modeAware);
    expect(built.diff).toBeDefined();
  });

  it("exposes both variants in addition to the active one", () => {
    const built = buildContextForGeneration(project(), "combat");
    expect(built.legacy).toBeDefined();
    expect(built.modeAware).toBeDefined();
    expect(built.staticCtx).toBe(built.legacy!.staticCtx);
  });
});

describe("shadow reporting is fail-open", () => {
  it("never throws when the sink itself throws", () => {
    setContextShadowSink(() => {
      throw new Error("telemetry exploded");
    });
    expect(() => buildContextForGeneration(project(), "combat")).not.toThrow();
  });

  it("works with no sink installed at all", () => {
    setContextShadowSink(null);
    expect(() => buildContextForGeneration(project(), "combat")).not.toThrow();
  });
});