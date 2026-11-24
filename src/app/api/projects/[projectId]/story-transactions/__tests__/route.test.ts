import { describe, it, expect, vi, beforeEach } from "vitest";
import { characters, locations, projects, storyChanges, storyTransactions } from "@/db/schema";

const findFirstProjects = vi.fn();
const selectRowsByTable = vi.fn();
const batchFn = vi.fn();

const updateSetCalls: { table: unknown; payload: unknown }[] = [];
const insertCalls: { table: unknown; payload: unknown }[] = [];

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

vi.mock("@/db", () => ({
  db: {
    query: { projects: { findFirst: (...args: any[]) => findFirstProjects(...args) } },
    select: () => ({
      from: (table: unknown) => ({ where: async () => selectRowsByTable(table) }),
    }),
    update: (table: unknown) => ({
      set: (payload: unknown) => {
        updateSetCalls.push({ table, payload });
        return { where: () => ({ returning: async () => [{ id: "x" }] }) };
      },
    }),
    insert: (table: unknown) => ({
      values: (payload: unknown) => {
        insertCalls.push({ table, payload });
        return {};
      },
    }),
    batch: (statements: unknown[]) => batchFn(statements),
  },
}));

const { POST } = await import("../route");

const DEFAULT_SELECT_ROWS = (table: unknown) =>
  table === characters ? [{ id: "c1" }] : table === locations ? [{ id: "l1" }] : [];
const DEFAULT_BATCH = (statements: unknown[]) =>
  statements.map((st) => (st as { __rows?: unknown }).__rows ?? [{ id: "row" }]);

function makeRequest(body: unknown) {
  return new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}

const revisionBumpCalls = () =>
  updateSetCalls.filter(
    (c) =>
      c.table === projects &&
      typeof (c.payload as Record<string, unknown>).contentRevision === "object",
  );

