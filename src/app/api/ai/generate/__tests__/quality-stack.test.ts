// Tests the split prose-augmentation gating in /api/ai/generate after the
// 2026-06-21 flag split: the free helpers (promise-ledger, voice-exemplars)
// must run unconditionally for any qualifying request (no flag check at all),
// while the costly Haiku scene-blueprint runs ONLY behind the sceneBlueprint
// flag (default OFF) and the per-request skipBlueprint escape hatch. The
// qualifying-request gate (isProseMode && projectId && tier !== 'free') must
// still short-circuit everything, including the free helpers, for non-prose
// modes, no projectId, or free tier.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/ratelimit", () => ({
  checkAiRateLimit: vi.fn(async () => null),
}));
vi.mock("@/lib/subscription", () => ({
  getUserTier: vi.fn(),
  canAccessFeature: vi.fn(() => true),
}));
vi.mock("@/lib/metering/meter", () => ({
  meterAndGate: vi.fn(async () => null),
  refundCredits: vi.fn(async () => {}),
}));
vi.mock("@/lib/analytics", () => ({
  track: vi.fn(async () => {}),
}));
vi.mock("@/lib/ai/aiisms", () => ({
  buildAiismsInstruction: vi.fn(() => "AIISMS"),
}));

const generate = vi.fn();
vi.mock("@/lib/ai/engine", () => ({
  generate: (...args: any[]) => generate(...args),
  MODELS: { default: "default-model", fast: "fast-model" },
}));

const isFeatureOnServer = vi.fn();
vi.mock("@/lib/growthbook-server", () => ({
  isFeatureOnServer: (...args: any[]) => isFeatureOnServer(...args),
}));

const buildSceneBlueprint = vi.fn();
const buildPromiseLedger = vi.fn();
const buildVoiceExemplars = vi.fn();
vi.mock("@/lib/ai/scene-blueprint", () => ({ buildSceneBlueprint: (...args: any[]) => buildSceneBlueprint(...args) }));
vi.mock("@/lib/ai/promise-ledger", () => ({ buildPromiseLedger: (...args: any[]) => buildPromiseLedger(...args) }));
vi.mock("@/lib/ai/exemplars", () => ({ buildVoiceExemplars: (...args: any[]) => buildVoiceExemplars(...args) }));

const findFirstProjects = vi.fn();
const findManySeriesBibles = vi.fn();
const insertGenerations = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      seriesBibles: { findMany: (...args: any[]) => findManySeriesBibles(...args) },
    },
    insert: () => ({ values: (...args: any[]) => insertGenerations(...args) }),
  },
}));

