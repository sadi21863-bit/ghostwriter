import { describe, it, expect } from "vitest";
import { capContextForTier, CONTEXT_CHAR_CAPS } from "@/lib/ai/context-caps";

describe("capContextForTier", () => {
  it("caps staticContext to the tier's character limit", () => {
    const huge = "a".repeat(100_000);
    const result = capContextForTier("free", { staticContext: huge, prompt: "hi" });
    expect(result.cappedStatic?.length).toBe(CONTEXT_CHAR_CAPS.free);
  });

  it("caps dynamicContext to half the tier's character limit", () => {
    const huge = "b".repeat(100_000);
    const result = capContextForTier("story_pro", { dynamicContext: huge, prompt: "hi" });
    expect(result.cappedDynamic?.length).toBe(Math.floor(CONTEXT_CHAR_CAPS.story_pro / 2));
  });

  it("caps prompt to 20,000 characters regardless of tier", () => {
    const huge = "c".repeat(100_000);
    const result = capContextForTier("all_access", { prompt: huge });
    expect(result.cappedPrompt.length).toBe(20_000);
  });

  it("leaves cappedStatic and cappedDynamic undefined when not provided", () => {
    const result = capContextForTier("free", { prompt: "hi" });
    expect(result.cappedStatic).toBeUndefined();
    expect(result.cappedDynamic).toBeUndefined();
  });

  it("falls back to the default cap for an unknown tier", () => {
    const huge = "d".repeat(100_000);
    const result = capContextForTier("unknown_tier", { staticContext: huge, prompt: "hi" });
    expect(result.cappedStatic?.length).toBe(6_000 * 4);
  });

  it("does not truncate content smaller than the cap", () => {
    const small = "hello world";
    const result = capContextForTier("story_pro", { staticContext: small, dynamicContext: small, prompt: small });
    expect(result.cappedStatic).toBe(small);
    expect(result.cappedDynamic).toBe(small);
    expect(result.cappedPrompt).toBe(small);
  });
});
