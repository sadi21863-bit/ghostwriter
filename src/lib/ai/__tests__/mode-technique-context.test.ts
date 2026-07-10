import { describe, it, expect } from "vitest";
import { buildModeTechniqueContext } from "../mode-technique-context";

describe("buildModeTechniqueContext", () => {
  it("returns combat biomechanics when mode is combat and a style is given", () => {
    const ctx = buildModeTechniqueContext({ mode: "combat", combatStyleA: "Muay Thai", combatStyleB: "Krav Maga" });
    expect(ctx).toContain("COMBAT LIBRARY");
    expect(ctx).toContain("MUAY THAI");
    expect(ctx).toContain("KRAV MAGA");
  });

  it("returns combat context for a single style with no opponent named", () => {
    const ctx = buildModeTechniqueContext({ mode: "combat", combatStyleA: "Boxing" });
    expect(ctx).toContain("BOXING");
  });

  it("binds a style to a named character when an owner is given, so the prose doesn't misattribute it", () => {
    const ctx = buildModeTechniqueContext({
      mode: "combat",
      combatStyleA: "Krav Maga",
      combatStyleB: "Boxing",
      combatStyleAOwner: "Kessler",
    });
    expect(ctx).toContain("KRAV MAGA");
    expect(ctx).toContain("used by Kessler");
    // Boxing has no owner supplied - must not be falsely bound to anyone.
    expect(ctx).not.toMatch(/BOXING.*used by/);
  });

  it("returns emotional physiology when mode is emotional and an emotion is given", () => {
    const ctx = buildModeTechniqueContext({ mode: "emotional", emotion: "Grief" });
    expect(ctx.length).toBeGreaterThan(0);
  });

  it("returns tension structure when mode is tension and a type is given", () => {
    const ctx = buildModeTechniqueContext({ mode: "tension", tensionType: "Dread" });
    expect(ctx.length).toBeGreaterThan(0);
  });

  it("returns atmosphere psychology when mode is atmosphere and an environment is given", () => {
    const ctx = buildModeTechniqueContext({ mode: "atmosphere", atmosphere: "Abandoned" });
    expect(ctx.length).toBeGreaterThan(0);
  });

  it("fails open to empty string when mode is combat but no style is supplied", () => {
    expect(buildModeTechniqueContext({ mode: "combat" })).toBe("");
  });

  it("fails open to empty string for a mode with no dedicated technique library", () => {
    expect(buildModeTechniqueContext({ mode: "horror" })).toBe("");
  });

  it("fails open to empty string when no mode is given at all", () => {
    expect(buildModeTechniqueContext({})).toBe("");
  });

  it("fails open to empty string for an unrecognized style/emotion/type/environment name", () => {
    expect(buildModeTechniqueContext({ mode: "combat", combatStyleA: "Not A Real Style" })).toBe("");
    expect(buildModeTechniqueContext({ mode: "emotional", emotion: "Not A Real Emotion" })).toBe("");
  });
});
