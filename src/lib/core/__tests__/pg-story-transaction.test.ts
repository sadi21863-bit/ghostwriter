import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Phase 5A — the Postgres side of §13.1's `StoryTransactionRepository`.
 *
 * Two invariants make this port worth its own tests:
 *
 *  1. `record()` persists the transaction AND its change rows in ONE `db.batch`
 *     (neon-http has no `db.transaction`; `batch` is one HTTP request executed
 *     server-side in a single transaction), so the audit trail can never be
 *     missing the writes it describes.
 *  2. `applyChanges()` must be all-or-nothing: a pre-check SELECT proves every
 *     referenced entity exists in the project BEFORE any write, and the write
 *     pass verifies each scoped UPDATE actually matched a row. A 0-row result
 *     means the entity vanished between pre-check and write, which aborts the
 *     whole transaction ("nothing was applied").
 *
 * Mock convention follows `pg-content-revision.test.ts`: hoisted rest-arg fns so
 * the `...args` delegation typechecks, plus capture arrays for the INSERT/UPDATE
 * payloads (unawaited statement builders carry their payload at build time; the
 * capture arrays are the ground truth the batch statements point at).
 */
const projectsFindFirst = vi.fn(async (..._args: unknown[]) => undefined);
const batch = vi.fn(async (...statements: unknown[]) => statements.map(() => [{ id: "row" }]));
const selectRows = vi.fn(async (..._table: unknown[]) => [] as unknown[]);

const insertCaptures: Array<{ table: unknown; payload: unknown }> = [];
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
      from: (table: unknown) => ({
        where: async () => selectRows(table),
      }),
    }),
    update: (table: unknown) => ({
      set: (payload: unknown) => {
        updateSetCaptures.push({ table, payload });
        return { where: () => ({ returning: async () => [{ id: "row" }] }) };
      },
    }),
    insert: (table: unknown) => ({
      values: (payload: unknown) => {
        insertCaptures.push({ table, payload: payload as Record<string, unknown> });
        return {};
      },
    }),
  },
}));

const { pgStoryTransactionRepository } = await import("@/lib/core/pg-repositories");
// Real schema table identities: dispatch/identity assertions compare against
// these imports, never against string keys.
import { characters, locations, worldEntities, storyChanges, storyTransactions } from "@/db/schema";
import { MissingEntitiesError, type StoryTransaction } from "@/lib/core/handlers/apply-story-transaction";

