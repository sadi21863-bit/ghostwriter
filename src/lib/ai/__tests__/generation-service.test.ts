import { describe, it, expect, vi } from "vitest";
import {
  PIPELINE_STAGES,
  runGenerationPipeline,
  type GenerationPorts,
  type GenerationRequest,
  type PipelineStage,
} from "@/lib/ai/generation-service";
import { ALLOWED, deny, subscriptionGate, type GateResolver } from "@/lib/capabilities/gate";

/**
 * Phase 1 / v4 item 9 — GenerationService.
 *
 * The billing contract is the thing worth testing hard: a reservation that is
 * silently dropped is exactly the leak Phase 0 spent its effort closing, and the
 * pipeline is where that can happen again.
 */

const req: GenerationRequest = { mode: "write", prompt: "Go on." };

/** Ports that succeed at every stage and record the order they ran in. */
function happyPath(order: PipelineStage[] = []): GenerationPorts {
  return {
    validate: (r) => {
      order.push("validate");
      return r;
    },
    authorize: () => {
      order.push("authorize");
      return undefined;
    },
    buildContext: () => {
      order.push("buildContext");
      return { static: "S", dynamic: "D" };
    },
    chooseProvider: () => {
      order.push("chooseProvider");
      return { provider: "anthropic", model: "sonnet-5" };
    },
    reserve: async () => {
      order.push("reserve");
      return { operation: "generate", estimatedUnits: 1 };
    },
    generate: async () => {
      order.push("generate");
      return { text: "prose", model: "sonnet-5", tokensUsed: 12 };
    },
    parse: (o) => {
      order.push("parse");
      return o;
    },
    persist: () => {
      order.push("persist");
    },
    proposeTransactions: () => {
      order.push("proposeTransactions");
    },
    finalizeUsage: async () => {
      order.push("finalizeUsage");
    },
  };
}

describe("pipeline happy path", () => {
  it("returns the generated text", async () => {
    const r = await runGenerationPipeline(req, happyPath());
    expect(r).toMatchObject({ ok: true, text: "prose", model: "sonnet-5", tokensUsed: 12 });
  });

  it("runs the v4 stages in order", async () => {
    const order: PipelineStage[] = [];
    await runGenerationPipeline(req, happyPath(order));
    expect(order).toEqual([
      "validate",
      "authorize",
      "buildContext",
      "chooseProvider",
      "reserve",
      "generate",
      "parse",
      "persist",
      "proposeTransactions",
      "finalizeUsage",
    ]);
  });

  it("reports each stage to onStage in pipeline order", async () => {
    const seen: PipelineStage[] = [];
    await runGenerationPipeline(req, happyPath(), (s) => seen.push(s));
    // resolveGate is skipped when no gates port is supplied.
    expect(seen).toEqual(["validate", "authorize", "buildContext", "chooseProvider", "reserve", "generate", "parse", "persist", "proposeTransactions"]);
  });

  it("PIPELINE_STAGES matches the v4 documented order", () => {
    expect([...PIPELINE_STAGES]).toEqual([
      "validate",
      "authorize",
      "resolveGate",
      "buildContext",
      "chooseProvider",
      "reserve",
      "generate",
      "parse",
      "persist",
      "proposeTransactions",
      "finalizeUsage",
    ]);
  });

  it("skips optional stages when their port is absent", async () => {
    const r = await runGenerationPipeline(req, { generate: async () => ({ text: "t" }) });
    expect(r.ok).toBe(true);
  });
});

