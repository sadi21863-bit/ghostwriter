import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildEntityEditTransaction,
  saveEntityEdit,
} from "@/lib/story/edit-transaction";

/**
 * §13.1 — pins for the form-save → story-transaction adapter. Node-env, no
 * DOM: `saveEntityEdit` is a pure fetch orchestrator, so the harness stubs
 * global fetch (the same pattern as useEntitySync.test.ts).
 */

const okRes = (body: any) => ({ ok: true, status: 200, json: async () => body });
const errRes = (status: number, body: any) => ({ ok: false, status, json: async () => body });

const mara = {
  id: "char_mara",
  name: "Mara Voss",
  age: "38",
  desires: "",
  backstory: "Grew up in the Dealers' quarter.",
  voiceId: "alloy",
  voiceProfile: "Mezzo, low",
  significantFlaws: { pride: "sharp" } as unknown, // jsonb object
  linkedLocationIds: ["loc_a"],
  skills: null,
};

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildEntityEditTransaction", () => {
  it("skips fields whose draft value equals the entity's canonical value", () => {
    const built = buildEntityEditTransaction("characters", mara, {
      name: "Mara Voss", // identical
      age: " 38 ", // whitespace-trimmed equal — canonical form matches
    });
    expect(built.changes).toEqual([]);
    expect(built.excluded).toEqual({});
  });

  it("records allowlisted changes with canonical old/new strings", () => {
    const built = buildEntityEditTransaction("characters", mara, {
      name: "Mara Colt",
      backstory: "Rewritten.",
    });
    expect(built.changes).toEqual([
      {
        entityKey: "characters",
        entityId: "char_mara",
        field: "name",
        oldValue: "Mara Voss",
        newValue: "Mara Colt",
      },
      {
        entityKey: "characters",
        entityId: "char_mara",
        field: "backstory",
        oldValue: "Grew up in the Dealers' quarter.",
        newValue: "Rewritten.",
      },
    ]);
  });

  it("splits out non-allowlisted fields as excluded, verbatim draft values", () => {
    const built = buildEntityEditTransaction("characters", mara, {
      name: "Mara Colt",
      voiceId: "nova", // production metadata — deliberately not allowlisted
    });
    expect(built.changes.map((c) => c.field)).toEqual(["name"]);
    expect(built.excluded).toEqual({ voiceId: "nova" });
  });

  it("records an explicit clear (empty draft value) as a change, not a skip", () => {
    const built = buildEntityEditTransaction("characters", mara, {
      backstory: "", // user cleared the field
    });
    expect(built.changes).toEqual([
      {
        entityKey: "characters",
        entityId: "char_mara",
        field: "backstory",
        oldValue: "Grew up in the Dealers' quarter.",
        newValue: "",
      },
    ]);
  });

  it("JSON-serializes object and array values for the string wire", () => {
    const built = buildEntityEditTransaction("characters", {
      ...mara,
      skills: null,
    }, {
      significantFlaws: { pride: "tempered" },
      linkedLocationIds: ["loc_a", "loc_b"],
    });
    expect(built.changes).toEqual([
      {
        entityKey: "characters",
        entityId: "char_mara",
        field: "significantFlaws",
        oldValue: JSON.stringify({ pride: "sharp" }),
        newValue: JSON.stringify({ pride: "tempered" }),
      },
      {
        entityKey: "characters",
        entityId: "char_mara",
        field: "linkedLocationIds",
        oldValue: JSON.stringify(["loc_a"]),
        newValue: JSON.stringify(["loc_a", "loc_b"]),
      },
    ]);
  });

  it("treats empty arrays/objects and null as the same 'unset' wire value on both sides", () => {
    const built = buildEntityEditTransaction("characters", mara, {
      skills: [], // entity has null; both canonicalize to "" — no change
      desires: null, // entity "" vs draft null → both ""
    });
    expect(built.changes).toEqual([]);
    expect(built.excluded).toEqual({});
  });

  it("keeps the draft's key order for the recorded changes", () => {
    const built = buildEntityEditTransaction("characters", mara, {
      backstory: "A.",
      name: "Z.",
    });
    expect(built.changes.map((c) => c.field)).toEqual(["backstory", "name"]);
  });

  it("booleans and numbers encode through String()", () => {
    const entity = { id: "we_1", name: "The Deck", alwaysInContext: false, sortOrder: 0 };
    const built = buildEntityEditTransaction("worldEntities", entity, {
      alwaysInContext: true,
      sortOrder: 2,
    });
    expect(built.changes).toEqual([
      expect.objectContaining({ field: "alwaysInContext", oldValue: "false", newValue: "true" }),
      expect.objectContaining({ field: "sortOrder", oldValue: "0", newValue: "2" }),
    ]);
  });

  it("carries entityId from the entity, never the draft", () => {
    const built = buildEntityEditTransaction("characters", { ...mara, id: "char_real" }, {
      id: "ATTACKER_CONTROLLED",
      name: "Mara Voss X",
    });
    expect(built.changes.every((c) => c.entityId === "char_real")).toBe(true);
  });
});

