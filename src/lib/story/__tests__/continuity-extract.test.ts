import { describe, expect, it } from "vitest";
import {
  openPromisesFrom,
  parseContinuityNotes,
  type ContinuityMemory,
} from "@/lib/story/continuity-extract";

/**
 * The extractor is the bridge between generated prose and the Doctor's
 * structured inputs. These pins cover the wrapper noise models actually emit
 * (code fences, a lead-in sentence), the required shift fields, and the
 * "nothing usable" fallback contract.
 */

describe("parseContinuityNotes", () => {
  it("parses a bare JSON object", () => {
    const out = parseContinuityNotes(
      JSON.stringify({
        knowledgeShifts: [
          { character: "Mara", learned: "the key opens the gate", from: "IGNORANT", to: "KNOWS" },
        ],
        openPromisesCreated: ["The brass key must be returned"],
        openPromisesResolved: ["The canal gate stays locked"],
        keyEvents: ["Mara opens the gate"],
      }),
    );
    expect(out).toEqual({
      knowledgeShifts: [
        { character: "Mara", learned: "the key opens the gate", from: "IGNORANT", to: "KNOWS" },
      ],
      openPromisesCreated: ["The brass key must be returned"],
      openPromisesResolved: ["The canal gate stays locked"],
      keyEvents: ["Mara opens the gate"],
    });
  });

  it("finds the object inside code fences and surrounding prose", () => {
    const raw = [
      "Here is the continuity note:",
      "```json",
      '{"openPromisesCreated":["A debt is called in"],"keyEvents":["Ivo collects"]}',
      "```",
      "Done.",
    ].join("\n");
    expect(parseContinuityNotes(raw)).toEqual({
      openPromisesCreated: ["A debt is called in"],
      openPromisesResolved: [],
      knowledgeShifts: [],
      keyEvents: ["Ivo collects"],
    });
  });

  it("drops malformed shifts and defaults the from/to pair", () => {
    const out = parseContinuityNotes(
      JSON.stringify({
        knowledgeShifts: [
          { character: "Sera", learned: "Ivo owns the debt" },
          { character: "", learned: "nothing" },
          { character: "Ivo", learned: "" },
          "not an object",
          null,
        ],
        openPromisesCreated: ["Ivo's name is in the ledger"],
      }),
    );
    expect(out?.knowledgeShifts).toEqual([
      { character: "Sera", learned: "Ivo owns the debt", from: "IGNORANT", to: "KNOWS" },
    ]);
  });

  it("preserves an explicit from/to pair", () => {
    const out = parseContinuityNotes(
      JSON.stringify({
        knowledgeShifts: [
          { character: "Pell", learned: "the sea keeps the balance", from: "DENIES", to: "ACCEPTS" },
        ],
      }),
    );
    expect(out?.knowledgeShifts[0]).toEqual({
      character: "Pell",
      learned: "the sea keeps the balance",
      from: "DENIES",
      to: "ACCEPTS",
    });
  });

  it("trims, drops blanks and caps each list", () => {
    const out = parseContinuityNotes(
      JSON.stringify({
        openPromisesCreated: ["  one  ", "", "   ", 42, null, "two"],
        keyEvents: Array.from({ length: 12 }, (_, i) => `event ${i + 1}`),
      }),
    );
    expect(out?.openPromisesCreated).toEqual(["one", "two"]);
    expect(out?.keyEvents).toHaveLength(8);
    expect(out?.keyEvents[7]).toBe("event 8");
  });

  it("returns null when the JSON is absent, broken, or all-empty", () => {
    expect(parseContinuityNotes("")).toBeNull();
    expect(parseContinuityNotes("no json here")).toBeNull();
    expect(parseContinuityNotes("{not json}")).toBeNull();
    expect(parseContinuityNotes("[]")).toBeNull();
    expect(parseContinuityNotes('{"openPromisesCreated":[]}')).toBeNull();
    expect(
      parseContinuityNotes(
        '{"knowledgeShifts":[{"character":"","learned":""}],"keyEvents":["   "]}',
      ),
    ).toBeNull();
  });
});

describe("openPromisesFrom", () => {
  const memory = (
    chapterIndex: number,
    created: string[],
    resolved: string[] = [],
  ): ContinuityMemory => ({
    chapterIndex,
    structuredData: { openPromisesCreated: created, openPromisesResolved: resolved },
  });

  it("walks memories in order and drops exactly-resolved promises", () => {
    const memories = [
      memory(0, ["The brass key must be returned", "The canal gate stays locked"]),
      memory(1, [], ["The brass key must be returned"]),
    ];
    expect(openPromisesFrom(memories)).toEqual(["The canal gate stays locked"]);
  });

  it("uses the Doctor's fuzzy close rule in both directions", () => {
    expect(
      openPromisesFrom([
        memory(0, ["Mara returns the brass key to the canal gate"]),
        memory(1, [], ["returns the brass key"]),
      ]),
    ).toEqual([]);
    expect(
      openPromisesFrom([
        memory(0, ["The brass key"]),
        memory(1, [], ["The brass key was returned at dusk"]),
      ]),
    ).toEqual([]);
  });

  it("keeps duplicates once and ignores missing structured data", () => {
    const memories: ContinuityMemory[] = [
      memory(0, ["A debt is called in"]),
      memory(1, ["A debt is called in"]),
      { chapterIndex: 2, structuredData: null },
      { chapterIndex: 3 },
    ];
    expect(openPromisesFrom(memories)).toEqual(["A debt is called in"]);
  });

  it("keeps a setup open when no resolution was recorded", () => {
    expect(openPromisesFrom([memory(0, ["Neve's line must be moved off her"])])).toEqual([
      "Neve's line must be moved off her",
    ]);
    expect(openPromisesFrom([])).toEqual([]);
  });
});
