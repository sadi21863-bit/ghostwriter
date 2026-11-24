import { beforeEach, describe, expect, it, vi } from "vitest";
import { cloudContext } from "@/lib/core/request-context";
import { MissingEntitiesError } from "@/lib/core/handlers/apply-story-transaction";
import {
  getStoryTransaction,
  listStoryTransactions,
  revertStoryTransaction,
  type StoryHistoryRepository,
  type StoryTransactionSummary,
} from "@/lib/core/handlers/story-history";

/**
 * §13.1 slice 2 — handler contract for the audit/revert unions. Route tests
 * drive these through the Next adapters; this file pins the handler's own
 * auth/scoping branches (403/404) and the revert decision tree (hook only on
 * real change, 409 with conflicts passed through) that route tests cannot
 * reach, since Next sessions never carry a projectScope.
 */
const repo = (): StoryHistoryRepository => ({
  ownsProject: vi.fn(async () => true),
  listTransactions: vi.fn(async () => []),
  getTransaction: vi.fn(async () => null),
  revertChanges: vi.fn(async () => []),
});

const hook = () => ({ onCanonicalMutation: vi.fn(async () => {}) });

const summary = (commands?: {
  id?: string;
  changes?: Array<{
    entityKey: "characters";
    entityId: string;
    field: string;
    oldValue: string;
    newValue: string;
  }>;
}): StoryTransactionSummary =>
  ({
    id: commands?.id ?? "tx_1",
    source: "model-proposal" as const,
    createdAt: new Date(0),
    changes:
      commands?.changes ??
      [
        {
          entityKey: "characters" as const,
          entityId: "c1",
          field: "desires",
          oldValue: "",
          newValue: "escape",
        },
      ],
  }) as StoryTransactionSummary;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listStoryTransactions", () => {
  it("403s when the context is scoped to another project", async () => {
    const r = repo();
    const out = await listStoryTransactions(
      cloudContext("u1", { projectScope: "p2" }),
      { projectId: "p1" },
      r,
    );
    expect(out).toEqual({
      ok: false,
      status: 403,
      reason: "Context is not scoped to this project.",
    });
    expect(vi.mocked(r.ownsProject).mock.calls.length).toBe(0);
    expect(vi.mocked(r.listTransactions).mock.calls.length).toBe(0);
  });

  it("404s when the actor does not own the project", async () => {
    const r = repo();
    vi.mocked(r.ownsProject).mockResolvedValue(false);
    const out = await listStoryTransactions(cloudContext("u1"), { projectId: "p1" }, r);
    expect(out).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(vi.mocked(r.listTransactions).mock.calls.length).toBe(0);
  });

  it("returns the audit read with a count", async () => {
    const r = repo();
    const txs = [summary(), summary({ id: "tx_2" })];
    vi.mocked(r.listTransactions).mockResolvedValue(txs);
    const out = await listStoryTransactions(cloudContext("u1"), { projectId: "p1" }, r);
    expect(out).toEqual({ ok: true, transactions: txs, count: 2 });
  });
});

describe("getStoryTransaction", () => {
  it("403s when scoped elsewhere", async () => {
    const r = repo();
    const out = await getStoryTransaction(
      cloudContext("u1", { projectScope: "p2" }),
      { projectId: "p1", transactionId: "tx_1" },
      r,
    );
    expect(out).toMatchObject({ ok: false, status: 403 });
    expect(vi.mocked(r.getTransaction).mock.calls.length).toBe(0);
  });

  it("404s on a transaction outside this project", async () => {
    const r = repo();
    const out = await getStoryTransaction(
      cloudContext("u1"),
      { projectId: "p1", transactionId: "tx_404" },
      r,
    );
    expect(out).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(vi.mocked(r.getTransaction).mock.calls[0]).toEqual(["p1", "tx_404"]);
  });

  it("returns the transaction when found", async () => {
    const r = repo();
    vi.mocked(r.getTransaction).mockResolvedValue(summary());
    const out = await getStoryTransaction(
      cloudContext("u1"),
      { projectId: "p1", transactionId: "tx_1" },
      r,
    );
    expect(out).toEqual({ ok: true, transaction: summary() });
  });
});

