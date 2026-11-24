import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Phase 5A §13.1 slice 2 — the Postgres side of `StoryHistoryRepository`:
 * audit reads (list/get) plus all-or-nothing revert over the
 * story_transactions/story_changes tables.
 *
 * Three invariants worth pinning:
 *
 *  1. Audit reads build summaries from the DB: tx rows come back in stored
 *     (newest-first) order, the change read is ONE statement for every tx, and
 *     each transaction groups its own change rows by `seq` ascending. A
 *     persisted null `sourceGenerationId` drops out of the summary.
 *  2. `revertChanges` verifies live values BEFORE writing: a field whose live
 *     value still equals the change's `newValue` goes back to `oldValue` in
 *     ONE batched grouped UPDATE per row; any drift returns the conflict list
 *     and refuses the whole revert. A null/undefined live value normalizes to
 *     "" so an empty `newValue` still verifies. An entity already gone at the
 *     verify pass throws the TYPED `MissingEntitiesError` (the route body's
 *     `missing` list), mirroring applyChanges' pre-check.
 *  3. The write pass mirrors `applyChanges`: a 0-row batch result means the
 *     entity vanished between read and write, which throws — nothing was
 *     applied.
 *
 * Mock convention mirrors `pg-story-transaction.test.ts`: hoisted rest-arg fns
 * so delegation typechecks, per-table row dispatch on REAL schema identities,
 * capture arrays for the UPDATE payloads. One adaptation forced by this
 * adapter's read shapes: the tx reads terminal-chain `.where().orderBy().limit()`
 * and `.where().limit()`, while the change select and the revert pre-check
 * await `.where()` directly — so `where()` returns a Promise with
 * `orderBy`/`limit` chain members assigned onto it, making both terminal
 * styles resolvable.
 */
const projectsFindFirst = vi.fn(async (..._args: unknown[]): Promise<unknown> => undefined);
const batch = vi.fn(async (...statements: unknown[]) =>
  (statements[0] as unknown[]).map(() => [{ id: "row" }]),
);
const txRows = vi.fn(async (_table: unknown) => [] as unknown[]);
const changeRows = vi.fn(async (_table: unknown) => [] as unknown[]);
const entityRows = vi.fn(async (_table: unknown) => [] as unknown[]);
const lastLimit: { value: number | undefined } = { value: undefined };
const updateSetCaptures: Array<{ table: unknown; payload: unknown }> = [];

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: {
        findFirst: (...args: unknown[]) => projectsFindFirst(...args),
      },
    },
    batch: (...args: unknown[]) => batch(...args),
    select: (_cols: unknown) => ({
      from: (table: unknown) => {
        const rowsFn =
          table === storyTransactions ? txRows : table === storyChanges ? changeRows : entityRows;
        return {
          where: (_cond: unknown) => {
            const base = Promise.resolve(rowsFn(table));
            // Attaching the chain members to the resolved Promise: awaiting
            // `…where()` yields the rows, and `.orderBy().limit()` /
            // `.limit()` stay reachable for the capped tx reads.
            return Object.assign(base, {
              orderBy: (_o: unknown) => ({
                limit: async (n: number) => {
                  lastLimit.value = n;
                  return rowsFn(table);
                },
              }),
              limit: async (n: number) => {
                lastLimit.value = n;
                return rowsFn(table);
              },
            });
          },
        };
      },
    }),
    update: (table: unknown) => ({
      set: (payload: unknown) => {
        updateSetCaptures.push({ table, payload });
        return { where: () => ({ returning: async () => [{ id: "row" }] }) };
      },
    }),
  },
}));

const { pgStoryHistoryRepository } = await import("@/lib/core/pg-repositories");
// Real schema table identities: dispatch/identity assertions compare against
// these imports, never against string keys.
import { characters, locations, worldEntities as worldEntitiesTable, storyChanges, storyTransactions } from "@/db/schema";
import { MissingEntitiesError, type StoryChange } from "@/lib/core/handlers/apply-story-transaction";

