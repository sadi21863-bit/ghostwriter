import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Sprint 0 / v4 §3.3 — request-boundary mode validation.
 *
 * `/api/ai/generate` used to check only that `mode` was truthy. An arbitrary
 * string then reached `MI[mode as GenerationMode](format)` in engine.ts, which
 * indexes a dispatch map with no optional chaining and throws a TypeError —
 * surfacing as an opaque HTTP 500 instead of a 400.
 *
 * These are behavioural tests against the real route. The pure guard itself is
 * covered in `src/lib/modes/__tests__/generation-mode-guard.test.ts`.
 */

const generate = vi.fn();
vi.mock("@/lib/ai/engine", () => ({
  generate: (...args: any[]) => generate(...args),
  MODELS: { default: "default-model", fast: "fast-model" },
}));
vi.mock("@/lib/ai/aiisms", () => ({ buildAiismsInstruction: vi.fn(() => "AIISMS") }));
vi.mock("@/lib/growthbook-server", () => ({ isFeatureOnServer: vi.fn(async () => false) }));
vi.mock("@/lib/ai/scene-blueprint", () => ({ buildSceneBlueprint: vi.fn(async () => "") }));
vi.mock("@/lib/ai/promise-ledger", () => ({ buildPromiseLedger: vi.fn(async () => "") }));
vi.mock("@/lib/ai/exemplars", () => ({ buildVoiceExemplars: vi.fn(async () => "") }));
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
vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: () => requireSession(),
}));

const checkAiRateLimit = vi.fn();
vi.mock("@/lib/ratelimit", () => ({
  checkAiRateLimit: (...args: any[]) => checkAiRateLimit(...args),
}));

const meterAndGate = vi.fn();
const refundCredits = vi.fn();
vi.mock("@/lib/metering/meter", () => ({
  meterAndGate: (...args: any[]) => meterAndGate(...args),
  refundCredits: (...args: any[]) => refundCredits(...args),
}));

const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ track: (...args: any[]) => track(...args) }));

// Tier-aware. The previous mock returned `true` unconditionally, which made the
// registry-derived `GATED_MODES` check a silent no-op in every test — the route's
// paywall was never actually exercised. Mirroring FEATURE_ACCESS means the real
// gate does the blocking, as it does in production.
vi.mock("@/lib/subscription", async () => {
  const { FEATURE_ACCESS } = await import("@/types/subscription");
  const table = FEATURE_ACCESS as unknown as Record<string, string[]>;
  return {
    getUserTier: vi.fn(async () => "story_pro"),
    canAccessFeature: vi.fn(
      (tier: string, feature: string) => table[feature]?.includes(tier) ?? false,
    ),
  };
});

const { POST } = await import("../route");

function makeRequest(body: unknown) {
  return new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const valid = { prompt: "Write the next scene.", projectId: "proj-1", format: "Novel" };

describe("POST /api/ai/generate — mode boundary validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSession.mockResolvedValue({ user: { id: "user-1" } });
    checkAiRateLimit.mockResolvedValue(null);
    meterAndGate.mockResolvedValue(null);
    findFirstProjects.mockResolvedValue(null);
  });

  it.each([
    ["an arbitrary string", "not-a-real-mode"],
    ["an inherited Object key", "toString"],
    ["a prototype-pollution key", "__proto__"],
    ["a constructor key", "constructor"],
    ["a wrong-cased real mode", "Write"],
    ["a non-string", 42],
  ])("rejects %s with a 400 instead of throwing a 500", async (_label, mode) => {
    const res = await POST(makeRequest({ ...valid, mode }));

    expect(res.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it("still accepts a registered mode", async () => {
    generate.mockResolvedValue({ text: "prose", tokensUsed: 1, model: "m" });

    const res = await POST(makeRequest({ ...valid, mode: "write" }));

    expect(res.status).toBe(200);
    expect(generate).toHaveBeenCalled();
  });
});

/**
 * Guards the deletion of the hardcoded 22-entry `LIBRARY_MODES` set from
 * `/api/ai/generate`. That set could never execute (every mode it listed was
 * already refused by the registry-derived `GATED_MODES` check), so removing it
 * should change no observable behaviour — these tests are what prove that rather
 * than assume it.
 */
describe("free tier is still refused library modes", () => {
  beforeEach(() => {
    // Required: without it these tests inherit call history from the describe
    // block above, so `generate` looks like it ran for a mode it never saw.
    vi.clearAllMocks();
  });

  const freeTier = async () => {
    const { getUserTier } = await import("@/lib/subscription");
    vi.mocked(getUserTier).mockResolvedValue("free" as never);
  };

  it.each(["combat", "composition", "horror", "isekai", "chase"])(
    "403s %s for a free user without ever calling the model",
    async (mode) => {
      await freeTier();
      const res = await POST(makeRequest({ ...valid, mode }));

      expect(res.status).toBe(403);
      expect(generate).not.toHaveBeenCalled();
    },
  );

  it("returns upgrade_required with the gate that refused it", async () => {
    await freeTier();
    const res = await POST(makeRequest({ ...valid, mode: "combat" }));
    const body = await res.json();

    expect(body.error).toBe("upgrade_required");
    // The registry's gate, not the deleted set's hardcoded feature name.
    expect(body.feature).toBe("story_modes_advanced");
  });

  it("still allows a free user an ungated core mode", async () => {
    await freeTier();
    generate.mockResolvedValue({ text: "prose", tokensUsed: 1, model: "m" });

    const res = await POST(makeRequest({ ...valid, mode: "write" }));

    expect(res.status).toBe(200);
  });
});