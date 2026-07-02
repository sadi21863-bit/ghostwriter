import { describe, it, expect } from "vitest";
import { capabilityAction } from "../actions";
import type { Capability } from "../registry";
import type { CapabilityAvailability } from "../registry";

function cap(partial: Partial<Capability>): Capability {
  return {
    id: "x", label: "X", kind: "tool", role: "writer", stage: "write",
    provider: "anthropic", gate: null, visibility: "universal", ...partial,
  };
}
const AVAIL: CapabilityAvailability = { available: true };

describe("capabilityAction", () => {
  it("an unavailable gated cap → upgrade action carrying the gate", () => {
    const c = cap({ gate: "comic_studio" });
    expect(capabilityAction(c, { available: false, reason: "upgrade_required" }))
      .toEqual({ type: "upgrade", gate: "comic_studio" });
  });

  it("an unavailable missing-key cap → hint action with the reason", () => {
    const c = cap({ provider: "segmind" });
    expect(capabilityAction(c, { available: false, reason: "missing_segmind_key" }))
      .toEqual({ type: "hint", reason: "missing_segmind_key" });
  });

  it("an available mode cap → selectMode action with the mode id", () => {
    const c = cap({ kind: "mode", id: "dialogue" });
    expect(capabilityAction(c, AVAIL)).toEqual({ type: "selectMode", mode: "dialogue" });
  });

  it("the comic tool → openComicStudio", () => {
    const c = cap({ kind: "tool", id: "comic_generate" });
    expect(capabilityAction(c, AVAIL)).toEqual({ type: "openComicStudio" });
  });

  it("production tools → openProductionStudio", () => {
    for (const id of ["generate_package", "scene_to_video_prompt", "production_video"]) {
      expect(capabilityAction(cap({ kind: "tool", id }), AVAIL)).toEqual({ type: "openProductionStudio" });
    }
  });

  it("any other tool → openActions", () => {
    expect(capabilityAction(cap({ kind: "tool", id: "refine" }), AVAIL)).toEqual({ type: "openActions" });
  });

  it("an unavailable not-applicable cap → noop (it is filtered from display, but guard anyway)", () => {
    const c = cap({ visibility: "story_only" });
    expect(capabilityAction(c, { available: false, reason: "not_applicable_for_format" }))
      .toEqual({ type: "noop" });
  });

  it("tension_curve → openInsights with tab 'tension'", () => {
    const c = cap({ kind: "tool", id: "tension_curve" });
    expect(capabilityAction(c, AVAIL)).toEqual({ type: "openInsights", tab: "tension" });
  });

  it("arc_heatmap → openInsights with tab 'arc'", () => {
    const c = cap({ kind: "tool", id: "arc_heatmap" });
    expect(capabilityAction(c, AVAIL)).toEqual({ type: "openInsights", tab: "arc" });
  });

  it("prose_fix → openStoryHealth with tab 'validator'", () => {
    const c = cap({ kind: "tool", id: "prose_fix" });
    expect(capabilityAction(c, AVAIL)).toEqual({ type: "openStoryHealth", tab: "validator" });
  });

  it("editor_review → openPolishStage", () => {
    const c = cap({ kind: "tool", id: "editor_review" });
    expect(capabilityAction(c, AVAIL)).toEqual({ type: "openPolishStage" });
  });

  it("refine is unaffected — still falls through to openActions", () => {
    const c = cap({ kind: "tool", id: "refine" });
    expect(capabilityAction(c, AVAIL)).toEqual({ type: "openActions" });
  });
});
