import { describe, it, expect, vi } from "vitest";

/**
 * §13.1 mirror gate — the mechanical contract between the allowlist and the
 * write pass. `DIFF_FIELDS` (src/lib/ai/entity-extraction.ts) is the single
 * source of truth for what a transaction may write; `ENTITY_TABLES`
 * (pg-repositories.ts) is the apply/revert projection of it onto real drizzle
 * columns. Nothing keeps those in sync structurally, so this file insists:
 *
 *  1. per entity, DIFF_FIELDS and ENTITY_TABLES.columns are the EXACT same set
 *     (zero deliberate non-mirrors — by design the allowlist no longer carries
 *     production metadata, so every writable field has a backing column);
 *  2. every mirrored column carries a dataType the wire codec can decode;
 *  3. the codec's shape rules hold per kind (string / boolean / number / jsonb)
 *     with round-trips, absence-as-NULL behaviour, and typed (never
 *     SyntaxError) failures on malformed wire values.
 */

vi.mock("@/db", () => ({
  db: {
    query: { projects: { findFirst: async () => undefined } },
    batch: async () => [],
    select: () => ({ from: async () => [] }),
    update: () => ({ set: () => ({ where: async () => [] }) }),
    insert: () => ({ values: () => ({}) }),
  },
}));

const { ENTITY_TABLES, decodeChangeValue, encodeChangeValue } = await import(
  "@/lib/core/pg-repositories"
);
import { DIFF_FIELDS, type EntityKey } from "@/lib/ai/entity-extraction";
import { characters, locations, plotThreads, worldEntities } from "@/db/schema";

const ENTITY_KEYS = Object.keys(DIFF_FIELDS) as EntityKey[];

describe("ENTITY_TABLES mirrors DIFF_FIELDS exactly", () => {
  it("per entity: every allowlisted field has a real column map and nothing else", () => {
    expect(Object.keys(ENTITY_TABLES).sort()).toEqual([...ENTITY_KEYS].sort());
    for (const key of ENTITY_KEYS) {
      const mapped = Object.keys(ENTITY_TABLES[key]!.columns).sort();
      const allowed = DIFF_FIELDS[key].map((f) => f.field).sort();
      // Exact set equality — no exceptions allowlist exists or is needed.
      expect(mapped).toEqual(allowed);
    }
  });

  it("pins the allowlist sizes a mirror edit would silently drift (characters 65, locations 6, plotThreads 5, worldEntities 11)", () => {
    expect(DIFF_FIELDS.characters).toHaveLength(65);
    expect(DIFF_FIELDS.locations).toHaveLength(6);
    expect(DIFF_FIELDS.plotThreads).toHaveLength(5);
    // 11, not 12: name, kind, summary, description, properties, alwaysInContext,
    // sortOrder, and the four linked*Ids arrays.
    expect(DIFF_FIELDS.worldEntities).toHaveLength(11);
  });

  it("every mapped column carries a dataType the wire codec knows how to decode", () => {
    for (const key of ENTITY_KEYS) {
      for (const field of Object.keys(ENTITY_TABLES[key]!.columns)) {
        const dataType = ENTITY_TABLES[key]!.columns[field]?.dataType;
        expect(
          ["string", "boolean", "number", "json"],
          `${key}.${field} must mirror a decodable column, not dataType "${String(dataType)}"`,
        ).toContain(dataType);
      }
    }
  });

  it("pins schema truth where the field name misleads a reader", () => {
    // age is a TEXT column (verified against src/db/schema.ts), so it decodes
    // as a string — NOT integer.
    expect(characters.age.dataType).toBe("string");
    expect(ENTITY_TABLES.characters!.columns.age).toBe(characters.age);
    // contextVisibility is varchar(20), NOT boolean.
    expect(characters.contextVisibility.dataType).toBe("string");
    expect(ENTITY_TABLES.characters!.columns.contextVisibility).toBe(characters.contextVisibility);
    // And the genuinely kinded columns: discriminator/status/relation columns
    // by real runtime type.
    expect(ENTITY_TABLES.characters!.columns.antagonistToggle.dataType).toBe("boolean");
    expect(ENTITY_TABLES.worldEntities!.columns.sortOrder.dataType).toBe("number");
    expect(ENTITY_TABLES.worldEntities!.columns.properties.dataType).toBe("json");
    expect(ENTITY_TABLES.locations!.columns.linkedCharacterIds.dataType).toBe("json");
  });
});

