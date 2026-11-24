/**
 * Phase 4 slice 4b — the dedicated Anthropic adapter, verified IN PROCESS
 * against injected structural clients (the real `@anthropic-ai/sdk` client
 * never constructs and no test path touches any network — injection instead
 * of vi.mock): the model resolution + the cache_control placements that ARE
 * §12.1's prompt-caching leverage, the shared assembly head's equality, the
 * engine's own response mapping, the mount's reason→status vocabulary
 * family, the client-factory cfg facts, and the module-source purity block
 * (no SDK at the top level — the dynamic import inside the default factory
 * is the sanctioned use).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  makeAnthropicGenerate,
  type AnthropicMessagesClient,
  type AnthropicSystemBlock,
  type AnthropicGenerateOptions,
  type LocalAnthropicEndpoint,
} from "@/lib/core/local-anthropic-adapter";
import { composeInstructionalHead } from "@/lib/core/local-provider-adapter";
import {
  ARTIFACT_VS_PERSONA_RULE,
  MI,
  getFormatRules,
  getCraftDirectives,
} from "@/lib/ai/engine";

/** The structural slice of a create response, for scripted results. */
type ScriptedResult = Awaited<ReturnType<AnthropicMessagesClient["messagesCreate"]>>;
type FactoryCfg = { apiKey: string; baseUrl?: string; timeoutMs: number };

const endpoint = (extra: Partial<LocalAnthropicEndpoint> = {}): LocalAnthropicEndpoint => ({
  model: "claude-fixture",
  apiKey: "sk-anthropic-fixture",
  ...extra,
});

/** A client whose create() records every params object it is handed. */
const scriptedClient = (result: ScriptedResult, calls: unknown[] = []): AnthropicMessagesClient => ({
  messagesCreate: async (p) => {
    calls.push(p);
    return result;
  },
});

/** A client whose create() always rejects — the translation family's input. */
const throwingClient = (err: unknown): AnthropicMessagesClient => ({
  messagesCreate: async () => {
    throw err;
  },
});

/** Factory injection that observes which cfg each generate call delivers. */
const injected = (
  client: AnthropicMessagesClient,
  cfgCalls?: FactoryCfg[],
  extra: AnthropicGenerateOptions = {},
): AnthropicGenerateOptions => ({
  ...extra,
  clientCreate: (cfg) => {
    cfgCalls?.push({ ...cfg });
    return client;
  },
});

const textMessage = (
  text: string,
  usage: { input_tokens: number; output_tokens: number } = { input_tokens: 10, output_tokens: 5 },
): ScriptedResult => ({ content: [{ type: "text", text }], usage });

const call = (
  gen: ReturnType<typeof makeAnthropicGenerate>,
  model: string,
  ctx: { staticContext?: string; dynamicContext?: string } = {},
) =>
  gen(
    { mode: "write", prompt: "PROMPT SENTINEL", format: "Novel" },
    { provider: "anthropic", model, ...ctx },
  );

/** The first recorded params object, structurally widened for assertions. */
type RecordedCreate = {
  model: string;
  max_tokens: number;
  system: readonly AnthropicSystemBlock[];
  messages: [{ role: "user"; content: string }];
  temperature?: number;
};

const firstCreate = (calls: unknown[]): RecordedCreate => {
  expect(calls.length).toBeGreaterThan(0);
  return calls[0] as RecordedCreate;
};

