import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({ getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })) }));

const findFirstProjects = vi.fn();
const findManyThreads = vi.fn();
const insertReturning = vi.fn();
const updateReturning = vi.fn();
const insertCaptures: Array<{ table: unknown; payload: unknown }> = [];
const updateCaptures: Array<{ table: unknown; payload: unknown }> = [];

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      storyThreads: { findMany: (...args: any[]) => findManyThreads(...args) },
    },
    insert: (table: unknown) => ({
      values: (payload: unknown) => {
        insertCaptures.push({ table, payload });
        return { returning: (...args: any[]) => insertReturning(...args) };
      },
    }),
    // Serves BOTH shapes this route's chains use: the adapter's
    // `set → where → returning()` PATCH read-back, and pgPostCommitHooks'
    // awaited `set → where()` revision bump.
    update: (table: unknown) => ({
      set: (payload: unknown) => {
        updateCaptures.push({ table, payload });
        return {
          where: (...whereArgs: any[]) => {
            const p = Promise.resolve(undefined) as Promise<undefined> & {
              returning: (...args: any[]) => unknown;
            };
            p.returning = (...args: any[]) => updateReturning(...args);
            return p;
          },
        };
      },
    }),
  },
}));

const updatePromiseEmbedding = vi.fn();
vi.mock("@/lib/story/promise-cross-reference", () => ({
  updatePromiseEmbedding: (...args: any[]) => updatePromiseEmbedding(...args),
}));

const { GET, POST, PATCH } = await import("../route");
import { projects, storyPromises, storyThreads } from "@/db/schema";

function makeRequest(body: unknown, method = "POST") {
  const hasBody = typeof body === "string" ? body.length > 0 : body !== undefined;
  return new Request("http://localhost", {
    method,
    body: hasBody && method !== "GET" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}

describe("POST /api/projects/[projectId]/story-state — promise embedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    insertCaptures.length = 0;
    updateCaptures.length = 0;
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

  it("creates are bare-row 200s scoped to the project, with one revision bump after the write", async () => {
    const created = { id: "promise-1", projectId: "proj-1", setup: "Mara hides the ring" };
    insertReturning.mockResolvedValue([created]);

    const res = await POST(makeRequest({ type: "promise", setup: "Mara hides the ring" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(created);
    expect(insertCaptures[0]!.table).toBe(storyPromises);
    expect(insertCaptures[0]!.payload).toMatchObject({ projectId: "proj-1" });

    const bumps = updateCaptures.filter(
      (c) => c.table === projects && "contentRevision" in (c.payload as Record<string, unknown>),
    );
    expect(bumps).toHaveLength(1);
  });

  it("404s BEFORE the body is parsed when the project belongs to someone else (pre-migration order)", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    // Deliberately malformed JSON: a route that parsed the body first would 500.
    const res = await POST(makeRequest("not-json"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
    expect(insertCaptures).toHaveLength(0);
  });

  it("400s 'type required: thread or promise' for an unknown discriminator (owner, valid body)", async () => {
    const res = await POST(makeRequest({ type: "mystery" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "type required: thread or promise" });
    expect(insertCaptures).toHaveLength(0);
  });
});

describe("GET /api/projects/[projectId]/story-state (thin adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
  });

  it("returns { threads } with their nested promises (the Promise Tracker's GET shape)", async () => {
    const threads = [{ id: "th1", projectId: "proj-1", name: "Heist debt", promises: [{ id: "pr1" }] }];
    findManyThreads.mockResolvedValue(threads);

    const res = await GET(makeRequest("", "GET"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ threads });
    expect(findManyThreads).toHaveBeenCalledTimes(1);
  });

  it("404s on a non-owned project without listing", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    const res = await GET(makeRequest("", "GET"), makeParams());

    expect(res.status).toBe(404);
    expect(findManyThreads).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/projects/[projectId]/story-state (thin adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    updateCaptures.length = 0;
  });

  it("thread branch: branch-fixed payload with the ?? null reset, bare row, revision bump", async () => {
    const updated = { id: "th1", status: "resolved" };
    updateReturning.mockResolvedValue([updated]);

    const res = await PATCH(makeRequest({ threadId: "th1", status: "resolved" }, "PATCH"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(updated);

    const rowWrites = updateCaptures.filter((c) => c.table === storyThreads);
    expect(rowWrites).toHaveLength(1);
    expect(rowWrites[0]!.payload).toEqual({ status: "resolved", resolvedAtChapterId: null, notes: undefined });

    const bumps = updateCaptures.filter(
      (c) => c.table === projects && "contentRevision" in (c.payload as Record<string, unknown>),
    );
    expect(bumps).toHaveLength(1);
  });

  it("404s (not 200 {}) when the threadId matched no row in this project", async () => {
    updateReturning.mockResolvedValue([]);

    const res = await PATCH(makeRequest({ threadId: "bogus", status: "resolved" }, "PATCH"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
  });

  it("400s 'threadId or promiseId required' when neither id is present", async () => {
    const res = await PATCH(makeRequest({ status: "resolved" }, "PATCH"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "threadId or promiseId required" });
  });
});
