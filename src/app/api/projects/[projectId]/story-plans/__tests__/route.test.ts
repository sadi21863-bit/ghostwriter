import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/ratelimit", () => ({ checkAiRateLimit: vi.fn(async () => null) }));

const messagesCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { create: (...a: any[]) => messagesCreate(...a) }; },
}));

const findFirstProjects = vi.fn();
const findFirstChapter = vi.fn();
const insertValues = vi.fn();
const insertReturning = vi.fn();
const findManyPlans = vi.fn();
const updateSet = vi.fn();
const updateReturning = vi.fn();
const deleteWhere = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...a: any[]) => findFirstProjects(...a) },
      storyPlans: { findMany: (...a: any[]) => findManyPlans(...a) },
      chapters: { findFirst: (...a: any[]) => findFirstChapter(...a) },
    },
    insert: () => ({ values: (v: any) => { insertValues(v); return { returning: (...a: any[]) => insertReturning(...a) }; } }),
    update: () => ({ set: (v: any) => { updateSet(v); return { where: () => ({ returning: (...a: any[]) => updateReturning(...a) }) }; } }),
    delete: () => ({ where: (...a: any[]) => { deleteWhere(...a); return Promise.resolve(); } }),
  },
}));

import { GET, POST, PATCH } from "../route";

function makeReq(body?: any) {
  return new Request("http://localhost/api/projects/proj-1/story-plans", {
    method: "POST", body: body ? JSON.stringify(body) : undefined,
  });
}
const params = { params: Promise.resolve({ projectId: "proj-1" }) };

function claudeReturning(json: any) {
  messagesCreate.mockResolvedValue({ content: [{ type: "text", text: JSON.stringify(json) }] });
}

describe("story-plans route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({
      id: "proj-1", userId: "user-1", format: "Novel",
      characters: [{ id: "c1", name: "Mara" }, { id: "c2", name: "Kessler" }],
      plotThreads: [{ id: "t1", name: "The Heist" }],
    });
    insertReturning.mockResolvedValue([{ id: "plan-1", beats: [] }]);
    findFirstChapter.mockResolvedValue({ id: "chap-1", projectId: "proj-1", title: "The Descent" });
    messagesCreate.mockResolvedValue({ content: [{ type: "text", text: "GOAL: escape\nOBSTACLE: locked door\nTURN: finds a key\nCHANGE: reaches the surface\nSENSORY: damp stone, distant drip, cold air\nEXIT: a decision" }] });
  });

  it("POST generates beats, maps character/thread NAMES to ids, assigns order+ids, persists via encode", async () => {
    claudeReturning({ beats: [
      { label: "Opening", summary: "Mara plans.", purpose: "setup", characters: ["Mara"], threads: ["The Heist"] },
      { label: "Clash", summary: "Kessler interferes.", purpose: "turn", characters: ["Kessler"], threads: [] },
    ] });

    const res = await POST(makeReq({ prompt: "a heist novel" }), params);
    expect(res.status).toBe(200);

    const inserted = insertValues.mock.calls[0][0];
    expect(inserted.projectId).toBe("proj-1");
    expect(inserted.beats).toHaveLength(2);
    expect(inserted.beats[0]).toMatchObject({ order: 1, label: "Opening", purpose: "setup", characterIds: ["c1"], threadIds: ["t1"] });
    expect(inserted.beats[0].id).toBeTruthy();
    expect(inserted.beats[1]).toMatchObject({ order: 2, characterIds: ["c2"], threadIds: [] });
  });

  it("POST returns 500 when Claude returns non-JSON", async () => {
    messagesCreate.mockResolvedValue({ content: [{ type: "text", text: "sorry, I can't" }] });
    const res = await POST(makeReq({ prompt: "x" }), params);
    expect(res.status).toBe(500);
  });

  it("POST 404s when the project isn't owned", async () => {
    findFirstProjects.mockResolvedValue(undefined);
    const res = await POST(makeReq({ prompt: "x" }), params);
    expect(res.status).toBe(404);
  });

  it("GET lists the project's plans", async () => {
    findManyPlans.mockResolvedValue([{ id: "plan-1" }, { id: "plan-2" }]);
    const res = await GET(makeReq(), params);
    const body = await res.json();
    expect(body.plans).toHaveLength(2);
  });

  it("PATCH validates beats through encode (400 on malformed) and persists valid ones", async () => {
    updateReturning.mockResolvedValue([{ id: "plan-1" }]);
    const goodBeat = { id: "b1", order: 1, label: "X", summary: "", purpose: "setup", characterIds: [], threadIds: [] };
    const ok = await PATCH(makeReq({ planId: "plan-1", beats: [goodBeat] }), params);
    expect(ok.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ beats: [expect.objectContaining({ label: "X" })] }));

    const bad = await PATCH(makeReq({ planId: "plan-1", beats: [{ id: "b1" }] }), params);
    expect(bad.status).toBe(400);
  });

  it("POST with kind:'chapter_plan' calls buildSceneBlueprint and persists one beat with the chapter's id", async () => {
    const res = await POST(makeReq({ kind: "chapter_plan", chapterId: "chap-1", prompt: "next scene" }), params);
    expect(res.status).toBe(200);

    const inserted = insertValues.mock.calls[0][0];
    expect(inserted.projectId).toBe("proj-1");
    expect(inserted.kind).toBe("chapter_plan");
    expect(inserted.beats).toHaveLength(1);
    expect(inserted.beats[0]).toMatchObject({ order: 1, label: "The Descent", chapterId: "chap-1" });
    expect(inserted.beats[0].summary.length).toBeGreaterThan(0);
  });

  it("POST with kind:'chapter_plan' and no chapterId returns 400", async () => {
    const res = await POST(makeReq({ kind: "chapter_plan" }), params);
    expect(res.status).toBe(400);
  });

  it("POST with kind:'chapter_plan' and an unknown chapterId returns 404", async () => {
    findFirstChapter.mockResolvedValue(undefined);
    const res = await POST(makeReq({ kind: "chapter_plan", chapterId: "missing-chap" }), params);
    expect(res.status).toBe(404);
  });

  it("POST with kind:'chapter_plan' returns 500 when buildSceneBlueprint fails open (empty string)", async () => {
    messagesCreate.mockRejectedValue(new Error("model unavailable"));
    const res = await POST(makeReq({ kind: "chapter_plan", chapterId: "chap-1" }), params);
    expect(res.status).toBe(500);
    expect(insertValues).not.toHaveBeenCalled();
  });
});
