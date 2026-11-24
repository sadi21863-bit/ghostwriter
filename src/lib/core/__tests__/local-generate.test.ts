/**
 * Phase 3 §2 stage (a) — `POST /ai/generate` mounted on the loopback transport.
 *
 * The mount is driven through a REAL listening host (the same open-socket
 * discipline as local-host.test.ts, no mocked transport), asserting what a
 * composition root and a local client would actually see:
 *
 *  - the route answers 501 in the default surface (OFF until `generation` is
 *    planted) — never a silent half-mount;
 *  - a planted bundle drives the real `generateChapter` pipeline, mirroring
 *    the cloud route's success body and its validate/authorize/buildContext
 *    control vocabulary byte for byte;
 *  - post-generate failures map to the same 429/400/500 bodies the cloud
 *    route produced, with the provider's words logged rather than shown;
 *  - a bundle cannot carry a meter port or a gate — even smuggled in through a
 *    cast — because the mount builds the pipeline ports explicitly (the
 *    stage-(b) record-only meter rides on the bundle and consults only the
 *    mount, after a success; it never reaches `generateChapter`'s ports);
 *  - `projectScope` is enforced at the edge and `stream: true` is refused
 *    before anything runs.
 */

import { describe, it, expect, afterAll, vi } from "vitest";
import {
  createLocalHostServer,
  defaultLocalRoutes,
  type DefaultRouteDeps,
  type LocalHost,
  type LocalHostOptions,
} from "@/lib/core/local-host";
import type { LocalGenerationDeps } from "@/lib/core/local-host";
import { readLocalGenerationProfile } from "@/lib/core/local-generation-profile";

const ownedServers: LocalHost[] = [];
afterAll(async () => {
  await Promise.all(ownedServers.map((s) => s.close().catch(() => undefined)));
});

/** Boot with the minimal §7 stub repos plus the generation deps under test. */
async function boot(
  generation?: Record<string, unknown>,
  overrides: Partial<Omit<LocalHostOptions, "routes">> = {},
): Promise<LocalHost> {
  const routes = defaultLocalRoutes({
    chapterRepo: {
      ownsProject: async () => true,
      updateScoped: async () => null,
      deleteScoped: async () => undefined,
    },
    storyBibleRepo: {
      ownsProject: async () => true,
      readSections: async () => ({}),
    },
    storyTransactionRepo: {
      ownsProject: async () => true,
      record: async () => undefined,
      applyChanges: async () => undefined,
    },
    ...(generation === undefined ? {} : { generation: generation as unknown as LocalGenerationDeps }),
  });
  const host = await createLocalHostServer({ routes, ...overrides });
  ownedServers.push(host);
  return host;
}

