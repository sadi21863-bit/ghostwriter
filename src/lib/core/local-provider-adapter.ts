/**
 * Master-plan Phase 4 (§12/§12.1, §18 "Provider portability"), slice 4a — the
 * LOCAL provider seam. Two capabilities, both import-pure (no `@/db`, no Next,
 * no Neon) and both injectable so no test path ever touches a real provider:
 *
 *  - `makeOpenAICompatibleGenerate(endpoint)` — §12.1's "ONE configurable
 *    OpenAI-compatible adapter": one `LocalOpenAIEndpoint` ({ baseUrl, model,
 *    optional BYOK apiKey }) covers localhost servers (Ollama/LM Studio/
 *    llama.cpp server) and compatible cloud endpoints alike. It returns the
 *    exact shape `LocalGenerationDeps.generate` carries
 *    (`GenerateChapterPorts["generate"]`), so a composition root plants it
 *    into the bundle with zero adapter glue.
 *
 *  - `detectLocalProviders()` — §12's "auto-detect supported localhost
 *    providers". Probes `GET /v1/models` on a documented port list with a
 *    short per-probe timeout, returning only servers that answer with a real
 *    OpenAI-compatible model listing. Localhost servers carry no credential
 *    and no external spend, so a composition root may compose from this —
 *    but never from a cloud key (§5.6: real provider spend is a named,
 *    separately-reviewed step, never a boot default).
 *
 * Prompt assembly mirrors the cloud engine (`src/lib/ai/engine.ts`)
 * byte-for-byte where the local surface can express it: the instructions
 * head (`ARTIFACT_VS_PERSONA_RULE` + the mode's `MI[mode](format)`), the
 * format rules, the story craft directives, then the `static`/`dynamic`
 * context blocks after `\n---\n` separators — the same parts the Anthropic
 * call splits into cached system blocks, translated into ONE OpenAI
 * system message (no `cache_control`; that lever is the §4b dedicated
 * Anthropic adapter's). Two deliberate differences, both inherited from the
 * local mount's §2.2 floor: `narrativeStructure` cannot arrive (the field
 * has no place on the local body), and the else-branch precedence of the
 * cloud's legacy `body.context` cannot either — a locally-specified
 * `staticContext` always rides, so where the cloud falls back to the raw
 * `context` blob, the adapter keeps the static block content itself.
 *
 * The model id: `genCtx.model` wins except the pipeline's own `"default"`
 * placeholder (no `chooseProvider` port), which falls to
 * `endpoint.model`. The outcome echoes the RESOLVED id — the honest local
 * behavior, since without routing the requested "default" would leak into
 * the response body and the meter.
 *
 * Error translation keeps the cloud route's reason→status vocabulary —
 * the local mount's `mapGenerationOutcome` reuses it verbatim
 * (rate_limit/529 → 429 retryable; context_length/"too long" → 400;
 * everything else → 500 with the provider's own words logged, never shown).
 */

import {
  ARTIFACT_VS_PERSONA_RULE,
  MI,
  getFormatRules,
  getCraftDirectives,
} from "@/lib/ai/engine";
import type { GeneratedOutput } from "@/lib/ai/generation-service";
import { Agent, fetch as undiciFetch } from "undici";
import type {
  GenerateChapterInput,
  GenerateChapterPorts,
} from "./handlers/generate-chapter";

/**
 * PLAN-v5 — slow local models on CPU-only hardware legitimately take minutes
 * to produce a NON-STREAMING reply, so the response HEADERS only arrive after
 * generation completes. Node's global fetch is undici under the hood and its
 * DEFAULT headersTimeout (~300s) fires before the AbortSignal ceiling — the
 * same documented gotcha this repo already fixed for the Segmind client
 * (which also warns: never mix Node's built-in fetch with this package's
 * Agent — the version mismatch throws). The default transport is therefore
 * the package's OWN fetch + an Agent whose headers/body timeouts follow the
 * caller's `timeoutMs`. An injected `fetchImpl` is used verbatim (tests own
 * their transport).
 */
function makeTimeoutFetch(timeoutMs: number): typeof fetch {
  const agent = new Agent({ headersTimeout: timeoutMs, bodyTimeout: timeoutMs });
  const wrapped = (
    input: Parameters<typeof undiciFetch>[0],
    init?: Parameters<typeof undiciFetch>[1],
  ) => undiciFetch(input, { ...init, dispatcher: agent });
  return wrapped as unknown as typeof fetch;
}

