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

vi.mock("@/lib/editor/content-migration", () => ({
  isValidTipTapJson: vi.fn(() => false),
  tiptapToPlainText: vi.fn((j: any) => j),
  plainTextToTipTap: vi.fn((t: string) => t),
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
  return new Request("http://localhost/api/ai/surgical-edit", {
    method: "POST", body: JSON.stringify(body),
  });
}

const VALID_CHAPTER = "Here is a long enough chapter with several sentences. It contains many words. The protagonist walked slowly. She thought about the situation carefully. There were many things to consider. The plot thickened noticeably. Rain fell outside the window.";

describe("POST /api/ai/surgical-edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meterAndGate.mockResolvedValue(null);
    createMessage.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ found: "walked slowly", replacement: "strode", explanation: "stronger verb" }) }],
    });
    buildPromiseLedger.mockResolvedValue("");
    extractVoiceFingerprint.mockReturnValue(null);
  });

  it("appends voice constraints to system prompt when fingerprint succeeds", async () => {
    extractVoiceFingerprint.mockReturnValue({ avgSentenceLength: 10 });
    fingerprintToConstraints.mockReturnValue("BINDING VOICE CONSTRAINTS");
    await POST(makeReq({ chapterContent: VALID_CHAPTER, instruction: "improve verbs" }));
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("BINDING VOICE CONSTRAINTS"),
      }),
    );
  });

  it("appends promise ledger to system prompt when projectId is supplied", async () => {
    buildPromiseLedger.mockResolvedValue("OPEN STORY PROMISES");
    await POST(makeReq({ chapterContent: VALID_CHAPTER, instruction: "improve verbs", projectId: "proj-1" }));
    expect(buildPromiseLedger).toHaveBeenCalledWith("proj-1", "preserve");
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("OPEN STORY PROMISES"),
      }),
    );
  });

  it("system prompt is unchanged when helpers return empty (fail-open)", async () => {
    await POST(makeReq({ chapterContent: VALID_CHAPTER, instruction: "improve verbs" }));
    const call = createMessage.mock.calls[0][0];
    // surgicalEditSystemPrompt() itself has no double-newlines in the same pattern — any extra means we appended
    expect(call.system.endsWith("\n\n")).toBe(false);
  });

  it("skips buildPromiseLedger when no projectId", async () => {
    await POST(makeReq({ chapterContent: VALID_CHAPTER, instruction: "improve verbs" }));
    expect(buildPromiseLedger).not.toHaveBeenCalled();
  });
});