describe("pgStoryTransactionRepository.record", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-seed defaults AFTER clearing (same pattern as pg-content-revision).
    batch.mockImplementation(async (...args: unknown[]) =>
      (args[0] as unknown[]).map(() => [{ id: "row" }]),
    );
    selectRows.mockResolvedValue([]);
    insertCaptures.length = 0;
    updateSetCaptures.length = 0;
  });

  it("record() — one atomic batch: transaction insert verbatim + ordered change rows", async () => {
    const tx: StoryTransaction = {
      id: "tx_1",
      projectId: "p1",
      source: "model-proposal",
      createdAt: new Date(0),
      sourceGenerationId: "gen-9",
      changes: [
        { entityKey: "characters", entityId: "c1", field: "desires", oldValue: "", newValue: "wants freedom" },
        { entityKey: "characters", entityId: "c1", field: "arc", oldValue: "", newValue: "grows bold" },
      ],
    };

    await pgStoryTransactionRepository.record(tx);

    // ONE batch — the audit rows ride the same server-side transaction as the
    // transaction row, never two statements racing each other.
    expect(batch).toHaveBeenCalledTimes(1);
    const statements = batch.mock.calls[0]![0] as unknown[];
    expect(statements).toHaveLength(2);

    // The statement builders are built unawaited before `batch` is called, so the
    // capture order IS the statement order: [0] transaction row, [1] change rows.
    expect(insertCaptures).toHaveLength(2);
    expect(insertCaptures[0]!.table).toBe(storyTransactions);
    // Verbatim port — the tx is persisted field-for-field, provenance included.
    expect(insertCaptures[0]!.payload).toEqual({
      id: "tx_1",
      projectId: "p1",
      source: "model-proposal",
      createdAt: new Date(0),
      sourceGenerationId: "gen-9",
    });

    expect(insertCaptures[1]!.table).toBe(storyChanges);
    const changeRows = insertCaptures[1]!.payload as Array<Record<string, unknown>>;
    expect(changeRows).toHaveLength(2);
    expect(changeRows[0]).toEqual({
      transactionId: "tx_1",
      projectId: "p1",
      seq: 0,
      entityKey: "characters",
      entityId: "c1",
      field: "desires",
      oldValue: "",
      newValue: "wants freedom",
    });
    expect(changeRows[1]!.seq).toBe(1);
    expect(changeRows[1]!.field).toBe("arc");
    expect(changeRows[1]!.transactionId).toBe("tx_1");
    expect(changeRows[1]!.projectId).toBe("p1");
  });

  it("record() — absent sourceGenerationId stays absent (never written as null from the port); empty changes → single-statement batch", async () => {
    const tx: StoryTransaction = {
      id: "tx_2",
      projectId: "p1",
      source: "user-edit",
      createdAt: new Date(0),
      changes: [],
    };

    await pgStoryTransactionRepository.record(tx);

    expect(batch).toHaveBeenCalledTimes(1);
    expect(insertCaptures).toHaveLength(1);
    expect(insertCaptures[0]!.table).toBe(storyTransactions);
    expect(insertCaptures[0]!.payload).toEqual({
      id: "tx_2",
      projectId: "p1",
      source: "user-edit",
      createdAt: new Date(0),
    });
    // Absent stays absent — the port must not invent a null for an undefined
    // field, so the column's own default/derive path stays in charge.
    expect(!("sourceGenerationId" in (insertCaptures[0]!.payload as object))).toBe(true);
  });

  it("record() — batch failure surfaces (no silent swallow)", async () => {
    batch.mockRejectedValueOnce(new Error("db down"));
    const tx: StoryTransaction = {
      id: "tx_3",
      projectId: "p1",
      source: "model-proposal",
      createdAt: new Date(0),
      changes: [],
    };

    // §11 lesson: a failed audit store must reach the handler, not be converted
    // into a false success by an internal catch.
    await expect(pgStoryTransactionRepository.record(tx)).rejects.toThrow("db down");
  });
});

