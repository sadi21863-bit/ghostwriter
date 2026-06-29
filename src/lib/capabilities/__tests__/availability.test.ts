import { describe, it, expect } from "vitest";
import { isCapabilityAvailable, supportEnvelope, type Capability } from "../registry";

const base: Capability = {
  id: "x", label: "X", kind: "tool", role: "writer", stage: "write",
  provider: "anthropic", gate: null, visibility: "universal",
};
const ctx = { tier: "free" as const, hasSegmindKey: false, hasOpenAIKey: false, format: "Novel" };

describe("isCapabilityAvailable", () => {
  it("anthropic ungated universal cap is available to everyone", () => {
    expect(isCapabilityAvailable(base, ctx)).toEqual({ available: true });
  });

  it("gated cap is unavailable to a tier without access (upgrade_required)", () => {
    const cap = { ...base, gate: "comic_studio" as const };
    expect(isCapabilityAvailable(cap, ctx)).toEqual({ available: false, reason: "upgrade_required" });
  });

  it("gated cap is available to a tier with access", () => {
    const cap = { ...base, gate: "comic_studio" as const };
    expect(isCapabilityAvailable(cap, { ...ctx, tier: "all_access" })).toEqual({ available: true });
  });

  it("segmind cap needs a segmind key", () => {
    const cap = { ...base, provider: "segmind" as const };
    expect(isCapabilityAvailable(cap, ctx)).toEqual({ available: false, reason: "missing_segmind_key" });
    expect(isCapabilityAvailable(cap, { ...ctx, hasSegmindKey: true })).toEqual({ available: true });
  });

  it("openai cap needs an openai key", () => {
    const cap = { ...base, provider: "openai" as const };
    expect(isCapabilityAvailable(cap, ctx)).toEqual({ available: false, reason: "missing_openai_key" });
    expect(isCapabilityAvailable(cap, { ...ctx, hasOpenAIKey: true })).toEqual({ available: true });
  });

  it("story_only cap is not applicable on a creator format", () => {
    const cap = { ...base, visibility: "story_only" as const };
    expect(isCapabilityAvailable(cap, { ...ctx, format: "TikTok Script" })).toEqual({ available: false, reason: "not_applicable_for_format" });
  });

  it("format check precedes gate/provider checks", () => {
    const cap = { ...base, visibility: "story_only" as const, provider: "segmind" as const, gate: "comic_studio" as const };
    expect(isCapabilityAvailable(cap, { ...ctx, format: "TikTok Script" })).toEqual({ available: false, reason: "not_applicable_for_format" });
  });
});

describe("supportEnvelope", () => {
  it("groups every capability under stage → role with availability annotated", () => {
    const env = supportEnvelope(ctx);
    expect(Object.keys(env.stages).sort()).toEqual(["discover", "produce", "shape", "write"]);
    const writeWriters = env.stages.write.writer;
    expect(writeWriters.length).toBeGreaterThan(0);
    for (const c of writeWriters) expect(typeof c.available).toBe("boolean");
  });
});
