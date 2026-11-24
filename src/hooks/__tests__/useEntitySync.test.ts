import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toastEmitter } from "@/lib/toast";
import type { EntitySuggestion } from "@/lib/ai/entity-extraction";
import { useEntitySync } from "@/hooks/useEntitySync";

/**
 * Node-env, no-RTL harness (matches the repo's "no RTL/jsdom" convention):
 * the hook's only React primitive is a single useState, so react is mocked
 * with a mutable-cell fake that honours functional updates. The fake does NOT
 * re-apply the hook's `[]` initial on mount — each test seeds cell.value in
 * beforeEach to represent chips left behind by a prior extraction run; letting
 * useState([]) run per mount would silently wipe that seed (and quietly
 * turned every "chip stays" test into a meaningless `[] === []` pass).
 * State is read through `cell.value`; accept/reject use functional setState
 * only, which keeps the cell authoritative. Toasts are captured via
 * toastEmitter (src/lib/toast is DOM-free) rather than a module mock.
 */
const { cell, useStateFake } = vi.hoisted(() => {
  const cell: { value: any } = { value: [] };
  const useStateFake = () => {
    const set = (update: any) => {
      cell.value = typeof update === "function" ? update(cell.value) : update;
    };
    return [cell.value, set] as const;
  };
  return { cell, useStateFake };
});

vi.mock("react", () => ({ useState: useStateFake }));

const mara = { id: "char_mara", name: "Mara Voss", age: "38", desires: "" };
const kessler = { id: "char_kessler", name: "Kessler", age: "51", desires: "" };

function makeProject() {
  return { id: "proj_1", characters: [mara, kessler], locations: [], plotThreads: [], worldEntities: [] };
}

const suggestion: EntitySuggestion = {
  type: "characters",
  entity: kessler,
  changes: [
    { field: "age", label: "Age", oldValue: "51", newValue: "49" },
    { field: "desires", label: "Want", oldValue: "", newValue: "to settle the debt" },
  ],
};

const okRes = (body: any) => ({ ok: true, status: 200, json: async () => body });
const errRes = (status: number, body: any) => ({ ok: false, status, json: async () => body });

let emitted: { type: string; message: string }[] = [];
let unsubscribe: (() => void) | undefined;

beforeEach(() => {
  cell.value = [suggestion]; // chip already emitted by a prior extraction run
  emitted = [];
  unsubscribe = toastEmitter.subscribe((t) => emitted.push({ type: t.type, message: t.message }));
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = undefined;
  vi.unstubAllGlobals();
});

describe("useEntitySync.acceptEntitySuggestion", () => {
  it("POSTs one user-edit story transaction with the suggestion's changes mapped verbatim", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okRes({ transaction: { id: "tx_1" } }));
    vi.stubGlobal("fetch", fetchMock);
    const onUpdate = vi.fn();
    const { acceptEntitySuggestion } = useEntitySync({ project: makeProject(), updateProject: onUpdate });

    await acceptEntitySuggestion(suggestion);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/projects/proj_1/story-transactions");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({
      source: "user-edit",
      changes: [
        { entityKey: "characters", entityId: "char_kessler", field: "age", oldValue: "51", newValue: "49" },
        { entityKey: "characters", entityId: "char_kessler", field: "desires", oldValue: "", newValue: "to settle the debt" },
      ],
    });
  });

  it("on success applies the changes to the matching entity locally and removes the chip", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okRes({ transaction: { id: "tx_1" } })));
    const onUpdate = vi.fn();
    const project = makeProject();
    const { acceptEntitySuggestion } = useEntitySync({ project, updateProject: onUpdate });

    await acceptEntitySuggestion(suggestion);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const next = onUpdate.mock.calls[0][0](project);
    expect(next.characters[1]).toEqual({
      id: "char_kessler", name: "Kessler", age: "49", desires: "to settle the debt",
    });
    expect(next.characters[0]).toBe(mara); // untouched entities keep their reference
    expect(next.id).toBe("proj_1");
    expect(cell.value).toEqual([]); // chip removed
  });

  it("keeps the chip and toasts on a generic server failure, with no local mutation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errRes(500, { error: "boom" })));
    const onUpdate = vi.fn();
    const project = makeProject();
    const { acceptEntitySuggestion } = useEntitySync({ project, updateProject: onUpdate });

    await acceptEntitySuggestion(suggestion);

    expect(onUpdate).not.toHaveBeenCalled();
    expect(cell.value).toEqual([suggestion]); // chip stays
    expect(emitted).toEqual([
      { type: "error", message: "Couldn't save that update — please try again." },
    ]);
  });

  it("treats an unparseable error body as a generic failure (chip stays + toast)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, status: 500, json: async () => { throw new SyntaxError("Unexpected token"); },
    }));
    const onUpdate = vi.fn();
    const project = makeProject();
    const { acceptEntitySuggestion } = useEntitySync({ project, updateProject: onUpdate });

    await acceptEntitySuggestion(suggestion);

    expect(onUpdate).not.toHaveBeenCalled();
    expect(cell.value).toEqual([suggestion]); // chip stays
    expect(emitted).toEqual([
      { type: "error", message: "Couldn't save that update — please try again." },
    ]);
  });

  it("drops the chip silently on 404 (entity/project gone): no toast, no local mutation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errRes(404, { error: "Not found" })));
    const onUpdate = vi.fn();
    const { acceptEntitySuggestion } = useEntitySync({ project: makeProject(), updateProject: onUpdate });

    await acceptEntitySuggestion(suggestion);

    expect(onUpdate).not.toHaveBeenCalled();
    expect(cell.value).toEqual([]);
    expect(emitted).toEqual([]);
  });

  it("drops the chip silently on 422 with a missing[] body (stale-entity semantics)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      errRes(422, { error: "Missing entity", missing: [{ entityKey: "characters", entityId: "char_kessler" }] }),
    ));
    const onUpdate = vi.fn();
    const { acceptEntitySuggestion } = useEntitySync({ project: makeProject(), updateProject: onUpdate });

    await acceptEntitySuggestion(suggestion);

    expect(onUpdate).not.toHaveBeenCalled();
    expect(cell.value).toEqual([]);
    expect(emitted).toEqual([]);
  });

  it("keeps the chip and toasts on 422 with rejected[] but no missing[]", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      errRes(422, { error: "Invalid transaction", rejected: [{ entityKey: "characters", entityId: "char_kessler", field: "id", oldValue: "", newValue: "x" }] }),
    ));
    const onUpdate = vi.fn();
    const { acceptEntitySuggestion } = useEntitySync({ project: makeProject(), updateProject: onUpdate });

    await acceptEntitySuggestion(suggestion);

    expect(onUpdate).not.toHaveBeenCalled();
    expect(cell.value).toEqual([suggestion]);
    expect(emitted).toEqual([
      { type: "error", message: "Couldn't save that update — please try again." },
    ]);
  });

  it("keeps the chip and toasts when fetch itself rejects (network throw)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const onUpdate = vi.fn();
    const { acceptEntitySuggestion } = useEntitySync({ project: makeProject(), updateProject: onUpdate });

    await acceptEntitySuggestion(suggestion);

    expect(onUpdate).not.toHaveBeenCalled();
    expect(cell.value).toEqual([suggestion]);
    expect(emitted).toEqual([
      { type: "error", message: "Couldn't save that update — please try again." },
    ]);
  });
});
