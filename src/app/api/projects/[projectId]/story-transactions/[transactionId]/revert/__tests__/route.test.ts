import { describe, it, expect, vi, beforeEach } from "vitest";
import { MissingEntitiesError } from "@/lib/core/handlers/apply-story-transaction";

const getRequiredSessionFn = vi.fn();
const ownsProjectFn = vi.fn();
const listTransactionsFn = vi.fn();
const getTransactionFn = vi.fn();
const revertChangesFn = vi.fn();
const onCanonicalMutationFn = vi.fn();

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: (...args: any[]) => getRequiredSessionFn(...args),
}));

vi.mock("@/lib/core/pg-repositories", () => ({
  pgStoryTransactionRepository: {},
  pgStoryHistoryRepository: {
    ownsProject: (...args: any[]) => ownsProjectFn(...args),
    listTransactions: (...args: any[]) => listTransactionsFn(...args),
    getTransaction: (...args: any[]) => getTransactionFn(...args),
    revertChanges: (...args: any[]) => revertChangesFn(...args),
  },
  pgPostCommitHooks: { onCanonicalMutation: (...args: any[]) => onCanonicalMutationFn(...args) },
}));

const { POST } = await import("../route");

function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1", transactionId: "tx_1" }) };
}

function makeSummary(changes: unknown[]) {
  return {
    id: "tx_1",
    projectId: "proj-1",
    source: "model-proposal",
    createdAt: "2026-10-18T00:00:00.000Z",
    changes,
  };
}

const CHANGE = {
  entityKey: "characters",
  entityId: "c1",
  field: "desires",
  oldValue: "",
  newValue: "to win",
};

describe("POST /api/projects/[projectId]/story-transactions/[transactionId]/revert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequiredSessionFn.mockResolvedValue({ user: { id: "user-1" } });
    ownsProjectFn.mockResolvedValue(true);
    getTransactionFn.mockResolvedValue(null);
    revertChangesFn.mockResolvedValue([]);
  });

  it("200 — reverts every recorded field back to its old value and reports the transaction", async () => {
    const summary = makeSummary([CHANGE]);
    getTransactionFn.mockResolvedValue(summary);
    revertChangesFn.mockResolvedValue([]);

    const res = await POST(new Request("http://localhost", { method: "POST" }), makeParams());

    expect(res.status).toBe(200);
    const json = (await res.json()) as { transaction?: unknown };
    expect(json.transaction).toEqual(summary);
    expect(revertChangesFn).toHaveBeenCalledWith("proj-1", [CHANGE]);
  });

  it("§11 — a successful revert fires the canonical-mutation hook with the revert kind", async () => {
    const summary = makeSummary([CHANGE]);
    getTransactionFn.mockResolvedValue(summary);
    revertChangesFn.mockResolvedValue([]);

    const res = await POST(new Request("http://localhost", { method: "POST" }), makeParams());

    expect(res.status).toBe(200);
    expect(onCanonicalMutationFn).toHaveBeenCalledWith("proj-1", "storyTransaction.revert");
  });

  it("409 — a later edit moved a field: the WHOLE revert is refused, conflicts listed, hook never fires", async () => {
    const summary = makeSummary([CHANGE]);
    getTransactionFn.mockResolvedValue(summary);
    revertChangesFn.mockResolvedValue([
      { entityKey: "characters", entityId: "c1", field: "desires", current: "moved on" },
    ]);

    const res = await POST(new Request("http://localhost", { method: "POST" }), makeParams());

    expect(res.status).toBe(409);
    const json = (await res.json()) as { error?: string; conflicts?: { current?: string }[] };
    expect(json.error).toBe("Later edits conflict with this revert; nothing was changed.");
    expect(json.conflicts![0]!.current).toBe("moved on");
    expect(onCanonicalMutationFn).not.toHaveBeenCalled();
  });

  it("422 — an entity missing at the verify pass surfaces the typed `missing` list, hook never fires", async () => {
    const summary = makeSummary([CHANGE]);
    getTransactionFn.mockResolvedValue(summary);
    revertChangesFn.mockRejectedValue(
      new MissingEntitiesError(
        [{ entityKey: "characters", entityId: "c1" }],
        "revertChanges — nothing was reverted; entities not found in project proj-1",
      ),
    );

    const res = await POST(new Request("http://localhost", { method: "POST" }), makeParams());

    expect(res.status).toBe(422);
    const json = (await res.json()) as { error?: string; missing?: Array<{ entityId: string }> };
    expect(json.error).toBe("Some referenced entities no longer exist; nothing was reverted.");
    expect(json.missing![0]!.entityId).toBe("c1");
    expect(onCanonicalMutationFn).not.toHaveBeenCalled();
  });

  it("404 — unknown transaction (adapter returns null): nothing is reverted", async () => {
    getTransactionFn.mockResolvedValue(null);

    const res = await POST(new Request("http://localhost", { method: "POST" }), makeParams());

    expect(res.status).toBe(404);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe("Not found");
    expect(revertChangesFn).not.toHaveBeenCalled();
  });

  it("200 — no-op: a transaction with no changes reverts nothing and never fires the hook", async () => {
    const summary = makeSummary([]);
    getTransactionFn.mockResolvedValue(summary);

    const res = await POST(new Request("http://localhost", { method: "POST" }), makeParams());

    expect(res.status).toBe(200);
    const json = (await res.json()) as { transaction?: unknown };
    expect(json.transaction).toEqual(summary);
    expect(revertChangesFn).not.toHaveBeenCalled();
    expect(onCanonicalMutationFn).not.toHaveBeenCalled();
  });
});
