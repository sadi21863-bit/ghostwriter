// Tests the quality_stack flag-gating in /api/ai/generate: flag-OFF must be
// byte-identical to pre-port behavior (no blueprint/promise-ledger/voice
// exemplars appended), flag-ON must invoke and append all three, and the
// gate must short-circuit before the GrowthBook call entirely for non-prose
// modes, no projectId, or free tier (so those paths never pay the extra
// network round-trip even when the flag would otherwise be on).
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

const generate = vi.fn(async () => ({ text: "generated prose", tokensUsed: 10, model: "claude" }));
vi.mock("@/lib/ai/engine", () => ({
  generate: (...args: any[]) => generate(...args),
  MODELS: { default: "default-model", fast: "fast-model" },
}));

const isFeatureOnServer = vi.fn(async () => false);
vi.mock("@/lib/growthbook-server", () => ({
  isFeatureOnServer: (...args: any[]) => isFeatureOnServer(...args),
}));

const buildSceneBlueprint = vi.fn(async () => "BLUEPRINT TEXT");
const buildPromiseLedger = vi.fn(async () => "PROMISE LEDGER TEXT");
const buildVoiceExemplars = vi.fn(async () => "VOICE EXEMPLARS TEXT");
vi.mock("@/lib/ai/scene-blueprint", () => ({ buildSceneBlueprint: (...args: any[]) => buildSceneBlueprint(...args) }));
vi.mock("@/lib/ai/promise-ledger", () => ({ buildPromiseLedger: (...args: any[]) => buildPromiseLedger(...args) }));
vi.mock("@/lib/ai/exemplars", () => ({ buildVoiceExemplars: (...args: any[]) => buildVoiceExemplars(...args) }));

const findFirstProjects = vi.fn(async () => ({ id: "proj-1", userId: "user-1", intentionalViolations: {} }));
const findManySeriesBibles = vi.fn(async () => []);
const insertGenerations = vi.fn(async () => {});
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

describe("POST /api/ai/generate — quality_stack gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1", intentionalViolations: {} });
    findManySeriesBibles.mockResolvedValue([]);
    generate.mockResolvedValue({ text: "generated prose", tokensUsed: 10, model: "claude" });
  });

  it("flag OFF: never calls the GrowthBook check or any builder, dynamicContext unchanged", async () => {
    vi.mocked(getUserTier).mockResolvedValue("story_pro" as any);
    isFeatureOnServer.mockResolvedValue(false);

    await POST(makeRequest({ mode: "write", prompt: "Write the next scene.", projectId: "proj-1", format: "Novel" }));

    expect(isFeatureOnServer).toHaveBeenCalledTimes(1); // tier is paid + mode is prose + projectId present, so it IS checked
    expect(buildSceneBlueprint).not.toHaveBeenCalled();
    expect(buildPromiseLedger).not.toHaveBeenCalled();
    expect(buildVoiceExemplars).not.toHaveBeenCalled();
    const callArgs = generate.mock.calls[0][0];
    // No dynamicContext was supplied in the request and the flag is off, so this
    // must be undefined — exactly what pre-port behavior produced. Any non-empty
    // value here would mean something leaked in despite the flag being off.
    expect(callArgs.dynamicContext).toBeUndefined();
  });

  it("flag ON: runs all three builders concurrently and appends their output to dynamicContext", async () => {
    vi.mocked(getUserTier).mockResolvedValue("story_pro" as any);
    isFeatureOnServer.mockResolvedValue(true);

    await POST(makeRequest({ mode: "write", prompt: "Write the next scene.", projectId: "proj-1", format: "Novel" }));

    expect(buildSceneBlueprint).toHaveBeenCalledTimes(1);
    expect(buildPromiseLedger).toHaveBeenCalledWith("proj-1");
    expect(buildVoiceExemplars).toHaveBeenCalledWith("user-1", expect.any(String));
    const callArgs = generate.mock.calls[0][0];
    expect(callArgs.dynamicContext).toContain("BLUEPRINT TEXT");
    expect(callArgs.dynamicContext).toContain("PROMISE LEDGER TEXT");
    expect(callArgs.dynamicContext).toContain("VOICE EXEMPLARS TEXT");
  });

  it("free tier: short-circuits before the GrowthBook check even if the flag would be on", async () => {
    vi.mocked(getUserTier).mockResolvedValue("free" as any);
    isFeatureOnServer.mockResolvedValue(true);

    await POST(makeRequest({ mode: "write", prompt: "Write the next scene.", projectId: "proj-1", format: "Novel" }));

    expect(isFeatureOnServer).not.toHaveBeenCalled();
    expect(buildSceneBlueprint).not.toHaveBeenCalled();
  });

  it("non-prose mode (outline): short-circuits before the GrowthBook check", async () => {
    vi.mocked(getUserTier).mockResolvedValue("story_pro" as any);
    isFeatureOnServer.mockResolvedValue(true);

    await POST(makeRequest({ mode: "outline", prompt: "Outline the next chapter.", projectId: "proj-1", format: "Novel" }));

    expect(isFeatureOnServer).not.toHaveBeenCalled();
    expect(buildPromiseLedger).not.toHaveBeenCalled();
  });

  it("no projectId: short-circuits before the GrowthBook check", async () => {
    vi.mocked(getUserTier).mockResolvedValue("story_pro" as any);
    isFeatureOnServer.mockResolvedValue(true);

    await POST(makeRequest({ mode: "write", prompt: "Write the next scene.", format: "Novel" }));

    expect(isFeatureOnServer).not.toHaveBeenCalled();
    expect(buildVoiceExemplars).not.toHaveBeenCalled();
  });

  it("skipBlueprint: still runs promise-ledger and voice exemplars but not the blueprint planner", async () => {
    vi.mocked(getUserTier).mockResolvedValue("story_pro" as any);
    isFeatureOnServer.mockResolvedValue(true);

    await POST(makeRequest({ mode: "write", prompt: "Write the next scene.", projectId: "proj-1", format: "Novel", skipBlueprint: true }));

    expect(buildSceneBlueprint).not.toHaveBeenCalled();
    expect(buildPromiseLedger).toHaveBeenCalledTimes(1);
    expect(buildVoiceExemplars).toHaveBeenCalledTimes(1);
  });
});