describe("revertStoryTransaction", () => {
  it("403s when scoped elsewhere and stops before any mutation", async () => {
    const r = repo();
    const out = await revertStoryTransaction(
      cloudContext("u1", { projectScope: "p2" }),
      { projectId: "p1", transactionId: "tx_1" },
      r,
      hook(),
    );
    expect(out).toMatchObject({ ok: false, status: 403 });
    expect(vi.mocked(r.getTransaction).mock.calls.length).toBe(0);
    expect(vi.mocked(r.revertChanges).mock.calls.length).toBe(0);
  });

  it("404s for a non-owner before reading the transaction", async () => {
    const r = repo();
    vi.mocked(r.ownsProject).mockResolvedValue(false);
    const out = await revertStoryTransaction(
      cloudContext("u1"),
      { projectId: "p1", transactionId: "tx_1" },
      r,
    );
    expect(out).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(vi.mocked(r.getTransaction).mock.calls.length).toBe(0);
  });

  it("404s on an unknown transaction without attempting a revert", async () => {
    const r = repo();
    const out = await revertStoryTransaction(
      cloudContext("u1"),
      { projectId: "p1", transactionId: "tx_404" },
      r,
      hook(),
    );
    expect(out).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(vi.mocked(r.revertChanges).mock.calls.length).toBe(0);
  });

  it("reverting an empty transaction is a no-op that fires no hook", async () => {
    const r = repo();
    const hooks = hook();
    vi.mocked(r.getTransaction).mockResolvedValue(summary({ changes: [] }));
    const out = await revertStoryTransaction(
      cloudContext("u1"),
      { projectId: "p1", transactionId: "tx_1" },
      r,
      hooks,
    );
    expect(out).toEqual({ ok: true, transaction: summary({ changes: [] }) });
    expect(vi.mocked(r.revertChanges).mock.calls.length).toBe(0);
    expect(vi.mocked(hooks.onCanonicalMutation!).mock.calls.length).toBe(0);
  });

  it("reverts, echoes the transaction, and fires the canonical-mutation hook", async () => {
    const r = repo();
    const hooks = hook();
    vi.mocked(r.getTransaction).mockResolvedValue(summary());
    vi.mocked(r.revertChanges).mockResolvedValue([]);
    const out = await revertStoryTransaction(
      cloudContext("u1"),
      { projectId: "p1", transactionId: "tx_1" },
      r,
      hooks,
    );
    expect(out).toEqual({ ok: true, transaction: summary() });
    expect(vi.mocked(r.revertChanges).mock.calls[0]).toEqual([
      "p1",
      summary().changes,
    ]);
    expect(vi.mocked(hooks.onCanonicalMutation!).mock.calls).toEqual([["p1", "storyTransaction.revert"]]);
  });

  it("refuses the whole revert with 409 + conflicts and fires no hook on drift", async () => {
    const r = repo();
    const hooks = hook();
    const conflicts = [
      { entityKey: "characters" as const, entityId: "c1", field: "desires", current: "moved on" },
    ];
    vi.mocked(r.getTransaction).mockResolvedValue(summary());
    vi.mocked(r.revertChanges).mockResolvedValue(conflicts);
    const out = await revertStoryTransaction(
      cloudContext("u1"),
      { projectId: "p1", transactionId: "tx_1" },
      r,
      hooks,
    );
    expect(out).toEqual({
      ok: false,
      status: 409,
      reason: "Later edits conflict with this revert; nothing was changed.",
      conflicts,
    });
    expect(vi.mocked(hooks.onCanonicalMutation!).mock.calls.length).toBe(0);
  });

  it("maps the typed missing-entities failure to a 422 with the missing refs and fires no hook", async () => {
    // Same typed outcome as the apply path's pre-check: the verify pass found
    // the entity gone, so nothing was reverted and canon did not move.
    const r = repo();
    const hooks = hook();
    vi.mocked(r.getTransaction).mockResolvedValue(summary());
    vi.mocked(r.revertChanges).mockRejectedValue(
      new MissingEntitiesError(
        [{ entityKey: "characters", entityId: "c9" }],
        "revertChanges — entities not found in project p1",
      ),
    );
    const out = await revertStoryTransaction(
      cloudContext("u1"),
      { projectId: "p1", transactionId: "tx_1" },
      r,
      hooks,
    );
    expect(out).toEqual({
      ok: false,
      status: 422,
      reason: "Some referenced entities no longer exist; nothing was reverted.",
      missing: [{ entityKey: "characters", entityId: "c9" }],
    });
    expect(vi.mocked(hooks.onCanonicalMutation!).mock.calls.length).toBe(0);
  });

  it("re-throws a non-typed revert failure — only MissingEntitiesError is the 422", async () => {
    // The vanish-between-check-and-write race is a plain thrown error and
    // must stay a 500-class fault, not masquerade as an expected outcome.
    const r = repo();
    vi.mocked(r.getTransaction).mockResolvedValue(summary());
    vi.mocked(r.revertChanges).mockRejectedValue(new Error("db down"));
    await expect(
      revertStoryTransaction(cloudContext("u1"), { projectId: "p1", transactionId: "tx_1" }, r),
    ).rejects.toThrow("db down");
  });
});
