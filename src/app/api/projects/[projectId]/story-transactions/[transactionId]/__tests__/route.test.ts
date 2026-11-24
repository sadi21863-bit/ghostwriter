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
  return { params: Promise.resolve({ projectId: "proj-1", transactionId: "tx_1" }) };
}

describe("GET /api/projects/[projectId]/story-transactions/[transactionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequiredSessionFn.mockResolvedValue({ user: { id: "user-1" } });
    ownsProjectFn.mockResolvedValue(true);
    getTransactionFn.mockResolvedValue(null);
  });

  it("200 — returns one recorded transaction with its changes", async () => {
    const summary = {
      id: "tx_1",
      projectId: "proj-1",
      source: "user-edit",
      createdAt: "2026-10-18T00:00:00.000Z",
      changes: [
        {
          entityKey: "characters",
          entityId: "c1",
          field: "desires",
          oldValue: "",
          newValue: "to win",
        },
      ],
    };
    getTransactionFn.mockResolvedValue(summary);

    const res = await GET(new Request("http://localhost"), makeParams());

    expect(res.status).toBe(200);
    const json = (await res.json()) as unknown;
    expect(json).toEqual({ transaction: summary });
    expect(getTransactionFn).toHaveBeenCalledWith("proj-1", "tx_1");
  });

  it("404 — unknown transaction (adapter returns null)", async () => {
    getTransactionFn.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost"), makeParams());

    expect(res.status).toBe(404);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe("Not found");
  });

  it("404 — not the caller's project (ownership probe false): the row is never read", async () => {
    ownsProjectFn.mockResolvedValue(false);

    const res = await GET(new Request("http://localhost"), makeParams());

    expect(res.status).toBe(404);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe("Not found");
    expect(getTransactionFn).not.toHaveBeenCalled();
  });
});
