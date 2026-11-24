import { describe, it, expect } from "vitest";
import {
  appendSeriesContext,
  applyModePromptDirective,
  composeDynamicContext,
  isResearchMode,
  shouldRunProseAugmentation,
} from "@/lib/ai/generation-context";

/*
 * Unit contract for the pure half of generation-context.ts. The DB-coupled
 * bible builders (buildSeriesUniverseContext / buildSeriesBibleContext) are
 * exercised through the route's composite quality-stack test, same as when
 * they lived inline in the route; what needed its own unit suite is the
 * assembly-order logic that was previously invisible inside the route body.
 */
describe("applyModePromptDirective", () => {
  it("appends the 3-option directive for brainstorm mode", () => {
    const out = applyModePromptDirective("brainstorm", "bank heist story");
    expect(out.startsWith("bank heist story")).toBe(true);
    expect(out).toContain("Return exactly 3 distinct structural approaches as options");
    expect(out).toContain("OPTION A");
    expect(out).toContain("One option should subvert expectations.");
  });

  it("appends the BEAT directive for outline mode", () => {
    const out = applyModePromptDirective("outline", "prison escape");
    expect(out.startsWith("prison escape")).toBe(true);
    expect(out).toContain('starting with "BEAT:"');
    expect(out).toContain("Generate 6-12 beats");
  });

  it("leaves every other mode's prompt untouched", () => {
    const p = "write the pottery scene";
    expect(applyModePromptDirective("write", p)).toBe(p);
    expect(applyModePromptDirective("combat", p)).toBe(p);
  });
});

describe("appendSeriesContext", () => {
  it("appends server-derived series context after the tier cap", () => {
    expect(appendSeriesContext("CLIENT BIBLE", "\n\n--- STORY UNIVERSE ---\nx")).toBe(
      "CLIENT BIBLE\n\n---\n\n\n--- STORY UNIVERSE ---\nx",
    );
  });

  it("uses the empty string when no client static was supplied", () => {
    expect(appendSeriesContext(undefined, "SERIES: x")).toBe("\n\n---\nSERIES: x");
  });

  it("passes the cap block through untouched when no series context exists", () => {
    expect(appendSeriesContext("CLIENT", "")).toBe("CLIENT");
  });
});

describe("composeDynamicContext", () => {
  it("joins non-empty parts with blank lines, in order", () => {
    expect(composeDynamicContext(["a", undefined, "", "b"])).toBe("a\n\nb");
  });

  it("produces an empty string when every part is empty", () => {
    expect(composeDynamicContext(["", undefined])).toBe("");
  });
});

describe("isResearchMode", () => {
  it("matches exactly the four research modes", () => {
    for (const m of ["historical", "scitech", "sports", "setting"]) expect(isResearchMode(m)).toBe(true);
    expect(isResearchMode("write")).toBe(false);
    expect(isResearchMode("historical ")).toBe(false); // no tolerant matching
  });
});

describe("shouldRunProseAugmentation", () => {
  it("requires prose mode + project + non-free tier, all three", () => {
    expect(shouldRunProseAugmentation("write", "p1", "story_pro")).toBe(true);
    expect(shouldRunProseAugmentation("brainstorm", "p1", "story_pro")).toBe(false); // not prose
    expect(shouldRunProseAugmentation("write", undefined, "story_pro")).toBe(false); // no project
    expect(shouldRunProseAugmentation("write", "p1", "free")).toBe(false); // free tier
  });
});
