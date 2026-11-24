import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/projects/[projectId]/reference-works — thin adapter route tests
 * (mocks @/db + auth, the chapters route-test idiom). Pins the preserved
 * bare-row 201 body, the conditional `attributes` passthrough the pg adapter
 * reproduces, and the 404/400 mappings.
 */
const findFirstProjects = vi.fn();
const insertReturning = vi.fn();

const insertCaptures: Array<{ table: unknown; payload: unknown }> = [];
const updateCaptures: Array<{ table: unknown; payload: unknown }> = [];

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: unknown[]) => findFirstProjects(...args) },
    },
    insert: (table: unknown) => ({
      values: (payload: unknown) => {
        insertCaptures.push({ table, payload });
        return { returning: (...args: unknown[]) => insertReturning(...args) };
      },
    }),
    update: (table: unknown) => ({
      set: (payload: unknown) => {
        updateCaptures.push({ table, payload });
        return { where: async () => undefined };
      },
    }),
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

import { POST } from "../route";
import { projects, referenceWorks } from "@/db/schema";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/projects/proj-1/reference-works", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}

describe("POST /api/projects/[projectId]/reference-works (thin adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    insertReturning.mockResolvedValue([]);
    insertCaptures.length = 0;
    updateCaptures.length = 0;
  });

  it("201s the created row BARE with attributes passed through when supplied", async () => {
    const created = { id: "rw-9", projectId: "proj-1", title: "Reedsy Style DNA", attributes: { tension: 4 } };
    insertReturning.mockResolvedValue([created]);

    const res = await POST(makeRequest({ title: "Reedsy Style DNA", attributes: { tension: 4 } }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual(created);
    expect(body).not.toHaveProperty("reference");

    expect(insertCaptures).toHaveLength(1);
    expect(insertCaptures[0]!.table).toBe(referenceWorks);
    const payload = insertCaptures[0]!.payload as Record<string, unknown>;
    expect(payload).toMatchObject({ projectId: "proj-1", title: "Reedsy Style DNA" });
    expect("attributes" in payload).toBe(true);
    expect(payload.attributes).toEqual({ tension: 4 });

    const bumps = updateCaptures.filter(
      (c) => c.table === projects && "contentRevision" in (c.payload as Record<string, unknown>),
    );
    expect(bumps).toHaveLength(1);
  });

  it("keeps the jsonb column's default when the caller omitted attributes (conditional spread preserved)", async () => {
    const created = { id: "rw-9", projectId: "proj-1", title: "Kindle Style Guide" };
    insertReturning.mockResolvedValue([created]);

    const res = await POST(makeRequest({ title: "Kindle Style Guide" }), makeParams());
    expect(res.status).toBe(201);

    const payload = insertCaptures[0]!.payload as Record<string, unknown>;
    expect("attributes" in payload).toBe(false);
  });

  it("404s with { error: 'Not found' } on a foreign project, inserting nothing", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ title: "x" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
    expect(insertCaptures).toHaveLength(0);
    expect(updateCaptures).toHaveLength(0);
  });

  it("400s 'title is required' at the route before any handler work", async () => {
    const res = await POST(makeRequest({ attributes: {} }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "title is required" });
    expect(insertCaptures).toHaveLength(0);
    expect(updateCaptures).toHaveLength(0);
    expect(findFirstProjects).not.toHaveBeenCalled();
  });
});
