/**
 * PLAN-v5 — provider model lists for the Settings picker. Pure unit tests over
 * injected transport/detection; no real network.
 */
import { describe, expect, it, vi } from "vitest";
import { makeLocalProviderModelsPort } from "@/lib/core/local-provider-models";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("local provider model lists", () => {
  it(
    "anthropic: the static known-id list, no network",
    async () => {
      const port = makeLocalProviderModelsPort({
        fetchImpl: (() => {
          throw new Error("must not be called");
        }) as never,
      });
      const models = await port.list("anthropic");
      expect(models.map((m) => m.id)).toEqual([
        "claude-sonnet-4-5",
        "claude-sonnet-5",
        "claude-opus-4-5",
        "claude-haiku-4-5",
      ]);
    },
    20000,
  );

  it(
    "localhost/auto: detection flattened with provider labels",
    async () => {
      const port = makeLocalProviderModelsPort({
        detect: async () => [
          { baseUrl: "http://127.0.0.1:11434/v1", label: "Ollama", models: ["llama3.2:1b", "llama3.2:3b"] },
        ],
      });
      expect(await port.list("localhost")).toEqual([
        { id: "llama3.2:1b", label: "Ollama — llama3.2:1b" },
        { id: "llama3.2:3b", label: "Ollama — llama3.2:3b" },
      ]);
      expect(await port.list("auto")).toHaveLength(2);
    },
    20000,
  );

  it(
    "opencode: live catalogue from the Go models URL with the operator key",
    async () => {
      const seen: { url?: string; auth?: string } = {};
      const fetchImpl = vi.fn(async (url: unknown, init?: { headers?: Record<string, string> }) => {
        seen.url = String(url);
        seen.auth = init?.headers?.["authorization"];
        return jsonResponse({
          data: [
            { id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash 1017" },
            { id: "kimi-k3" },
          ],
        });
      });
      const port = makeLocalProviderModelsPort({
        env: { GW_LOCAL_API_KEY: "test-key" },
        fetchImpl: fetchImpl as never,
      });
      expect(await port.list("opencode")).toEqual([
        { id: "deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash 1017" },
        { id: "kimi-k3" },
      ]);
      expect(seen.url).toBe("https://opencode.ai/inference/go/v1/models");
      expect(seen.auth).toBe("Bearer test-key");
    },
    20000,
  );

  it(
    "opencode: an endpoint override keeps its Go root; missing key and non-200s reject loudly",
    async () => {
      const seen: string[] = [];
      const fetchImpl = vi.fn(async (url: unknown) => {
        seen.push(String(url));
        return jsonResponse({ data: [] });
      });
      const port = makeLocalProviderModelsPort({
        env: {
          GW_LOCAL_API_KEY: "k",
          GW_LOCAL_ENDPOINT_URL: "https://gateway.example/go/openai/v1",
        },
        fetchImpl: fetchImpl as never,
      });
      expect(await port.list("opencode")).toEqual([]);
      expect(seen[0]).toBe("https://gateway.example/go/v1/models");

      await expect(
        makeLocalProviderModelsPort({ env: {}, fetchImpl: fetchImpl as never }).list("opencode"),
      ).rejects.toThrow(/GW_LOCAL_API_KEY/);

      await expect(
        makeLocalProviderModelsPort({
          env: { GW_LOCAL_API_KEY: "k" },
          fetchImpl: (async () => new Response("nope", { status: 503 })) as never,
        }).list("opencode"),
      ).rejects.toThrow(/HTTP 503/);
    },
    20000,
  );

  it(
    "unknown providers (and generic) return an empty list — the shell keeps free text",
    async () => {
      const port = makeLocalProviderModelsPort({ env: {} });
      expect(await port.list("generic")).toEqual([]);
      expect(await port.list("off")).toEqual([]);
    },
    20000,
  );
});
