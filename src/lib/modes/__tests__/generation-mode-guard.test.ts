import { describe, it, expect } from "vitest";
import { isGenerationMode, MODE_REGISTRY, isProseMode } from "../registry";
import type { GenerationMode } from "../registry";

/**
 * Sprint 0 / v4 §3.3 — request-boundary mode validation.
 *
 * /api/ai/generate previously checked only that `mode` was truthy. An arbitrary
 * string then reached engine.ts, where `MI[mode as GenerationMode](format)`
 * indexes a dispatch map with no optional chaining and throws a TypeError,
 * surfacing as an opaque HTTP 500 instead of a 400.
 *
 * `isGenerationMode` is derived from MODE_REGISTRY rather than a hand-kept list,
 * so these tests also pin that the guard cannot drift from the registry.
 */
describe("isGenerationMode", () => {
  it("accepts every mode present in the registry", () => {
    for (const mode of Object.keys(MODE_REGISTRY)) {
      expect(isGenerationMode(mode)).toBe(true);
    }
  });

  it("accepts the documented core modes", () => {
    for (const mode of ["brainstorm", "outline", "write", "dialogue", "combat"]) {
      expect(isGenerationMode(mode)).toBe(true);
    }
  });

  it("rejects an arbitrary attacker-supplied string", () => {
    // This is the exact shape that used to reach MI[...] and throw.
    expect(isGenerationMode("__proto__")).toBe(false);
    expect(isGenerationMode("toString")).toBe(false);
    expect(isGenerationMode("constructor")).toBe(false);
    expect(isGenerationMode("not-a-mode")).toBe(false);
    expect(isGenerationMode("")).toBe(false);
  });

  it("rejects non-string input without throwing", () => {
    expect(isGenerationMode(undefined)).toBe(false);
    expect(isGenerationMode(null)).toBe(false);
    expect(isGenerationMode(42)).toBe(false);
    expect(isGenerationMode({ mode: "write" })).toBe(false);
    expect(isGenerationMode(["write"])).toBe(false);
  });

  it("is case-sensitive, so 'Write' does not silently pass", () => {
    // A lenient match here would reach the same TypeError it is meant to prevent.
    expect(isGenerationMode("Write")).toBe(false);
    expect(isGenerationMode("WRITE")).toBe(false);
  });

  it("narrows the type for TypeScript", () => {
    const value: unknown = "write";
    if (isGenerationMode(value)) {
      // Compile-time guarantee: value is GenerationMode inside the guard.
      const asMode: GenerationMode = value;
      expect(MODE_REGISTRY[asMode]).toBeDefined();
    } else {
      throw new Error("expected 'write' to be a valid mode");
    }
  });

  it("stays in sync with the registry as a derived guard, not a duplicated list", () => {
    // If a mode were removed from the registry, the guard must stop accepting it.
    const registryModes = Object.keys(MODE_REGISTRY);
    expect(registryModes.length).toBeGreaterThanOrEqual(26);
    // Every registry key round-trips.
    expect(registryModes.filter((m) => !isGenerationMode(m))).toEqual([]);
    // And nothing outside it is accepted.
    expect(isGenerationMode("definitely-not-registered")).toBe(false);
  });
});

describe("isProseMode (unchanged, adjacent guard)", () => {
  it("treats planning modes as non-prose", () => {
    expect(isProseMode("brainstorm")).toBe(false);
    expect(isProseMode("outline")).toBe(false);
  });

  it("treats scene-producing modes as prose", () => {
    expect(isProseMode("write")).toBe(true);
    expect(isProseMode("dialogue")).toBe(true);
  });
});