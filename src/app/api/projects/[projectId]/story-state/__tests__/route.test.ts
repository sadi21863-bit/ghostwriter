import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({ getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })) }));

const findFirstProjects = vi.fn();
const insertReturning = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: { projects: { findFirst: (...args: any[]) => findFirstProjects(...args) } },
    insert: () => ({ values: () => ({ returning: (...args: any[]) => insertReturning(...args) }) }),
  },
}));

const updatePromiseEmbedding = vi.fn();
vi.mock("@/lib/story/promise-cross-reference", () => ({
  updatePromiseEmbedding: (...args: any[]) => updatePromiseEmbedding(...args),
}));

const { POST } = await import("../route");

function makeRequest(body: unknown) {
  return new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}

describe("POST /api/projects/[projectId]/story-state — promise embedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
  });

  it("fires updatePromiseEmbedding with the new promise's id and setup text", async () => {
    insertReturning.mockResolvedValue([{ id: "promise-1", setup: "Mara hides the ring" }]);

    await POST(makeRequest({ type: "promise", setup: "Mara hides the ring" }), makeParams());

    expect(updatePromiseEmbedding).toHaveBeenCalledWith("promise-1", "Mara hides the ring");
  });

  it("does not fire for thread creation (only promises are embedded)", async () => {
    insertReturning.mockResolvedValue([{ id: "thread-1", name: "The Missing Ring" }]);

    await POST(makeRequest({ type: "thread", name: "The Missing Ring" }), makeParams());

    expect(updatePromiseEmbedding).not.toHaveBeenCalled();
  });
});
