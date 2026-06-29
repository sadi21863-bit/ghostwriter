import { describe, it, expect } from "vitest";
import { FUNNEL_ORDER, FUNNEL_LABELS, CREATOR_FUNNEL_LABELS, guideStageToFunnel, funnelStageToGuide } from "../funnel";
import { STAGE_ORDER, type GuideStage } from "../next-action";

describe("FUNNEL_ORDER", () => {
  it("is the four funnel stages in order", () => {
    expect(FUNNEL_ORDER).toEqual(["discover", "shape", "write", "produce"]);
  });
  it("has a label for every funnel stage in both label maps", () => {
    for (const s of FUNNEL_ORDER) {
      expect(FUNNEL_LABELS[s]).toBeTruthy();
      expect(CREATOR_FUNNEL_LABELS[s]).toBeTruthy();
    }
  });
});

describe("guideStageToFunnel", () => {
  it("maps all five guide stages to the right funnel stage", () => {
    expect(guideStageToFunnel("idea")).toBe("discover");
    expect(guideStageToFunnel("structure")).toBe("shape");
    expect(guideStageToFunnel("draft")).toBe("write");
    expect(guideStageToFunnel("polish")).toBe("produce");
    expect(guideStageToFunnel("export")).toBe("produce");
  });

  it("covers every GuideStage in STAGE_ORDER (no unmapped stage)", () => {
    for (const s of STAGE_ORDER) {
      expect(FUNNEL_ORDER).toContain(guideStageToFunnel(s as GuideStage));
    }
  });
});

describe("funnelStageToGuide", () => {
  it("returns a representative guide stage whose funnel is the original", () => {
    for (const f of FUNNEL_ORDER) {
      expect(guideStageToFunnel(funnelStageToGuide(f))).toBe(f);
    }
  });

  it("Produce enters at polish", () => {
    expect(funnelStageToGuide("produce")).toBe("polish");
  });
});