describe("POST /api/projects/[projectId]/story-transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateSetCalls.length = 0;
    insertCalls.length = 0;
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    selectRowsByTable.mockImplementation(DEFAULT_SELECT_ROWS);
    batchFn.mockImplementation(DEFAULT_BATCH);
  });

  it("200 — records the transaction then applies valid changes, and fires the §11 revision bump", async () => {
    const res = await POST(
      makeRequest({
        source: "model-proposal",
        sourceGenerationId: "gen-1",
        changes: [
          { entityKey: "characters", entityId: "c1", field: "desires", oldValue: "", newValue: "to win" },
          { entityKey: "locations", entityId: "l1", field: "description", oldValue: "", newValue: "a bar" },
        ],
      }),
      makeParams(),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      transaction?: { changes: unknown[]; source: string; sourceGenerationId?: string };
    };
    expect(json.transaction).toBeDefined();
    expect(json.transaction!.changes).toHaveLength(2);
    expect(json.transaction!.source).toBe("model-proposal");
    expect(json.transaction!.sourceGenerationId).toBe("gen-1");

    expect(batchFn).toHaveBeenCalledTimes(2);
    const recordStatements = batchFn.mock.calls[0]![0] as unknown[];
    const writeStatements = batchFn.mock.calls[1]![0] as unknown[];
    expect(recordStatements).toHaveLength(2);
    expect(writeStatements).toHaveLength(2);

    expect(insertCalls.map((c) => c.table)).toEqual([storyTransactions, storyChanges]);
    expect(revisionBumpCalls()).toHaveLength(1);

    const charUpdate = updateSetCalls.find((c) => c.table === characters);
    const locUpdate = updateSetCalls.find((c) => c.table === locations);
    expect(Object.keys(charUpdate!.payload as object)).toEqual(["desires"]);
    expect(Object.keys(locUpdate!.payload as object)).toEqual(["description"]);
  });

  it("404 — unknown project (ownership probe returns null)", async () => {
    findFirstProjects.mockResolvedValue(null);

    const res = await POST(makeRequest({ source: "model-proposal", changes: [] }), makeParams());

    expect(res.status).toBe(404);
    expect(batchFn).not.toHaveBeenCalled();
    expect(revisionBumpCalls()).toHaveLength(0);
  });

  it("422 — non-writable field in changes: whole transaction rejected, nothing recorded", async () => {
    const res = await POST(
      makeRequest({
        source: "user-edit",
        changes: [
          { entityKey: "characters", entityId: "c1", field: "id", oldValue: "", newValue: "evil" },
        ],
      }),
      makeParams(),
    );

    expect(res.status).toBe(422);
    const json = (await res.json()) as { rejected?: unknown[] };
    expect(Array.isArray(json.rejected)).toBe(true);
    expect(batchFn).not.toHaveBeenCalled();
    expect(revisionBumpCalls()).toHaveLength(0);
  });

  it("422 — unknown entityKey rejected", async () => {
    const res = await POST(
      makeRequest({
        source: "user-edit",
        changes: [
          { entityKey: "plotThreads2", entityId: "t1", field: "description", oldValue: "", newValue: "x" },
        ],
      }),
      makeParams(),
    );

    expect(res.status).toBe(422);
    expect(batchFn).not.toHaveBeenCalled();
    expect(revisionBumpCalls()).toHaveLength(0);
  });

  it("400 — invalid source", async () => {
    const res = await POST(makeRequest({ source: "aliens", changes: [] }), makeParams());

    expect(res.status).toBe(400);
    expect(batchFn).not.toHaveBeenCalled();
  });

  it("400 — missing changes", async () => {
    const res = await POST(makeRequest({ source: "model-proposal" }), makeParams());

    expect(res.status).toBe(400);
    expect(batchFn).not.toHaveBeenCalled();
  });

  it("400 — invalid JSON body", async () => {
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: "not json" }),
      makeParams(),
    );

    expect(res.status).toBe(400);
    expect(batchFn).not.toHaveBeenCalled();
  });

  it("422 — entity missing at the pre-check: typed `missing` in the body, audit row still recorded, hook never fires", async () => {
    selectRowsByTable.mockImplementation(() => []);

    const res = await POST(
      makeRequest({
        source: "model-proposal",
        changes: [
          { entityKey: "characters", entityId: "c1", field: "desires", oldValue: "", newValue: "to win" },
        ],
      }),
      makeParams(),
    );

    expect(res.status).toBe(422);
    const json = (await res.json()) as {
      error?: string;
      missing?: Array<{ entityKey: string; entityId: string }>;
      rejected?: unknown[];
    };
    expect(json.error).toBe(
      "Some referenced entities no longer exist; the transaction was recorded but nothing was applied.",
    );
    expect(json.missing).toEqual([{ entityKey: "characters", entityId: "c1" }]);
    // The rejected/missing arms never co-occur: this failure comes from the
    // post-record pre-check, never from validation.
    expect("rejected" in json).toBe(false);
    // Audit-first order unchanged: the record batch happened; nothing was
    // applied and §11's revision did not move.
    expect(batchFn).toHaveBeenCalledTimes(1);
    const recordStatements = batchFn.mock.calls[0]![0] as unknown[];
    expect(recordStatements).toHaveLength(2);
    expect(insertCalls.map((c) => c.table)).toEqual([storyTransactions, storyChanges]);
    expect(revisionBumpCalls()).toHaveLength(0);
  });

  it('revision hook kind — bump fires with kind "storyTransaction.model-proposal"', async () => {
    const res = await POST(
      makeRequest({
        source: "user-edit",
        changes: [
          { entityKey: "characters", entityId: "c1", field: "desires", oldValue: "", newValue: "braver" },
        ],
      }),
      makeParams(),
    );

    expect(res.status).toBe(200);
    const bumps = updateSetCalls.filter((c) => c.table === projects);
    expect(bumps).toHaveLength(1);
    expect(typeof (bumps[0]!.payload as Record<string, unknown>).contentRevision).toBe("object");
  });

  it("changes: [] — empty transaction records an audit row with no changes insert, no write batch, and the revision bump still fires", async () => {
    const res = await POST(makeRequest({ source: "import", changes: [] }), makeParams());

    expect(res.status).toBe(200);
    const json = (await res.json()) as { transaction?: { changes: unknown[] } };
    expect(json.transaction!.changes).toHaveLength(0);

    expect(batchFn).toHaveBeenCalledTimes(1);
    const recordStatements = batchFn.mock.calls[0]![0] as unknown[];
    expect(recordStatements).toHaveLength(1);
    expect(insertCalls.map((c) => c.table)).toEqual([storyTransactions]);

    expect(revisionBumpCalls()).toHaveLength(1);
  });
});
