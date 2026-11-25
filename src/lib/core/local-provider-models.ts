/**
 * PLAN-v5 — provider MODEL LISTS for the shell's Settings picker.
 *
 * One optional port (`GET /provider-models/:provider`), implemented by the
 * composition root because it needs the operator env (the OpenCode key) and
 * the network (only for the OpenCode Go listing). The host itself stays
 * transport-free and 501s without a plant.
 *
 *  - `opencode`  → live `GET <go>/v1/models` with the operator's key
 *                  (Go/Console Chat Completions models), label = name when the
 *                  catalogue carries one.
 *  - `anthropic` → a static id list (the Messages API has no public model
 *                  enumeration without a key; these are the repo's known ids).
 *  - `localhost` / `auto` → slice 4a's detection, flattened with its label.
 *  - anything else → empty (the shell keeps the free-text field).
 */
import {
  detectLocalProviders,
  type DetectLocalProvidersOptions,
  type DetectedLocalProvider,
} from "./local-provider-adapter";

export interface ProviderModelInfo {
  readonly id: string;
  readonly label?: string;
}

export interface LocalProviderModelsPort {
  list(provider: string): Promise<readonly ProviderModelInfo[]>;
}

export interface LocalProviderModelsDeps {
  /** The composition root's merged env (process env + .env.local + settings). */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Injectable transport (tests); default: the global fetch. */
  readonly fetchImpl?: typeof fetch;
  /** Injectable detection (tests); default: slice 4a's real probes. */
  readonly detect?: (o?: DetectLocalProvidersOptions) => Promise<readonly DetectedLocalProvider[]>;
}

const ANTHROPIC_MODELS: readonly ProviderModelInfo[] = [
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "claude-opus-4-5", label: "Claude Opus 4.5" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
];

/** The OpenCode models root: `<go base>/v1/models`. */
function opencodeModelsUrl(endpoint: string | undefined): string {
  const base = (endpoint ?? "https://opencode.ai/inference/go/openai/v1")
    .replace(/\/+$/, "")
    .replace(/\/openai\/v1$/, "");
  return `${base}/v1/models`;
}

export function makeLocalProviderModelsPort(
  deps: LocalProviderModelsDeps = {},
): LocalProviderModelsPort {
  const env = deps.env ?? process.env;
  const doFetch = deps.fetchImpl ?? fetch;
  const detect = deps.detect ?? detectLocalProviders;

  return {
    async list(provider) {
      if (provider === "anthropic") return ANTHROPIC_MODELS;

      if (provider === "localhost" || provider === "auto") {
        const detected = await detect();
        const out: ProviderModelInfo[] = [];
        for (const d of detected) {
          for (const id of d.models) {
            out.push({ id, label: `${d.label} — ${id}` });
          }
        }
        return out;
      }

      if (provider === "opencode") {
        const key = env["GW_LOCAL_API_KEY"];
        if (!key) throw new Error("GW_LOCAL_API_KEY is not configured");
        const res = await doFetch(opencodeModelsUrl(env["GW_LOCAL_ENDPOINT_URL"]), {
          method: "GET",
          headers: { authorization: `Bearer ${key}`, accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        } as RequestInit);
        if (!res.ok) throw new Error(`OpenCode model listing failed (HTTP ${res.status})`);
        const body = (await res.json()) as { data?: { id?: unknown; name?: unknown }[] };
        return (body.data ?? [])
          .map((m) =>
            typeof m?.id === "string"
              ? { id: m.id, ...(typeof m.name === "string" ? { label: m.name } : {}) }
              : null,
          )
          .filter((m): m is ProviderModelInfo => m !== null);
      }

      return [];
    },
  };
}
