/**
 * Phase 4 slice 4a — the local provider seam, verified over REAL sockets
 * against in-process fixtures (the local-host.test.ts convention): the one
 * OpenAI-compatible adapter's wire shape, model resolution, header behavior,
 * and the cloud route's reason→status vocabulary translation; plus §12's
 * localhost detection (port probes, honest skip semantics, the documented
 * default list pin). No test path touches a real model server — every
 * provider here is a node:http handler this file started and stops.
 */

import { describe, it, expect, afterAll } from "vitest";
import http from "node:http";
import type { IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  makeOpenAICompatibleGenerate,
  detectLocalProviders,
  LOCAL_PROVIDER_PROBES,
  type LocalOpenAIEndpoint,
} from "@/lib/core/local-provider-adapter";
import { ARTIFACT_VS_PERSONA_RULE, MI } from "@/lib/ai/engine";

const created: http.Server[] = [];
afterAll(() => {
  for (const s of created) {
    s.closeAllConnections?.();
    s.close();
  }
  created.length = 0;
});

type FixtureHandler = (
  req: IncomingMessage,
  body: string,
  res: http.ServerResponse,
) => void | Promise<void>;

async function startFixture(handler: FixtureHandler): Promise<number> {
  const server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += String(chunk);
    await handler(req, raw, res);
  });
  created.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  return (server.address() as AddressInfo).port;
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(body === undefined ? "{}" : JSON.stringify(body));
}

const endpoint = (port: number, extra: Partial<LocalOpenAIEndpoint> = {}): LocalOpenAIEndpoint => ({
  baseUrl: `http://127.0.0.1:${port}/v1`,
  model: "fixture-model",
  ...extra,
});

const call = (
  gen: ReturnType<typeof makeOpenAICompatibleGenerate>,
  model: string,
  ctx: { staticContext?: string; dynamicContext?: string } = {},
) =>
  gen(
    { mode: "write", prompt: "PROMPT SENTINEL", format: "Novel" },
    { provider: "fixture", model, ...ctx },
  );

