import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Phase 2 / v4 §7 — the violation gate through the real route.
 *
 * The violation check is a ZERO-CHARGE pre-reserve stop: the caller is asked to
 * confirm before any metering, any model call, any context build. These are the
 * behaviours the old inline route owned silently — now the route owns the
 * transport and Core owns the policy, and this file pins the seam between them:
 *
 *  - an OP-protagonist prompt yields the 200 confirmation body (not an error);
 *  - it must never reach the meter (the pipeline stops at `authorize`, before
 *    `reserve`, so a re-confirm loop can't double-charge);
 *  - `bypassViolationCheck` / a previously-confirmed record / no projectId all
 *    let the request proceed to the model exactly as the inline route did.
 */

const generate = vi.fn();
const generateStream = vi.fn();
vi.mock("@/lib/ai/engine", () => ({
  generate: (...args: any[]) => generate(...args),
  generateStream: (...args: any[]) => generateStream(...args),
  MODELS: { default: "default-model", fast: "fast-model" },
}));
vi.mock("@/lib/ai/aiisms", () => ({ buildAiismsInstruction: vi.fn(() => "AIISMS") }));
vi.mock("@/lib/growthbook-server", () => ({ isFeatureOnServer: vi.fn(async () => false) }));
vi.mock("@/lib/ai/scene-blueprint", () => ({ buildSceneBlueprint: vi.fn(async () => "") }));
vi.mock("@/lib/ai/promise-ledger", () => ({ buildPromiseLedger: vi.fn(async () => "") }));
vi.mock("@/lib/ai/exemplars", () => ({ buildVoiceExemplars: vi.fn(async () => "") }));
vi.mock("@/lib/ai/author-voice", () => ({ buildAuthorVoiceExemplars: vi.fn(async () => "") }));
vi.mock("@/lib/ai/web-research", () => ({
  groundInWebResearch: vi.fn(async () => ""),
  isGroundableMode: () => false,
}));

const findFirstProjects = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      seriesBibles: { findMany: vi.fn(async () => []) },
    },
    insert: () => ({ values: vi.fn(async () => undefined) }),
  },
}));

const requireSession = vi.fn();
vi.mock("@/lib/auth-helpers", () => ({ getRequiredSession: () => requireSession() }));

const checkAiRateLimit = vi.fn();
vi.mock("@/lib/ratelimit", () => ({ checkAiRateLimit: (...args: any[]) => checkAiRateLimit(...args) }));

const meterAndGate = vi.fn();
const refundCredits = vi.fn();
vi.mock("@/lib/metering/meter", () => ({
  meterAndGate: (...args: any[]) => meterAndGate(...args),
  refundCredits: (...args: any[]) => refundCredits(...args),
}));

const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ track: (...args: any[]) => track(...args) }));

vi.mock("@/lib/subscription", () => ({
  getUserTier: vi.fn(async () => "story_pro"),
  canAccessFeature: vi.fn(() => true),
}));

const { POST } = await import("../route");

function makeRequest(body: unknown) {
  return new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const OP_PROMPT =
  "Write the next scene. My protagonist is OP and always win — nothing can touch him.";
const valid = { prompt: OP_PROMPT, projectId: "proj-1", mode: "write", format: "Novel" };

describe("POST /api/ai/generate — violation gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSession.mockResolvedValue({ user: { id: "user-1" } });
    checkAiRateLimit.mockResolvedValue(null);
    meterAndGate.mockResolvedValue(null);
    findFirstProjects.mockResolvedValue(null);
    generate.mockResolvedValue({ text: "prose", tokensUsed: 1, model: "m" });
  });

  it("answers an OP prompt with a 200 confirmation body, not an error — and never reaches the meter or the model", async () => {
    const res = await POST(makeRequest(valid));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      requiresConfirmation: true,
      violationType: "op_protagonist",
      flagMessage: expect.any(String),
      supportMode: expect.any(String),
    });
    expect(body.flagMessage).toContain("overpowered");
    expect(generate).not.toHaveBeenCalled();
    // Zero-charge: the stop happens at `authorize`, before `reserve`.
    expect(meterAndGate).not.toHaveBeenCalled();
    expect(meterAndGate).toHaveBeenCalledTimes(0);
  });

  it("generates when the client re-sends with bypassViolationCheck after confirming", async () => {
    const res = await POST(makeRequest({ ...valid, bypassViolationCheck: true }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.text).toBe("prose");
    expect(generate).toHaveBeenCalledTimes(1);
    expect(meterAndGate).toHaveBeenCalledTimes(1);
  });

  it("generates when the project's record shows this violation was previously confirmed", async () => {
    findFirstProjects.mockResolvedValue({
      id: "proj-1",
      userId: "user-1",
      intentionalViolations: { op_protagonist: { confirmed: true } },
    });

    const res = await POST(makeRequest(valid));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.text).toBe("prose");
    expect(findFirstProjects).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("generates for a body with no projectId — the violation gate needs a record to check", async () => {
    const res = await POST(makeRequest({ ...valid, projectId: undefined }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.text).toBe("prose");
    // No project scope: nothing to load, no record read ever happens.
    expect(findFirstProjects).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
