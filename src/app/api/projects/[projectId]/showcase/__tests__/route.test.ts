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