export interface LocalOpenAIEndpoint {
  /**
   * Base URL INCLUDING the version segment, e.g. `http://127.0.0.1:11434/v1`.
   * A pathless origin (`http://127.0.0.1:1234`) gains `/v1` — that is the
   * compatible-API default, never a guess about a proxy's route table.
   */
  readonly baseUrl: string;
  /**
   * The model id this endpoint serves — the fallback when routing has no
   * opinion (`genCtx.model === "default"`, the pipeline's own placeholder).
   */
  readonly model: string;
  /**
   * The BYOK credential for a compatible cloud endpoint. Localhost servers
   * omit it: no header goes out without one. The VALUE may only ever come
   * from operator env via the composition root — never from a profile or a
   * serializable object (the LocalGenerationProfile presence-only rule).
   */
  readonly apiKey?: string;
}

export interface OpenAICompatibleGenerateOptions {
  readonly fetchImpl?: typeof fetch;
  /** Whole-request timeout; a local model can legitimately think for minutes. */
  readonly timeoutMs?: number;
  /** Requested completion budget; mirrors the cloud engine's default headroom. */
  readonly maxTokens?: number;
  /** Omitted from the wire unless set — a server's own default is honest. */
  readonly temperature?: number;
}

/** The `generate` port factory. Throws are the error TRANSLATION, not bugs. */
export function makeOpenAICompatibleGenerate(
  endpoint: LocalOpenAIEndpoint,
  opts: OpenAICompatibleGenerateOptions = {},
): NonNullable<GenerateChapterPorts["generate"]> {
  const timeoutMs = opts.timeoutMs ?? 300_000;
  const doFetch = opts.fetchImpl ?? makeTimeoutFetch(timeoutMs);
  const maxTokens = opts.maxTokens ?? 8000;
  const base = endpoint.baseUrl.replace(/\/+$/, "");
  const url = joinUrl(base, "/chat/completions");

  return async (
    req: GenerateChapterInput,
    genCtx: { staticContext?: string; dynamicContext?: string; provider: string; model: string },
  ): Promise<GeneratedOutput> => {
    const servedModel = genCtx.model && genCtx.model !== "default" ? genCtx.model : endpoint.model;
    const system = composeSystemMessage({
      mode: req.mode,
      format: req.format ?? "",
      staticContext: genCtx.staticContext,
      dynamicContext: genCtx.dynamicContext,
    });

    const payload: Record<string, unknown> = {
      model: servedModel,
      stream: false,
      max_tokens: maxTokens,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: req.prompt },
      ],
    };
    if (opts.temperature !== undefined) payload["temperature"] = opts.temperature;

    let res: Response;
    try {
      res = await doFetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(endpoint.apiKey ? { authorization: `Bearer ${endpoint.apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`provider unreachable (${servedModel} via ${url}): ${detail}`);
    }

    // Read the body ALWAYS — an error body's own words ARE the mount's
    // reason→status vocabulary input ("maximum context length" arrives in
    // the body, never the status line).
    const rawText = await res.text();
    if (!res.ok) throw translateHttpError(res.status, rawText);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      throw new Error(`provider_error: malformed response from ${url} (not JSON)`);
    }

    const choices = parsed["choices"];
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new Error(`provider_error: response carried no choices (${url})`);
    }
    const message = (choices[0] as { message?: { content?: unknown } }).message;
    const content = message?.content;
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
              .filter((p): p is { type: string; text: string } => {
                return typeof p === "object" && p !== null && (p as { type?: unknown }).type === "text";
              })
              .map((p) => p.text)
              .join("")
          : "";

    const usage = parsed["usage"] as
      | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      | undefined;
    const tokensUsed =
      usage?.total_tokens ??
      (usage?.prompt_tokens !== undefined && usage?.completion_tokens !== undefined
        ? usage.prompt_tokens + usage.completion_tokens
        : undefined);

    return {
      text,
      tokensUsed,
      // The resolved id, not the requested placeholder — see the header.
      model: servedModel,
    };
  };
}

/**
 * The cloud route's reason→status vocabulary, translated verbatim — the local
 * mount's mapGenerationOutcome runs the same string probes. Context-length
 * tagging is marker-based (a plain 400 is NOT a context error), matching the
 * real bodies both families of servers send ("maximum context length",
 * "context length", "prompt is too long"). The provider's own words stay
 * INSIDE the reason (logged by the mount, never shown).
 */
function translateHttpError(status: number, bodyText: string): Error {
  const detail = (bodyText || "(no body)").slice(0, 300);
  if (status === 429) return new Error(`rate_limit: ${detail}`);
  if (status === 401 || status === 403) return new Error(`provider auth failed (${status}): ${detail}`);
  if (/(context[\s_-]?length|maximum context|too long)/i.test(detail)) {
    return new Error(`context_length: rejected by provider — ${detail}`);
  }
  return new Error(`provider_error ${status}: ${detail}`);
}

/**
 * The engine's exact assembly order for the instructions head, factored out
 * so slice 4b's dedicated Anthropic adapter (`local-anthropic-adapter.ts`)
 * embeds the SAME head in its own cached system block:
 * ARTIFACT_VS_PERSONA_RULE + "\n\n" + MI[mode](format) + formatRules +
 * craftDirectives. `narrativeNote` has no local source (see header).
 */
export function composeInstructionalHead(mode: string, format: string): string {
  return (
    ARTIFACT_VS_PERSONA_RULE +
    "\n\n" +
    MI[mode as keyof typeof MI](format) +
    getFormatRules(format) +
    getCraftDirectives(format)
  );
}

/**
 * The engine's exact assembly order, translated to a single system message:
 * composeInstructionalHead + then "\n---\n"-delimited context blocks. Both
 * blocks ride when both are present; each rides alone when it is the only one
 * (the local floor can produce that; the cloud's else-branch legacy
 * `body.context` fallback cannot exist here); NEITHER → the empty block the
 * cloud's single-system path yields. `narrativeNote` has no local source (see
 * header).
 */
export function composeSystemMessage(input: {
  mode: string;
  format: string;
  staticContext?: string;
  dynamicContext?: string;
}): string {
  const head = composeInstructionalHead(input.mode, input.format);

  const parts: string[] = [head];
  if (input.staticContext !== undefined) parts.push("\n---\n" + input.staticContext);
  if (input.dynamicContext !== undefined) parts.push("\n---\n" + input.dynamicContext);
  if (input.staticContext === undefined && input.dynamicContext === undefined) parts.push("\n---\n");
  return parts.join("");
}

// ---------------------------------------------------------------------------
// §12 detection — localhost providers, presence only
// ---------------------------------------------------------------------------

export interface LocalProviderProbe {
  readonly port: number;
  readonly label: string;
}

/**
 * The documented default probe list. Well-known OpenAI-compatible localhost
 * talks first (Ollama :11434, LM Studio :1234), then the llama.cpp-style
 * "any OpenAI-compatible server" fallback port. Env overrides belong to the
 * composition slice, never this module.
 */
export const LOCAL_PROVIDER_PROBES: readonly LocalProviderProbe[] = [
  { port: 11434, label: "Ollama" },
  { port: 1234, label: "LM Studio" },
  { port: 8080, label: "Local server" },
];

export interface DetectedLocalProvider {
  readonly baseUrl: string;
  readonly label: string;
  /** The model ids the endpoint's /v1/models listing served. */
  readonly models: readonly string[];
}

export interface DetectLocalProvidersOptions {
  readonly fetchImpl?: typeof fetch;
  /** Default 127.0.0.1 — a local-first host never probes a remote. */
  readonly host?: string;
  /** Full probe-list overrides (tests drive an ephemeral port through this). */
  readonly probes?: readonly LocalProviderProbe[];
  /** Per-probe timeout; detection must stay fast enough to ride a boot. */
  readonly timeoutMs?: number;
}

/**
 * Detect localhost OpenAI-compatible providers. NEVER network-touches at
 * import time, never throws (probes that fail/timeout/talk nonsense are
 * simply not detected), and returns results in the probe list's order.
 * A probe counts as detected ONLY on HTTP 200 + { data: [{ id: string }] } —
 * the wire shape the OpenAI-compatible API (and Ollama's and LM Studio's
 * compatibility layers) actually serves on GET /v1/models.
 */
export async function detectLocalProviders(
  opts: DetectLocalProvidersOptions = {},
): Promise<readonly DetectedLocalProvider[]> {
  const doFetch = opts.fetchImpl ?? fetch;
  const host = opts.host ?? "127.0.0.1";
  const probes = opts.probes ?? LOCAL_PROVIDER_PROBES;
  const timeoutMs = opts.timeoutMs ?? 1500;

  const settled = await Promise.allSettled(
    probes.map(async (probe): Promise<DetectedLocalProvider | null> => {
      const url = `http://${host}:${probe.port}/v1/models`;
      let res: Response;
      try {
        res = await doFetch(url, {
          method: "GET",
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        return null;
      }
      if (!res.ok) return null;
      try {
        const body = (await res.json()) as { data?: unknown };
        if (!Array.isArray(body.data)) return null;
        const models = body.data
          .filter((m): m is { id: string } => typeof (m as { id?: unknown })?.id === "string")
          .map((m) => m.id);
        if (models.length === 0) return null;
        return { baseUrl: `http://${host}:${probe.port}/v1`, label: probe.label, models };
      } catch {
        return null;
      }
    }),
  );

  return settled.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
}

/** `base` + path join without duplicating slashes (base is already de-slashed). */
function joinUrl(base: string, path: string): string {
  let out = base;
  if (!new URL(out).pathname || new URL(out).pathname === "/") {
    out = out.replace(/\/?$/, "/v1");
  }
  return out + path;
}
