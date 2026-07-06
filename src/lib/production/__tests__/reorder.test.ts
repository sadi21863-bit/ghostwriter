import { describe, it, expect } from "vitest";
import { reorderIds, changedOrders } from "@/lib/production/reorder";

describe("reorderIds", () => {
  it("moves a dragged id to just before the target id", () => {
    expect(reorderIds(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
  });

  it("moves a dragged id forward in the list", () => {
    expect(reorderIds(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "a", "c", "d"]);
  });

  it("is a no-op when dragged and target are the same id", () => {
    const ids = ["a", "b", "c"];
    expect(reorderIds(ids, "b", "b")).toBe(ids);
  });

  it("is a no-op when the target id isn't found", () => {
    const ids = ["a", "b", "c"];
    expect(reorderIds(ids, "a", "nonexistent")).toBe(ids);
  });

  it("does not mutate the input array", () => {
    const ids = ["a", "b", "c"];
    const copy = [...ids];
    reorderIds(ids, "c", "a");
    expect(ids).toEqual(copy);
  });
});

describe("changedOrders", () => {
  it("returns only the ids whose position actually changed", () => {
    // Original order: a=0, b=1, c=2, d=3. After moving d before b: a=0, d=1, b=2, c=3.
    const reordered = ["a", "d", "b", "c"];
    const original = { a: 0, b: 1, c: 2, d: 3 };
    expect(changedOrders(reordered, original)).toEqual([
      { id: "d", order: 1 },
      { id: "b", order: 2 },
      { id: "c", order: 3 },
    ]);
  });

  it("returns an empty array when nothing changed", () => {
    expect(changedOrders(["a", "b", "c"], { a: 0, b: 1, c: 2 })).toEqual([]);
  });

  it("treats an id missing from the original order map as always-changed", () => {
    expect(changedOrders(["a", "new"], { a: 0 })).toEqual([{ id: "new", order: 1 }]);
  });
});