describe("the dedicated Anthropic generate adapter (the wire)", () => {
  it("routes the model like slice 4a — ctx.model wins, the 'default' placeholder falls to the endpoint — and the outcome echoes the RESOLVED id", async () => {
    const calls: unknown[] = [];
    const gen = makeAnthropicGenerate(endpoint(), injected(scriptedClient(textMessage("the fixture's prose"), calls)));

    // The pipeline's own "default" placeholder (no chooseProvider) must NOT
    // leak to the wire — the endpoint's env-decided model serves instead.
    const defaultOut = await call(gen, "default", { staticContext: "S", dynamicContext: "D" });
    expect(defaultOut).toEqual({ text: "the fixture's prose", model: "claude-fixture", tokensUsed: 15 });
    expect(firstCreate(calls).model).toBe("claude-fixture");

    // Routing's explicit model wins, and the outcome echoes the RESOLVED id.
    const routedOut = await call(gen, "slot-model:latest");
    expect((calls[1] as { model: string }).model).toBe("slot-model:latest");
    expect(routedOut.model).toBe("slot-model:latest");
  }, 20000);

  it("cache_control rides EXACTLY the cacheable blocks when both contexts arrive — head+static cached, dynamic left uncached", async () => {
    const calls: unknown[] = [];
    const gen = makeAnthropicGenerate(endpoint(), injected(scriptedClient(textMessage("x"), calls)));
    const head = composeInstructionalHead("write", "Novel");

    await call(gen, "m", { staticContext: "STATIC SENTINEL", dynamicContext: "DYNAMIC SENTINEL" });

    const system = firstCreate(calls).system;
    expect(system).toHaveLength(2);
    // Block 1: the shared instructions head, then the slow-moving static
    // block after the engine's "\n---\n" separator — THE cached block.
    expect(system[0]!.text).toBe(head + "\n---\n" + "STATIC SENTINEL");
    expect(system[0]!.cache_control).toEqual({ type: "ephemeral" });
    // Block 2: the fast-moving dynamic block rides UNCACHED — the cache
    // boundary is the two-block seam, never the whole message.
    expect(system[1]!.text).toBe("DYNAMIC SENTINEL");
    expect(system[1]!.cache_control).toBeUndefined();
  }, 20000);

  it("each single-context case caches its one block, and NEITHER keeps the empty block the cloud's single-system path yields", async () => {
    const calls: unknown[] = [];
    const gen = makeAnthropicGenerate(endpoint(), injected(scriptedClient(textMessage("x"), calls)));
    const head = composeInstructionalHead("write", "Novel");

    await call(gen, "m", { staticContext: "S ONLY" });
    await call(gen, "m", { dynamicContext: "D ONLY" });
    await call(gen, "m"); // no context at all

    expect(calls).toHaveLength(3);
    for (const c of calls) {
      const system = (c as { system: AnthropicSystemBlock[] }).system;
      expect(system).toHaveLength(1);
      expect(system[0]!.cache_control).toEqual({ type: "ephemeral" });
    }
    expect((calls[0] as { system: AnthropicSystemBlock[] }).system[0]!.text).toBe(head + "\n---\n" + "S ONLY");
    expect((calls[1] as { system: AnthropicSystemBlock[] }).system[0]!.text).toBe(head + "\n---\n" + "D ONLY");
    // The empty block — the cloud engine's single-system path with no legacy
    // `body.context` fallback possible on the local mount.
    expect((calls[2] as { system: AnthropicSystemBlock[] }).system[0]!.text).toBe(head + "\n---\n");
  }, 20000);

  it("messages carry exactly the prompt, max_tokens defaults to 8000, and temperature is omitted unless set", async () => {
    const calls: unknown[] = [];
    const gen = makeAnthropicGenerate(endpoint(), injected(scriptedClient(textMessage("x"), calls)));
    await call(gen, "m");

    const wire = firstCreate(calls);
    expect(wire.messages).toEqual([{ role: "user", content: "PROMPT SENTINEL" }]);
    expect(wire.max_tokens).toBe(8000);
    expect(wire.temperature).toBeUndefined();

    const hotCalls: unknown[] = [];
    const hotGen = makeAnthropicGenerate(
      endpoint(),
      injected(scriptedClient(textMessage("x"), hotCalls), undefined, {
        temperature: 0.7,
        maxTokens: 1000,
      }),
    );
    await call(hotGen, "m");
    const hotWire = firstCreate(hotCalls);
    expect(hotWire.temperature).toBe(0.7);
    expect(hotWire.max_tokens).toBe(1000);
  }, 20000);

  it("text joins ONLY the text blocks in order, and tokensUsed is the usage sum", async () => {
    const calls: unknown[] = [];
    const result: ScriptedResult = {
      content: [
        { type: "text", text: "alpha" },
        { type: "text", text: "beta" },
        { type: "tool_use", text: "SKIPPED" },
        {}, // untyped block — not a text block, skipped
        { type: "text", text: "gamma" },
      ],
      usage: { input_tokens: 111, output_tokens: 22 },
    };
    const gen = makeAnthropicGenerate(endpoint(), injected(scriptedClient(result, calls)));
    const out = await call(gen, "m");

    expect(out).toEqual({ text: "alphabetagamma", model: "m", tokensUsed: 133 });

    // No text blocks at all → the empty string, never undefined.
    const emptyCalls: unknown[] = [];
    const emptyGen = makeAnthropicGenerate(
      endpoint(),
      injected(scriptedClient({ content: [], usage: { input_tokens: 1, output_tokens: 2 } }, emptyCalls)),
    );
    const emptyOut = await call(emptyGen, "m");
    expect(emptyOut.text).toBe("");
    expect(emptyOut.tokensUsed).toBe(3);
  }, 20000);

  it("the shared assembly: the system lead equals composeInstructionalHead + separators, and that head is the engine's own assembly", () => {
    const head = composeInstructionalHead("write", "Novel");
    expect(head.startsWith(ARTIFACT_VS_PERSONA_RULE)).toBe(true);
    expect(head.includes(MI.write!("Novel"))).toBe(true);
    // Exactly the engine's engine.ts assembly order, factored and shared with
    // slice 4a's single-message adapter:
    expect(head).toBe(
      ARTIFACT_VS_PERSONA_RULE +
        "\n\n" +
        MI.write!("Novel") +
        getFormatRules("Novel") +
        getCraftDirectives("Novel"),
    );
  }, 20000);

  const errorCases: Array<[unknown, RegExp]> = [
    [{ status: 429, message: "Too many requests" }, /rate_limit.*Too many requests/],
    // 529 is Anthropic's overloaded status — the mount probes both spellings.
    [{ status: 529, message: "overloaded_error" }, /rate_limit.*overloaded_error/],
    [{ status: 400, message: "prompt is too long: 189203 tokens" }, /context_length.*too long/],
    [{ message: "maximum context length exceeded" }, /context_length.*maximum context/],
    // A plain bad request is NOT a context error — tagging stays marker-based.
    [{ status: 400, message: "messages: field required" }, /provider_error 400.*field required/],
    [{ status: 401, message: "invalid x-api-key" }, /provider auth failed \(401\).*invalid x-api-key/],
    [{ status: 403, message: "not allowed" }, /provider auth failed \(403\)/],
    [{ message: "kaboom without a status" }, /provider_error unavailable|unknown/],
  ];

  it.each(errorCases)(
    "a %o rejection translates into the mount's reason→status vocabulary (provider words logged, never shown)",
    async (errShape, matcher) => {
      const gen = makeAnthropicGenerate(endpoint(), injected(throwingClient(errShape)));
      await expect(
        gen({ mode: "write", prompt: "p", format: "Novel" }, { provider: "anthropic", model: "m" }),
      ).rejects.toThrow(matcher as RegExp);
    },
    20000,
  );

  it("the injected clientCreate receives the endpoint's key decision + the adapter timeout, the key never rides the wire params, and a gateway override rides the cfg", async () => {
    const cfgCalls: FactoryCfg[] = [];
    const calls: unknown[] = [];
    const gen = makeAnthropicGenerate(
      endpoint({ apiKey: "sk-operator-env" }),
      injected(scriptedClient(textMessage("x"), calls), cfgCalls),
    );
    await call(gen, "m", { staticContext: "S" });

    expect(cfgCalls).toEqual([{ apiKey: "sk-operator-env", timeoutMs: 300_000 }]);
    // The wire params carry no credential — the SDK client owns the header.
    expect(firstCreate(calls)).not.toHaveProperty("apiKey");

    // A gateway override rides the factory cfg so the SDK can aim at it.
    const gatewayCfg: FactoryCfg[] = [];
    const gatewayGen = makeAnthropicGenerate(
      endpoint({ apiKey: "k", baseUrl: "https://gateway.example" }),
      injected(scriptedClient(textMessage("x")), gatewayCfg),
    );
    await call(gatewayGen, "m");
    expect(gatewayCfg).toEqual([
      { apiKey: "k", baseUrl: "https://gateway.example", timeoutMs: 300_000 },
    ]);
  }, 20000);

  it("a client factory that throws — or yields no usable client — surfaces as thrown, untranslated, for the pipeline's settle path", async () => {
    // Factory throw: raw, NOT translated into the provider vocabulary.
    const boom = makeAnthropicGenerate(endpoint(), {
      clientCreate: () => {
        throw new Error("factory boom");
      },
    });
    let raw = "";
    await call(boom, "m").catch((e: unknown) => {
      raw = (e as Error).message;
    });
    expect(raw).toBe("factory boom");

    // No usable client: also a raw wiring failure, not a provider failure.
    const noClient = makeAnthropicGenerate(endpoint(), {
      clientCreate: () => undefined as unknown as AnthropicMessagesClient,
    });
    let missing = "";
    await call(noClient, "m").catch((e: unknown) => {
      missing = (e as Error).message;
    });
    expect(missing).toContain("no usable messages client");
    expect(missing).not.toContain("provider_error");
  }, 20000);
});

describe("local anthropic adapter — source purity (local-provider-adapter's mirrored convention)", () => {
  it("never imports the Neon side, the pg schema, the Next runtime, or the SDK's own names at the top level", () => {
    const source = readFileSync(join(__dirname, "../local-anthropic-adapter.ts"), "utf-8");
    expect(source).not.toMatch(/"@\/db"|'@\/db'|"@\/db\/schema"|'@\/db\/schema'/);
    expect(source).not.toMatch(/"next(\/|-auth)?"/);
    expect(source).not.toMatch(/@neondatabase\/serverless/);
    // The SDK arrives ONLY through the dynamic import inside the default
    // factory — a top-level `from`-import would drag it into every importer.
    expect(source).not.toMatch(/from ["']@anthropic-ai\/sdk["']/);
  }, 20000);

  it("the sanctioned dynamic import inside the default factory is on the source", () => {
    const source = readFileSync(join(__dirname, "../local-anthropic-adapter.ts"), "utf-8");
    expect(source).toMatch(/import\(["']@anthropic-ai\/sdk["']\)/);
  }, 20000);
});
