import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/ratelimit", () => ({
  checkAiRateLimit: vi.fn(async () => null),
}));
vi.mock("@/lib/subscription", () => ({
  getUserTier: vi.fn(async () => "pro"),
  canAccessFeature: vi.fn(() => true),
}));
const meterAndGate = vi.fn();
const refundCredits = vi.fn();
vi.mock("@/lib/metering/meter", () => ({
  meterAndGate: (...args: any[]) => meterAndGate(...args),
  refundCredits: (...args: any[]) => refundCredits(...args),
}));

const findFirstProject = vi.fn();
const findFirstCharacter = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProject(...args) },
      characters: { findFirst: (...args: any[]) => findFirstCharacter(...args) },
    },
  },
}));
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((_a: any, b: any) => b),
    and: vi.fn((...args: any[]) => args),
  };
});

const createMessage = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: (...args: any[]) => createMessage(...args),
      // runMeteredCall uses streaming (src/lib/roles/shared.ts) - route it
      // through the same mock so existing createMessage.mockResolvedValue(...)
      // setups still work unchanged.
      stream: (...args: any[]) => ({ finalMessage: () => createMessage(...args) }),
    };
  },
}));

const buildPromiseLedger = vi.fn();
vi.mock("@/lib/ai/promise-ledger", () => ({
  buildPromiseLedger: (...args: any[]) => buildPromiseLedger(...args),
}));
const buildVoiceExemplars = vi.fn();
vi.mock("@/lib/ai/exemplars", () => ({
  buildVoiceExemplars: (...args: any[]) => buildVoiceExemplars(...args),
}));

const { POST } = await import("../route");

function makeReq(body: unknown) {
  return new Request("http://localhost/api/projects/proj-1/villain-pov", {
    method: "POST", body: JSON.stringify(body),
  });
}
function makeParams(projectId = "proj-1") {
  return { params: Promise.resolve({ projectId }) };
}

