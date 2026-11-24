import { describe, it, expect, vi, beforeEach } from "vitest";
import { projects } from "@/db/schema";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/subscription", () => ({
  getUserTier: vi.fn(async () => "pro"),
  canAccessFeature: vi.fn(() => true),
}));
vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn((v: string) => v || ""),
}));

const findFirstUser = vi.fn();
const findFirstChapter = vi.fn();
const findFirstProject = vi.fn();
const findManyComicPages = vi.fn();
const insertValues = vi.fn();
const insertReturning = vi.fn();
const updateTables = vi.fn();
const updateWhere = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      users: { findFirst: (...args: any[]) => findFirstUser(...args) },
      chapters: { findFirst: (...args: any[]) => findFirstChapter(...args) },
      projects: { findFirst: (...args: any[]) => findFirstProject(...args) },
      comicPages: { findMany: (...args: any[]) => findManyComicPages(...args) },
    },
    insert: vi.fn(() => ({
      values: (...vArgs: any[]) => {
        insertValues(...vArgs);
        return { returning: (...args: any[]) => insertReturning(...args) };
      },
    })),
    update: (...uArgs: any[]) => {
      updateTables(...uArgs);
      return {
        set: vi.fn(() => ({ where: (...args: any[]) => updateWhere(...args) })),
      };
    },
  },
}));
vi.mock("drizzle-orm", async (importOriginal: any) => {
  const actual = await importOriginal();
  return { ...actual, eq: vi.fn((_a: any, b: any) => b), and: vi.fn((...args: any[]) => args) };
});

const createMessage = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: (...args: any[]) => createMessage(...args) };
  },
}));

const generateSoulImage = vi.fn();
vi.mock("@/lib/higgsfield/client", () => ({
  generateSoulImage: (...args: any[]) => generateSoulImage(...args),
}));

const critiqueShot = vi.fn();
vi.mock("@/lib/production/vision-critic", () => ({
  critiqueShot: (...args: any[]) => critiqueShot(...args),
}));
vi.mock("@/lib/production/self-eval", () => ({
  scoreShot: vi.fn(() => ({ overall: 0.8, weakest: "pacing", dims: {} })),
  retryHint: vi.fn(() => "hint"),
}));

const generateComicPageViaStoryDiffusion = vi.fn();
vi.mock("@/lib/comic-gen/generate-storydiffusion-page", () => ({
  generateComicPageViaStoryDiffusion: (...args: any[]) => generateComicPageViaStoryDiffusion(...args),
}));

const { GET, POST } = await import("../route");

function makeReq(body: unknown) {
  return new Request("http://localhost/api/projects/proj-1/comics", {
    method: "POST", body: JSON.stringify(body),
  });
}
function makeParams(projectId = "proj-1") {
  return { params: Promise.resolve({ projectId }) };
}

const SPECS_JSON = JSON.stringify([
  { beatIndex: 0, action: "Arthur boards", characters: ["Arthur"], location: "Platform", shotType: "Wide", mood: "tense" },
  { beatIndex: 1, action: "Arthur looks ahead", characters: ["Arthur"], location: "Car 14", shotType: "Close-up", mood: "dread" },
]);

describe("POST /api/projects/[projectId]/comics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BLOB_READ_WRITE_TOKEN;
    findFirstUser.mockResolvedValue({ id: "user-1", segmindApiKey: "encrypted-key" });
    findFirstChapter.mockResolvedValue({ id: "ch-1", projectId: "proj-1", content: "Once upon a time, Arthur boarded the ride." });
    findFirstProject.mockResolvedValue({
      id: "proj-1", name: "Test Story",
      characters: [{ id: "c1", name: "Arthur", appearance: "tired eyes", portraitUrl: null, soulId: null }],
      worldEntities: [],
    });
    findManyComicPages.mockResolvedValue([]);
    insertReturning.mockImplementation(async () => [{ id: `row-${Math.random()}`, panelIndex: 0 }]);
    updateWhere.mockResolvedValue(undefined);
    createMessage.mockResolvedValue({ content: [{ type: "text", text: SPECS_JSON }] });
    critiqueShot.mockResolvedValue({});
  });

  it("uses the per-panel Soul path by default when useStoryDiffusion is not set", async () => {
    generateSoulImage.mockResolvedValue("https://segmind.example/panel.png");
    const res = await POST(makeReq({ chapterId: "ch-1", artStyleId: "manga" }), makeParams());
    expect(res.status).toBe(200);
    expect(generateSoulImage).toHaveBeenCalled();
    expect(generateComicPageViaStoryDiffusion).not.toHaveBeenCalled();
  });

  it("uses StoryDiffusion instead of per-panel Soul calls when useStoryDiffusion is true", async () => {
    generateComicPageViaStoryDiffusion.mockResolvedValue([
      { prompt: "p1", imageUrl: "https://blob.example/panel-0.png", referenceImageUrl: "", characterName: "Arthur", index: 0 },
      { prompt: "p2", imageUrl: "https://blob.example/panel-1.png", referenceImageUrl: "", characterName: "Arthur", index: 1 },
    ]);
    const res = await POST(makeReq({ chapterId: "ch-1", artStyleId: "manga", useStoryDiffusion: true }), makeParams());
    expect(res.status).toBe(200);
    expect(generateComicPageViaStoryDiffusion).toHaveBeenCalled();
    expect(generateSoulImage).not.toHaveBeenCalled();
  });

  it("falls back to the per-panel Soul path when StoryDiffusion generation throws", async () => {
    generateComicPageViaStoryDiffusion.mockRejectedValue(new Error("StoryDiffusion generation failed: content filter"));
    generateSoulImage.mockResolvedValue("https://segmind.example/panel.png");
    const res = await POST(makeReq({ chapterId: "ch-1", artStyleId: "manga", useStoryDiffusion: true }), makeParams());
    expect(res.status).toBe(200);
    expect(generateComicPageViaStoryDiffusion).toHaveBeenCalled();
    expect(generateSoulImage).toHaveBeenCalled();
  });

  it("passes the resolved artStyle and project characters through to StoryDiffusion", async () => {
    generateComicPageViaStoryDiffusion.mockResolvedValue([
      { prompt: "p1", imageUrl: "https://blob.example/panel-0.png", referenceImageUrl: "", characterName: "Arthur", index: 0 },
    ]);
    await POST(makeReq({ chapterId: "ch-1", artStyleId: "noir", useStoryDiffusion: true }), makeParams());
    const call = generateComicPageViaStoryDiffusion.mock.calls[0][0];
    expect(call.artStyle.id).toBe("noir");
    expect(call.characters).toEqual([{ id: "c1", name: "Arthur", appearance: "tired eyes", portraitUrl: null, soulId: null }]);
  });
});

