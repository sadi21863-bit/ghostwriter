import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

vi.mock("@/lib/ratelimit", () => ({
  checkAiRateLimit: vi.fn(async () => null),
}));

const findFirstProjects = vi.fn();
const deleteShots = vi.fn();
const insertCharacters = vi.fn();
const insertLocations = vi.fn();
const insertShots = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
    },
    delete: () => ({ where: () => deleteShots() }),
    insert: (table: any) => ({
      values: (vals: any) => ({
        returning: () => {
          // Distinguish by shape: shots have sceneNumber, characters have name+appearance-ish role.
          if (Array.isArray(vals) && vals[0] && "sceneNumber" in vals[0]) {
            insertShots(vals);
            return Promise.resolve(vals.map((v: any, i: number) => ({ id: `shot-${i}`, ...v })));
          }
          if (vals && "appearance" in vals) {
            insertCharacters(vals);
            return Promise.resolve([{ id: "char-new", ...vals }]);
          }
          insertLocations(vals);
          return Promise.resolve([{ id: "loc-new", ...vals }]);
        },
      }),
    }),
  },
}));

const createMessage = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: (...args: any[]) => createMessage(...args) };
  },
}));

import { POST } from "../route";

function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}

describe("POST /api/projects/[projectId]/production/generate-package", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({
      id: "proj-1",
      userId: "user-1",
      name: "Test Project",
      format: "Novel",
      genres: ["thriller"],
      characters: [],
      locations: [],
      plotThreads: [],
      chapters: [{ id: "ch-1", title: "Chapter 1", content: "Some content", sortOrder: 0 }],
      referenceWorks: [],
      storyMemories: [],
    });
  });

  it("persists each scene's multiShotScript onto every shot in that scene", async () => {
    createMessage.mockResolvedValue({
      content: [{
        type: "text",
        text: JSON.stringify({
          projectBrief: { title: "T", logline: "L", format: "Novel", genres: [], tone: "", styleNotes: "" },
          characterSheets: [],
          locationSheets: [],
          scenes: [
            { sceneNumber: 1, multiShotScript: "Shot 1: @image1 enters. Shot 2: @image1 turns." },
          ],
          shots: [
            { sceneNumber: 1, shotNumber: 1, chapterTitle: "Chapter 1", subject: "Mara", action: "enters", soulPrompt: "p1", videoPrompt: "v1" },
            { sceneNumber: 1, shotNumber: 2, chapterTitle: "Chapter 1", subject: "Mara", action: "turns", soulPrompt: "p2", videoPrompt: "v2" },
          ],
        }),
      }],
    });

    await POST(new Request("http://localhost", { method: "POST" }), makeParams());

    expect(insertShots).toHaveBeenCalledTimes(1);
    const inserted = insertShots.mock.calls[0][0];
    expect(inserted).toHaveLength(2);
    expect(inserted[0].multiShotScript).toBe("Shot 1: @image1 enters. Shot 2: @image1 turns.");
    expect(inserted[1].multiShotScript).toBe("Shot 1: @image1 enters. Shot 2: @image1 turns.");
  });

  it("defaults multiShotScript to empty string for a scene with no script returned", async () => {
    createMessage.mockResolvedValue({
      content: [{
        type: "text",
        text: JSON.stringify({
          projectBrief: { title: "T", logline: "L", format: "Novel", genres: [], tone: "", styleNotes: "" },
          characterSheets: [],
          locationSheets: [],
          scenes: [],
          shots: [
            { sceneNumber: 1, shotNumber: 1, chapterTitle: "Chapter 1", subject: "Mara", action: "enters", soulPrompt: "p1", videoPrompt: "v1" },
          ],
        }),
      }],
    });

    await POST(new Request("http://localhost", { method: "POST" }), makeParams());

    const inserted = insertShots.mock.calls[0][0];
    expect(inserted[0].multiShotScript).toBe("");
  });
});
