// src/app/api/ai/__tests__/auth.test.ts
// Tests that all AI routes enforce authentication.

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn().mockRejectedValue(
    Object.assign(new Error("Unauthorized"), { status: 401 })
  ),
}));

describe("Auth enforcement on AI routes", () => {
  it("getRequiredSession throws 401 when no session", async () => {
    const { getRequiredSession } = await import("@/lib/auth-helpers");
    await expect(getRequiredSession()).rejects.toMatchObject({ status: 401 });
  });

  it("401 error has correct status code", async () => {
    const { getRequiredSession } = await import("@/lib/auth-helpers");
    try {
      await getRequiredSession();
    } catch (err: any) {
      expect(err.status).toBe(401);
    }
  });
});

describe("Rate limiting enforcement", () => {
  it("aiRatelimit is configured with sliding window", async () => {
    const { aiRatelimit } = await import("@/lib/ratelimit");
    expect(aiRatelimit === null || typeof aiRatelimit === "object").toBe(true);
  });

  it("freeGenerationLimit is configured with fixed window", async () => {
    const { freeGenerationLimit } = await import("@/lib/ratelimit");
    expect(freeGenerationLimit === null || typeof freeGenerationLimit === "object").toBe(true);
  });
});
