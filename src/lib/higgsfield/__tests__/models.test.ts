// src/lib/higgsfield/__tests__/models.test.ts
import { describe, it, expect } from "vitest";
import { VIDEO_MODELS, ACTIVE_VIDEO_MODELS, VIDEO_ENDPOINTS, VIDEO_MODEL_INFO, MODE_TO_MODEL } from "../models";

describe("VIDEO_MODELS registry", () => {
  it("derives an endpoint and info entry for every model", () => {
    for (const id of Object.keys(VIDEO_MODELS)) {
      expect(VIDEO_ENDPOINTS[id]).toBe(VIDEO_MODELS[id].segmindEndpoint);
      expect(VIDEO_MODEL_INFO[id]).toBeDefined();
      expect(VIDEO_MODEL_INFO[id].label).toBe(VIDEO_MODELS[id].label);
    }
  });

  it("excludes deprecated models from ACTIVE_VIDEO_MODELS", () => {
    expect(ACTIVE_VIDEO_MODELS.find(m => m.id === "sora")).toBeUndefined();
    expect(VIDEO_MODELS.sora.deprecated).toBe(true);
  });

  it("never auto-selects a deprecated model via MODE_TO_MODEL", () => {
    for (const [mode, modelId] of Object.entries(MODE_TO_MODEL)) {
      expect(VIDEO_MODELS[modelId], `MODE_TO_MODEL.${mode} -> "${modelId}" must exist in VIDEO_MODELS`).toBeDefined();
      expect(VIDEO_MODELS[modelId].deprecated, `MODE_TO_MODEL.${mode} -> "${modelId}" must not be deprecated`).not.toBe(true);
    }
  });

  it("routes horror to a non-deprecated model (regression: was 'sora')", () => {
    expect(MODE_TO_MODEL.horror).not.toBe("sora");
  });
});
