import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findFirstProjects = vi.fn();
const findManyNotes = vi.fn();
const insertValues = vi.fn();
const insertReturning = vi.fn();
const updateSet = vi.fn();
const updateReturning = vi.fn();
const deleteWhere = vi.fn();
let lastUpdateTable: any;
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...a: any[]) => findFirstProjects(...a) },
      editorNotes: { findMany: (...a: any[]) => findManyNotes(...a) },
    },
    insert: () => ({ values: (v: any) => { insertValues(v); return { returning: (...a: any[]) => insertReturning(...a) }; } }),
    update: (table: any) => { lastUpdateTable = table; return { set: (v: any) => { updateSet(v); return { where: () => ({ returning: (...a: any[]) => updateReturning(...a) }) }; } }; },
    delete: () => ({ where: (...a: any[]) => { deleteWhere(...a); return Promise.resolve(); } }),
  },
}));
vi.mock("@/db/schema", () => ({ editorNotes: { __t: "editor_notes" }, chapters: { __t: "chapters" }, projects: {} }));

import { GET, POST, PATCH, DELETE } from "../route";

function req(body?: any, url = "http://localhost/api/projects/proj-1/editor-notes") {
  return new Request(url, { method: "POST", body: body ? JSON.stringify(body) : undefined });
}
const params = { params: Promise.resolve({ projectId: "proj-1" }) };

describe("editor-notes route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    insertReturning.mockResolvedValue([{ id: "note-1" }]);
    updateReturning.mockResolvedValue([{ id: "x" }]);
  });

  it("POST inserts a single manual note", async () => {
    await POST(req({ chapterId: "ch-1", message: "Pacing drags here", severity: "high", category: "pacing" }), params);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      projectId: "proj-1", chapterId: "ch-1", message: "Pacing drags here", severity: "high", category: "pacing",
    }));
  });

  it("POST bulk-inserts an array of notes", async () => {
    insertReturning.mockResolvedValue([{ id: "n1" }, { id: "n2" }]);
    await POST(req({ notes: [
      { message: "AIism: 'a testament to'", category: "aiism", source: "aiisms" },
      { message: "Continuity: hair color flips", category: "continuity", chapterId: "ch-2" },
    ] }), params);
    const arg = insertValues.mock.calls[0][0];
    expect(Array.isArray(arg)).toBe(true);
    expect(arg).toHaveLength(2);
    expect(arg[0]).toMatchObject({ projectId: "proj-1", message: "AIism: 'a testament to'", source: "aiisms" });
  });

  it("POST 400s when neither message nor notes provided", async () => {
    const res = await POST(req({ severity: "high" }), params);
    expect(res.status).toBe(400);
  });

  it("PATCH updates a note's status", async () => {
    const res = await PATCH(req({ noteId: "note-1", status: "resolved" }), params);
    expect(res.status).toBe(200);
    expect(lastUpdateTable).toEqual({ __t: "editor_notes" });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "resolved" }));
  });

  it("PATCH approves a chapter (updates chapters.reviewStatus)", async () => {
    const res = await PATCH(req({ chapterId: "ch-1", reviewStatus: "approved" }), params);
    expect(res.status).toBe(200);
    expect(lastUpdateTable).toEqual({ __t: "chapters" });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ reviewStatus: "approved" }));
  });

  it("PATCH 400s on an invalid status / reviewStatus enum", async () => {
    expect((await PATCH(req({ noteId: "n", status: "banana" }), params)).status).toBe(400);
    expect((await PATCH(req({ chapterId: "c", reviewStatus: "banana" }), params)).status).toBe(400);
  });

  it("GET lists notes, filtered, and 404s when unowned", async () => {
    findManyNotes.mockResolvedValue([{ id: "n1" }]);
    const ok = await GET(req(undefined, "http://localhost/api/projects/proj-1/editor-notes?status=open"), params);
    expect((await ok.json()).notes).toHaveLength(1);

    findFirstProjects.mockResolvedValue(undefined);
    expect((await GET(req(), params)).status).toBe(404);
  });

  it("DELETE removes a note", async () => {
    const res = await DELETE(req({ noteId: "note-1" }), params);
    expect(res.status).toBe(200);
    expect(deleteWhere).toHaveBeenCalled();
  });
});
