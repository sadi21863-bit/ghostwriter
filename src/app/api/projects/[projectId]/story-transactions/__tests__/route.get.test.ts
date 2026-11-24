import { describe, it, expect, vi, beforeEach } from "vitest";

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

const { GET } = await import("../route");

function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}

describe("GET /api/projects/[projectId]/story-transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequiredSessionFn.mockResolvedValue({ user: { id: "user-1" } });
    ownsProjectFn.mockResolvedValue(true);
    listTransactionsFn.mockResolvedValue([]);
  });

  it("200 — returns the recorded transactions with their changes intact", async () => {
    const change = {
      entityKey: "characters",
      entityId: "c1",
      field: "desires",
      oldValue: "",
      newValue: "to win",
    };
    const summary = {
      id: "tx_1",
      projectId: "proj-1",
      source: "model-proposal",
      createdAt: "2026-10-18T00:00:00.000Z",
      changes: [change],
    };
    listTransactionsFn.mockResolvedValue([summary]);

    const res = await GET(new Request("http://localhost"), makeParams());

    expect(res.status).toBe(200);
    const json = (await res.json()) as unknown;
    expect(json).toEqual({ transactions: [summary], count: 1 });
    expect(
      (json as { transactions: { changes: unknown[] }[] }).transactions[0]!.changes[0],
    ).toEqual(change);
  });

  it("404 — unknown project (ownership probe false): the list is never consulted", async () => {
    ownsProjectFn.mockResolvedValue(false);

    const res = await GET(new Request("http://localhost"), makeParams());

    expect(res.status).toBe(404);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe("Not found");
    expect(listTransactionsFn).not.toHaveBeenCalled();
  });

  it("500-class — the list read fails: the route surfaces the thrown repository error", async () => {
    listTransactionsFn.mockRejectedValue(new Error("db down"));

    await expect(GET(new Request("http://localhost"), makeParams())).rejects.toThrow("db down");
  });

  it("401-class — missing session: getRequiredSession throws before any read happens", async () => {
    getRequiredSessionFn.mockRejectedValueOnce(
      Object.assign(new Error("Unauthorized"), { status: 401 }),
    );

    await expect(GET(new Request("http://localhost"), makeParams())).rejects.toThrow("Unauthorized");
    expect(ownsProjectFn).not.toHaveBeenCalled();
    expect(listTransactionsFn).not.toHaveBeenCalled();
  });
});
