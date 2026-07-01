import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findFirstProject = vi.fn();
const findManyChapters = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...a: any[]) => findFirstProject(...a) },
      chapters: { findMany: (...a: any[]) => findManyChapters(...a) },
    },
  },
}));

const buildPromiseLedger = vi.fn();
vi.mock("@/lib/ai/promise-ledger", () => ({
  buildPromiseLedger: (...a: any[]) => buildPromiseLedger(...a),
}));

import { GET } from "../route";

function makeReq(chapterId?: string) {
  const url = new URL("http://localhost/api/projects/proj-1/chapter-research");
  if (chapterId) url.searchParams.set("chapterId", chapterId);
  return new Request(url);
}
const params = { params: Promise.resolve({ projectId: "proj-1" }) };

describe("GET /api/projects/[projectId]/chapter-research", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProject.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    buildPromiseLedger.mockResolvedValue("");
  });

  it("returns openPromises from buildPromiseLedger in preserve mode", async () => {
    buildPromiseLedger.mockResolvedValue("OPEN STORY PROMISES\n- the missing letter");
    findManyChapters.mockResolvedValue([
      { id: "ch-1", sortOrder: 0, summary: "Mara finds the letter." },
      { id: "ch-2", sortOrder: 1, summary: "" },
    ]);
    const res = await GET(makeReq("ch-2"), params);
    const body = await res.json();
    expect(buildPromiseLedger).toHaveBeenCalledWith("proj-1", "preserve");
    expect(body.openPromises).toContain("the missing letter");
  });

  it("returns the prior chapter's summary based on sortOrder", async () => {
    findManyChapters.mockResolvedValue([
      { id: "ch-1", sortOrder: 0, summary: "Mara finds the letter." },
      { id: "ch-2", sortOrder: 1, summary: "" },
    ]);
    const res = await GET(makeReq("ch-2"), params);
    const body = await res.json();
    expect(body.priorChapterSummary).toBe("Mara finds the letter.");
  });

  it("returns an empty priorChapterSummary for the first chapter", async () => {
    findManyChapters.mockResolvedValue([
      { id: "ch-1", sortOrder: 0, summary: "" },
    ]);
    const res = await GET(makeReq("ch-1"), params);
    const body = await res.json();
    expect(body.priorChapterSummary).toBe("");
  });

  it("404s when the project isn't owned", async () => {
    findFirstProject.mockResolvedValue(undefined);
    const res = await GET(makeReq("ch-1"), params);
    expect(res.status).toBe(404);
  });

  it("400s when chapterId is missing", async () => {
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(400);
  });

  it("is fail-open: an empty ledger still returns 200 with an empty string", async () => {
    findManyChapters.mockResolvedValue([{ id: "ch-1", sortOrder: 0, summary: "" }]);
    const res = await GET(makeReq("ch-1"), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openPromises).toBe("");
  });
});