describe("pgStoryTransactionRepository.applyChanges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batch.mockImplementation(async (...args: unknown[]) =>
      (args[0] as unknown[]).map(() => [{ id: "row" }]),
    );
    selectRows.mockResolvedValue([]);
    insertCaptures.length = 0;
    updateSetCaptures.length = 0;
  });

  it("applyChanges() — groups by entity row: one scoped UPDATE per row carrying all its fields", async () => {
    selectRows.mockImplementation(async (table: unknown) => {
      if (table === characters) return [{ id: "c1" }];
      if (table === locations) return [{ id: "l1" }];
      return [];
    });
    const tx: StoryTransaction = {
      id: "tx_4",
      projectId: "p1",
      source: "model-proposal",
      createdAt: new Date(0),
      changes: [
        { entityKey: "characters", entityId: "c1", field: "desires", oldValue: "", newValue: "escape" },
        { entityKey: "characters", entityId: "c1", field: "arc", oldValue: "", newValue: "hardens" },
        { entityKey: "locations", entityId: "l1", field: "description", oldValue: "", newValue: "a cold attic" },
      ],
    };

    await pgStoryTransactionRepository.applyChanges("p1", tx);

    // Write is ONE batch: two grouped statements (c1 and l1 in this project).
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0]![0]).toHaveLength(2);

    // Allowlist precision: each row's patch carries exactly its own fields.
    expect(updateSetCaptures).toHaveLength(2);
    const charCapture = updateSetCaptures.find((c) => c.table === characters);
    const locCapture = updateSetCaptures.find((c) => c.table === locations);
    expect(charCapture).toBeDefined();
    expect(locCapture).toBeDefined();
    expect(Object.keys(charCapture!.payload as object).sort()).toEqual(["arc", "desires"]);
    expect(charCapture!.payload).toEqual({ desires: "escape", arc: "hardens" });
    expect(locCapture!.payload).toEqual({ description: "a cold attic" });
  });

  it("applyChanges() — pre-check pass runs before the write batch (missing entity aborts everything)", async () => {
    // Default selectRows → [] means c1 is NOT found in the project.
    const tx: StoryTransaction = {
      id: "tx_5",
      projectId: "p1",
      source: "model-proposal",
      createdAt: new Date(0),
      changes: [
        { entityKey: "characters", entityId: "c1", field: "desires", oldValue: "", newValue: "escape" },
      ],
    };

    await expect(pgStoryTransactionRepository.applyChanges("p1", tx)).rejects.toThrow(
      /references entities not found.*c1/,
    );
    // Abort happened at the pre-check: nothing was queued, nothing was written.
    expect(batch).toHaveBeenCalledTimes(0);
    expect(updateSetCaptures).toHaveLength(0);
  });

  it("applyChanges() — pre-check missing rejects with MissingEntitiesError whose .missing lists exactly the missing refs", async () => {
    // Default selectRows → [] means BOTH ids are missing from their tables.
    const tx: StoryTransaction = {
      id: "tx_11",
      projectId: "p1",
      source: "model-proposal",
      createdAt: new Date(0),
      changes: [
        { entityKey: "characters", entityId: "c1", field: "desires", oldValue: "", newValue: "escape" },
        { entityKey: "locations", entityId: "l1", field: "description", oldValue: "", newValue: "a cold attic" },
      ],
    };

    const err = await pgStoryTransactionRepository
      .applyChanges("p1", tx)
      .then(
        () => null,
        (e: unknown) => e,
      );

    expect(err).toBeInstanceOf(MissingEntitiesError);
    expect(err).not.toBeNull();
    if (!(err instanceof MissingEntitiesError)) return;
    expect(err.name).toBe("MissingEntitiesError");
    // The two table reads run in parallel, so the refs' order is not
    // deterministic — compare as a sorted set.
    const sorted = [...err.missing].sort((a, b) =>
      `${a.entityKey}#${a.entityId}`.localeCompare(`${b.entityKey}#${b.entityId}`),
    );
    expect(sorted).toEqual([
      { entityKey: "characters", entityId: "c1" },
      { entityKey: "locations", entityId: "l1" },
    ]);
    expect(err.message).toMatch(/references entities not found in project p1/);
    // Abort happened at the pre-check: no write statements were ever built.
    expect(batch).not.toHaveBeenCalled();
    expect(updateSetCaptures).toHaveLength(0);
  });

  it("applyChanges() — pre-check covers DISTINCT ids per entity (two characters, one lookup each id in the IN clause)", async () => {
    selectRows.mockResolvedValue([{ id: "c1" }]);
    const tx: StoryTransaction = {
      id: "tx_6",
      projectId: "p1",
      source: "model-proposal",
      createdAt: new Date(0),
      changes: [
        { entityKey: "characters", entityId: "c1", field: "desires", oldValue: "", newValue: "a" },
        { entityKey: "characters", entityId: "c2", field: "desires", oldValue: "", newValue: "b" },
      ],
    };

    await expect(pgStoryTransactionRepository.applyChanges("p1", tx)).rejects.toThrow(
      /references entities not found.*characters#c2/,
    );
    expect(batch).toHaveBeenCalledTimes(0);
    expect(updateSetCaptures).toHaveLength(0);
  });

  it("applyChanges() — unknown entityKey never resolves a column by interpolation", async () => {
    const tx: StoryTransaction = {
      id: "tx_7",
      projectId: "p1",
      source: "model-proposal",
      createdAt: new Date(0),
      // "universe" is not one of the four EntityKeys — a hand-crafted
      // transaction must never reach a table whose name was interpolated.
      changes: [
        {
          entityKey: "universe",
          entityId: "u1",
          field: "description",
          oldValue: "",
          newValue: "x",
        } as unknown as StoryTransaction["changes"][number],
      ],
    };

    await expect(pgStoryTransactionRepository.applyChanges("p1", tx)).rejects.toThrow(
      /references entities not found.*universe/,
    );
    // Unknown-key abort skips the pre-check SELECTs (the map lookup already
    // decided) — zero reads, zero writes.
    expect(selectRows).toHaveBeenCalledTimes(0);
    expect(batch).toHaveBeenCalledTimes(0);
    expect(updateSetCaptures).toHaveLength(0);
  });

  it("applyChanges() — unknown field aborts the write pass even when the PRE-CHECK passes", async () => {
    selectRows.mockImplementation(async (table: unknown) => {
      if (table === characters) return [{ id: "c1" }];
      return [];
    });
    const tx: StoryTransaction = {
      id: "tx_8",
      projectId: "p1",
      source: "model-proposal",
      createdAt: new Date(0),
      // The pre-check only knows ENTITY_TABLES presence, so "characters" passes
      // it; the grouping pass then refuses the field before any write exists.
      changes: [
        { entityKey: "characters", entityId: "c1", field: "notAField", oldValue: "", newValue: "x" },
      ],
    };

    await expect(pgStoryTransactionRepository.applyChanges("p1", tx)).rejects.toThrow(
      /not writable on characters/,
    );
    expect(updateSetCaptures).toHaveLength(0);
    expect(batch).toHaveBeenCalledTimes(0);
  });

  it("applyChanges() — write verifies rows matched: 0-row result aborts (vanished between pre-check and write)", async () => {
    selectRows.mockImplementation(async (table: unknown) => {
      if (table === characters) return [{ id: "c1" }];
      return [];
    });
    // Single group (two fields on one row) → one statement whose batch result
    // came back 0 rows despite the pre-check having seen the entity.
    batch.mockResolvedValueOnce([[]]);
    const tx: StoryTransaction = {
      id: "tx_9",
      projectId: "p1",
      source: "model-proposal",
      createdAt: new Date(0),
      changes: [
        { entityKey: "characters", entityId: "c1", field: "desires", oldValue: "", newValue: "escape" },
        { entityKey: "characters", entityId: "c1", field: "arc", oldValue: "", newValue: "hardens" },
      ],
    };

    await expect(pgStoryTransactionRepository.applyChanges("p1", tx)).rejects.toThrow(
      /applyChanges.*characters#c1 vanished between pre-check and write — nothing was applied/,
    );
    expect(batch).toHaveBeenCalledTimes(1);
  });

  it("applyChanges() — empty changes is a no-op: no select, no batch, no throw", async () => {
    const tx: StoryTransaction = {
      id: "tx_10",
      projectId: "p1",
      source: "user-edit",
      createdAt: new Date(0),
      changes: [],
    };

    await expect(pgStoryTransactionRepository.applyChanges("p1", tx)).resolves.toBeUndefined();
    expect(selectRows).toHaveBeenCalledTimes(0);
    expect(batch).toHaveBeenCalledTimes(0);
    expect(updateSetCaptures).toHaveLength(0);
  });

  it("applyChanges() — DECODED natives, never wire strings, reach .set() (boolean + jsonb + integer + link array)", async () => {
    // §13.1 mirror-expansion wire-gap guard: the audit wire carries strings, but
    // an UPDATE carrying the literal string "true" into a boolean column (or
    // unparsed JSON into jsonb) is the exact bug class the write pass must not
    // let through. Every kinded shape must arrive as its native type.
    selectRows.mockImplementation(async (table: unknown) => {
      if (table === worldEntities) return [{ id: "w1" }];
      return [];
    });
    const tx: StoryTransaction = {
      id: "tx_12",
      projectId: "p1",
      source: "user-edit",
      createdAt: new Date(0),
      changes: [
        { entityKey: "worldEntities", entityId: "w1", field: "alwaysInContext", oldValue: "", newValue: "true" },
        { entityKey: "worldEntities", entityId: "w1", field: "properties", oldValue: "", newValue: '{"tier":"rare","origins":["myth"]}' },
        { entityKey: "worldEntities", entityId: "w1", field: "sortOrder", oldValue: "", newValue: "7" },
        { entityKey: "worldEntities", entityId: "w1", field: "linkedCharacterIds", oldValue: "", newValue: '["c1","c2"]' },
      ],
    };

    await pgStoryTransactionRepository.applyChanges("p1", tx);

    expect(updateSetCaptures).toHaveLength(1);
    expect(updateSetCaptures[0]!.table).toBe(worldEntities);
    const payload = updateSetCaptures[0]!.payload as Record<string, unknown>;
    expect(payload).toEqual({
      alwaysInContext: true,
      properties: { tier: "rare", origins: ["myth"] },
      sortOrder: 7,
      linkedCharacterIds: ["c1", "c2"],
    });
    // toEqual already distinguishes native booleans/numbers from "true"/"7";
    // assert the native types outright so the intent survives edits.
    expect(payload.alwaysInContext).toBe(true);
    expect(payload.sortOrder).toBe(7);
    expect(Array.isArray(payload.linkedCharacterIds)).toBe(true);
    expect(payload.properties).toEqual({ tier: "rare", origins: ["myth"] });
  });
});