// ------------------------------------------------------ Phase 2 migration pins

describe("GET /api/projects/[projectId]/comics (thin listComicPages adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProject.mockResolvedValue({ id: "proj-1", userId: "user-1" });
  });

  it("returns the newest-first pages read from the adapter, still under `{ pages }`", async () => {
    const pages = [
      { id: "page-2", projectId: "proj-1", panels: [{ panelIndex: 1 }, { panelIndex: 0 }] },
      { id: "page-1", projectId: "proj-1", panels: [] },
    ];
    findManyComicPages.mockResolvedValue(pages);

    const res = await GET(new Request("http://localhost/api/projects/proj-1/comics"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.pages).toEqual(pages);
  });

  it("404 `{ error: \"Not found\" }` when the project isn't owned, before any page read", async () => {
    findFirstProject.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/projects/proj-1/comics"), makeParams());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
    expect(findManyComicPages).not.toHaveBeenCalled();
  });
});

describe("POST /api/projects/[projectId]/comics — migrated CRUD verbs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BLOB_READ_WRITE_TOKEN;
    findFirstUser.mockResolvedValue({ id: "user-1", segmindApiKey: "encrypted-key" });
    findFirstChapter.mockResolvedValue({ id: "ch-1", projectId: "proj-1", content: "Arthur boarded." });
    findFirstProject.mockResolvedValue({
      id: "proj-1", name: "Test Story",
      characters: [{ id: "c1", name: "Arthur", appearance: "tired eyes", portraitUrl: null, soulId: null }],
      worldEntities: [],
    });
    findManyComicPages.mockResolvedValue([]);
    insertReturning.mockResolvedValue([{ id: "row-1", panelIndex: 0 }]);
    updateWhere.mockResolvedValue(undefined);
    createMessage.mockResolvedValue({ content: [{ type: "text", text: SPECS_JSON }] });
    critiqueShot.mockResolvedValue({});
    generateSoulImage.mockResolvedValue("https://segmind.example/panel.png");
  });

  it("the page insert carries projectId + the count-derived pageNumber (existing pages + 1)", async () => {
    findManyComicPages.mockResolvedValue([{ id: "a" }, { id: "b" }]); // countByProject = 2
    await POST(makeReq({ chapterId: "ch-1", artStyleId: "manga" }), makeParams());

    const pageValues = insertValues.mock.calls[0][0];
    expect(pageValues.projectId).toBe("proj-1");
    expect(pageValues.chapterId).toBe("ch-1");
    expect(pageValues.pageNumber).toBe(3);
    expect(pageValues.artStyle).toBe("manga");
  });

  it("panel inserts carry projectId + the created page's id, and every insert fires a revision bump", async () => {
    await POST(makeReq({ chapterId: "ch-1", artStyleId: "manga" }), makeParams());

    // 1 page insert + 2 panel inserts (SPECS_JSON has 2 panels)
    expect(insertValues).toHaveBeenCalledTimes(3);
    expect(insertValues.mock.calls[1][0].pageId).toBe("row-1");
    expect(insertValues.mock.calls[1][0].projectId).toBe("proj-1");
    expect(insertValues.mock.calls[2][0].pageId).toBe("row-1");

    // comicPage.create + comicPanel.create × 2 — every bump targets the projects table
    expect(updateTables).toHaveBeenCalledTimes(3);
    updateTables.mock.calls.forEach(([table]) => expect(table).toBe(projects));
    expect(updateWhere).toHaveBeenCalledTimes(3);
  });

  it("when every panel generation fails, the page row still exists with its bump and errors are reported", async () => {
    generateSoulImage.mockRejectedValue(new Error("Segmind rejected the prompt"));

    const res = await POST(makeReq({ chapterId: "ch-1", artStyleId: "manga" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.errors).toBe("2 panel(s) failed to generate.");
    expect(body.page.panels).toEqual([]);
    // only the page insert happened; only its comicPage.create bump fired
    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(updateTables).toHaveBeenCalledTimes(1);
    expect(updateTables.mock.calls[0][0]).toBe(projects);
  });
});