describe("pgStoryHistoryRepository.listTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-seed defaults AFTER clearing (same pattern as pg-story-transaction).
    batch.mockImplementation(async (...args: unknown[]) =>
      (args[0] as unknown[]).map(() => [{ id: "row" }]),
    );
    txRows.mockResolvedValue([]);
    changeRows.mockResolvedValue([]);
    entityRows.mockResolvedValue([]);
    lastLimit.value = undefined;
    updateSetCaptures.length = 0;
  });

  it("listTransactions() — an empty trail reads as an empty list", async () => {
    const result = await pgStoryHistoryRepository.listTransactions("p1");

    expect(result).toEqual([]);
    expect(changeRows).not.toHaveBeenCalled();
  });

  it("listTransactions() — maps rows in stored order, sorts per-tx changes by seq, and drops a null sourceGenerationId", async () => {
    txRows.mockResolvedValue([
      { id: "tx_1", source: "model-proposal", sourceGenerationId: "gen_9", createdAt: new Date(1000) },
      { id: "tx_2", source: "user-edit", sourceGenerationId: null, createdAt: new Date(2000) },
    ]);
    // Input is interleaved across both transactionIds and NOT seq-sorted
    // within tx_1 — the adapter must regroup and sort.
    changeRows.mockResolvedValue([
      { transactionId: "tx_1", seq: 2, entityKey: "characters", entityId: "c1", field: "arc", oldValue: "", newValue: "grows bold" },
      { transactionId: "tx_2", seq: 1, entityKey: "locations", entityId: "l1", field: "description", oldValue: "", newValue: "storm attic" },
      { transactionId: "tx_2", seq: 2, entityKey: "locations", entityId: "l1", field: "history", oldValue: "", newValue: "attic history" },
      { transactionId: "tx_1", seq: 1, entityKey: "characters", entityId: "c1", field: "desires", oldValue: "", newValue: "escape" },
    ]);

    const result = await pgStoryHistoryRepository.listTransactions("p1");

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe("tx_1");
    expect(result[0]!.source).toBe("model-proposal");
    expect(result[0]!.sourceGenerationId).toBe("gen_9");
    expect(result[0]!.createdAt).toEqual(new Date(1000));
    expect(result[0]!.changes).toEqual([
      { entityKey: "characters", entityId: "c1", field: "desires", oldValue: "", newValue: "escape" },
      { entityKey: "characters", entityId: "c1", field: "arc", oldValue: "", newValue: "grows bold" },
    ]);
    expect(result[1]!.id).toBe("tx_2");
    // A persisted null is dropped, never surfaced as a null summary field.
    expect(result[1]!.sourceGenerationId).toBeUndefined();
    expect(result[1]!.changes).toEqual([
      { entityKey: "locations", entityId: "l1", field: "description", oldValue: "", newValue: "storm attic" },
      { entityKey: "locations", entityId: "l1", field: "history", oldValue: "", newValue: "attic history" },
    ]);
    // The change read for ALL tx ids is ONE statement.
    expect(changeRows).toHaveBeenCalledTimes(1);
    expect(batch).not.toHaveBeenCalled();
  });

  it("listTransactions() — the host cap limits the tx read to 50 rows", async () => {
    txRows.mockResolvedValue(
      Array.from({ length: 60 }, (_, i) => ({
        id: `tx_${i}`,
        source: "user-edit",
        sourceGenerationId: null,
        createdAt: new Date(i),
      })),
    );

    const result = await pgStoryHistoryRepository.listTransactions("p1");

    expect(result).toHaveLength(60);
    expect(lastLimit.value).toBe(50);
  });

  it("listTransactions() — a transaction with no change rows is still listed, with an empty changes array", async () => {
    txRows.mockResolvedValue([
      { id: "tx_1", source: "import", sourceGenerationId: null, createdAt: new Date(3000) },
    ]);
    changeRows.mockResolvedValue([]);

    const result = await pgStoryHistoryRepository.listTransactions("p1");

    expect(result).toHaveLength(1);
    expect(result[0]!.changes).toEqual([]);
  });
});