describe("decodeChangeValue per column kind", () => {
  it("string columns decode verbatim: the name example stays byte-identical", () => {
    const col = ENTITY_TABLES.characters!.columns.name;
    expect(col.dataType).toBe("string");
    expect(decodeChangeValue(col, "Ember Prime")).toBe("Ember Prime");
  });

  it("booleans decode only from 'true'/'false' on a boolean column", () => {
    const col = ENTITY_TABLES.worldEntities!.columns.alwaysInContext;
    expect(decodeChangeValue(col, "true")).toBe(true);
    expect(decodeChangeValue(col, "false")).toBe(false);
    expect(decodeChangeValue(ENTITY_TABLES.characters!.columns.antagonistToggle, "false")).toBe(
      false,
    );
  });

  it("an empty wire is absence: strings restore '', every other kind restores SQL NULL", () => {
    expect(decodeChangeValue(ENTITY_TABLES.characters!.columns.name, "")).toBe("");
    expect(decodeChangeValue(ENTITY_TABLES.worldEntities!.columns.alwaysInContext, "")).toBeNull();
    expect(decodeChangeValue(ENTITY_TABLES.worldEntities!.columns.sortOrder, "")).toBeNull();
    expect(decodeChangeValue(ENTITY_TABLES.worldEntities!.columns.properties, "")).toBeNull();
  });

  it("boolean junk ('1', 'yes') throws a typed describable error, never a guessed value", () => {
    const col = ENTITY_TABLES.worldEntities!.columns.alwaysInContext;
    expect(() => decodeChangeValue(col, "1", "applyChanges: field \"alwaysInContext\"")).toThrow(
      /applyChanges: field "alwaysInContext".*must decode from its boolean shape.*"1"/,
    );
    try {
      decodeChangeValue(col, "yes");
      expect.unreachable("decode must throw for junk");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as SyntaxError).constructor).not.toBe(SyntaxError);
    }
  });

  it("integers decode from numeric strings into native numbers", () => {
    const decoded = decodeChangeValue(ENTITY_TABLES.worldEntities!.columns.sortOrder, "7");
    expect(decoded).toBe(7);
    expect(typeof decoded).toBe("number");
  });

  it("integer junk ('three') throws the typed error", () => {
    expect(() =>
      decodeChangeValue(ENTITY_TABLES.worldEntities!.columns.sortOrder, "three", "revertChanges"),
    ).toThrow(/must decode from its number shape.*"three"/);
  });

  it("jsonb objects round-trip: object → JSON.stringify wire → decode → the same object", () => {
    const col = ENTITY_TABLES.worldEntities!.columns.properties;
    const value = { tier: "rare", origins: ["myth"], engraving: { script: "cuneiform" } };
    const wire = JSON.stringify(value);
    expect(decodeChangeValue(col, wire)).toEqual(value);
    const knowledge = { knows: { "the Heist": true } };
    expect(
      decodeChangeValue(ENTITY_TABLES.characters!.columns.knowledgeMap, JSON.stringify(knowledge)),
    ).toEqual(knowledge);
  });

  it("link arrays round-trip as native string arrays", () => {
    const value = ["l1", "l2"];
    expect(decodeChangeValue(ENTITY_TABLES.characters!.columns.linkedLocationIds, '["l1","l2"]')).toEqual(value);
    expect(
      decodeChangeValue(ENTITY_TABLES.worldEntities!.columns.linkedEntityIds, '["l1"]'),
    ).toEqual(["l1"]);
  });

  it("malformed JSON on a jsonb column throws the typed shape error, NOT a raw SyntaxError", () => {
    const col = ENTITY_TABLES.characters!.columns.significantFlaws;
    expect(() => decodeChangeValue(col, "{not-json")).toThrow(/must decode from its json shape/);
    try {
      decodeChangeValue(col, "[1,2");
      expect.unreachable("decode must throw for malformed JSON");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      // The guard exists precisely to stop the raw parse crash from surfacing.
      expect((err as Error).constructor).not.toBe(SyntaxError);
    }
  });

  it("every allowlisted field of every entity decodes a sample wire of its own kind without throwing", () => {
    const sampleOf: Record<string, string> = {
      string: "sample",
      boolean: "false",
      number: "1",
      json: '{"k":["v"]}',
    };
    for (const key of ENTITY_KEYS) {
      for (const field of Object.keys(ENTITY_TABLES[key]!.columns)) {
        const col = ENTITY_TABLES[key]!.columns[field];
        const value = decodeChangeValue(col, sampleOf[col.dataType as string] ?? "", `${key}.${field}`);
        if (col.dataType === "string") expect(value).toBe("sample");
      }
    }
  });
});

describe("encodeChangeValue (revert/conflict comparison side)", () => {
  it("a boolean column encodes to the audit's canonical 'true'/'false' wire, so old audit strings compare equal", () => {
    const col = ENTITY_TABLES.worldEntities!.columns.alwaysInContext;
    expect(encodeChangeValue(col, true)).toBe("true");
    expect(encodeChangeValue(col, false)).toBe("false");
    // The exact alignment this pass exists for: live true vs recorded "true".
    expect(encodeChangeValue(col, decodeChangeValue(col, "true"))).toBe("true");
    expect(encodeChangeValue(col, decodeChangeValue(col, "false"))).toBe("false");
  });

  it("null/undefined encodes to '' — matching the audit's recorded-absence canonical form", () => {
    expect(encodeChangeValue(ENTITY_TABLES.worldEntities!.columns.alwaysInContext, null)).toBe("");
    expect(encodeChangeValue(ENTITY_TABLES.characters!.columns.arc, undefined)).toBe("");
    expect(encodeChangeValue(ENTITY_TABLES.worldEntities!.columns.properties, null)).toBe("");
  });

  it("jsonb link arrays encode back to the JSON wire (and empty shapes to '')", () => {
    expect(encodeChangeValue(ENTITY_TABLES.characters!.columns.linkedLocationIds, ["l1", "l2"]))
      .toBe('["l1","l2"]');
    expect(encodeChangeValue(ENTITY_TABLES.worldEntities!.columns.linkedEntityIds, [])).toBe("");
    expect(encodeChangeValue(ENTITY_TABLES.worldEntities!.columns.properties, {})).toBe("");
  });

  it("revert-verify discipline end to end: decode(wire) → write → encode(dt) === wire", () => {
    const properties = { tier: "rare" };
    const wire = JSON.stringify(properties);
    const stored = decodeChangeValue(ENTITY_TABLES.worldEntities!.columns.properties, wire);
    expect(encodeChangeValue(ENTITY_TABLES.worldEntities!.columns.properties, stored)).toBe(wire);
  });
});
