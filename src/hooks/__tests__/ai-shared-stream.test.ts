import { describe, it, expect, vi, afterEach } from "vitest";
import { callAIStream } from "@/hooks/ai-shared";

function makeStreamingResponse(chunks: string[]) {
  let i = 0;
  return {
    headers: { get: () => "text/plain; charset=utf-8" },
    body: {
      getReader: () => ({
        read: async () => {
          if (i >= chunks.length) return { done: true, value: undefined };
          const value = new TextEncoder().encode(chunks[i]);
          i += 1;
          return { done: false, value };
        },
      }),
    },
  };
}

function makeJsonResponse(body: any) {
  return {
    headers: { get: () => "application/json" },
    body: {},
    json: async () => body,
  };
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe("callAIStream", () => {
  it("reads chunked text deltas and resolves with the full accumulated text", async () => {
    global.fetch = vi.fn().mockResolvedValue(makeStreamingResponse(["Hello, ", "world."])) as any;

    const deltas: string[] = [];
    const result = await callAIStream("generate", { mode: "write" }, (chunk) => deltas.push(chunk));

    expect(deltas).toEqual(["Hello, ", "world."]);
    expect(result.text).toBe("Hello, world.");
  });

  it("sends stream: true in the request body regardless of the caller's body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeStreamingResponse(["x"]));
    global.fetch = fetchMock as any;

    await callAIStream("generate", { mode: "write", prompt: "p" }, () => {});

    const [, opts] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(opts.body);
    expect(sentBody).toMatchObject({ mode: "write", prompt: "p", stream: true });
  });

  it("returns the JSON body directly (e.g. upgrade_required/violation control responses) without reading a stream", async () => {
    global.fetch = vi.fn().mockResolvedValue(makeJsonResponse({ error: "upgrade_required", feature: "story_modes_advanced" })) as any;

    const onDelta = vi.fn();
    const result = await callAIStream("generate", { mode: "write" }, onDelta);

    expect(result).toEqual({ error: "upgrade_required", feature: "story_modes_advanced" });
    expect(onDelta).not.toHaveBeenCalled();
  });

  it("falls back to a generic error object if a JSON-content-type response fails to parse", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      headers: { get: () => "application/json" },
      body: {},
      json: async () => { throw new Error("bad json"); },
    }) as any;

    const result = await callAIStream("generate", { mode: "write" }, () => {});
    expect(result.error).toBe("Generation failed. Please try again.");
  });
});