describe("pgStoryHistoryRepository.getTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batch.mockImplementation(async (...args: unknown[]) =>
      (args[0] as unknown[]).map(() => [{ id: "row" }]),
    );
    txRows.mockResolvedValue([]);
    changeRows.mockResolvedValue([]);
    entityRows.mockResolvedValue([]);
    lastLimit.value = undefined;
    updateSetCaptures.length = 0;
  });

  it("getTransaction() — no matching row in this project reads as null", async () => {
    const result = await pgStoryHistoryRepository.getTransaction("p1", "tx_missing");

    expect(result).toBeNull();
  });

  it("getTransaction() — changes sorted by seq with the field/oldValue/newValue mapping verbatim", async () => {
    txRows.mockResolvedValue([
      { id: "tx_1", source: "import", sourceGenerationId: "gen_1", createdAt: new Date(4000) },
    ]);
    changeRows.mockResolvedValue([
      { seq: 3, entityKey: "plotThreads", entityId: "pt1", field: "stakes", oldValue: "", newValue: "secrets surface" },
      { seq: 1, entityKey: "characters", entityId: "c1", field: "desires", oldValue: "quiet", newValue: "escape" },
      { seq: 2, entityKey: "locations", entityId: "l1", field: "description", oldValue: "bare room", newValue: "storm attic" },
    ]);

    const result = await pgStoryHistoryRepository.getTransaction("p1", "tx_1");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("tx_1");
    expect(result!.source).toBe("import");
    expect(result!.sourceGenerationId).toBe("gen_1");
    expect(result!.createdAt).toEqual(new Date(4000));
    expect(result!.changes).toEqual([
      { entityKey: "characters", entityId: "c1", field: "desires", oldValue: "quiet", newValue: "escape" },
      { entityKey: "locations", entityId: "l1", field: "description", oldValue: "bare room", newValue: "storm attic" },
      { entityKey: "plotThreads", entityId: "pt1", field: "stakes", oldValue: "", newValue: "secrets surface" },
    ]);
  });
});