function post(host: LocalHost, body: unknown): Promise<Response> {
  return fetch(`${host.origin}/ai/generate`, {
    method: "POST",
    headers: { authorization: `Bearer ${host.token}`, "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

describe("POST /ai/generate — the phase 3 §2 stage-(a) mount", () => {
  it("501s before any pipeline work when the composition root plants no bundle", async () => {
    const host = await boot();
    const res = await post(host, { mode: "write", prompt: "Hi" });
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "AI generation is not configured for this host.",
    });
  });

  it("200s a happy path with the cloud route's exact success body and pipeline defaults", async () => {
    const generate = vi.fn(async (_req: unknown, _genCtx: unknown) => ({
      text: "Prose for write",
      model: "local-model",
      tokensUsed: 11,
    }));
    const host = await boot({ generate });
    const res = await post(host, { mode: "write", prompt: "A storm rolls in." });
    expect(res.status).toBe(200);
    // Byte-shaped like the cloud route: {text, model, tokensUsed}, nothing more.
    expect(await res.json()).toEqual({ text: "Prose for write", model: "local-model", tokensUsed: 11 });
    const [reqArg, genCtx] = generate.mock.calls[0]!;
    expect(reqArg).toMatchObject({ mode: "write", prompt: "A storm rolls in." });
    // No chooseProvider port was planted, so the pipeline's defaults ride.
    expect(genCtx).toEqual({ staticContext: undefined, dynamicContext: undefined, provider: "default", model: "default" });
  });

  it("400s a blank prompt with the exact validate body — generate never hears it", async () => {
    const generate = vi.fn(async () => ({ text: "nope", model: "m", tokensUsed: 1 }));
    const host = await boot({ generate });
    const res = await post(host, { mode: "write", prompt: "   " });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, status: 400, error: "Prompt is required" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("400s an over-limit context with the cloud ceiling body, ahead of the bundle's own builder", async () => {
    const buildContext = vi.fn(async () => ({ static: "c", dynamic: "c" }));
    const generate = vi.fn(async () => ({ text: "t", model: "m", tokensUsed: 1 }));
    const host = await boot({ generate, buildContext });
    const res = await post(host, {
      mode: "write",
      prompt: "x",
      context: "c".repeat(150001),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      status: 400,
      error: "Context too large. Try reducing your World Bible or clearing old memories.",
    });
    // The ceiling is the mount's guard, not part of any provider's assembly.
    expect(buildContext).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("carries a bundled builder's own buildContext stop through as a 400", async () => {
    const generate = vi.fn(async () => ({ text: "t", model: "m", tokensUsed: 1 }));
    const host = await boot({
      generate,
      buildContext: async () => ({
        stop: { ok: false, stoppedAt: "buildContext", control: { error: "no local provider context" } },
      }),
    });
    const res = await post(host, { mode: "write", prompt: "x" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, status: 400, error: "no local provider context" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("429s a post-generate rate-limit reason with the cloud billing shape (retryable)", async () => {
    const generate = vi.fn(async () => {
      throw new Error("429 rate_limit_error from upstream");
    });
    const host = await boot({ generate });
    const res = await post(host, { mode: "write", prompt: "x" });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      ok: false,
      status: 429,
      error: "Anthropic rate limit hit. Wait a moment and try again.",
      retryable: true,
    });
  });

  it("400s a post-generate context-length reason", async () => {
    const generate = vi.fn(async () => {
      throw new Error("request too long: context_length exceeded the window");
    });
    const host = await boot({ generate });
    const res = await post(host, { mode: "write", prompt: "x" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      status: 400,
      error: "Context too long. Reduce World Bible detail or clear old memories.",
    });
  });

  it("500s any other post-generate failure — the provider's words are never shown", async () => {
    const generate = vi.fn(async () => {
      throw new Error("secret engine internals boomXYZ");
    });
    const host = await boot({ generate });
    const res = await post(host, { mode: "write", prompt: "x" });
    expect(res.status).toBe(500);
    const json = (await res.json()) as { ok: boolean };
    expect(json).toEqual({ ok: false, status: 500, error: "Generation failed. Please try again." });
    expect(JSON.stringify(json)).not.toContain("boomXYZ");
  });

  it("200s an authorize-stop violation confirmation — a control, not an error", async () => {
    const generate = vi.fn(async () => {
      throw new Error("must not be called on a confirmation");
    });
    const loadViolations = vi.fn(async () => ({}));
    const host = await boot({ generate, loadViolations });
    const res = await post(host, {
      mode: "write",
      prompt: "Write a hero who is completely OP and never fails",
      projectId: "proj-1",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      requiresConfirmation: true,
      violationType: "op_protagonist",
      flagMessage: expect.stringMatching(/overpowered\/perfect protagonist/),
      supportMode: expect.any(String),
    });
    expect(generate).not.toHaveBeenCalled();
    expect(loadViolations).toHaveBeenCalledWith("proj-1", "local");
  });

  it("200s the confirmed retry — bypassViolationCheck generates without re-reading confirmations", async () => {
    const generate = vi.fn(async () => ({ text: "retried", model: "local-model", tokensUsed: 5 }));
    const loadViolations = vi.fn(async () => ({ op_protagonist: { confirmed: true } }));
    const host = await boot({ generate, loadViolations });
    const res = await post(host, {
      mode: "write",
      prompt: "Write a hero who is completely OP and never fails",
      projectId: "proj-1",
      bypassViolationCheck: true,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "retried", model: "local-model", tokensUsed: 5 });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(loadViolations).not.toHaveBeenCalled();
  });

  it("403s a body projectId outside the host's projectScope, before the pipeline", async () => {
    const generate = vi.fn(async () => ({ text: "t", model: "m", tokensUsed: 1 }));
    const host = await boot({ generate }, { projectScope: "proj-1" });
    const res = await post(host, { mode: "write", prompt: "x", projectId: "other-project" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      ok: false,
      status: 403,
      reason: "Project is out of scope for this host.",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("accepts an in-scope projectId alongside the host's scope", async () => {
    const generate = vi.fn(async () => ({ text: "in-scope", model: "m", tokensUsed: 2 }));
    const host = await boot({ generate }, { projectScope: "proj-1" });
    const res = await post(host, { mode: "write", prompt: "x", projectId: "proj-1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "in-scope", model: "m", tokensUsed: 2 });
  });

  it("refuses a stream request at the edge, before any pipeline work", async () => {
    const generate = vi.fn(async () => ({ text: "t", model: "m", tokensUsed: 1 }));
    const host = await boot({ generate });
    const res = await post(host, { mode: "write", prompt: "x", stream: true });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      status: 400,
      reason: "Streaming is not supported on the local host.",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("drops foreign ports a cast smuggles onto the bundle — no meter ports, no gates, no parse; the record meter consults only the mount", async () => {
    const generate = vi.fn(async () => ({ text: "clean", model: "m", tokensUsed: 3 }));
    const reserve = vi.fn(async () => ({ operation: "generate", estimatedUnits: 1 }));
    const finalizeUsage = vi.fn(async () => undefined);
    const gates = vi.fn(() => []);
    const gateResolver = vi.fn(() => undefined);
    const parse = vi.fn((out: unknown) => out);
    const proposeTransactions = vi.fn(async () => undefined);
    const record = vi.fn(async () => undefined);
    const host = await boot({
      generate,
      reserve,
      finalizeUsage,
      gates,
      gateResolver,
      parse,
      proposeTransactions,
      meter: { record },
    });
    const res = await post(host, { mode: "write", prompt: "x" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { text: string }).text).toBe("clean");
    expect(reserve).not.toHaveBeenCalled();
    expect(finalizeUsage).not.toHaveBeenCalled();
    expect(gates).not.toHaveBeenCalled();
    expect(gateResolver).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
    expect(proposeTransactions).not.toHaveBeenCalled();
    // Stage (b): a `meter` key riding the bundle is consulted exactly once —
    // by the MOUNT's own call-site, never through the pipeline ports (an
    // explicit-assembly regression that spread it in would have armed
    // `reserve`, which never fired above).
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("carries the mode directive into the generate port's prompt and composes the dynamic block", async () => {
    const generate = vi.fn(async (_req: unknown, _genCtx: unknown) => ({
      text: "directive rode along",
      model: "m",
      tokensUsed: 4,
    }));
    const host = await boot({ generate });
    const res = await post(host, {
      mode: "brainstorm",
      prompt: "Neighbourhood watch as folk horror.",
      staticContext: "STATIC",
      dynamicContext: "DYN",
      additionalContext: "EXTRA",
    });
    expect(res.status).toBe(200);
    const [reqArg, genCtx] = generate.mock.calls[0]!;
    // The built-in builder suffixed the mode directive onto the prompt —
    // still the caller's words first, and strictly longer.
    const prompt = String((reqArg as { prompt: string }).prompt);
    expect(prompt.startsWith("Neighbourhood watch as folk horror.")).toBe(true);
    expect(prompt.length).toBeGreaterThan("Neighbourhood watch as folk horror.".length);
    // …and the composed dynamic block joins the two client-supplied parts.
    expect(genCtx).toEqual({ staticContext: "STATIC", dynamicContext: "DYN\n\nEXTRA", provider: "default", model: "default" });
  });
});

describe("POST /ai/generate — the phase 3 §2.3 stage-(b) record-only meter", () => {
  const failingGenerate = (msg: string) => vi.fn(async () => { throw new Error(msg); });

  it("records exactly once after a success, with the generate port's own report", async () => {
    const record = vi.fn(async (_entry: unknown) => undefined);
    const generate = vi.fn(async () => ({ text: "Prose for write", model: "local-model", tokensUsed: 11 }));
    const host = await boot({ generate, meter: { record } });
    const res = await post(host, { mode: "write", prompt: "A storm rolls in." });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "Prose for write", model: "local-model", tokensUsed: 11 });
    expect(record).toHaveBeenCalledTimes(1);
    const entry = record.mock.calls[0]![0] as {
      operation?: string; model?: string; tokensUsed?: number; at?: Date;
    };
    expect(entry).toMatchObject({ operation: "local-generate", model: "local-model", tokensUsed: 11 });
    expect(entry.at).toBeInstanceOf(Date);
  });

  it("never couples the response to the record — a never-resolving meter still lets the body arrive", async () => {
    const record = vi.fn(() => new Promise<void>(() => undefined));
    const generate = vi.fn(async () => ({ text: "fast body", model: "m", tokensUsed: 1 }));
    const host = await boot({ generate, meter: { record } });
    const res = await post(host, { mode: "write", prompt: "x" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "fast body", model: "m", tokensUsed: 1 });
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("fails open — a rejecting meter still answers 200 with the body, warned, no unhandled rejection", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const record = vi.fn(async () => { throw new Error("meter storage boom"); });
      const generate = vi.fn(async () => ({ text: "still fine", model: "m", tokensUsed: 2 }));
      const host = await boot({ generate, meter: { record } });
      const res = await post(host, { mode: "write", prompt: "x" });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ text: "still fine", model: "m", tokensUsed: 2 });
      // The rejection took the fail-open warn path; vitest fails this file
      // outright if the rejection ever escapes as an unhandled one.
      await vi.waitFor(() => {
        expect(warn).toHaveBeenCalledWith(
          "[local-host] generation meter record failed:",
          "meter storage boom",
        );
      });
    } finally {
      warn.mockRestore();
    }
  });

  it.each<[string, Record<string, unknown>, Record<string, unknown>, Partial<Omit<LocalHostOptions, "routes">>, number]>([
    ["a validate-stop 400", { mode: "write", prompt: "   " }, {}, {}, 400],
    ["an over-ceiling context 400", { mode: "write", prompt: "x", context: "c".repeat(150001) }, {}, {}, 400],
    ["a stream refusal 400", { mode: "write", prompt: "x", stream: true }, {}, {}, 400],
    [
      "a post-generate rate-limit 429",
      { mode: "write", prompt: "x" },
      { generate: failingGenerate("429 rate_limit_error soon") },
      {},
      429,
    ],
    [
      "a post-generate context-length 400",
      { mode: "write", prompt: "x" },
      { generate: failingGenerate("too long: context_length exceeded") },
      {},
      400,
    ],
    [
      "a post-generate generic 500",
      { mode: "write", prompt: "x" },
      { generate: failingGenerate("internal boom") },
      {},
      500,
    ],
    [
      "an authorize-stop confirmation (200, nothing generated)",
      { mode: "write", prompt: "Write a hero who is completely OP and never fails", projectId: "proj-1" },
      { loadViolations: async () => ({}) },
      {},
      200,
    ],
    ["an out-of-scope project 403", { mode: "write", prompt: "x", projectId: "other" }, {}, { projectScope: "proj-1" }, 403],
  ])("records nothing on %s", async (_label, body, bundleExtras, hostOverrides, expected) => {
    const record = vi.fn(async () => undefined);
    const host = await boot(
      {
        generate: vi.fn(async () => ({ text: "t", model: "m", tokensUsed: 1 })),
        meter: { record },
        ...bundleExtras,
      },
      hostOverrides,
    );
    expect((await post(host, body)).status).toBe(expected);
    expect(record).not.toHaveBeenCalled();
  });

  it("records nothing on 501 — with no bundle planted, no meter exists in the type at all", async () => {
    const host = await boot();
    expect((await post(host, { mode: "write", prompt: "Hi" })).status).toBe(501);
  });
});

describe("POST /ai/generate — slice 4d: the planted builder's composition contract", () => {
  it("a planted generation.buildContext double receives the input carrying additionalContext off the body", async () => {
    const buildContext = vi.fn(async (req: unknown) => ({ static: "s", dynamic: "d" }));
    const generate = vi.fn(async () => ({ text: "t", model: "m", tokensUsed: 1 }));
    const host = await boot({ generate, buildContext });
    const res = await post(host, {
      mode: "write",
      prompt: "x",
      additionalContext: "EXTRA",
      dynamicContext: "DYN",
    });
    expect(res.status).toBe(200);
    // The §2.7 planted lane sees the FULL body-carried input — the 4d field
    // rides the pipeline request so a real local builder can compose it.
    expect(buildContext.mock.calls[0]![0]).toMatchObject({
      additionalContext: "EXTRA",
      dynamicContext: "DYN",
    });
  });

  it("after the planted builder resolves, the generate port's effective prompt carries the mode directive — the floor keeps its own", async () => {
    const generate = vi.fn(async (_req: { prompt: string }) => ({ text: "t", model: "m", tokensUsed: 1 }));
    const host = await boot({
      generate,
      buildContext: async () => ({ static: "S", dynamic: "D" }),
    });
    const res = await post(host, { mode: "brainstorm", prompt: "Neighbourhood watch as folk horror." });
    expect(res.status).toBe(200);
    const prompt = String(
      (generate.mock.calls[0]![0] as { prompt: string }).prompt,
    );
    // The MOUNT owns effectivePrompt on this branch now: the cloud's
    // cap→suffix order minus the cap — the caller's words first, the
    // brainstorm directive's marker after.
    expect(prompt.startsWith("Neighbourhood watch as folk horror.")).toBe(true);
    expect(prompt).toContain("OPTION A —");
  });
});

describe("LocalGenerationProfile — env read (§2.7)", () => {
  it("defaults to an all-unset profile with no key present", () => {
    expect(readLocalGenerationProfile({})).toEqual({
      provider: null,
      models: { default: null, fast: null, quality: null },
      contextCap: null,
      hasApiKey: false,
      // Stage-(d) evolution (§5.6): tier + media-provider key PRESENCE flags
      // default to unset when the environment carries nothing.
      tier: null,
      hasSegmindKey: false,
      hasOpenAIKey: false,
    });
  });

  it("shapes a full env, reading the cap as a strict positive integer", () => {
    expect(
      readLocalGenerationProfile({
        GW_LOCAL_PROVIDER: "openai-compatible",
        GW_LOCAL_MODEL: "gpt-oss-120b",
        GW_LOCAL_FAST_MODEL: "gpt-oss-20b",
        GW_LOCAL_QUALITY_MODEL: "gpt-oss-120b",
        GW_LOCAL_CONTEXT_CAP: "150000",
        GW_LOCAL_API_KEY: "sk-profile-presence-test",
      }),
    ).toEqual({
      provider: "openai-compatible",
      models: { default: "gpt-oss-120b", fast: "gpt-oss-20b", quality: "gpt-oss-120b" },
      contextCap: 150000,
      hasApiKey: true,
      // No media-provider keys in this env — presence-only, still false.
      tier: null,
      hasSegmindKey: false,
      hasOpenAIKey: false,
    });
  });

  it("treats garbage caps as unset", () => {
    expect(readLocalGenerationProfile({ GW_LOCAL_CONTEXT_CAP: "8k" }).contextCap).toBeNull();
    expect(readLocalGenerationProfile({ GW_LOCAL_CONTEXT_CAP: "-5" }).contextCap).toBeNull();
    expect(readLocalGenerationProfile({ GW_LOCAL_CONTEXT_CAP: "0" }).contextCap).toBeNull();
  });

  it("reduces the key to presence — its VALUE never survives serialization", () => {
    const profile = readLocalGenerationProfile({ GW_LOCAL_API_KEY: "sk-very-secret-profile-value" });
    expect(profile.hasApiKey).toBe(true);
    expect(JSON.stringify(profile)).not.toContain("sk-very-secret-profile-value");
  });
});
