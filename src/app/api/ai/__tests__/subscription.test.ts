// src/app/api/ai/__tests__/subscription.test.ts
// Tests for subscription tier logic and feature gating.

import { describe, it, expect, vi } from "vitest";

// Mock DB so importing @/lib/subscription doesn't need DATABASE_URL
vi.mock("@/db", () => ({
  db: {
    query: {
      subscriptions: { findFirst: vi.fn().mockResolvedValue(null) },
    },
  },
}));
import {
  FEATURE_ACCESS,
  GATED_MODES,
  FREE_TIER_LIMITS,
  STRIPE_PRICES,
} from "@/types/subscription";
import { canAccessFeature } from "@/lib/subscription";

describe("Subscription tier structure", () => {
  it("story_pro can access story_modes_advanced", () => {
    expect(canAccessFeature("story_pro", "story_modes_advanced")).toBe(true);
  });

  it("creator_pro cannot access story_modes_advanced", () => {
    expect(canAccessFeature("creator_pro", "story_modes_advanced")).toBe(false);
  });

  it("all_access can access both story and creator features", () => {
    expect(canAccessFeature("all_access", "story_modes_advanced")).toBe(true);
    expect(canAccessFeature("all_access", "creator_tools_advanced")).toBe(true);
  });

  it("free tier cannot access any gated feature", () => {
    const gatedFeatures = Object.keys(FEATURE_ACCESS) as Array<keyof typeof FEATURE_ACCESS>;
    for (const feature of gatedFeatures) {
      if (FEATURE_ACCESS[feature].length > 0) {
        expect(canAccessFeature("free", feature)).toBe(false);
      }
    }
  });

  it("composition_layer is gated on story_pro and all_access", () => {
    expect(canAccessFeature("story_pro", "composition_layer")).toBe(true);
    expect(canAccessFeature("all_access", "composition_layer")).toBe(true);
    expect(canAccessFeature("creator_pro", "composition_layer")).toBe(false);
    expect(canAccessFeature("free", "composition_layer")).toBe(false);
  });

  it("creator_tools_advanced is gated on creator_pro and all_access", () => {
    expect(canAccessFeature("creator_pro", "creator_tools_advanced")).toBe(true);
    expect(canAccessFeature("all_access", "creator_tools_advanced")).toBe(true);
    expect(canAccessFeature("story_pro", "creator_tools_advanced")).toBe(false);
    expect(canAccessFeature("free", "creator_tools_advanced")).toBe(false);
  });

  it("audio_novel is gated on story_pro and all_access", () => {
    expect(canAccessFeature("story_pro", "audio_novel")).toBe(true);
    expect(canAccessFeature("all_access", "audio_novel")).toBe(true);
    expect(canAccessFeature("creator_pro", "audio_novel")).toBe(false);
    expect(canAccessFeature("free", "audio_novel")).toBe(false);
  });
});

describe("Free tier limits", () => {
  it("free tier has exactly 10 generations per day", () => {
    expect(FREE_TIER_LIMITS.generations_per_day).toBe(10);
  });

  it("free tier has exactly 1 project", () => {
    expect(FREE_TIER_LIMITS.projects).toBe(1);
  });

  it("free tier has exactly 3 chapters", () => {
    expect(FREE_TIER_LIMITS.chapters).toBe(3);
  });
});

describe("GATED_MODES coverage", () => {
  const allSpecializedModes = [
    "dialogue", "combat", "emotional", "atmosphere", "tension",
    "composition", "horror", "comedy", "mystery", "romance",
    "action", "monologue", "voice", "thriller", "sports",
  ];

  for (const mode of allSpecializedModes) {
    it(`${mode} mode is gated`, () => {
      expect(GATED_MODES[mode]).toBeDefined();
    });
  }

  it("brainstorm is not gated", () => {
    expect(GATED_MODES["brainstorm"]).toBeUndefined();
  });

  it("write is not gated", () => {
    expect(GATED_MODES["write"]).toBeUndefined();
  });

  it("outline is not gated", () => {
    expect(GATED_MODES["outline"]).toBeUndefined();
  });
});

describe("Stripe price IDs configured", () => {
  it("story_pro price ID is set", () => {
    expect(typeof STRIPE_PRICES.story_pro).toBe("string");
  });

  it("creator_pro price ID is set", () => {
    expect(typeof STRIPE_PRICES.creator_pro).toBe("string");
  });

  it("all_access price ID is set", () => {
    expect(typeof STRIPE_PRICES.all_access).toBe("string");
  });
});
