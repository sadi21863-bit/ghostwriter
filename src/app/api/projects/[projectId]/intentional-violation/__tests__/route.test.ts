// Phase 2 / v4 §7 — route adapter tests for the intentional-violation edge.
// Mocks only auth + `@/db`; the handler owns the 400/404 ordering and the
// verbatim acknowledgement transformation, and the pg adapter does the
// read-modify-write of the project's jsonb map.
import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirstProjects = vi.fn();
const updateSet = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
    },
    // Both the record write and the §11 hook (contentRevision) run through here.
    update: (_table: unknown) => ({
      set: (vals: unknown) => {
        updateSet(vals);
        return { where: () => Promise.resolve(undefined) };
      },
    }),
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const { GET, POST } = await import("../route");

function makeRequest(body: unknown) {
  return new Request("http://localhost", { method: body === undefined ? "GET" : "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}

describe("GET .../intentional-violation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({
      id: "proj-1",
      userId: "user-1",
      intentionalViolations: {
        safety_violation: { confirmed: true, purpose: "dark ending", timestamp: "2026-01-01T00:00:00.000Z" },
      },
    });
  });

  it("returns the project's acknowledgement map — same body, byte-comparable", async () => {
    const res = await GET(new Request("http://localhost"), makeParams());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      violations: {
        safety_violation: { confirmed: true, purpose: "dark ending", timestamp: "2026-01-01T00:00:00.000Z" },
      },
    });
  });

  it("404s a non-owner with the pre-migration 'Not found' body", async () => {
    findFirstProjects.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), makeParams());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });
});

describe("POST .../intentional-violation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({
      id: "proj-1",
      userId: "user-1",
      intentionalViolations: {
        existing_violation: { confirmed: true, purpose: "old", timestamp: "2026-01-01T00:00:00.000Z" },
      },
    });
  });

  it("merges the new acknowledgement into the stored jsonb map via one UPDATE, and fires the canonical-mutation hook", async () => {
    const res = await POST(
      makeRequest({ violationType: "safety_violation", purpose: "dark ending" }),
      makeParams(),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    // First update = the record write: existing entries preserved (the dedupe
    // semantics are KEYED overwrite — re-acknowledging replaces that key only).
    const record = updateSet.mock.calls[0]![0] as Record<string, any>;
    expect(record.intentionalViolations.existing_violation).toEqual({
      confirmed: true, purpose: "old", timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(record.intentionalViolations.safety_violation).toMatchObject({
      confirmed: true, purpose: "dark ending",
    });
    expect(typeof record.intentionalViolations.safety_violation.timestamp).toBe("string");
    // Second update = §11's revision bump (this acknowledgement is now a
    // canonical-mutation hook firing — a NEW capability of the migrated route).
    expect(updateSet.mock.calls[1]![0]).toHaveProperty("contentRevision");
  });

  it("falls back to an empty purpose, as the pre-migration route did", async () => {
    await POST(makeRequest({ violationType: "safety_violation" }), makeParams());
    const record = updateSet.mock.calls[0]![0] as Record<string, any>;
    expect(record.intentionalViolations.safety_violation).toMatchObject({
      confirmed: true,
      purpose: "",
    });
  });

  it("400s 'violationType required' for an owner and 404s a non-owner FIRST", async () => {
    const missingType = await POST(makeRequest({}), makeParams());
    expect(missingType.status).toBe(400);
    expect(await missingType.json()).toEqual({ error: "violationType required" });
    expect(updateSet).not.toHaveBeenCalled();

    findFirstProjects.mockResolvedValue(null);
    const notOwner = await POST(makeRequest({}), makeParams());
    expect(notOwner.status).toBe(404);
    expect(await notOwner.json()).toEqual({ error: "Not found" });
    expect(updateSet).not.toHaveBeenCalled();
  });
});
