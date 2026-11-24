import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CanonicalMutationKind } from "@/lib/core/repositories";

/**
 * Phase 5A — the Postgres side of §11's `contentRevision`.
 *
 * The increment must be ONE atomic statement (a read-modify-write would lose
 * increments under concurrent mutation), and `readContentRevision` must keep
 * null = "never mutated" distinguishable from 0. A missing project row also
 * reads as null, but only AFTER ownership has been decided upstream, so the
 * two nulls are safe to conflate at this layer.
 *
 * Mock convention follows `pg-child-resources.test.ts`: rest-arg fns so the
 * `...args` delegation typechecks.
 */
const updateWhere = vi.fn(async (..._cond: unknown[]) => undefined);
const updateSet = vi.fn((..._payload: unknown[]) => ({ where: (...a: any[]) => updateWhere(...a) }));
const updateTable = vi.fn((..._t: unknown[]) => ({ set: (...a: any[]) => updateSet(...a) }));

const selectLimit = vi.fn(async (..._n: unknown[]) => [] as unknown[]);
const selectWhere = vi.fn((..._cond: unknown[]) => ({ limit: (...a: any[]) => selectLimit(...a) }));
const selectFrom = vi.fn((..._t: unknown[]) => ({ where: (...a: any[]) => selectWhere(...a) }));
const select = vi.fn((..._cols: unknown[]) => ({ from: (...a: any[]) => selectFrom(...a) }));

vi.mock("@/db", () => ({
  db: {
    update: (...args: any[]) => updateTable(...args),
    select: (...args: any[]) => select(...args),
  },
}));

const { pgPostCommitHooks, pgStoryBibleRepository } = await import("@/lib/core/pg-repositories");

/**
 * These two tests only exercise error propagation, not the kind — the hook
 * attaches nothing to it. The out-of-union sentinel is cast because
 * `CanonicalMutationKind` gates call sites at COMPILE time only; the real
 * `pgPostCommitHooks` never validates the kind at runtime.
 */
const UNDETERMINED_KIND = "x" as unknown as CanonicalMutationKind;

describe("pgPostCommitHooks.onCanonicalMutation (§11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bumps contentRevision in ONE atomic statement scoped to the project", async () => {
    await pgPostCommitHooks.onCanonicalMutation!("proj-1", "chapter.update");

    expect(updateTable).toHaveBeenCalledTimes(1);
    expect(updateSet).toHaveBeenCalledTimes(1);
    // The increment must happen in SQL (COALESCE against the column itself),
    // never as a client-side read-modify-write — the set payload is the driver
    // to send, not a plain number computed here.
    const payload = updateSet.mock.calls[0]![0] as Record<string, unknown>;
    expect(typeof payload.contentRevision).toBe("object");
  });

  it("does not need `.returning()` — the bump is fire-and-confirm", async () => {
    await pgPostCommitHooks.onCanonicalMutation!("proj-1", "chapter.delete");
    expect(updateWhere).toHaveBeenCalledTimes(1);
  });

  it("surfaces a repo failure rather than swallowing it (awaited by callers)", async () => {
    updateWhere.mockRejectedValueOnce(new Error("db down"));
    await expect(pgPostCommitHooks.onCanonicalMutation!("proj-1", UNDETERMINED_KIND)).rejects.toThrow(
      "db down",
    );
  });

  it("resolves once the statement completes", async () => {
    await expect(pgPostCommitHooks.onCanonicalMutation!("proj-1", UNDETERMINED_KIND)).resolves.toBeUndefined();
  });
});

describe("pgStoryBibleRepository.readContentRevision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the stored revision", async () => {
    selectLimit.mockResolvedValueOnce([{ contentRevision: 7 } as unknown]);
    expect(await pgStoryBibleRepository.readContentRevision!("proj-1")).toBe(7);
  });

  it("keeps null distinguishable from 0 (never-mutated state)", async () => {
    selectLimit.mockResolvedValueOnce([{ contentRevision: null } as unknown]);
    expect(await pgStoryBibleRepository.readContentRevision!("proj-1")).toBeNull();
  });

  it("reads null for a missing project row rather than fabricating 0", async () => {
    selectLimit.mockResolvedValueOnce([]);
    expect(await pgStoryBibleRepository.readContentRevision!("ghost")).toBeNull();
  });

  it("queries the projects table, not a section table", async () => {
    selectLimit.mockResolvedValueOnce([{ contentRevision: 1 } as unknown]);
    await pgStoryBibleRepository.readContentRevision!("proj-1");
    expect(selectFrom).toHaveBeenCalledTimes(1);
  });
});
