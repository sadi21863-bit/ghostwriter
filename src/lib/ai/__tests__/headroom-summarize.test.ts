import { describe, it, expect, vi } from "vitest";
import { summarizeToFit, summarizeOverflow, makeClaudeSummarizer } from "../headroom-summarize";

// A deterministic mock summariser: returns the first ~targetTokens*4 chars.
const mockSummarize = vi.fn(async (text: string, targetTokens: number) => text.slice(0, targetTokens * 4));

describe("summarizeToFit", () => {
  it("returns text untouched when it already fits", async () => {
    mockSummarize.mockClear();
    const text = "short";
    expect(await summarizeToFit(text, 100, mockSummarize)).toBe(text);
    expect(mockSummarize).not.toHaveBeenCalled();
  });

  it("summarises when over the target", async () => {
    const text = "x".repeat(4000); // ~1000 tokens
    const out = await summarizeToFit(text, 50, mockSummarize);
    expect(out.length).toBeLessThan(text.length);
    expect(mockSummarize).toHaveBeenCalled();
  });

  it("never returns something longer than the original", async () => {
    const grow = vi.fn(async (t: string) => t + t); // misbehaving summariser
    const text = "y".repeat(4000);
    expect(await summarizeToFit(text, 10, grow)).toBe(text);
  });
});

describe("summarizeOverflow", () => {
  it("leaves sections untouched when the total is within budget", async () => {
    const spy = vi.fn(async (t: string) => t.slice(0, 4));
    const secs = [{ id: "a", text: "tiny", priority: 1 }];
    expect(await summarizeOverflow(secs, 1000, spy)).toEqual(secs);
    expect(spy).not.toHaveBeenCalled();
  });

  it("compresses the lowest-priority section first to fit the budget", async () => {
    const big = "z".repeat(8000);   // ~2000 tokens
    const small = "keep me intact"; // tiny, high priority
    const secs = [
      { id: "low", text: big, priority: 1 },
      { id: "high", text: small, priority: 10 },
    ];
    const out = await summarizeOverflow(secs, 100, mockSummarize);
    const byId = Object.fromEntries(out.map(s => [s.id, s.text]));
    expect(byId.high).toBe(small);                 // high priority untouched
    expect(byId.low.length).toBeLessThan(big.length); // low priority compressed
  });
});

describe("makeClaudeSummarizer", () => {
  it("wraps a model call and returns its trimmed output", async () => {
    const call = vi.fn(async () => "  compressed  ");
    const s = makeClaudeSummarizer(call);
    expect(await s("long text", 30)).toBe("compressed");
    expect(call).toHaveBeenCalled();
  });

  it("fails open to the original text when the model call throws", async () => {
    const call = vi.fn(async () => { throw new Error("boom"); });
    const s = makeClaudeSummarizer(call);
    expect(await s("original", 30)).toBe("original");
  });
});
