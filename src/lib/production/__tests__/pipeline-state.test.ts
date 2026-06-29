import { describe, it, expect } from "vitest";
import { PRODUCTION_PIPELINES, getProductionPipelines } from "../pipelines";
import { computePipelineState, estimatePipelineCost, type PipelineContext } from "../pipeline-state";
import { getCapabilities } from "@/lib/capabilities/registry";

const trailer = PRODUCTION_PIPELINES.find(p => p.id === "book_trailer")!;

const base: PipelineContext = {
  hasShots: false, hasGeneratedMedia: false, chaptersApproved: false,
  hasSegmindKey: false, blobConfigured: false,
};
const stateOf = (ctx: PipelineContext) => {
  const m = new Map(computePipelineState(trailer, ctx).map(s => [s.id, s.status]));
  return (id: string) => m.get(id);
};

describe("PRODUCTION_PIPELINES data", () => {
  it("every capabilityId references a real registry capability", () => {
    const ids = new Set(getCapabilities().map(c => c.id));
    for (const p of PRODUCTION_PIPELINES) {
      for (const st of p.stages) {
        if (st.capabilityId) expect(ids, `${p.id}/${st.id} -> ${st.capabilityId}`).toContain(st.capabilityId);
      }
    }
  });

  it("every pipeline has at least one paid stage preceded by a checkpoint", () => {
    for (const p of PRODUCTION_PIPELINES) {
      const paidIdx = p.stages.findIndex(s => s.paid);
      expect(paidIdx, p.id).toBeGreaterThan(0);
      const hasPriorCheckpoint = p.stages.slice(0, paidIdx).some(s => s.checkpoint);
      expect(hasPriorCheckpoint, `${p.id} paid stage must be gated by a checkpoint`).toBe(true);
    }
  });

  it("getProductionPipelines filters by format", () => {
    expect(getProductionPipelines("Novel").length).toBeGreaterThan(0);
    expect(getProductionPipelines("TikTok Script")).toEqual([]);
  });
});

describe("computePipelineState — the QA-before-spend gate", () => {
  it("plan is ready with nothing, done once shots exist", () => {
    expect(stateOf(base)("plan")).toBe("ready");
    expect(stateOf({ ...base, hasShots: true })("plan")).toBe("done");
  });

  it("review checkpoint is blocked_deps before shots, ready after shots, done when approved", () => {
    expect(stateOf(base)("review")).toBe("blocked_deps");
    expect(stateOf({ ...base, hasShots: true })("review")).toBe("ready");
    expect(stateOf({ ...base, hasShots: true, chaptersApproved: true })("review")).toBe("done");
  });

  it("paid generate stage is blocked_deps with no shots", () => {
    expect(stateOf(base)("generate")).toBe("blocked_deps");
  });

  it("paid generate stage is blocked_gate when shots exist but chapters are NOT approved (the hard gate)", () => {
    expect(stateOf({ ...base, hasShots: true, hasSegmindKey: true, blobConfigured: true })("generate")).toBe("blocked_gate");
  });

  it("gate precedes the key check — approval first, then keys", () => {
    // approved but no key → blocked_key (gate passed); not approved → blocked_gate regardless of key
    expect(stateOf({ ...base, hasShots: true, chaptersApproved: true })("generate")).toBe("blocked_key");
    expect(stateOf({ ...base, hasShots: true, chaptersApproved: false, hasSegmindKey: true, blobConfigured: true })("generate")).toBe("blocked_gate");
  });

  it("paid generate stage is ready when shots + approved + keyed + blob", () => {
    expect(stateOf({ ...base, hasShots: true, chaptersApproved: true, hasSegmindKey: true, blobConfigured: true })("generate")).toBe("ready");
  });

  it("paid generate stage is done once media exists", () => {
    expect(stateOf({ ...base, hasShots: true, chaptersApproved: true, hasSegmindKey: true, blobConfigured: true, hasGeneratedMedia: true })("generate")).toBe("done");
  });

  it("package stage is blocked_deps until media exists, then ready", () => {
    expect(stateOf({ ...base, hasShots: true })("package")).toBe("blocked_deps");
    expect(stateOf({ ...base, hasGeneratedMedia: true })("package")).toBe("ready");
  });
});

describe("estimatePipelineCost", () => {
  it("sums only paid stages and ignores unpaid ones", () => {
    const est = estimatePipelineCost(trailer, 6);
    expect(est.usd).toBeGreaterThan(0);
    expect(est.breakdown.every(b => b.items === 6)).toBe(true);
    // only the single paid stage contributes
    expect(est.breakdown).toHaveLength(1);
  });

  it("scales with item count", () => {
    expect(estimatePipelineCost(trailer, 12).usd).toBeGreaterThan(estimatePipelineCost(trailer, 3).usd);
  });
});
