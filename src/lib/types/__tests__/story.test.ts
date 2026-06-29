import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  decodeAIRules, encodeAIRules,
  decodeKnowledgeMap, encodeKnowledgeMap,
  decodeIntelligenceProfile, encodeIntelligenceProfile,
  decodeCharacterSkills, encodeCharacterSkills,
  decodeMemoryStructuredData, encodeMemoryStructuredData,
  decodeStoryBeats, encodeStoryBeats,
} from "../story";

// decode = lenient (DB reads may be legacy/corrupt): never throws, drops bad
// elements, falls back to a sensible default, logs.
// encode = strict (writes): validates + normalizes (strips unknown keys), throws on invalid.

describe("decodeAIRules", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); });

  it("returns valid rules unchanged", () => {
    const rules = [{ id: "r1", text: "No adverbs", source: "user" }, { id: "r2", text: "Show don't tell", source: "genre" }];
    expect(decodeAIRules(rules)).toEqual(rules);
  });

  it("drops malformed rules but keeps the valid ones (one bad rule doesn't nuke the list)", () => {
    const raw = [
      { id: "r1", text: "Keep this", source: "user" },
      { id: "r2" }, // missing text
      "not even an object",
    ];
    const result = decodeAIRules(raw);
    expect(result).toEqual([{ id: "r1", text: "Keep this", source: "user" }]);
    expect(warn).toHaveBeenCalled();
  });

  it("falls back to [] for non-array / null / undefined input", () => {
    expect(decodeAIRules(null)).toEqual([]);
    expect(decodeAIRules(undefined)).toEqual([]);
    expect(decodeAIRules("oops")).toEqual([]);
    expect(decodeAIRules({})).toEqual([]);
  });

  it("coerces an unknown source value to 'user' rather than dropping the rule", () => {
    const result = decodeAIRules([{ id: "r1", text: "t", source: "banana" }]);
    expect(result).toEqual([{ id: "r1", text: "t", source: "user" }]);
  });
});

describe("encodeAIRules", () => {
  it("validates and strips unknown keys", () => {
    const result = encodeAIRules([{ id: "r1", text: "t", source: "user", junk: 123 }]);
    expect(result).toEqual([{ id: "r1", text: "t", source: "user" }]);
  });

  it("throws on a structurally invalid rule (a write-side caller bug)", () => {
    expect(() => encodeAIRules([{ id: "r1" }])).toThrow();
    expect(() => encodeAIRules("nope" as unknown)).toThrow();
  });
});

describe("decodeKnowledgeMap / encodeKnowledgeMap", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); });

  it("keeps valid entries and drops invalid ones", () => {
    const raw = {
      e1: { state: "KNOWS", entityType: "character", entityName: "Mara" },
      e2: { state: "BOGUS_STATE", entityType: "character", entityName: "X" },
    };
    const result = decodeKnowledgeMap(raw);
    expect(result.e1).toEqual({ state: "KNOWS", entityType: "character", entityName: "Mara" });
    expect(result.e2).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it("falls back to {} for non-object input", () => {
    expect(decodeKnowledgeMap(null)).toEqual({});
    expect(decodeKnowledgeMap([])).toEqual({});
  });

  it("encode strips unknown keys and throws on invalid", () => {
    const ok = encodeKnowledgeMap({ e1: { state: "SUSPECTS", entityType: "plotThread", entityName: "Heist", junk: 1 } });
    expect(ok.e1).toEqual({ state: "SUSPECTS", entityType: "plotThread", entityName: "Heist" });
    expect(() => encodeKnowledgeMap({ e1: { state: "KNOWS" } })).toThrow();
  });
});

