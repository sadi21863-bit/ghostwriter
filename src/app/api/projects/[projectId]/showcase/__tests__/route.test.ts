import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirstProjects = vi.fn();
const findFirstShowcases = vi.fn();
const updateReturning = vi.fn();
const insertReturning = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      showcases: { findFirst: (...args: any[]) => findFirstShowcases(...args) },
    },
    update: () => ({
      set: () => ({
        where: () => ({
          returning: (...args: any[]) => updateReturning(...args),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: (...args: any[]) => insertReturning(...args),
      }),
    }),
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const generateEmbedding = vi.fn();
vi.mock("@/lib/ai/embeddings", () => ({ generateEmbedding: (...args: any[]) => generateEmbedding(...args) }));

import { POST, GET } from "../route";

const ownedProject = { id: "project-1", userId: "user-1", name: "My Novel" };

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/projects/project-1/showcase", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/projects/[projectId]/showcase", () => {
  beforeEach(() => {
    findFirstProjects.mockReset();
    findFirstShowcases.mockReset();
    updateReturning.mockReset();
    insertReturning.mockReset();
    generateEmbedding.mockReset();
    generateEmbedding.mockResolvedValue([0.1, 0.2]);
  });

  it("404s when the project isn't owned by the caller", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    const res = await POST(makePostRequest({ title: "t", blurb: "b", visibility: "public" }), {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(res.status).toBe(404);
  });

  it("rejects an invalid visibility value", async () => {
    findFirstProjects.mockResolvedValue(ownedProject);

    const res = await POST(makePostRequest({ title: "t", blurb: "b", visibility: "bogus" }), {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(res.status).toBe(400);
  });

  it("creates a showcase with a fresh slug when none exists", async () => {
    findFirstProjects.mockResolvedValue(ownedProject);
    findFirstShowcases.mockResolvedValue(undefined);
    insertReturning.mockResolvedValue([{ id: "sc-1", slug: "abc123", title: "t", blurb: "b", visibility: "private" }]);

    const res = await POST(makePostRequest({ title: "t", blurb: "b", visibility: "private" }), {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe("abc123");
    expect(updateReturning).not.toHaveBeenCalled();
  });

  it("updates the existing showcase and keeps its stable slug across edits", async () => {
    findFirstProjects.mockResolvedValue(ownedProject);
    findFirstShowcases.mockResolvedValue({ id: "sc-1", slug: "stable-slug", title: "old", blurb: "old", visibility: "private" });
    updateReturning.mockResolvedValue([{ id: "sc-1", slug: "stable-slug", title: "new", blurb: "new", visibility: "public" }]);

    const res = await POST(makePostRequest({ title: "new", blurb: "new", visibility: "public" }), {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe("stable-slug");
    expect(insertReturning).not.toHaveBeenCalled();
  });

  it("computes an embedding from title+blurb for the discovery feed's search", async () => {
    findFirstProjects.mockResolvedValue(ownedProject);
    findFirstShowcases.mockResolvedValue(undefined);
    insertReturning.mockResolvedValue([{ id: "sc-1", slug: "abc123" }]);

    await POST(makePostRequest({ title: "A Novel About Grief", blurb: "A quiet, devastating story", visibility: "private" }), {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(generateEmbedding).toHaveBeenCalledWith("A Novel About Grief. A quiet, devastating story");
  });

  it("recomputes the embedding on every save, not just at creation", async () => {
    findFirstProjects.mockResolvedValue(ownedProject);
    findFirstShowcases.mockResolvedValue({ id: "sc-1", slug: "stable-slug", title: "old", blurb: "old", visibility: "private" });
    updateReturning.mockResolvedValue([{ id: "sc-1", slug: "stable-slug" }]);

    await POST(makePostRequest({ title: "Updated Title", blurb: "Updated blurb", visibility: "public" }), {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(generateEmbedding).toHaveBeenCalledWith("Updated Title. Updated blurb");
  });
});

describe("GET /api/projects/[projectId]/showcase", () => {
  beforeEach(() => {
    findFirstProjects.mockReset();
    findFirstShowcases.mockReset();
  });

  it("404s when the project isn't owned by the caller", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ projectId: "project-1" }) });

    expect(res.status).toBe(404);
  });

  it("returns null showcase + a computed preview when none exists yet", async () => {
    findFirstProjects
      .mockResolvedValueOnce(ownedProject)
      .mockResolvedValueOnce({ id: "project-1", chapters: [], characters: [], comicPages: [], productionShots: [] });
    findFirstShowcases.mockResolvedValue(undefined);

    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ projectId: "project-1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.showcase).toBeNull();
    expect(body.preview).toBeDefined();
  });
});
