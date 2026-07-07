import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirstProjects = vi.fn();
const updateReturning = vi.fn();
vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/db", () => ({
  db: {
    query: { projects: { findFirst: (...args: any[]) => findFirstProjects(...args) } },
    update: () => ({ set: () => ({ where: () => ({ returning: (...args: any[]) => updateReturning(...args) }) }) }),
    delete: () => ({ where: () => Promise.resolve(undefined) }),
  },
}));

const updateChapterEmbedding = vi.fn();
vi.mock("@/lib/ai/author-voice", () => ({
  updateChapterEmbedding: (...args: any[]) => updateChapterEmbedding(...args),
}));

const { PATCH } = await import("../route");

function makeRequest(body: unknown) {
  return new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1", chapterId: "chap-1" }) };
}

describe("PATCH /api/projects/[projectId]/chapters/[chapterId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
  });

  it("fires updateChapterEmbedding only after the scoped update confirms a real matching row (IDOR regression), and 404s instead of crashing on no match", async () => {
    // Simulates chapterId belonging to a DIFFERENT project than the one the
    // caller owns — the scoped WHERE (chapterId AND projectId) matches
    // nothing, so .returning() yields an empty array.
    updateReturning.mockResolvedValue([]);

    const res = await PATCH(makeRequest({ content: "some content" }), makeParams());

    expect(res.status).toBe(404);
    expect(updateChapterEmbedding).not.toHaveBeenCalled();
  });

  it("fires updateChapterEmbedding when the scoped update actually matched the caller's own chapter", async () => {
    updateReturning.mockResolvedValue([{ id: "chap-1", projectId: "proj-1", content: "some content" }]);

    await PATCH(makeRequest({ content: "some content" }), makeParams());

    expect(updateChapterEmbedding).toHaveBeenCalledWith("chap-1", "some content");
  });

  it("does not call updateChapterEmbedding when content isn't part of the patch", async () => {
    updateReturning.mockResolvedValue([{ id: "chap-1", projectId: "proj-1", title: "New Title" }]);

    await PATCH(makeRequest({ title: "New Title" }), makeParams());

    expect(updateChapterEmbedding).not.toHaveBeenCalled();
  });
});