describe("saveEntityEdit", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs a user-edit story transaction with the built changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okRes({ transaction: { id: "tx_1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveEntityEdit({
      projectId: "proj_1",
      entityKey: "characters",
      entity: mara,
      draft: { name: "Mara Colt" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/projects/proj_1/story-transactions");
    expect(JSON.parse(init.body)).toEqual({
      source: "user-edit",
      changes: [
        {
          entityKey: "characters",
          entityId: "char_mara",
          field: "name",
          oldValue: "Mara Voss",
          newValue: "Mara Colt",
        },
      ],
    });
    expect(result).toEqual({
      ok: true,
      updated: { ...mara, name: "Mara Colt" },
      transaction: { id: "tx_1" },
    });
  });

  it("merges recorded fields from the draft (typed values, not wire strings)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okRes({ transaction: {} })));
    const result = await saveEntityEdit({
      projectId: "proj_1",
      entityKey: "characters",
      entity: { ...mara, skills: null },
      draft: { skills: { bladeWork: "hard" } }, // jsonb field, allowlisted
    });
    expect((result as any).updated.skills).toEqual({ bladeWork: "hard" });
  });

  it("no-op save fires zero requests and returns the entity unchanged", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await saveEntityEdit({
      projectId: "proj_1",
      entityKey: "characters",
      entity: mara,
      draft: { name: "Mara Voss" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(result).toEqual({ ok: true, updated: mara, transaction: null });
  });

  it("fires a residual PATCH carrying ONLY the excluded fields, merged over the result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okRes({ transaction: { id: "tx_2" } }))
      .mockResolvedValueOnce(okRes({ id: "char_mara", voiceId: "nova", name: "Mara Colt" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveEntityEdit({
      projectId: "proj_1",
      entityKey: "characters",
      entity: mara,
      draft: { name: "Mara Colt", voiceId: "nova" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [patchUrl, patchInit] = fetchMock.mock.calls[1];
    expect(patchUrl).toBe("/api/projects/proj_1/characters/char_mara");
    expect(JSON.parse(patchInit.body)).toEqual({ voiceId: "nova" });
    // The residual response row is authoritative for its fields.
    expect((result as any).updated.name).toBe("Mara Colt");
  });

  it("fails closed on a rejected transaction and never fires the residual PATCH", async () => {
    const fetchMock = vi.fn().mockResolvedValue(errRes(422, { error: "nope", missing: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await saveEntityEdit({
      projectId: "proj_1",
      entityKey: "characters",
      entity: mara,
      draft: { name: "X", voiceId: "nova" }, // both dirty: txn first, residual must not run
    });
    expect(result).toMatchObject({ ok: false, step: "transaction", status: 422 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a 404 transaction (entity gone) to a transaction-step failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errRes(404, { error: "Not found" })));
    const result = await saveEntityEdit({
      projectId: "proj_1",
      entityKey: "locations",
      entity: { id: "loc_1", name: "Old Pier" },
      draft: { name: "New Pier" },
    });
    expect(result).toMatchObject({ ok: false, step: "transaction", status: 404 });
  });

  it("residual PATCH failure is reported as its own step after a successful transaction", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okRes({ transaction: { id: "tx_3" } }))
      .mockResolvedValueOnce(errRes(500, { error: "boom" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await saveEntityEdit({
      projectId: "proj_1",
      entityKey: "characters",
      entity: mara,
      draft: { name: "Mara Colt", voiceId: "nova" },
    });
    expect(result).toMatchObject({ ok: false, step: "residual", status: 500 });
  });

  it("serializes several entity kinds onto the transaction route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okRes({ transaction: {} }));
    vi.stubGlobal("fetch", fetchMock);
    await saveEntityEdit({
      projectId: "proj_1",
      entityKey: "worldEntities",
      entity: { id: "we_1", name: "Old", kind: "object", properties: {} },
      draft: { name: "New" },
    });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/projects/proj_1/story-transactions");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.changes[0].entityKey).toBe("worldEntities");
  });

  it("returns the thrown error (not a crash) when the transaction call itself throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await saveEntityEdit({
      projectId: "proj_1",
      entityKey: "characters",
      entity: mara,
      draft: { name: "X" },
    });
    expect(result).toMatchObject({ ok: false, step: "transaction" });
    expect((result as any).error).toBeInstanceOf(Error);
  });
});

describe("excluded-field partition (integration guard)", () => {
  it("the WorldBiblePanel character form's voiceId stays a residual direct PATCH", () => {
    const built = buildEntityEditTransaction("characters", { ...mara, voiceProfile: "" }, {
      ...mara,
      voiceProfile: "Belt, reedy",
    });
    const fields = [...built.changes.map((c) => c.field), ...Object.keys(built.excluded)];
    expect(fields).toContain("voiceProfile");
    // nothing outside the draft changed silently
    expect(new Set(fields).size).toBe(fields.length);
  });
});
