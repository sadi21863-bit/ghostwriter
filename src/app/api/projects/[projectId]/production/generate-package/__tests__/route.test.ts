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
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProject(...args) },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: "row-1" }]) })),
    })),
    delete: vi.fn(() => ({ where: vi.fn(async () => {}) })),
  },
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
  default: class { messages = { create: (...args: any[]) => createMessage(...args) }; },
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
});
