import { describe, it, expect } from "vitest";
import { capContextForTier, CONTEXT_CHAR_CAPS } from "@/lib/ai/context-caps";

const MARKER = "\n[Context truncated for tier limit]";

describe("capContextForTier", () => {
  it("caps staticContext to the tier's character limit and appends a marker", () => {
    const huge = "a".repeat(100_000);
    const result = capContextForTier("free", { staticContext: huge, prompt: "hi" });
    expect(result.cappedStatic?.startsWith("a".repeat(CONTEXT_CHAR_CAPS.free))).toBe(true);
    expect(result.cappedStatic?.endsWith(MARKER)).toBe(true);
  });

  it("caps dynamicContext to half the tier's character limit and appends a marker", () => {
    const huge = "b".repeat(100_000);
    const result = capContextForTier("story_pro", { dynamicContext: huge, prompt: "hi" });
    const halfCap = Math.floor(CONTEXT_CHAR_CAPS.story_pro / 2);
    expect(result.cappedDynamic?.startsWith("b".repeat(halfCap))).toBe(true);
    expect(result.cappedDynamic?.endsWith(MARKER)).toBe(true);
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
    expect(result.cappedStatic?.startsWith("d".repeat(6_000 * 4))).toBe(true);
  });

  it("does not truncate content smaller than the cap", () => {
    const small = "hello world";
    const result = capContextForTier("story_pro", { staticContext: small, dynamicContext: small, prompt: small });
    expect(result.cappedStatic).toBe(small);
    expect(result.cappedDynamic).toBe(small);
    expect(result.cappedPrompt).toBe(small);
  });

  it("truncates at the last line boundary before the cap, never mid-line", () => {
    const cap = CONTEXT_CHAR_CAPS.free; // 8000
    const line = "x".repeat(50) + "-END\n"; // 55 chars per line
    const big = line.repeat(200); // 11,000 chars > cap
    const result = capContextForTier("free", { staticContext: big, prompt: "hi" });
    expect(result.cappedStatic?.endsWith(MARKER)).toBe(true);
    const content = result.cappedStatic!.slice(0, -MARKER.length);
    expect(content.length).toBeLessThanOrEqual(cap);
    expect(content.endsWith("-END")).toBe(true);
    expect(content.length % line.length).toBe(line.length - 1); // whole lines minus the final \n
  });
});