describe("pgStoryHistoryRepository.revertChanges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batch.mockImplementation(async (...args: unknown[]) =>
      (args[0] as unknown[]).map(() => [{ id: "row" }]),
    );
    txRows.mockResolvedValue([]);
    changeRows.mockResolvedValue([]);
    entityRows.mockResolvedValue([]);
    lastLimit.value = undefined;
    updateSetCaptures.length = 0;
  });

  it("revertChanges() — one drifted field refuses the whole revert: exactly its conflict is returned and nothing is written", async () => {
    // The characters row still holds the desires change's `newValue` (that
    // change verifies clean); the drift is arc: the row's null reads as "" and
    // no longer matches "hardens". The location change verifies clean too.
    entityRows.mockImplementation(async (t: unknown) => {
      if (t === characters) return [{ id: "c1", desires: "escape", arc: null }];
      if (t === locations) return [{ id: "l1", description: "a cold attic" }];
      return [];
    });
    const changes: StoryChange[] = [
      { entityKey: "characters", entityId: "c1", field: "desires", oldValue: "wandering", newValue: "escape" },
      { entityKey: "characters", entityId: "c1", field: "arc", oldValue: "", newValue: "hardens" },
      { entityKey: "locations", entityId: "l1", field: "description", oldValue: "bare room", newValue: "a cold attic" },
    ];

    const conflicts = await pgStoryHistoryRepository.revertChanges("p1", changes);

    expect(conflicts).toEqual([{ entityKey: "characters", entityId: "c1", field: "arc", current: "" }]);
    // Only the two involved tables were read — never anything else.
    const readTables = entityRows.mock.calls.map((call) => call[0]);
    expect(readTables).toHaveLength(2);
    expect(readTables[0]).toBe(characters);
    expect(readTables[1]).toBe(locations);
    expect(batch).not.toHaveBeenCalled();
    expect(updateSetCaptures).toHaveLength(0);
  });

  it("revertChanges() — a null live value normalizes to '' and matches an empty newValue, so the revert writes the oldValue back", async () => {
    entityRows.mockImplementation(async (t: unknown) =>
      t === characters ? [{ id: "c1", desires: null }] : [],
    );
    const changes: StoryChange[] = [
      { entityKey: "characters", entityId: "c1", field: "desires", oldValue: "aggressive", newValue: "" },
    ];

    const conflicts = await pgStoryHistoryRepository.revertChanges("p1", changes);

    expect(conflicts).toEqual([]);
    expect(updateSetCaptures).toHaveLength(1);
    expect(updateSetCaptures[0]!.table).toBe(characters);
    expect(updateSetCaptures[0]!.payload).toEqual({ desires: "aggressive" });
    expect(batch).toHaveBeenCalledTimes(1);
  });

  it("revertChanges() — every live value matching applies the inverse in ONE batch: a grouped UPDATE per row carrying the oldValues", async () => {
    entityRows.mockImplementation(async (t: unknown) => {
      if (t === characters) return [{ id: "c1", desires: "escape", arc: "hardens" }];
      if (t === locations) return [{ id: "l1", description: "a cold attic" }];
      return [];
    });
    const changes: StoryChange[] = [
      { entityKey: "characters", entityId: "c1", field: "desires", oldValue: "", newValue: "escape" },
      { entityKey: "characters", entityId: "c1", field: "arc", oldValue: "", newValue: "hardens" },
      { entityKey: "locations", entityId: "l1", field: "description", oldValue: "", newValue: "a cold attic" },
    ];

    const conflicts = await pgStoryHistoryRepository.revertChanges("p1", changes);

    expect(conflicts).toEqual([]);
    // Write is ONE batch: two grouped statements (c1 and l1).
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0]![0]).toHaveLength(2);
    expect(updateSetCaptures).toHaveLength(2);
    // Payload keys are exactly the reverted fields (the changes' oldValues).
    const charCapture = updateSetCaptures.find((c) => c.table === characters)!;
    const locCapture = updateSetCaptures.find((c) => c.table === locations)!;
    expect(Object.keys(charCapture.payload as object)).toEqual(["desires", "arc"]);
    expect(charCapture.payload).toEqual({ desires: "", arc: "" });
    expect(Object.keys(locCapture.payload as object)).toEqual(["description"]);
    expect(locCapture.payload).toEqual({ description: "" });
  });

  it("revertChanges() — an entity missing at the verify pass rejects with MissingEntitiesError carrying exactly the missing refs", async () => {
    entityRows.mockImplementation(async (t: unknown) =>
      t === locations ? [{ id: "l1", description: "a cold attic" }] : [],
    );
    const changes: StoryChange[] = [
      { entityKey: "characters", entityId: "c9", field: "desires", oldValue: "", newValue: "escape" },
      { entityKey: "locations", entityId: "l1", field: "description", oldValue: "", newValue: "a cold attic" },
    ];

    const err = await pgStoryHistoryRepository
      .revertChanges("p1", changes)
      .then(
        () => null,
        (e: unknown) => e,
      );

    expect(err).toBeInstanceOf(MissingEntitiesError);
    if (err instanceof MissingEntitiesError) {
      expect(err.name).toBe("MissingEntitiesError");
      expect(err.missing).toEqual([{ entityKey: "characters", entityId: "c9" }]);
      // The typed context names the failed revert and the project.
      expect(err.message).toMatch(/nothing was reverted; entities not found in project p1/);
    }
    // The verify pass decided before any write: zero statements queued.
    expect(batch).not.toHaveBeenCalled();
    expect(updateSetCaptures).toHaveLength(0);
  });

  it("revertChanges() — unknown entityKey throws before any table is read", async () => {
    const changes = [
      { entityKey: "factions", entityId: "f1", field: "summary", oldValue: "", newValue: "x" },
    ] as unknown as StoryChange[];

    await expect(pgStoryHistoryRepository.revertChanges("p1", changes)).rejects.toThrow(
      /revertChanges: unknown entity key "factions"/,
    );
    expect(entityRows).not.toHaveBeenCalled();
  });

  it("revertChanges() — a 0-row batch verifies the write: the entity vanished between pre-check and write", async () => {
    entityRows.mockImplementation(async (t: unknown) => {
      if (t === characters) return [{ id: "c1", desires: "escape", arc: "hardens" }];
      if (t === locations) return [{ id: "l1", description: "a cold attic" }];
      return [];
    });
    const changes: StoryChange[] = [
      { entityKey: "characters", entityId: "c1", field: "desires", oldValue: "", newValue: "escape" },
      { entityKey: "characters", entityId: "c1", field: "arc", oldValue: "", newValue: "hardens" },
      { entityKey: "locations", entityId: "l1", field: "description", oldValue: "", newValue: "a cold attic" },
    ];
    // Second grouped statement reports 0 matched rows.
    batch.mockImplementationOnce(async (...args: unknown[]) =>
      (args[0] as unknown[]).map((_statement, i) => (i === 1 ? [] : [{ id: "row" }])));

    await expect(pgStoryHistoryRepository.revertChanges("p1", changes)).rejects.toThrow(
      /revertChanges: entity locations#l1 vanished between pre-check and write — nothing was reverted/,
    );
  });

  it("revertChanges() — empty changes is an immediate no-op: no reads, no batch", async () => {
    const result = await pgStoryHistoryRepository.revertChanges("p1", []);

    expect(result).toEqual([]);
    expect(txRows).not.toHaveBeenCalled();
    expect(changeRows).not.toHaveBeenCalled();
    expect(entityRows).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
  });

  it("revertChanges() — the inverse write DECODES oldValue for kinded columns: a recorded link-array oldValue writes the native array, not the JSON string", async () => {
    entityRows.mockImplementation(async (t: unknown) =>
      t === characters ? [{ id: "c1", linkedLocationIds: ["l1"] }] : [],
    );
    const changes: StoryChange[] = [
      { entityKey: "characters", entityId: "c1", field: "linkedLocationIds", oldValue: '["l2"]', newValue: '["l1"]' },
    ];

    const conflicts = await pgStoryHistoryRepository.revertChanges("p1", changes);

    expect(conflicts).toEqual([]);
    expect(updateSetCaptures).toHaveLength(1);
    expect(updateSetCaptures[0]!.table).toBe(characters);
    // The decode contract: '["l2"]' must reach the jsonb column as an array.
    const payload = updateSetCaptures[0]!.payload as Record<string, unknown>;
    expect(payload).toEqual({ linkedLocationIds: ["l2"] });
    expect(Array.isArray(payload.linkedLocationIds)).toBe(true);
  });

  it("revertChanges() — booleans too: a live true matches the recorded 'true', and an absent oldValue decodes to SQL null (never the string '')", async () => {
    // alwaysInContext is allowlisted ONLY on worldEntities (the context-star
    // toggle writes it directly on characters/locations/plotThreads), so the
    // boolean pin runs against that row.
    entityRows.mockImplementation(async (t: unknown) =>
      t === worldEntitiesTable ? [{ id: "w1", alwaysInContext: true }] : [],
    );
    const changes: StoryChange[] = [
      { entityKey: "worldEntities", entityId: "w1", field: "alwaysInContext", oldValue: "", newValue: "true" },
    ];

    const conflicts = await pgStoryHistoryRepository.revertChanges("p1", changes);

    // The encode/decode alignment: DB boolean `true` vs audit "true" verifies
    // clean instead of conflicting — and the write carries a DECODED absence
    // (null), never a boolean-column-hostile "" string.
    expect(conflicts).toEqual([]);
    expect(updateSetCaptures).toHaveLength(1);
    const payload = updateSetCaptures[0]!.payload as Record<string, unknown>;
    expect(payload).toEqual({ alwaysInContext: null });
    expect("alwaysInContext" in payload && payload.alwaysInContext === null).toBe(true);
  });
});

describe("pgStoryHistoryRepository.ownsProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batch.mockImplementation(async (...args: unknown[]) =>
      (args[0] as unknown[]).map(() => [{ id: "row" }]),
    );
    txRows.mockResolvedValue([]);
    changeRows.mockResolvedValue([]);
    entityRows.mockResolvedValue([]);
    lastLimit.value = undefined;
    updateSetCaptures.length = 0;
  });

  it("ownsProject() — true/false passthrough via the project row lookup", async () => {
    projectsFindFirst.mockResolvedValueOnce({ id: "p1" });
    await expect(pgStoryHistoryRepository.ownsProject("p1", "u1")).resolves.toBe(true);

    projectsFindFirst.mockResolvedValueOnce(undefined);
    await expect(pgStoryHistoryRepository.ownsProject("p1", "u2")).resolves.toBe(false);
  });
});
