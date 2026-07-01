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
  getUserTier: vi.fn(async () => "pro"),
  canAccessFeature: vi.fn(() => true),
}));

const createMessage = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { create: (...args: any[]) => createMessage(...args) }; },
}));

const buildPromiseLedger = vi.fn();
vi.mock("@/lib/ai/promise-ledger", () => ({
  buildPromiseLedger: (...args: any[]) => buildPromiseLedger(...args),
}));
const extractVoiceFingerprint = vi.fn();
const fingerprintToConstraints = vi.fn();
vi.mock("@/lib/ai/voice-fingerprint", () => ({
  extractVoiceFingerprint: (...args: any[]) => extractVoiceFingerprint(...args),
  fingerprintToConstraints: (...args: any[]) => fingerprintToConstraints(...args),
}));

const { POST } = await import("../route");

function makeReq(body: unknown) {
  return new Request("http://localhost/api/ai/prose-fix", {
    method: "POST", body: JSON.stringify(body),
  });
}

describe("POST /api/ai/prose-fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meterAndGate.mockResolvedValue(null);
    createMessage.mockResolvedValue({
      content: [{ type: "text", text: "fixed prose" }],
    });
    buildPromiseLedger.mockResolvedValue("");
    extractVoiceFingerprint.mockReturnValue(null);
  });

  it("appends voice constraints to system prompt when fingerprint succeeds", async () => {
    extractVoiceFingerprint.mockReturnValue({ avgSentenceLength: 12 });
    fingerprintToConstraints.mockReturnValue("BINDING VOICE CONSTRAINTS");
    await POST(makeReq({ text: "some chapter text", fixInstruction: "fix pacing" }));
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("BINDING VOICE CONSTRAINTS"),
      }),
    );
  });

  it("appends promise ledger to system prompt when projectId is supplied", async () => {
    buildPromiseLedger.mockResolvedValue("OPEN STORY PROMISES");
    await POST(makeReq({ text: "some chapter text", fixInstruction: "fix pacing", projectId: "proj-1" }));
    expect(buildPromiseLedger).toHaveBeenCalledWith("proj-1", "preserve");
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("OPEN STORY PROMISES"),
      }),
    );
  });

  it("system prompt is unchanged when helpers return empty (fail-open)", async () => {
    await POST(makeReq({ text: "some chapter text", fixInstruction: "fix pacing" }));
    const call = createMessage.mock.calls[0][0];
    // When no extra context appended, prompt should not end with double newlines
    expect(call.system.endsWith("\n\n")).toBe(false);
  });

  it("skips buildPromiseLedger when no projectId", async () => {
    await POST(makeReq({ text: "some chapter text", fixInstruction: "fix pacing" }));
    expect(buildPromiseLedger).not.toHaveBeenCalled();
  });
});