describe("POST /api/projects/[projectId]/villain-pov", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProject.mockResolvedValue({ id: "proj-1", userId: "user-1", name: "Test" });
    findFirstCharacter.mockResolvedValue({
      id: "char-1", name: "Mordred", role: "antagonist",
      antagonistType: null, personality: "cold", desires: "power",
    });
    createMessage.mockResolvedValue({ content: [{ type: "text", text: "villain scene" }] });
    buildPromiseLedger.mockResolvedValue("");
    buildVoiceExemplars.mockResolvedValue("");
    meterAndGate.mockResolvedValue(null);
    refundCredits.mockResolvedValue(undefined);
  });

  it("fetches promiseLedger and voiceExemplars in parallel", async () => {
    buildPromiseLedger.mockResolvedValue("OPEN STORY PROMISES");
    buildVoiceExemplars.mockResolvedValue("VOICE EXEMPLARS");
    await POST(makeReq({ characterId: "char-1", sceneDescription: "a tense confrontation" }), makeParams());
    expect(buildPromiseLedger).toHaveBeenCalledWith("proj-1", "generate");
    expect(buildVoiceExemplars).toHaveBeenCalledWith("user-1", "a tense confrontation", undefined);
  });

  it("appends both context strings to the system prompt", async () => {
    buildPromiseLedger.mockResolvedValue("OPEN STORY PROMISES");
    buildVoiceExemplars.mockResolvedValue("VOICE EXEMPLARS");
    await POST(makeReq({ characterId: "char-1", sceneDescription: "a tense confrontation" }), makeParams());
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("OPEN STORY PROMISES"),
      }),
    );
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("VOICE EXEMPLARS"),
      }),
    );
  });

  it("system prompt is unchanged when both helpers return empty (fail-open)", async () => {
    await POST(makeReq({ characterId: "char-1", sceneDescription: "a tense confrontation" }), makeParams());
    const call = createMessage.mock.calls[0][0];
    expect(call.system.endsWith("\n\n")).toBe(false);
  });

  it("grounds the scene in real combat biomechanics when combat styles are supplied", async () => {
    await POST(makeReq({
      characterId: "char-1", sceneDescription: "the antagonist corners the protagonist",
      combatStyleA: "Muay Thai", combatStyleB: "Krav Maga",
    }), makeParams());
    const call = createMessage.mock.calls[0][0];
    expect(call.system).toContain("COMBAT LIBRARY");
    expect(call.system).toContain("MUAY THAI");
    expect(call.system).toContain("KRAV MAGA");
  });

  it("binds combatStyleA to the antagonist's own name so terminology isn't misattributed (item 58 fix)", async () => {
    await POST(makeReq({
      characterId: "char-1", sceneDescription: "the antagonist corners the protagonist",
      combatStyleA: "Muay Thai", combatStyleB: "Krav Maga",
    }), makeParams());
    const call = createMessage.mock.calls[0][0];
    expect(call.system).toContain("used by Mordred");
    // The opponent (styleB) has no known owner in this route - must not guess one.
    expect(call.system).not.toMatch(/KRAV MAGA.*used by/);
  });

  it("omits combat context when no styles are supplied", async () => {
    await POST(makeReq({ characterId: "char-1", sceneDescription: "a quiet confrontation" }), makeParams());
    const call = createMessage.mock.calls[0][0];
    expect(call.system).not.toContain("COMBAT LIBRARY");
  });

  it("passes 'combat' as the mode hint to buildVoiceExemplars when a combat style is supplied", async () => {
    await POST(makeReq({
      characterId: "char-1", sceneDescription: "the antagonist corners the protagonist",
      combatStyleA: "Muay Thai",
    }), makeParams());
    expect(buildVoiceExemplars).toHaveBeenCalledWith("user-1", "the antagonist corners the protagonist", "combat");
  });

  it("passes no mode hint to buildVoiceExemplars when no combat style is supplied", async () => {
    await POST(makeReq({ characterId: "char-1", sceneDescription: "a quiet confrontation" }), makeParams());
    expect(buildVoiceExemplars).toHaveBeenCalledWith("user-1", "a quiet confrontation", undefined);
  });

  it("infers the combat style from the antagonist's own World Bible skills when none is explicitly supplied", async () => {
    findFirstCharacter.mockResolvedValue({
      id: "char-1", name: "Mordred", role: "antagonist",
      antagonistType: null, personality: "cold", desires: "power",
      skills: [{ name: "Krav Maga", category: "physical", level: 3, acquisitionPath: "deliberate_practice", traumaLinked: false }],
    });
    await POST(makeReq({ characterId: "char-1", sceneDescription: "the antagonist corners the protagonist" }), makeParams());
    const call = createMessage.mock.calls[0][0];
    expect(call.system).toContain("COMBAT LIBRARY");
    expect(call.system).toContain("KRAV MAGA");
    expect(buildVoiceExemplars).toHaveBeenCalledWith("user-1", "the antagonist corners the protagonist", "combat");
  });

  it("prefers an explicitly-supplied combat style over an inferred one from skills", async () => {
    findFirstCharacter.mockResolvedValue({
      id: "char-1", name: "Mordred", role: "antagonist",
      antagonistType: null, personality: "cold", desires: "power",
      skills: [{ name: "Krav Maga", category: "physical", level: 3, acquisitionPath: "deliberate_practice", traumaLinked: false }],
    });
    await POST(makeReq({
      characterId: "char-1", sceneDescription: "the antagonist corners the protagonist",
      combatStyleA: "Muay Thai",
    }), makeParams());
    const call = createMessage.mock.calls[0][0];
    expect(call.system).toContain("MUAY THAI");
    expect(call.system).not.toContain("KRAV MAGA");
  });

  it("does not infer a combat style from a vague, non-matching skill", async () => {
    findFirstCharacter.mockResolvedValue({
      id: "char-1", name: "Mordred", role: "antagonist",
      antagonistType: null, personality: "cold", desires: "power",
      skills: [{ name: "self-defense", category: "physical", level: 1, acquisitionPath: "deliberate_practice", traumaLinked: false }],
    });
    await POST(makeReq({ characterId: "char-1", sceneDescription: "a quiet confrontation" }), makeParams());
    const call = createMessage.mock.calls[0][0];
    expect(call.system).not.toContain("COMBAT LIBRARY");
  });
});
