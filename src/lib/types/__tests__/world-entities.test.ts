import { describe, it, expect } from "vitest";
import {
  WorldEntityKindSchema, decodeWorldEntityProperties, encodeWorldEntityProperties,
} from "../story";

describe("WorldEntityKindSchema", () => {
  it("accepts the seven kinds", () => {
    for (const k of ["object", "weapon", "organization", "faction", "phenomenon", "entity", "concept"])
      expect(WorldEntityKindSchema.parse(k)).toBe(k);
  });
  it("coerces an unknown kind to 'object' rather than throwing", () => {
    expect(WorldEntityKindSchema.parse("spaceship")).toBe("object");
  });
});

describe("world-entity properties guards", () => {
  it("decode keeps valid fields and drops malformed ones", () => {
    const out = decodeWorldEntityProperties({ origin: "forged in the north", powers: ["fire"], leader: 42 });
    expect(out.origin).toBe("forged in the north");
    expect(out.powers).toEqual(["fire"]);
    expect(out.leader).toBeUndefined();
  });
  it("decode returns {} for non-object input (never throws)", () => {
    expect(decodeWorldEntityProperties("nope")).toEqual({});
    expect(decodeWorldEntityProperties(null)).toEqual({});
  });
  it("encode strips unknown keys and returns a clean object", () => {
    const out = encodeWorldEntityProperties({ goal: "rule the city", bogus: 1 });
    expect(out).toEqual({ goal: "rule the city" });
  });
});