describe("the OpenAI-compatible generate adapter (the wire)", () => {
  it("posts the resolved model + assembled system + the prompt, and maps the response shape", async () => {
    let seenUrl = "";
    let seenAuth = "";
    let seenBody: Record<string, unknown> | null = null;
    const port = await startFixture((req, body, res) => {
      seenUrl = req.url ?? "";
      seenAuth = req.headers["authorization"] ?? "";
      seenBody = JSON.parse(body) as Record<string, unknown>;
      send(res, 200, {
        choices: [{ message: { content: "the fixture's prose" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
    });

    const gen = makeOpenAICompatibleGenerate(endpoint(port));
    const out = await call(gen, "default", {
      staticContext: "STATIC SENTINEL",
      dynamicContext: "DYNAMIC SENTINEL",
    });
    expect(out).toEqual({ text: "the fixture's prose", model: "fixture-model", tokensUsed: 15 });

    expect(seenUrl).toBe("/v1/chat/completions");
    // No credential out without one — a localhost server gets no auth header.
    expect(seenAuth).toBe("");
    expect(seenBody!["model"]).toBe("fixture-model");
    expect(seenBody!["stream"]).toBe(false);
    expect(seenBody!["max_tokens"]).toBe(8000);
    expect(seenBody!["temperature"]).toBeUndefined();
    const messages = seenBody!["messages"] as { role: string; content: string }[];
    expect(messages).toHaveLength(2);
    expect(messages[0]!.role).toBe("system");
    const system = messages[0]!.content;
    // The cloud assembly, byte-parity where the local surface can express it:
    // the artifact rule leads, the write mode's MI applies, then both context
    // blocks ride after \n---\n separators, static before dynamic.
    expect(system.startsWith(ARTIFACT_VS_PERSONA_RULE)).toBe(true);
    expect(system.includes(MI.write!("Novel"))).toBe(true);
    expect(system.indexOf("STATIC SENTINEL")).toBeGreaterThan(-1);
    expect(system.indexOf("DYNAMIC SENTINEL")).toBeGreaterThan(system.indexOf("STATIC SENTINEL"));
    expect(messages[1]!.role).toBe("user");
    expect(messages[1]!.content).toBe("PROMPT SENTINEL");
  }, 20000);

  it("a pathless origin baseUrl gains /v1 (the compatible-API default, never a guess)", async () => {
    let seenUrl = "";
    const port = await startFixture((req, _body, res) => {
      seenUrl = req.url ?? "";
      send(res, 200, { choices: [{ message: { content: "ok" } }] });
    });
    const gen = makeOpenAICompatibleGenerate({
      baseUrl: `http://127.0.0.1:${port}`,
      model: "fixture-model",
    });
    await call(gen, "default");
    expect(seenUrl).toBe("/v1/chat/completions");
  }, 20000);

  it("routing's explicit model wins over the endpoint default, and the outcome echoes the RESOLVED id", async () => {
    let seenBody: Record<string, unknown> | null = null;
    const port = await startFixture((req, body, res) => {
      seenBody = JSON.parse(body) as Record<string, unknown>;
      send(res, 200, { choices: [{ message: { content: "x" } }] });
    });
    const gen = makeOpenAICompatibleGenerate(endpoint(port));
    const out = await call(gen, "slot-model:latest");
    expect(seenBody!["model"]).toBe("slot-model:latest");
    expect(out.model).toBe("slot-model:latest");
  }, 20000);

  it("an apiKey rides as a bearer; temperature rides only when set; usage.total_tokens wins", async () => {
    const seen: { auth: string[]; temps: unknown[] } = { auth: [], temps: [] };
    const port = await startFixture((req, body, res) => {
      seen.auth.push(req.headers["authorization"] ?? "(none)");
      const parsed = JSON.parse(body) as Record<string, unknown>;
      seen.temps.push(parsed["temperature"]);
      send(res, 200, {
        choices: [{ message: { content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] } }],
        usage: { total_tokens: 42, prompt_tokens: 1, completion_tokens: 1 },
      });
    });

    const withKey = makeOpenAICompatibleGenerate(endpoint(port, { apiKey: "sk-byok-secret" }), {
      temperature: 0.7,
    });
    const out = await call(withKey, "default");
    expect(out).toEqual({ text: "ab", model: "fixture-model", tokensUsed: 42 });
    // Two calls total: one with the key, one without — the header follows it.
    await call(makeOpenAICompatibleGenerate(endpoint(port)), "default");
    expect(seen.auth).toEqual(["Bearer sk-byok-secret", "(none)"]);
    expect(seen.temps).toEqual([0.7, undefined]);
  }, 20000);

  it.each([
    [429, { error: { message: "slow down" } }, /rate_limit.*slow down/],
    [400, { error: { message: "maximum context length exceeded" } }, /context_length.*maximum context length/],
    [400, { error: { message: "bad field" } }, /provider_error 400.*bad field/],
    [401, { error: { message: "no key" } }, /provider auth failed \(401\)/],
    [500, { error: { message: "kaboom" } }, /provider_error 500.*kaboom/],
  ])("status %i maps into the mount's reason→status vocabulary (provider words logged, never shown)", async (status, body, matcher) => {
    const port = await startFixture((_req, _body, res) => void send(res, status as number, body));
    const gen = makeOpenAICompatibleGenerate(endpoint(port));
    await expect(
      gen({ mode: "write", prompt: "p", format: "Novel" }, { provider: "f", model: "m" }),
    ).rejects.toThrow(matcher as RegExp);
  }, 20000);

  it("a broken endpoint surfaces as provider_error, and an unreachable one as provider unreachable", async () => {
    const noChoices = makeOpenAICompatibleGenerate(
      endpoint(await startFixture((_q, _b, res) => void send(res, 200, { choices: [] }))),
    );
    await expect(
      noChoices({ mode: "write", prompt: "p", format: "Novel" }, { provider: "f", model: "m" }),
    ).rejects.toThrow(/no choices/);

    const notJson = makeOpenAICompatibleGenerate(
      endpoint(
        await startFixture((_q, _b, res) => {
          res.writeHead(200, { "content-type": "application/json" });
          res.end("this is not json");
        }),
      ),
    );
    await expect(
      notJson({ mode: "write", prompt: "p", format: "Novel" }, { provider: "f", model: "m" }),
    ).rejects.toThrow(/malformed/);

    // A closed listener → ECONNREFUSED → provider unreachable.
    const port = await startFixture((_q, _b, res) => void send(res, 200, {}));
    await new Promise<void>((resolve) => {
      const s = created.pop()!;
      s.closeAllConnections?.();
      s.close(() => resolve());
    });
    const dead = makeOpenAICompatibleGenerate(endpoint(port));
    await expect(
      dead({ mode: "write", prompt: "p", format: "Novel" }, { provider: "f", model: "m" }),
    ).rejects.toThrow(/provider unreachable/);

    // A server that never answers inside its budget → abort → provider unreachable.
    const slow = makeOpenAICompatibleGenerate(
      endpoint(
        await startFixture((_q, _b, res) => {
          void res;
        }),
      ),
      { timeoutMs: 120 },
    );
    await expect(
      slow({ mode: "write", prompt: "p", format: "Novel" }, { provider: "f", model: "m" }),
    ).rejects.toThrow(/provider unreachable/);
  }, 30000);
});

describe("§12 localhost provider detection", () => {
  it("detects a compatible /v1/models server with its model list", async () => {
    const port = await startFixture((_req, _body, res) => {
      send(res, 200, { object: "list", data: [{ id: "qwen3:8b" }, { id: "llama3.1" }] });
    });
    const found = await detectLocalProviders({
      probes: [{ port, label: "Fixture" }],
      timeoutMs: 2000,
    });
    expect(found).toEqual([
      { baseUrl: `http://127.0.0.1:${port}/v1`, label: "Fixture", models: ["qwen3:8b", "llama3.1"] },
    ]);
  }, 20000);

  it("skips everything that is not honestly OpenAI-compatible: refused, 5xx, garbage, empty", async () => {
    const garbage = await startFixture((_req, _body, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end("not json at all");
    });
    const empty = await startFixture((_req, _body, res) => void send(res, 200, { data: [] }));
    const noIds = await startFixture((_req, _body, res) => void send(res, 200, { data: [{ number: 1 }] }));
    const fiveHundred = await startFixture((_req, _body, res) => void send(res, 500, {}));

    const found = await detectLocalProviders({
      probes: [
        { port: garbage, label: "garbage" },
        { port: empty, label: "empty" },
        { port: noIds, label: "noIds" },
        { port: fiveHundred, label: "500" },
        // A port nothing listens on (loopback refusal, logged-in port 1).
        { port: 1, label: "dead" },
      ],
      timeoutMs: 2000,
    });
    expect(found).toEqual([]);
  }, 20000);

  it("a slow endpoint times out of detection instead of hanging the probe pass", async () => {
    const slow = await startFixture((_req, _body, res) => {
      setTimeout(() => {
        void send(res, 200, { data: [{ id: "late" }] });
      }, 400);
    });
    const t0 = Date.now();
    const found = await detectLocalProviders({
      probes: [{ port: slow, label: "slow" }],
      timeoutMs: 80,
    });
    expect(found).toEqual([]);
    expect(Date.now() - t0).toBeLessThan(3000);
  }, 20000);

  it("the documented default probe list is pinned (env overrides belong to the composition slice)", () => {
    expect([...LOCAL_PROVIDER_PROBES]).toEqual([
      { port: 11434, label: "Ollama" },
      { port: 1234, label: "LM Studio" },
      { port: 8080, label: "Local server" },
    ]);
  }, 20000);
});

describe("local provider adapter — source purity (live-shell-reachability convention)", () => {
  it("never imports the Neon side, the pg schema, or the Next runtime", () => {
    const source = readFileSync(join(__dirname, "../local-provider-adapter.ts"), "utf-8");
    expect(source).not.toMatch(/"@\/db"|'@\/db'|"@\/db\/schema"|'@\/db\/schema'/);
    expect(source).not.toMatch(/"next(\/|-auth)?"/);
    expect(source).not.toMatch(/@neondatabase\/serverless/);
  }, 20000);
});
