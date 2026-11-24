import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateChapter, validateGenerateRequest } from "@/lib/core/handlers/generate-chapter";
import type { GenerateChapterPorts } from "@/lib/core/handlers/generate-chapter";
import { cloudContext } from "@/lib/core/request-context";
import type { PipelineStage } from "@/lib/ai/generation-service";

// The base ports: a generate port that records what it was called with, so a
// test can prove the request passed through validate unharmed.
function basePorts(): GenerateChapterPorts {
  return {
    generate: async (req) => ({ text: `generated for ${req.mode}`, model: "m", tokensUsed: 3 }),
  };
}

const OP_PROMPT = "Write a hero who is completely OP and never fails";

describe("validateGenerateRequest — the 400 contract", () => {
  it("refuses a blank prompt with the route's exact body", () => {
    const r = validateGenerateRequest({ mode: "write", prompt: "   " });
    expect(r).toMatchObject({
      stop: { ok: false, stoppedAt: "validate", control: { error: "Prompt is required" } },
    });
  });

  it("refuses a missing mode with the route's exact body", () => {
    const r = validateGenerateRequest({ mode: "", prompt: "x" });
    expect(r).toMatchObject({
      stop: { ok: false, stoppedAt: "validate", control: { error: "Mode is required" } },
    });
  });

  it("refuses an unknown mode with the route's exact body", () => {
    const r = validateGenerateRequest({ mode: "inherited-key", prompt: "x" });
    expect(r).toMatchObject({
      stop: { ok: false, stoppedAt: "validate", control: { error: "Unknown mode: inherited-key" } },
    });
  });

  it("rejects inherited Object keys (the TypeError-to-500 regression)", () => {
    // SITE: engine.ts indexes a dispatch map with no optional chaining; passing
    // "constructor" as the mode used to reach it after only a truthiness check.
    const r = validateGenerateRequest({ mode: "toString", prompt: "x" });
    expect(r).toMatchObject({
      stop: { ok: false, stoppedAt: "validate", control: { error: "Unknown mode: toString" } },
    });
  });

  it("passes a valid request through untouched", () => {
    const input = { mode: "write", prompt: "x", projectId: "p1" };
    expect(validateGenerateRequest(input)).toBe(input);
  });
});

describe("generateChapter — violation gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const loadViolations = vi.fn(async () => ({}));

  it("halts at authorize with the confirmation contract for a violating prompt", async () => {
    const out = await generateChapter(
      { mode: "write", prompt: OP_PROMPT, projectId: "p1" },
      cloudContext("u1"),
      { ...basePorts(), loadViolations },
    );
    expect(loadViolations).toHaveBeenCalledWith("p1", "u1");
    expect(out.ok).toBe(false);
    expect(out.stoppedAt).toBe("authorize");
    expect(out.control).toMatchObject({
      requiresConfirmation: true,
      violationType: "op_protagonist",
    });
  });

  it("a confirmed violation does not re-fire", async () => {
    loadViolations.mockResolvedValueOnce({ op_protagonist: { confirmed: true } });
    const out = await generateChapter(
      { mode: "write", prompt: OP_PROMPT, projectId: "p1" },
      cloudContext("u1"),
      { ...basePorts(), loadViolations },
    );
    expect(out.ok).toBe(true);
    expect(out.text).toBe("generated for write");
  });

  it("bypassViolationCheck skips the gate entirely (the confirm retry path)", async () => {
    const out = await generateChapter(
      { mode: "write", prompt: OP_PROMPT, projectId: "p1", bypassViolationCheck: true },
      cloudContext("u1"),
      { ...basePorts(), loadViolations },
    );
    expect(loadViolations).not.toHaveBeenCalled();
    expect(out.ok).toBe(true);
  });

  it("never consults the gate without a project", async () => {
    const out = await generateChapter(
      { mode: "write", prompt: OP_PROMPT },
      cloudContext("u1"),
      { ...basePorts(), loadViolations },
    );
    expect(loadViolations).not.toHaveBeenCalled();
    expect(out.ok).toBe(true);
  });

  it("validate halts before the gate is consulted", async () => {
    const loadViolations = vi.fn(async () => ({}));
    const out = await generateChapter(
      { mode: "not-a-mode", prompt: OP_PROMPT, projectId: "p1" },
      cloudContext("u1"),
      { ...basePorts(), loadViolations },
    );
    expect(loadViolations).not.toHaveBeenCalled();
    expect(out.ok).toBe(false);
    expect(out.stoppedAt).toBe("validate");
  });
});

describe("generateChapter — port pass-through", () => {
  it("forwards host ports unchanged so the pipeline sees the real closures", async () => {
    const order: PipelineStage[] = [];
    const persist = vi.fn();
    const finalizeUsage = vi.fn();
    const loadViolations = vi.fn(async () => ({ op_protagonist: { confirmed: true } }));
    const out = await generateChapter(
      { mode: "write", prompt: "start fresh" },
      cloudContext("u1"),
      {
        generate: async () => ({ text: "t", model: "m", tokensUsed: 2 }),
        reserve: async () => ({ operation: "generate", estimatedUnits: 1 }),
        persist,
        finalizeUsage: async (r, o) => {
          finalizeUsage(r, o);
        },
        loadViolations,
        onStage: (s) => order.push(s),
      },
    );
    expect(persist).toHaveBeenCalledOnce();
    expect(finalizeUsage).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "generate" }),
      { ok: true, tokensUsed: 2 },
    );
    expect(order[0]).toBe("validate");
  });

  it("omitting loadViolations leaves the pipeline authorise-free (local-host shape)", async () => {
    const out = await generateChapter(
      { mode: "write", prompt: OP_PROMPT },
      cloudContext("u1"),
      basePorts(),
    );
    expect(out.ok).toBe(true);
  });
});
