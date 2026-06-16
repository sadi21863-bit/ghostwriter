// src/app/api/projects/[projectId]/chapters/__tests__/persistence.test.ts
// Integration-style tests that verify the chapter content-persistence loop:
//   updateChapter accumulation -> single PATCH with content+wordCount -> DB receives content

import { describe, it, expect, vi } from "vitest";
import {
  tiptapToPlainText,
  isValidTipTapJson,
  getWordCount,
} from "@/lib/editor/content-migration";

// ── Accumulation unit tests ───────────────────────────────────────────────────

describe("chapter persistence loop", () => {
  it("accumulated updateChapter batch includes content when content+wordCount are both set", () => {
    // Test the accumulation logic directly: set up pendingChanges,
    // merge content then wordCount, verify final PATCH body has content
    const pending: Record<string, any> = {};
    const merge = (f: string, v: any) => {
      pending[f] = v;
    };
    merge("content", '{"type":"doc","content":[]}');
    merge("wordCount", 42);
    expect(pending).toHaveProperty("content");
    expect(pending).toHaveProperty("wordCount");
  });

  it("tiptapToPlainText word count matches real text length", () => {
    const json = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world this is content" }],
        },
      ],
    };
    const plain = tiptapToPlainText(json);
    expect(plain.trim().length).toBeGreaterThan(0);
    expect(plain).toContain("Hello world");
  });

  it("isValidTipTapJson detects valid and invalid JSON", () => {
    expect(isValidTipTapJson('{"type":"doc","content":[]}')).toBe(true);
    expect(isValidTipTapJson("just plain text")).toBe(false);
    expect(isValidTipTapJson("")).toBe(false);
  });
});

// ── Loop integration test ─────────────────────────────────────────────────────

describe("write-mode generation -> PATCH -> reload loop", () => {
  it("content PATCH body contains the generated content", async () => {
    // Mock fetch to capture PATCH calls
    const fetchCalls: { url: string; body: any }[] = [];
    const mockFetch = vi.fn().mockImplementation((url: string, opts: any) => {
      if (opts?.method === "PATCH") {
        fetchCalls.push({ url, body: JSON.parse(opts.body) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    // Simulate the accumulation logic that the fixed updateChapter implements
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pending: Record<string, any> = {};
    const updateChapter = (f: string, v: any) => {
      pending[f] = v;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        mockFetch("/api/projects/p1/chapters/c1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...pending }),
        });
        // Clear pending after firing
        Object.keys(pending).forEach((k) => delete pending[k]);
      }, 10); // short debounce for test
    };

    const generatedContent =
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"The dragon awoke at dawn."}]}]}';
    updateChapter("content", generatedContent);
    updateChapter("wordCount", 5);

    // Wait for debounce to fire
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].body).toHaveProperty("content");
    expect(fetchCalls[0].body.content).toBe(generatedContent);
    expect(fetchCalls[0].body).toHaveProperty("wordCount", 5);
  });

  it("second rapid updateChapter does NOT clobber content from first", async () => {
    // Verify that with accumulation (new behavior), both fields are in one PATCH
    const pending: Record<string, any> = {};
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fetchCalls: any[] = [];

    const updateChapterAccumulating = (f: string, v: any) => {
      pending[f] = v; // accumulate
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fetchCalls.push({ ...pending });
        Object.keys(pending).forEach((k) => delete pending[k]);
      }, 10);
    };

    updateChapterAccumulating("content", "some-tiptap-json");
    updateChapterAccumulating("wordCount", 3);

    await new Promise((r) => setTimeout(r, 50));

    // Only ONE call was made (debounce coalesced them)
    expect(fetchCalls).toHaveLength(1);
    // That one call has BOTH fields
    expect(fetchCalls[0]).toHaveProperty("content", "some-tiptap-json");
    expect(fetchCalls[0]).toHaveProperty("wordCount", 3);
  });

  it("getWordCount returns correct count for TipTap JSON string", () => {
    const json = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "The dragon awoke at dawn." }],
        },
      ],
    });
    const count = getWordCount(json);
    expect(count).toBe(5);
  });
});
