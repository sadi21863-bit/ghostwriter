import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
const updateSet = vi.fn();
const insertValues = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: { semanticCache: { findFirst: (...args: any[]) => findFirst(...args) } },
    update: () => ({ set: (...args: any[]) => { updateSet(...args); return { where: vi.fn() }; } }),
    insert: () => ({ values: (...args: any[]) => { insertValues(...args); return { onConflictDoNothing: vi.fn() }; } }),
  },
}));

const createMessage = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { create: (...args: any[]) => createMessage(...args) }; },
}));

const { claudeSummarizer, rescueSkippedSections } = await import("../headroom-summarize");

describe("claudeSummarizer (production wiring)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirst.mockResolvedValue(undefined);
    createMessage.mockResolvedValue({ content: [{ type: "text", text: "compressed output" }] });
  });

  it("calls the model and caches the result on a cache miss", async () => {
    const out = await claudeSummarizer("some long story context", 100);
    expect(out).toBe("compressed output");
    expect(createMessage).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledTimes(1);
  });

  it("reuses a cached result and never calls the model again", async () => {
    findFirst.mockResolvedValue({ id: "row-1", hitCount: 2, cachedOutput: { text: "cached compressed" } });
    const out = await claudeSummarizer("some long story context", 100);
    expect(out).toBe("cached compressed");
    expect(createMessage).not.toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalledTimes(1); // hit-count bump
  });

  it("fails open (returns original text) if the model call throws", async () => {
    createMessage.mockRejectedValue(new Error("api down"));
    const out = await claudeSummarizer("original text here", 100);
    expect(out).toBe("original text here");
  });
});

describe("rescueSkippedSections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirst.mockResolvedValue(undefined);
    createMessage.mockResolvedValue({ content: [{ type: "text", text: "short compressed section" }] });
  });

  it("returns empty string when there is nothing skipped", async () => {
    expect(await rescueSkippedSections([], 500)).toBe("");
  });

  it("returns empty string when there is no budget to rescue into", async () => {
    expect(await rescueSkippedSections([{ label: "plots", content: "some plot text" }], 0)).toBe("");
  });

  it("keeps small skipped sections verbatim when they fit the rescue budget", async () => {
    const out = await rescueSkippedSections([{ label: "world-elements", content: "- The Ember Blade" }], 5000);
    expect(out).toContain("[WORLD-ELEMENTS — auto-compressed]");
    expect(out).toContain("- The Ember Blade");
    expect(createMessage).not.toHaveBeenCalled(); // small enough to skip the model call entirely
  });

  it("compresses the lowest-priority (world-elements) section first when over budget", async () => {
    const big = "x".repeat(8000); // ~2000 tokens
    const out = await rescueSkippedSections(
      [
        { label: "characters", content: "- Mara: protagonist" },
        { label: "world-elements", content: big },
      ],
      100
    );
    expect(out).toContain("[CHARACTERS — auto-compressed]");
    expect(out).toContain("- Mara: protagonist");
    expect(out).toContain("[WORLD-ELEMENTS — auto-compressed]");
    expect(out).toContain("short compressed section"); // world-elements got compressed
    expect(out).not.toContain(big); // the raw oversized text did not survive verbatim
  });
});
