import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/ratelimit", () => ({
  checkAiRateLimit: vi.fn(async () => null),
}));

const meterAndGate = vi.fn();
const refundCredits = vi.fn(async () => {});
vi.mock("@/lib/metering/meter", () => ({
  meterAndGate: (...args: any[]) => meterAndGate(...args),
  refundCredits: (...args: any[]) => refundCredits(...args),
}));

const refinePassage = vi.fn();
vi.mock("@/lib/ai/engine", () => ({
  refinePassage: (...args: any[]) => refinePassage(...args),
}));

vi.mock("@/lib/analytics", () => ({ track: vi.fn(async () => {}) }));

const insertGenerations = vi.fn(async () => {});
vi.mock("@/db", () => ({
  db: { insert: () => ({ values: (...args: any[]) => insertGenerations(...args) }) },
}));

const { POST } = await import("../route");

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/ai/refine", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/ai/refine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meterAndGate.mockResolvedValue(null);
  });

  it("meters at the cheaper 'refine' weight, not 'generate'", async () => {
    refinePassage.mockResolvedValue({ text: "polished prose", tokensUsed: 50, model: "claude" });
    await POST(makeRequest({ text: "a passage long enough to pass the minimum length check", format: "Novel" }));
    expect(meterAndGate).toHaveBeenCalledWith("user-1", "refine");
  });

  it("rejects passages under the minimum length without metering", async () => {
    const res = await POST(makeRequest({ text: "short", format: "Novel" }));
    expect(res.status).toBe(400);
    expect(meterAndGate).not.toHaveBeenCalled();
  });

  it("refunds at the 'refine' weight on failure", async () => {
    refinePassage.mockRejectedValue(new Error("model error"));
    const res = await POST(makeRequest({ text: "a passage long enough to pass the minimum length check", format: "Novel" }));
    expect(res.status).toBe(500);
    expect(refundCredits).toHaveBeenCalledWith("user-1", "refine");
  });

  it("returns the refined text on success", async () => {
    refinePassage.mockResolvedValue({ text: "polished prose", tokensUsed: 50, model: "claude" });
    const res = await POST(makeRequest({ text: "a passage long enough to pass the minimum length check", format: "Novel" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("polished prose");
  });
});
