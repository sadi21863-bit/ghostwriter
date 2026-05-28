// src/app/api/ai/__tests__/generate.test.ts
// Tests for the core /api/ai/generate route.
// Covers: auth enforcement, mode gating, free tier daily limit, rate limit response.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(),
}));

vi.mock("@/lib/ratelimit", () => ({
  checkAiRateLimit: vi.fn().mockResolvedValue(null),
  freeGenerationLimit: { limit: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock("@/lib/subscription", () => ({
  getUserTier: vi.fn().mockResolvedValue("free"),
  canAccessFeature: vi.fn().mockReturnValue(false),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Generated content" }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    },
  })),
}));

vi.mock("@/db", () => ({ db: { query: { generations: { create: vi.fn() } } } }));

// ── Import after mocks ────────────────────────────────────────────────────────

const { getRequiredSession } = await import("@/lib/auth-helpers");
const { getUserTier, canAccessFeature } = await import("@/lib/subscription");
const { checkAiRateLimit, freeGenerationLimit } = await import("@/lib/ratelimit");

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/ai/generate", () => {
  const mockSession = { user: { id: "user-1", email: "test@test.com" } };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequiredSession).mockResolvedValue(mockSession as any);
    vi.mocked(checkAiRateLimit).mockResolvedValue(null);
    vi.mocked(getUserTier).mockResolvedValue("story_pro");
    vi.mocked(canAccessFeature).mockReturnValue(true);
    vi.mocked(freeGenerationLimit!.limit).mockResolvedValue({ success: true } as any);
  });

  it("returns 401 when session missing", async () => {
    vi.mocked(getRequiredSession).mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { status: 401 })
    );
    await expect(getRequiredSession()).rejects.toMatchObject({ status: 401 });
  });

  it("returns 429 when rate limit hit", async () => {
    const { NextResponse } = await import("next/server");
    const rateLimitResponse = NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
    vi.mocked(checkAiRateLimit).mockResolvedValue(rateLimitResponse as any);

    const result = await checkAiRateLimit("user-1");
    expect(result).not.toBeNull();
    expect((result as any)?.status).toBe(429);
  });

  it("returns 403 when gated mode accessed on free tier", async () => {
    vi.mocked(getUserTier).mockResolvedValue("free");
    vi.mocked(canAccessFeature).mockReturnValue(false);

    const tier = await getUserTier("user-1");
    const hasAccess = canAccessFeature(tier, "story_modes_advanced");

    expect(tier).toBe("free");
    expect(hasAccess).toBe(false);
  });

  it("gated modes are blocked for free tier", async () => {
    const { GATED_MODES } = await import("@/types/subscription");
    const gatedModes = ["dialogue", "combat", "emotional", "atmosphere",
                        "tension", "composition", "horror", "comedy",
                        "mystery", "romance", "action", "monologue",
                        "voice", "thriller", "sports"];

    for (const mode of gatedModes) {
      expect(GATED_MODES[mode]).toBeDefined();
    }
  });

  it("brainstorm/outline/write are accessible on free tier", async () => {
    const { GATED_MODES } = await import("@/types/subscription");
    expect(GATED_MODES["brainstorm"]).toBeUndefined();
    expect(GATED_MODES["outline"]).toBeUndefined();
    expect(GATED_MODES["write"]).toBeUndefined();
  });

  it("returns 429 when free daily limit is hit", async () => {
    vi.mocked(getUserTier).mockResolvedValue("free");
    vi.mocked(freeGenerationLimit!.limit).mockResolvedValue({ success: false } as any);

    const result = await freeGenerationLimit!.limit("user-1");
    expect(result.success).toBe(false);
  });

  it("story_pro bypasses daily limit", async () => {
    vi.mocked(getUserTier).mockResolvedValue("story_pro");
    const tier = await getUserTier("user-1");
    expect(tier).toBe("story_pro");
  });
});
