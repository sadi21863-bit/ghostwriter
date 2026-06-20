import { describe, it, expect, vi } from "vitest";

const finalMessage = vi.fn();
const streamHandlers: Record<string, (delta: string) => void> = {};
const streamMock = vi.fn(() => ({
  on: (event: string, cb: (delta: string) => void) => { streamHandlers[event] = cb; },
  finalMessage: () => finalMessage(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function () {
    return { messages: { stream: (...args: any[]) => streamMock(...args) } };
  }),
}));

vi.mock("@/lib/semantic-cache", () => ({
  checkSemanticCache: vi.fn(),
  writeSemanticCache: vi.fn(),
}));

const { generateStream } = await import("@/lib/ai/engine");

describe("generateStream", () => {
  it("emits each delta via onDelta and resolves with the full accumulated text", async () => {
    finalMessage.mockImplementation(async () => {
      // Simulate the SDK emitting two text deltas before the stream completes.
      streamHandlers.text("Hello, ");
      streamHandlers.text("world.");
      return { usage: { input_tokens: 10, output_tokens: 5 } };
    });

    const deltas: string[] = [];
    const result = await generateStream(
      { mode: "write", prompt: "Continue the scene.", staticContext: "static", dynamicContext: "dynamic", format: "Novel" },
      (delta) => deltas.push(delta),
    );

    expect(deltas).toEqual(["Hello, ", "world."]);
    expect(result.text).toBe("Hello, world.");
    expect(result.tokensUsed).toBe(15);
  });

  it("builds the same two-block system structure as generate() when static/dynamic context is provided", async () => {
    finalMessage.mockResolvedValue({ usage: { input_tokens: 1, output_tokens: 1 } });
    streamMock.mockClear();

    await generateStream(
      { mode: "write", prompt: "p", staticContext: "STATIC_MARKER", dynamicContext: "DYNAMIC_MARKER", format: "Novel" },
      () => {},
    );

    const callArgs = streamMock.mock.calls[0][0];
    expect(callArgs.system).toHaveLength(2);
    expect(callArgs.system[0].text).toContain("STATIC_MARKER");
    expect(callArgs.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(callArgs.system[1].text).toBe("DYNAMIC_MARKER");
  });

  it("falls back to a single system block built from `context` when static/dynamic are omitted", async () => {
    finalMessage.mockResolvedValue({ usage: { input_tokens: 1, output_tokens: 1 } });
    streamMock.mockClear();

    await generateStream({ mode: "write", prompt: "p", context: "FULL_CONTEXT_MARKER", format: "Novel" }, () => {});

    const callArgs = streamMock.mock.calls[0][0];
    expect(callArgs.system).toHaveLength(1);
    expect(callArgs.system[0].text).toContain("FULL_CONTEXT_MARKER");
  });

  it("routes to the mode's configured model tier, same as generate()", async () => {
    finalMessage.mockResolvedValue({ usage: { input_tokens: 1, output_tokens: 1 } });
    streamMock.mockClear();

    const result = await generateStream({ mode: "combat", prompt: "p", format: "Novel" }, () => {});

    // combat is modelTier "quality" in MODE_REGISTRY -> Opus
    expect(result.model).toBe("claude-opus-4-8");
  });
});
