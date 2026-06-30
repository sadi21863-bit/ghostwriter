import { describe, it, expect } from "vitest";
import { applicableCapabilityIds, buildRunPlan, runnableCapabilities } from "../graph-program";
import type { CapabilityContext } from "@/lib/capabilities/registry";

const allAccess: CapabilityContext = { tier: "all_access", hasSegmindKey: true, hasOpenAIKey: true, format: "Novel" };
const freeNoKeys: CapabilityContext = { tier: "free", hasSegmindKey: false, hasOpenAIKey: false, format: "Novel" };
// Passes the comic_studio tier gate but has no Segmind key — isolates the key path.
const paidTierNoKey: CapabilityContext = { tier: "all_access", hasSegmindKey: false, hasOpenAIKey: false, format: "Novel" };

describe("applicableCapabilityIds", () => {
  it("unions a selection's node kinds, order-stable and deduped", () => {
    // thread → tension_curve, arc_heatmap, villain_pov ; character → villain_pov (dup dropped)
    expect(applicableCapabilityIds(["thread", "character"])).toEqual(["tension_curve", "arc_heatmap", "villain_pov"]);
  });
  it("returns [] for node kinds with no wired capabilities", () => {
    expect(applicableCapabilityIds(["location", "world_entity"])).toEqual([]);
  });
});

describe("buildRunPlan", () => {
  it("returns null for an unknown capability id", () => {
    expect(buildRunPlan("does_not_exist", ["n1"], allAccess)).toBeNull();
  });

  it("a free anthropic analysis tool is available, costs nothing, needs no confirm", () => {
    const plan = buildRunPlan("tension_curve", ["t1"], allAccess)!;
    expect(plan.available).toBe(true);
    expect(plan.costUsd).toBe(0);
    expect(plan.requiresConfirm).toBe(false);
    expect(plan.action.type).toBe("openActions");
  });

  it("a paid segmind capability (comic) costs per node and REQUIRES confirm when available", () => {
    const plan = buildRunPlan("comic_generate", ["c1", "c2", "c3"], allAccess)!;
    expect(plan.available).toBe(true);
    expect(plan.costUsd).toBeCloseTo(0.29 * 3, 5); // validated unit cost
    expect(plan.requiresConfirm).toBe(true);
    expect(plan.action.type).toBe("openComicStudio");
  });

  it("blocks a paid capability when the segmind key is missing — no confirm, no cost", () => {
    const plan = buildRunPlan("comic_generate", ["c1"], paidTierNoKey)!;
    expect(plan.available).toBe(false);
    expect(plan.reason).toBe("missing_segmind_key");
    expect(plan.requiresConfirm).toBe(false);
    expect(plan.action.type).toBe("hint");
  });

  it("blocks a gated capability for a free tier with an upgrade prompt", () => {
    const plan = buildRunPlan("comic_generate", ["c1"], freeNoKeys)!;
    expect(plan.available).toBe(false);
    expect(plan.reason).toBe("upgrade_required");
    expect(plan.action.type).toBe("upgrade");
  });
});

describe("runnableCapabilities", () => {
  it("enumerates every applicable capability for a chapter selection with availability + cost", () => {
    const opts = runnableCapabilities({ kinds: ["chapter"], nodeIds: ["ch1", "ch2"] }, allAccess);
    const byId = new Map(opts.map(o => [o.capabilityId, o]));
    expect(byId.has("comic_generate")).toBe(true);
    expect(byId.get("comic_generate")!.requiresConfirm).toBe(true);
    expect(byId.get("comic_generate")!.costUsd).toBeCloseTo(0.58, 5);
    // free editor tools present and confirm-free
    expect(byId.get("refine")!.requiresConfirm).toBe(false);
  });

  it("returns an empty list when the selection's kinds have no capabilities", () => {
    expect(runnableCapabilities({ kinds: ["location"], nodeIds: ["l1"] }, allAccess)).toEqual([]);
  });
});
