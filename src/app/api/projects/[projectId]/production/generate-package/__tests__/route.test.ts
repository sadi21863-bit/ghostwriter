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

const findFirstProject = vi.fn();
const findFirstUser = vi.fn();
const findFirstCharacter = vi.fn();
const updateSet = vi.fn((..._args: any[]) => ({ where: vi.fn(async () => {}) }));
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProject(...args) },
      users: { findFirst: (...args: any[]) => findFirstUser(...args) },
      characters: { findFirst: (...args: any[]) => findFirstCharacter(...args) },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: "row-1" }]) })),
    })),
    delete: vi.fn(() => ({ where: vi.fn(async () => {}) })),
    update: vi.fn(() => ({ set: (...args: any[]) => updateSet(...args) })),
  },
}));
vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn((v: string) => v || ""),
}));
const bootstrapAndTrainSoulId = vi.fn();
vi.mock("@/lib/production/soul-id-bootstrap", () => ({
  bootstrapAndTrainSoulId: (...args: any[]) => bootstrapAndTrainSoulId(...args),
}));
vi.mock("drizzle-orm", async (importOriginal: any) => {
  const actual = await importOriginal();
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

const { POST } = await import("../route");

function makeReq() {
  return new Request("http://localhost/api/projects/proj-1/production/generate-package", { method: "POST" });
}
function makeParams(projectId = "proj-1") {
  return { params: Promise.resolve({ projectId }) };
}

const MOCK_PACKAGE = JSON.stringify({
  projectBrief: { title: "T", logline: "l", format: "Novel", genres: [], tone: "t", styleNotes: "" },
  characterSheets: [],
  locationSheets: [],
  scenes: [],
  shots: [{ sceneNumber: 1, chapterId: "", chapterTitle: "Ch1", shotNumber: 1, shotType: "Medium", cameraMovement: "Static", lightingMood: "Day", timeOfDay: "Noon", subject: "hero", action: "walks", location: "park", mood: "calm", primaryCharacterName: "", soulPrompt: "", videoPrompt: "", dialogue: "", speaker: "" }],
});

describe("POST /api/projects/[projectId]/production/generate-package", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProject.mockResolvedValue({
      id: "proj-1", userId: "user-1", name: "Test", format: "Novel", genres: [],
      characters: [], locations: [], plotThreads: [], worldEntities: [],
      chapters: [{ id: "ch-1", title: "Ch1", content: "content", sortOrder: 0 }],
      referenceWorks: [], storyMemories: [],
    });
    createMessage.mockResolvedValue({
      content: [{ type: "text", text: MOCK_PACKAGE }],
    });
    buildPromiseLedger.mockResolvedValue("");
    meterAndGate.mockResolvedValue(null);
    refundCredits.mockResolvedValue(undefined);
    findFirstUser.mockResolvedValue({ id: "user-1", segmindApiKey: "segmind-key", higgsfieldApiKey: "hf-key", higgsfieldApiSecret: "hf-secret" });
    findFirstCharacter.mockResolvedValue({ id: "row-1", soulId: "" });
    bootstrapAndTrainSoulId.mockResolvedValue(null);
  });

  it("calls buildPromiseLedger with generate mode", async () => {
    await POST(makeReq(), makeParams());
    expect(buildPromiseLedger).toHaveBeenCalledWith("proj-1", "generate");
  });

  it("appends promise ledger to the user prompt when non-empty", async () => {
    buildPromiseLedger.mockResolvedValue("OPEN STORY PROMISES");
    await POST(makeReq(), makeParams());
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("OPEN STORY PROMISES"),
          }),
        ]),
      }),
    );
  });

  it("user prompt is unchanged when promise ledger returns empty (fail-open)", async () => {
    await POST(makeReq(), makeParams());
    const call = createMessage.mock.calls[0][0];
    const userContent = call.messages[0].content as string;
    expect(userContent).not.toContain("OPEN STORY PROMISES");
  });

  it("instructs the model to vary lightingMood per shot instead of defaulting to one value (real-test finding: Director shots defaulted to flat Golden Hour lighting)", async () => {
    await POST(makeReq(), makeParams());
    const call = createMessage.mock.calls[0][0];
    const userContent = call.messages[0].content as string;
    expect(userContent).toContain("LIGHTING MOOD OPTIONS");
    expect(userContent).toContain("Dramatic side light");
    expect(userContent).toContain("do not default every shot to the same one");
    // The old schema example hardcoded a single literal value ("Golden hour")
    // as the "lightingMood" example, which biased every generated shot toward
    // it - the fix replaced that literal with an instruction to choose deliberately.
    expect(userContent).not.toContain('"lightingMood": "Golden hour"');
  });

  it("instructs the model in real film-craft shot discipline (forensic consistency lock, shot-size progression, scene turn, narrative handoff, axis of action) — real-money finding: a shot list of merely 'visually interesting moments' reads as a random highlight reel, not a story", async () => {
    await POST(makeReq(), makeParams());
    const call = createMessage.mock.calls[0][0];
    const userContent = call.messages[0].content as string;
    expect(userContent).toContain("SHOT CRAFT");
    expect(userContent).toContain("FORENSIC CONSISTENCY LOCK");
    expect(userContent).toContain("repeat that exact sentence verbatim");
    expect(userContent).toContain("SHOT-SIZE PROGRESSION");
    expect(userContent).toContain("SCENE TURN");
    expect(userContent).toContain("emotionalTurn");
    expect(userContent).toContain("NARRATIVE HANDOFF");
    expect(userContent).toContain("bookend");
    expect(userContent).toContain("AXIS OF ACTION");
    // The character/location sheet instructions must ask for forensic-lock-
    // level detail, not the old generic "3-4 sentences" - the shot-level
    // verbatim-repetition instruction only works if there's a complete
    // description to repeat.
    expect(userContent).toContain("FORENSIC LOCK description");
  });

  describe("Soul ID auto-bootstrap (item 68 Task 2)", () => {
    const PACKAGE_WITH_RECURRING_CHARACTER = JSON.stringify({
      projectBrief: { title: "T", logline: "l", format: "Novel", genres: [], tone: "t", styleNotes: "" },
      characterSheets: [{ characterId: "", name: "Arthur", role: "Protagonist", soulIdPrompt: "A gaunt man in a charcoal suit.", voiceNotes: "" }],
      locationSheets: [],
      scenes: [],
      shots: [
        { sceneNumber: 1, chapterId: "", chapterTitle: "Ch1", shotNumber: 1, shotType: "Wide", cameraMovement: "Static", lightingMood: "Dusk", timeOfDay: "Dusk", subject: "Arthur", action: "walks", location: "dome", mood: "tense", primaryCharacterName: "Arthur", soulPrompt: "", videoPrompt: "", dialogue: "", speaker: "" },
        { sceneNumber: 1, chapterId: "", chapterTitle: "Ch1", shotNumber: 2, shotType: "Close-up", cameraMovement: "Static", lightingMood: "Dusk", timeOfDay: "Dusk", subject: "Arthur", action: "reacts", location: "dome", mood: "tense", primaryCharacterName: "Arthur", soulPrompt: "", videoPrompt: "", dialogue: "", speaker: "" },
      ],
    });

    it("fire-and-forget bootstraps Soul ID training for a character appearing as primary in 2+ shots, without delaying the response", async () => {
      createMessage.mockResolvedValue({ content: [{ type: "text", text: PACKAGE_WITH_RECURRING_CHARACTER }] });
      bootstrapAndTrainSoulId.mockResolvedValue("job-abc");

      const res = await POST(makeReq(), makeParams());
      expect(res.status).toBe(200); // response returns immediately, not blocked on the bootstrap call

      await vi.waitFor(() => expect(bootstrapAndTrainSoulId).toHaveBeenCalledWith(expect.objectContaining({
        characterName: "Arthur",
        soulIdPrompt: "A gaunt man in a charcoal suit.",
        segmindApiKey: "segmind-key", higgsfieldApiKey: "hf-key", higgsfieldApiSecret: "hf-secret",
      })));
      await vi.waitFor(() => expect(updateSet).toHaveBeenCalledWith({ soulIdTrainingJobId: "job-abc" }));
    });

    it("does not bootstrap a character appearing in only 1 shot (not a recurring primary character)", async () => {
      const singleShotPackage = JSON.stringify({
        projectBrief: { title: "T", logline: "l", format: "Novel", genres: [], tone: "t", styleNotes: "" },
        characterSheets: [{ characterId: "", name: "Arthur", role: "Protagonist", soulIdPrompt: "A gaunt man.", voiceNotes: "" }],
        locationSheets: [], scenes: [],
        shots: [{ sceneNumber: 1, chapterId: "", chapterTitle: "Ch1", shotNumber: 1, shotType: "Wide", cameraMovement: "Static", lightingMood: "Dusk", timeOfDay: "Dusk", subject: "Arthur", action: "walks", location: "dome", mood: "tense", primaryCharacterName: "Arthur", soulPrompt: "", videoPrompt: "", dialogue: "", speaker: "" }],
      });
      createMessage.mockResolvedValue({ content: [{ type: "text", text: singleShotPackage }] });

      await POST(makeReq(), makeParams());
      await new Promise(r => setTimeout(r, 50)); // let any pending microtasks flush
      expect(bootstrapAndTrainSoulId).not.toHaveBeenCalled();
    });

    it("does not bootstrap a character that already has a trained soulId", async () => {
      createMessage.mockResolvedValue({ content: [{ type: "text", text: PACKAGE_WITH_RECURRING_CHARACTER }] });
      findFirstCharacter.mockResolvedValue({ id: "row-1", soulId: "already-trained-id" });

      await POST(makeReq(), makeParams());
      await new Promise(r => setTimeout(r, 50));
      expect(bootstrapAndTrainSoulId).not.toHaveBeenCalled();
    });

    it("skips silently (no throw, no call) when the user has no Segmind/Higgsfield keys configured", async () => {
      createMessage.mockResolvedValue({ content: [{ type: "text", text: PACKAGE_WITH_RECURRING_CHARACTER }] });
      findFirstUser.mockResolvedValue({ id: "user-1", segmindApiKey: "", higgsfieldApiKey: "", higgsfieldApiSecret: "" });

      const res = await POST(makeReq(), makeParams());
      expect(res.status).toBe(200);
      await new Promise(r => setTimeout(r, 50));
      expect(bootstrapAndTrainSoulId).not.toHaveBeenCalled();
    });
  });
});
