import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/ratelimit", () => ({
  checkAiRateLimit: vi.fn(async () => null),
}));
const meterAndGate = vi.fn();
const refundCredits = vi.fn();
vi.mock("@/lib/metering/meter", () => ({
  meterAndGate: (...args: any[]) => meterAndGate(...args),
  refundCredits: (...args: any[]) => refundCredits(...args),
}));
vi.mock("@/lib/subscription", () => ({
  getUserTier: vi.fn(async () => "story_pro"),
  canAccessFeature: vi.fn(() => true),
}));

const createMessage = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { create: (...args: any[]) => createMessage(...args) }; },
}));

const { POST } = await import("../route");

const LONG_TEXT = "A".repeat(250);

function makeReq(body: unknown) {
  return new Request("http://localhost/api/ai/beta-read", {
    method: "POST", body: JSON.stringify(body),
  });
}

function personaResponse(verdict: string, dnfPoint?: string) {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        reaction: "It landed fine.",
        highlights: ["strong opening"],
        concerns: dnfPoint ? ["lost me here"] : [],
        verdict,
        ...(dnfPoint ? { dnfPoint } : {}),
      }),
    }],
  };
}

describe("POST /api/ai/beta-read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meterAndGate.mockResolvedValue(null);
  });

  it("returns 3 persona results + a summary on the happy path", async () => {
    createMessage.mockResolvedValue(personaResponse("would_continue"));
    const res = await POST(makeReq({ text: LONG_TEXT, format: "Novel" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(3);
    expect(body.summary.continueCount).toBe(3);
    expect(body.summary.headline).toContain("would keep going");
    expect(refundCredits).not.toHaveBeenCalled();
  });

  it("returns the other 2 results when 1 of 3 persona calls rejects, without refunding", async () => {
    createMessage
      .mockResolvedValueOnce(personaResponse("would_continue"))
      .mockRejectedValueOnce(new Error("Anthropic overloaded"))
      .mockResolvedValueOnce(personaResponse("might_stop"));
    const res = await POST(makeReq({ text: LONG_TEXT, format: "Novel" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(refundCredits).not.toHaveBeenCalled();
  });

  it("refunds and errors when all 3 persona calls fail", async () => {
    createMessage.mockRejectedValue(new Error("Anthropic overloaded"));
    const res = await POST(makeReq({ text: LONG_TEXT, format: "Novel" }));
    expect(res.status).toBe(500);
    expect(refundCredits).toHaveBeenCalledWith("user-1", "beta-read");
  });

  it("rejects text shorter than 200 characters", async () => {
    const res = await POST(makeReq({ text: "too short", format: "Novel" }));
    expect(res.status).toBe(400);
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("returns the metering gate's response when the monthly limit is reached", async () => {
    const gateResponse = new Response(JSON.stringify({ error: "Monthly generation limit reached" }), { status: 429 });
    meterAndGate.mockResolvedValue(gateResponse);
    const res = await POST(makeReq({ text: LONG_TEXT, format: "Novel" }));
    expect(res.status).toBe(429);
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("gates behind the story_modes_advanced tier", async () => {
    const { canAccessFeature } = await import("@/lib/subscription");
    (canAccessFeature as any).mockReturnValue(false);
    const res = await POST(makeReq({ text: LONG_TEXT, format: "Novel" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("upgrade_required");
  });
});
