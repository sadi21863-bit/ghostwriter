import { describe, it, expect } from "vitest";
import { createReversibleStore } from "../headroom-reversible";

describe("createReversibleStore (CCR)", () => {
  it("compresses and lets you retrieve the exact original", () => {
    const store = createReversibleStore();
    const original = "Mara wants to clear her name.\n\n\n\nKessler blocks her at every turn.   ";
    const ref = store.compress(original);
    expect(ref.compressed.length).toBeLessThanOrEqual(original.length); // lossless compaction shrinks whitespace
    expect(store.retrieve(ref.token)).toBe(original); // original recoverable byte-for-byte
  });

  it("returns undefined for an unknown token", () => {
    const store = createReversibleStore();
    expect(store.retrieve("hr:deadbeef")).toBeUndefined();
  });

  it("dedupes identical originals to the same token", () => {
    const store = createReversibleStore();
    const a = store.compress("same content here");
    const b = store.compress("same content here");
    expect(a.token).toBe(b.token);
    expect(store.stats().entries).toBe(1);
  });

  it("accepts a custom (lossy) compressor and still retrieves the original", () => {
    const store = createReversibleStore();
    const original = "a very long original passage that we will summarise heavily";
    const ref = store.compress(original, () => "short summary");
    expect(ref.compressed).toBe("short summary");
    expect(store.retrieve(ref.token)).toBe(original); // reversibility holds even for lossy compression
  });

  it("accumulates savings stats", () => {
    const store = createReversibleStore();
    store.compress("x".repeat(40) + "\n\n\n\n" + "y".repeat(40)); // blank-line run compacts
    const s = store.stats();
    expect(s.entries).toBe(1);
    expect(s.tokensSaved).toBeGreaterThanOrEqual(0);
    expect(s.originalTokens).toBeGreaterThanOrEqual(s.compressedTokens);
  });
});