describe("decodeIntelligenceProfile / encodeIntelligenceProfile", () => {
  it("returns the default {dominant:[],weak:[]} for missing/invalid input", () => {
    expect(decodeIntelligenceProfile(null)).toEqual({ dominant: [], weak: [] });
    expect(decodeIntelligenceProfile("x")).toEqual({ dominant: [], weak: [] });
  });

  it("keeps valid types and drops unknown ones in each list", () => {
    const result = decodeIntelligenceProfile({ dominant: ["logical", "telepathic"], weak: ["spatial"] });
    expect(result).toEqual({ dominant: ["logical"], weak: ["spatial"] });
  });

  it("encode throws on a non-object", () => {
    expect(() => encodeIntelligenceProfile(42 as unknown)).toThrow();
  });
});

describe("decodeCharacterSkills / encodeCharacterSkills", () => {
  it("keeps valid skills, applies defaults, drops junk", () => {
    const raw = [
      { name: "Lockpicking", category: "physical", level: 3, acquisitionPath: "deliberate_practice", traumaLinked: false },
      { nope: true },
    ];
    const result = decodeCharacterSkills(raw);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Lockpicking");
  });

  it("falls back to [] for non-array input", () => {
    expect(decodeCharacterSkills({})).toEqual([]);
  });

  it("encode strips unknown keys and throws on missing name", () => {
    const ok = encodeCharacterSkills([{ name: "Sailing", category: "physical", level: 1, acquisitionPath: "deliberate_practice", traumaLinked: false, junk: 9 }]);
    expect(ok[0]).not.toHaveProperty("junk");
    expect(() => encodeCharacterSkills([{ category: "physical" }])).toThrow();
  });
});

describe("decodeMemoryStructuredData / encodeMemoryStructuredData", () => {
  it("returns valid structured data including nested knowledgeShifts", () => {
    const sd = {
      chapterTitle: "The Heist",
      charactersPresent: ["Mara", "Kessler"],
      keyEvents: ["The vault opens"],
      knowledgeShifts: [{ character: "Mara", learned: "the code", from: "IGNORANT", to: "KNOWS" }],
    };
    expect(decodeMemoryStructuredData(sd)).toEqual(sd);
  });

  it("falls back to {} for null/non-object and on a fully invalid blob", () => {
    expect(decodeMemoryStructuredData(null)).toEqual({});
    expect(decodeMemoryStructuredData("x")).toEqual({});
  });

  it("drops a malformed sub-field but keeps the rest", () => {
    const result = decodeMemoryStructuredData({ keyEvents: ["a", 5], chapterTitle: "T" });
    // keyEvents had a non-string element → that field is dropped, chapterTitle kept.
    expect(result.chapterTitle).toBe("T");
    expect(result.keyEvents).toBeUndefined();
  });

  it("encode strips unknown keys", () => {
    const result = encodeMemoryStructuredData({ chapterTitle: "T", junk: 1 });
    expect(result).toEqual({ chapterTitle: "T" });
  });
});

describe("decodeStoryBeats / encodeStoryBeats", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); });

  const goodBeat = {
    id: "b1", order: 1, label: "Opening Image", summary: "The dealer enters.",
    purpose: "setup", characterIds: ["c1"], threadIds: ["t1"],
  };

  it("returns valid beats, applies defaults, drops malformed ones", () => {
    const raw = [goodBeat, { id: "b2" /* missing order+label */ }, "junk"];
    const result = decodeStoryBeats(raw);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Opening Image");
    expect(result[0].purpose).toBe("setup");
    expect(warn).toHaveBeenCalled();
  });

  it("coerces an unknown purpose to 'rising' rather than dropping the beat", () => {
    const result = decodeStoryBeats([{ ...goodBeat, purpose: "banana" }]);
    expect(result).toHaveLength(1);
    expect(result[0].purpose).toBe("rising");
  });

  it("falls back to [] for non-array input", () => {
    expect(decodeStoryBeats(null)).toEqual([]);
    expect(decodeStoryBeats({})).toEqual([]);
  });

  it("encode strips unknown keys and throws on a structurally invalid beat", () => {
    const ok = encodeStoryBeats([{ ...goodBeat, junk: 9 }]);
    expect(ok[0]).not.toHaveProperty("junk");
    expect(() => encodeStoryBeats([{ id: "b1" }])).toThrow();
  });
});
