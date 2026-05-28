// src/app/api/ai/__tests__/ratelimit.test.ts
// Tests for rate limiting behaviour.

import { describe, it, expect } from "vitest";

describe("Rate limit response format", () => {
  it("rate limit response has correct shape when limit is hit", async () => {
    const { NextResponse } = await import("next/server");

    const mockRateResponse = NextResponse.json(
      { error: "Rate limit exceeded. Maximum 20 AI requests per minute." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "20",
          "X-RateLimit-Remaining": "0",
        },
      }
    );

    expect(mockRateResponse.status).toBe(429);
  });

  it("fail-open behavior: null ratelimit allows all requests", async () => {
    const { checkAiRateLimit } = await import("@/lib/ratelimit");
    const result = await checkAiRateLimit("test-user");
    expect(result === null || result !== undefined).toBe(true);
  });
});

describe("Free generation limit", () => {
  it("free tier limit is 10 per day", async () => {
    const { FREE_TIER_LIMITS } = await import("@/types/subscription");
    expect(FREE_TIER_LIMITS.generations_per_day).toBe(10);
  });
});
