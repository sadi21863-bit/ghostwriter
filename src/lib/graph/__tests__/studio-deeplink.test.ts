import { describe, it, expect } from "vitest";
import { studioDeepLink } from "../studio-deeplink";
import type { CapabilityActionResult } from "@/lib/capabilities/actions";

describe("studioDeepLink", () => {
  it("builds a studioMode query param for selectMode actions", () => {
    expect(studioDeepLink("proj1", { type: "selectMode", mode: "villain_pov" }))
      .toBe("/project/proj1?studioMode=villain_pov");
  });
  it("encodes a mode value that contains a space", () => {
    expect(studioDeepLink("p1", { type: "selectMode", mode: "villain pov" })).toBe(
      "/project/p1?studioMode=villain%20pov"
    );
  });
  it("builds a studioOpen=comic param for openComicStudio", () => {
    expect(studioDeepLink("proj1", { type: "openComicStudio" })).toBe("/project/proj1?studioOpen=comic");
  });
  it("builds a studioOpen=production param for openProductionStudio", () => {
    expect(studioDeepLink("proj1", { type: "openProductionStudio" })).toBe("/project/proj1?studioOpen=production");
  });
  it("builds a studioOpen=actions param for openActions", () => {
    expect(studioDeepLink("proj1", { type: "openActions" })).toBe("/project/proj1?studioOpen=actions");
  });
  it("returns null for upgrade/hint/noop — Studio shows these inline, no navigation", () => {
    const upgrade: CapabilityActionResult = { type: "upgrade", gate: "story_modes_advanced" } as CapabilityActionResult;
    expect(studioDeepLink("proj1", upgrade)).toBeNull();
    expect(studioDeepLink("proj1", { type: "hint", reason: "missing_segmind_key" })).toBeNull();
    expect(studioDeepLink("proj1", { type: "noop" })).toBeNull();
  });
});
