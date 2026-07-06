import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/ratelimit", () => ({
  checkAiRateLimit: vi.fn(async () => null),
}));

const rescueSkippedSections = vi.fn();
vi.mock("@/lib/ai/headroom-summarize", () => ({
  rescueSkippedSections: (...args: any[]) => rescueSkippedSections(...args),
}));

const { POST } = await import("../route");

function makeReq(body: unknown) {
  return new Request("http://localhost/api/ai/headroom-rescue", {
    method: "POST", body: JSON.stringify(body),
  });
}

describe("POST /api/ai/headroom-rescue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rescueSkippedSections.mockResolvedValue("[PLOTS — auto-compressed]\ncompressed text");
  });

  it("returns the rescued text on success", async () => {
    const res = await POST(makeReq({ skipped: [{ label: "plots", content: "long plot text" }], remainingBudgetTokens: 500 }));
    const data = await res.json();
    expect(data.rescued).toBe("[PLOTS — auto-compressed]\ncompressed text");
    expect(rescueSkippedSections).toHaveBeenCalledWith(
      [{ label: "plots", content: "long plot text" }], 500
    );
  });

  it("returns empty string without calling the summarizer when skipped is empty", async () => {
    const res = await POST(makeReq({ skipped: [], remainingBudgetTokens: 500 }));
    const data = await res.json();
    expect(data.rescued).toBe("");
    expect(rescueSkippedSections).not.toHaveBeenCalled();
  });

  it("returns empty string when skipped is missing/malformed", async () => {
    const res = await POST(makeReq({ remainingBudgetTokens: 500 }));
    const data = await res.json();
    expect(data.rescued).toBe("");
  });

  it("fails open (empty string) if rescueSkippedSections throws", async () => {
    rescueSkippedSections.mockRejectedValue(new Error("db down"));
    const res = await POST(makeReq({ skipped: [{ label: "plots", content: "x" }], remainingBudgetTokens: 500 }));
    const data = await res.json();
    expect(data.rescued).toBe("");
  });
});