import { getUserTier } from "@/lib/subscription";
import { POST } from "../route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/ai/generate", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/ai/generate — split prose-augmentation gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1", intentionalViolations: {} });
    findManySeriesBibles.mockResolvedValue([]);
    generate.mockResolvedValue({ text: "generated prose", tokensUsed: 10, model: "claude" });
    buildSceneBlueprint.mockResolvedValue("BLUEPRINT TEXT");
    buildPromiseLedger.mockResolvedValue("PROMISE LEDGER TEXT");
    buildVoiceExemplars.mockResolvedValue("VOICE EXEMPLARS TEXT");
  });

  it("default state (sceneBlueprint flag OFF): free helpers run, blueprint does not", async () => {
    vi.mocked(getUserTier).mockResolvedValue("story_pro" as any);
    isFeatureOnServer.mockResolvedValue(false);

    await POST(makeRequest({ mode: "write", prompt: "Write the next scene.", projectId: "proj-1", format: "Novel" }));

    expect(buildPromiseLedger).toHaveBeenCalledWith("proj-1");
    expect(buildVoiceExemplars).toHaveBeenCalledWith("user-1", expect.any(String), "write");
    expect(buildSceneBlueprint).not.toHaveBeenCalled();
    const callArgs: any = generate.mock.calls[0]?.[0];
    expect(callArgs.dynamicContext).toContain("PROMISE LEDGER TEXT");
    expect(callArgs.dynamicContext).toContain("VOICE EXEMPLARS TEXT");
    expect(callArgs.dynamicContext).not.toContain("BLUEPRINT TEXT");
  });

  it("sceneBlueprint flag ON: free helpers AND the blueprint all run and append to dynamicContext", async () => {
    vi.mocked(getUserTier).mockResolvedValue("story_pro" as any);
    isFeatureOnServer.mockResolvedValue(true);

    await POST(makeRequest({ mode: "write", prompt: "Write the next scene.", projectId: "proj-1", format: "Novel" }));

    expect(buildSceneBlueprint).toHaveBeenCalledTimes(1);
    expect(buildPromiseLedger).toHaveBeenCalledWith("proj-1");
    expect(buildVoiceExemplars).toHaveBeenCalledWith("user-1", expect.any(String), "write");
    const callArgs: any = generate.mock.calls[0]?.[0];
    expect(callArgs.dynamicContext).toContain("BLUEPRINT TEXT");
    expect(callArgs.dynamicContext).toContain("PROMISE LEDGER TEXT");
    expect(callArgs.dynamicContext).toContain("VOICE EXEMPLARS TEXT");
  });

  it("the GrowthBook check only ever gates the blueprint, never the free helpers", async () => {
    vi.mocked(getUserTier).mockResolvedValue("story_pro" as any);
    isFeatureOnServer.mockResolvedValue(false);

    await POST(makeRequest({ mode: "write", prompt: "p", projectId: "proj-1", format: "Novel" }));

    expect(isFeatureOnServer).toHaveBeenCalledTimes(1);
    expect(isFeatureOnServer).toHaveBeenCalledWith("scene_blueprint", "user-1", "story_pro");
  });

  it("free tier: short-circuits everything, including the free helpers and the GrowthBook check", async () => {
    vi.mocked(getUserTier).mockResolvedValue("free" as any);
    isFeatureOnServer.mockResolvedValue(true);

    await POST(makeRequest({ mode: "write", prompt: "Write the next scene.", projectId: "proj-1", format: "Novel" }));

    expect(buildPromiseLedger).not.toHaveBeenCalled();
    expect(buildVoiceExemplars).not.toHaveBeenCalled();
    expect(isFeatureOnServer).not.toHaveBeenCalled();
    expect(buildSceneBlueprint).not.toHaveBeenCalled();
  });

  it("non-prose mode (outline): short-circuits everything", async () => {
    vi.mocked(getUserTier).mockResolvedValue("story_pro" as any);
    isFeatureOnServer.mockResolvedValue(true);

    await POST(makeRequest({ mode: "outline", prompt: "Outline the next chapter.", projectId: "proj-1", format: "Novel" }));

    expect(buildPromiseLedger).not.toHaveBeenCalled();
    expect(buildVoiceExemplars).not.toHaveBeenCalled();
    expect(isFeatureOnServer).not.toHaveBeenCalled();
  });

  it("no projectId: short-circuits everything", async () => {
    vi.mocked(getUserTier).mockResolvedValue("story_pro" as any);
    isFeatureOnServer.mockResolvedValue(true);

    await POST(makeRequest({ mode: "write", prompt: "Write the next scene.", format: "Novel" }));

    expect(buildPromiseLedger).not.toHaveBeenCalled();
    expect(buildVoiceExemplars).not.toHaveBeenCalled();
    expect(isFeatureOnServer).not.toHaveBeenCalled();
  });

  it("skipBlueprint with the flag ON: still skips the blueprint but free helpers still run", async () => {
    vi.mocked(getUserTier).mockResolvedValue("story_pro" as any);
    isFeatureOnServer.mockResolvedValue(true);

    await POST(makeRequest({ mode: "write", prompt: "Write the next scene.", projectId: "proj-1", format: "Novel", skipBlueprint: true }));

    expect(buildSceneBlueprint).not.toHaveBeenCalled();
    expect(buildPromiseLedger).toHaveBeenCalledTimes(1);
    expect(buildVoiceExemplars).toHaveBeenCalledTimes(1);
  });
});