describe("usage reservation is always settled", () => {
  it("finalizes as a SUCCESS with real token usage", async () => {
    const finalizeUsage = vi.fn();
    await runGenerationPipeline(req, { ...happyPath(), finalizeUsage });
    expect(finalizeUsage).toHaveBeenCalledWith(
      { operation: "generate", estimatedUnits: 1 },
      { ok: true, tokensUsed: 12 },
    );
  });

  it("refunds when the model call throws", async () => {
    const finalizeUsage = vi.fn();
    const r = await runGenerationPipeline(req, {
      ...happyPath(),
      generate: async () => {
        throw new Error("provider exploded");
      },
      finalizeUsage,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("provider exploded");
    expect(finalizeUsage).toHaveBeenCalledWith(
      { operation: "generate", estimatedUnits: 1 },
      { ok: false, tokensUsed: undefined },
    );
  });

  it("refunds when parse rejects the output", async () => {
    const finalizeUsage = vi.fn();
    const r = await runGenerationPipeline(req, {
      ...happyPath(),
      parse: () => ({ stop: { ok: false, reason: "unstructured output" } }),
      finalizeUsage,
    });
    expect(r.ok).toBe(false);
    expect(finalizeUsage).toHaveBeenCalledTimes(1);
    expect(finalizeUsage.mock.calls[0]![1]).toEqual({ ok: false, tokensUsed: undefined });
  });

  it("refunds when persist rejects", async () => {
    const finalizeUsage = vi.fn();
    await runGenerationPipeline(req, {
      ...happyPath(),
      persist: () => ({ stop: { ok: false, reason: "conflict" } }),
      finalizeUsage,
    });
    expect(finalizeUsage).toHaveBeenCalledTimes(1);
  });

  it("settles EXACTLY ONCE even when a later stage also fails", async () => {
    const finalizeUsage = vi.fn();
    await runGenerationPipeline(req, {
      ...happyPath(),
      parse: (o) => {
        // Pass parse, then blow up in persist's async tail.
        setTimeout(() => {}, 0);
        return o;
      },
      persist: () => {
        throw new Error("db down");
      },
      finalizeUsage,
    });
    expect(finalizeUsage).toHaveBeenCalledTimes(1);
  });

  it("does NOT settle when the failure happened before any reservation", async () => {
    const finalizeUsage = vi.fn();
    const r = await runGenerationPipeline(req, {
      ...happyPath(),
      validate: () => ({ stop: { ok: false, reason: "empty prompt" } }),
      finalizeUsage,
    });
    expect(r.ok).toBe(false);
    // Nothing was reserved, so refunding would credit the user for free.
    expect(finalizeUsage).not.toHaveBeenCalled();
  });

  it("does not settle when the gate denies", async () => {
    const finalizeUsage = vi.fn();
    const r = await runGenerationPipeline(req, {
      ...happyPath(),
      gates: () => [subscriptionGate("style_dna")],
      gateResolver: { subscription: (g) => deny("upgrade_required:style_dna", g) },
      finalizeUsage,
    });
    expect(r.ok).toBe(false);
    expect(r.stoppedAt).toBe("resolveGate");
    expect(finalizeUsage).not.toHaveBeenCalled();
  });

  it("still reports the outcome when finalizeUsage itself throws", async () => {
    const r = await runGenerationPipeline(req, {
      ...happyPath(),
      finalizeUsage: async () => {
        throw new Error("billing down");
      },
    });
    // The user must not lose their text because settlement blew up.
    expect(r.ok).toBe(true);
    expect(r.text).toBe("prose");
  });

  it("treats a failed proposal as advisory, not a generation failure", async () => {
    const r = await runGenerationPipeline(req, {
      ...happyPath(),
      proposeTransactions: () => {
        throw new Error("transaction proposer offline");
      },
    });
    expect(r.ok).toBe(true);
    expect(r.text).toBe("prose");
  });
});

describe("gate resolution", () => {
  const allowAll: GateResolver = { subscription: () => ALLOWED };

  it("consults gates and reports them on success", async () => {
    const r = await runGenerationPipeline(req, {
      ...happyPath(),
      gates: () => [subscriptionGate("style_dna")],
      gateResolver: allowAll,
    });
    expect(r.ok).toBe(true);
    expect(r.gates).toHaveLength(1);
  });

  it("names the exact gate that denied", async () => {
    const r = await runGenerationPipeline(req, {
      ...happyPath(),
      gates: () => [subscriptionGate("style_dna")],
      gateResolver: { subscription: (g) => deny("nope", g) },
    });
    expect(r.ok).toBe(false);
    expect(r.gateRef).toEqual({ kind: "subscription", value: "style_dna" });
  });

  it("stops at the gate and never reaches reserve", async () => {
    const reserve = vi.fn();
    await runGenerationPipeline(req, {
      ...happyPath(),
      gates: () => [subscriptionGate("style_dna")],
      gateResolver: { subscription: (g) => deny("nope", g) },
      reserve,
    });
    expect(reserve).not.toHaveBeenCalled();
  });
});

describe("early stops", () => {
  it("validate can stop the pipeline before anything else runs", async () => {
    const generate = vi.fn();
    const r = await runGenerationPipeline(req, {
      ...happyPath(),
      validate: () => ({ stop: { ok: false, reason: "prompt required" } }),
      generate,
    });
    expect(r).toMatchObject({ ok: false, reason: "prompt required" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("authorize can stop before context is built", async () => {
    const buildContext = vi.fn();
    await runGenerationPipeline(req, {
      ...happyPath(),
      authorize: () => ({ stop: { ok: false, reason: "forbidden" } }),
      buildContext,
    });
    expect(buildContext).not.toHaveBeenCalled();
  });

  it("throws a clear error when no generate port is supplied", async () => {
    const r = await runGenerationPipeline(req, { reserve: async () => ({ operation: "x", estimatedUnits: 1 }) });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no `generate` port/);
  });

  it("carries a control response through to the caller without failing", async () => {
    // /api/ai/generate answers 200 with { error: "upgrade_required", feature }
    // rather than an HTTP error. Treating that as a thrown failure would show a
    // red toast instead of the paywall prompt.
    const parse = vi.fn((o) => o);
    const r = await runGenerationPipeline(req, {
      ...happyPath(),
      generate: async () => ({ text: "", control: { error: "upgrade_required", feature: "style_dna" } }),
      parse,
      finalizeUsage: vi.fn(),
    });
    expect(r.ok).toBe(true);
    expect(parse).toHaveBeenCalled();
    expect(r.text).toBe("");
  });

  it("does not consume a reservation when a control response stops the pipeline", async () => {
    const finalizeUsage = vi.fn();
    const r = await runGenerationPipeline(req, {
      ...happyPath(),
      generate: async () => ({ text: "", control: { error: "upgrade_required", feature: "style_dna" } }),
      parse: () => ({ stop: { ok: false, reason: "upgrade_required", feature: "style_dna" } }),
      finalizeUsage,
    });
    expect(r.ok).toBe(false);
    // A paywall refusal must not charge the user.
    expect(finalizeUsage).toHaveBeenCalledWith(
      { operation: "generate", estimatedUnits: 1 },
      { ok: false, tokensUsed: undefined },
    );
  });
});

describe("pre-reserve halts carry structured payloads and cost nothing", () => {
  it("a reserve refusal stops the pipeline without settling usage", async () => {
    const meter = { error: "Monthly generation limit reached", upgrade: true };
    const generate = vi.fn();
    const finalizeUsage = vi.fn();
    const r = await runGenerationPipeline(req, {
      ...happyPath(),
      reserve: async () => ({ stop: { ok: false, control: { response: meter } } }),
      generate,
      finalizeUsage,
    });
    expect(r.ok).toBe(false);
    expect(r.control).toEqual({ response: meter });
    // The refusal is the meter's own response, verbatim.
    expect(r.stoppedAt).toBe("reserve");
    expect(generate).not.toHaveBeenCalled();
    expect(finalizeUsage).not.toHaveBeenCalled();
  });

  it("a stop can answer with a defined control response instead of an error", async () => {
    // Violation confirmation: the endpoint answers 200 with a prompt the client
    // is expected to show, not with a transport error.
    const r = await runGenerationPipeline(req, {
      ...happyPath(),
      authorize: () => ({
        stop: {
          ok: false,
          control: { status: 200, body: { requiresConfirmation: true, violationType: "op_protagonist" } },
        },
      }),
    });
    expect(r.ok).toBe(false);
    expect(r.control).toEqual({
      status: 200,
      body: { requiresConfirmation: true, violationType: "op_protagonist" },
    });
  });

  it("absent context is preserved as undefined, not coerced to an empty string", async () => {
    // The distinction decides whether a provider falls back to the raw
    // `context` parameter (undefined) or receives an authored empty block ("").
    let seen: { staticContext?: string; dynamicContext?: string } | undefined;
    await runGenerationPipeline(req, {
      ...happyPath(),
      buildContext: () => ({ static: undefined, dynamic: undefined }),
      generate: async (_req, ctx) => {
        seen = ctx;
        return { text: "t", model: "m" };
      },
    });
    // buildContext absent would leave both undefined too; here it RAN and the
    // undefined case still reached the provider untouched.
      expect(seen?.staticContext).toBeUndefined();
      expect(seen?.dynamicContext).toBeUndefined();
  });

  it("a pre-reserve stage THROW becomes a structured outcome, never an exception", async () => {
    // A database outage inside buildContext used to bypass every error-shaping
    // contract the host had — stages before `reserve` could only fail via
    // {stop}, and a throw fell through to the caller unhandled.
    const finalizeUsage = vi.fn();
    const generate = vi.fn();
    const r = await runGenerationPipeline(req, {
      ...happyPath(),
      buildContext: () => {
        throw new Error("connection terminated");
      },
      generate,
      finalizeUsage,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("connection terminated");
    expect(r.stoppedAt).toBe("buildContext");
    expect(generate).not.toHaveBeenCalled();
    expect(finalizeUsage).not.toHaveBeenCalled();
  });

  it("a pre-reserve stage throw still reports which stage it was", async () => {
    const r = await runGenerationPipeline(req, {
      ...happyPath(),
      authorize: () => {
        throw new Error("db down");
      },
    });
    expect(r.ok).toBe(false);
    expect(r.stoppedAt).toBe("authorize");
  });
});