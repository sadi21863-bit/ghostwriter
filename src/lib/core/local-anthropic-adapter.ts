/**
 * Master-plan Phase 4 (§12/§12.1, §18 "Provider portability"), slice 4b — the
 * DEDICATED Anthropic adapter for the local host. §12.1 verbatim motivation:
 * "Anthropic retains a dedicated adapter where provider-specific prompt
 * caching/features justify it" — prompt caching is that justification, so this
 * module owns the `messages.create` translation instead of riding slice 4a's
 * OpenAI-compatible seam.
 *
 * The wire contract mirrors the cloud engine (`src/lib/ai/engine.ts`
 * generate()): `system` is an ARRAY of text blocks in which the shared
 * instructions head + slow-moving context ride
 * `cache_control: { type: "ephemeral" }` (the fast-moving dynamic block stays
 * uncached), and `messages` is exactly one user message carrying the prompt.
 * Those placements ARE the §12.1 feature leverage this dedicated adapter
 * exists to keep; the response mapping is the engine's own (joined
 * text-block content, the usage sum, the model).
 *
 * The instructions head is SHARED with slice 4a's adapter
 * (`composeInstructionalHead` from `./local-provider-adapter`):
 * ARTIFACT_VS_PERSONA_RULE + "\n\n" + MI[mode](format) + getFormatRules +
 * getCraftDirectives. Two deliberate differences from the cloud call,
 * inherited from the local mount's §2.2 floor (same as slice 4a):
 * `narrativeStructure` cannot arrive (no such field on the local body), and
 * the cloud's legacy `body.context` else-branch fallback cannot either — a
 * locally-specified static block always rides, and with NEITHER context the
 * adapter keeps the empty `\n---\n` block the cloud's single-system path
 * yields.
 *
 * Key discipline (§5.6): `apiKey` is REQUIRED by type — a composition root
 * literally cannot construct a `LocalAnthropicEndpoint` without the
 * operator's env decision — and the VALUE may only ever come from operator
 * env via that root: never from a profile or any serializable object (the
 * LocalGenerationProfile presence-only rule). The key rides only into the
 * client factory's cfg — never onto the wire params.
 *
 * The SDK never enters THIS module's top level: the default client factory
 * lazily `await import`s the SDK inside the factory-call path, and tests (and
 * compatible gateways) inject a structural client through
 * `AnthropicGenerateOptions.clientCreate` instead of mocking the SDK.
 *
 * Model resolution is identical to slice 4a: `genCtx.model` wins unless it is
 * exactly `"default"` (the pipeline's own `chooseProvider`-less placeholder),
 * which falls to `endpoint.model`; the outcome echoes the RESOLVED id — the
 * honest local behavior, since an unresolved "default" would leak into the
 * response body and the stage-(b) meter.
 *
 * Error translation keeps the local mount's reason→status vocabulary
 * VERBATIM — the mount's `mapGenerationOutcome` probes these same strings
 * (rate_limit/529 → 429 retryable; the context-length markers → 400; auth
 * failures → the provider's own words logged, never shown; everything else →
 * 500). Client-factory failures and a factory that yields no usable client
 * surface as thrown, untranslated — the pipeline's settle path turns them
 * into `{ ok: false, reason }`.
 */

import type { GeneratedOutput } from "@/lib/ai/generation-service";
import type {
  GenerateChapterInput,
  GenerateChapterPorts,
} from "./handlers/generate-chapter";
import { composeInstructionalHead } from "./local-provider-adapter";

export interface LocalAnthropicEndpoint {
  /**
   * The model id the operator's env decision named — the fallback when
   * routing has no opinion (`genCtx.model === "default"`, the pipeline's own
   * placeholder).
   */
  readonly model: string;
  /**
   * The ANTHROPIC API key. REQUIRED by type (unlike slice 4a's optional BYOK
   * key): this adapter talks cloud spend, so a composition root cannot even
   * construct the endpoint without the operator's planted decision. The
   * VALUE may only ever come from operator env via the composition root —
   * never from a profile or any serializable object (the
   * LocalGenerationProfile presence-only rule).
   */
  readonly apiKey: string;
  /** Optional override for a compatible Anthropic-messages gateway. */
  readonly baseUrl?: string;
}

export interface AnthropicGenerateOptions {
  /**
   * Builds the structural client. Defaults to a lazy SDK construction (see
   * below) — tests inject scripted clients and a compatible gateway injects
   * its own implementation; the SDK is never mocked.
   */
  readonly clientCreate?: (cfg: {
    apiKey: string;
    baseUrl?: string;
    timeoutMs: number;
  }) => AnthropicMessagesClient | Promise<AnthropicMessagesClient>;
  /**
   * Whole-request timeout, carried into the SDK client's own timeout on the
   * default path — a cloud model can legitimately think for minutes.
   */
  readonly timeoutMs?: number;
  /** Requested completion budget; mirrors the cloud engine's default headroom. */
  readonly maxTokens?: number;
  /** Omitted from the wire unless set — the provider's own default is honest. */
  readonly temperature?: number;
}

/** One Anthropic system text block — the cloud engine's block shape. */
export interface AnthropicSystemBlock {
  readonly text: string;
  readonly cache_control?: { readonly type: "ephemeral" };
}

/**
 * The minimal structural slice of `client.messages.create` this adapter
 * runs — no SDK type is named, so the SDK stays out of any NEW import this
 * module adds and any compatible implementation (the real client, a test
 * double, a gateway) plugs in structurally.
 */
export interface AnthropicMessagesClient {
  messagesCreate(params: {
    model: string;
    max_tokens: number;
    system: readonly AnthropicSystemBlock[];
    messages: readonly [{ role: "user"; content: string }];
    temperature?: number;
  }): Promise<{
    content: readonly { type?: string; text?: string }[];
    usage: { input_tokens: number; output_tokens: number };
  }>;
}

/**
 * The `generate` port factory. Throws are the error TRANSLATION (the
 * messagesCreate path) or raw factory/wiring failures — the pipeline's
 * settle path shapes either into `{ ok: false, reason }`.
 */
export function makeAnthropicGenerate(
  endpoint: LocalAnthropicEndpoint,
  opts: AnthropicGenerateOptions = {},
): NonNullable<GenerateChapterPorts["generate"]> {
  const doCreate: NonNullable<AnthropicGenerateOptions["clientCreate"]> =
    opts.clientCreate ?? defaultAnthropicClientCreate;
  const timeoutMs = opts.timeoutMs ?? 300_000;
  const maxTokens = opts.maxTokens ?? 8000;

  return async (
    req: GenerateChapterInput,
    genCtx: { staticContext?: string; dynamicContext?: string; provider: string; model: string },
  ): Promise<GeneratedOutput> => {
    // Identical to slice 4a: "default" is the pipeline's own
    // chooseProvider-less placeholder, not a model id.
    const servedModel = genCtx.model && genCtx.model !== "default" ? genCtx.model : endpoint.model;

    // The key + gateway override ride ONLY into the factory's cfg — never
    // onto the wire params. A factory failure surfaces as thrown, raw.
    const client = await doCreate({
      apiKey: endpoint.apiKey,
      ...(endpoint.baseUrl ? { baseUrl: endpoint.baseUrl } : {}),
      timeoutMs,
    });
    if (!client || typeof client.messagesCreate !== "function") {
      throw new Error("anthropic adapter: the client factory returned no usable messages client");
    }

    // The §12.1 prompt-caching placements (see header): the instructions head
    // leads every block, contexts ride after the "\n---\n" separator exactly
    // like the cloud engine's — static inside the cached block, the dynamic
    // one uncached.
    const head = composeInstructionalHead(req.mode, req.format ?? "");
    let system: AnthropicSystemBlock[];
    if (genCtx.staticContext !== undefined && genCtx.dynamicContext !== undefined) {
      // Both ride: the cacheable head + slow-moving static block FIRST, the
      // fast-moving dynamic block cached-EXEMPT behind it (the engine's order).
      system = [
        { text: head + "\n---\n" + genCtx.staticContext, cache_control: { type: "ephemeral" } },
        { text: genCtx.dynamicContext },
      ];
    } else if (genCtx.staticContext !== undefined) {
      system = [{ text: head + "\n---\n" + genCtx.staticContext, cache_control: { type: "ephemeral" } }];
    } else if (genCtx.dynamicContext !== undefined) {
      system = [{ text: head + "\n---\n" + genCtx.dynamicContext, cache_control: { type: "ephemeral" } }];
    } else {
      // NEITHER → the empty block the cloud's single-system path yields.
      system = [{ text: head + "\n---\n", cache_control: { type: "ephemeral" } }];
    }

    const params: {
      model: string;
      max_tokens: number;
      system: AnthropicSystemBlock[];
      messages: [{ role: "user"; content: string }];
      temperature?: number;
    } = {
      model: servedModel,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: req.prompt }],
    };
    if (opts.temperature !== undefined) params.temperature = opts.temperature;

    let msg: Awaited<ReturnType<AnthropicMessagesClient["messagesCreate"]>>;
    try {
      msg = await client.messagesCreate(params);
    } catch (err) {
      throw translateAnthropicError(err);
    }

    // The engine's own mapping: joined text-block content, the usage sum.
    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    return {
      text,
      tokensUsed: msg.usage.input_tokens + msg.usage.output_tokens,
      // The resolved id, not the requested placeholder — see the header.
      model: servedModel,
    };
  };
}

/**
 * The local mount's reason→status vocabulary, translated verbatim — the
 * mount's mapGenerationOutcome runs the same string probes (rate_limit/529
 * → 429 retryable; the context-length markers → 400; auth failures → the
 * provider's words logged, never shown; everything else → 500). The
 * provider's own words stay INSIDE the reason. Context-length tagging is
 * MARKER-BASED on the real Anthropic bodies ("prompt is too long", "context
 * length", "maximum context") — a plain bad request stays provider_error.
 */
function translateAnthropicError(err: unknown): Error {
  const e = err as { status?: unknown; message?: unknown } | null | undefined;
  const status = typeof e?.status === "number" && Number.isFinite(e.status) ? e.status : undefined;
  const rawMessage = e?.message;
  const detail = (typeof rawMessage === "string" ? rawMessage : String(err)).slice(0, 300);

  if (status === 429 || status === 529) return new Error(`rate_limit: ${detail}`);
  if (/(prompt is too long|context length|maximum context|too long)/i.test(detail)) {
    return new Error(`context_length: rejected by provider — ${detail}`);
  }
  if (status === 401 || status === 403) {
    return new Error(`provider auth failed (${status}): ${detail}`);
  }
  return new Error(`provider_error ${status ?? "unknown"}: ${detail}`);
}

/**
 * The default client factory — the only place the SDK class is referenced.
 * The import is lazy, INSIDE this factory-call path (never at module top
 * level), the operator's key decision + optional gateway override + the
 * adapter timeout become the SDK's own options, and the SDK's own typing is
 * asserted loosely at the one structural bridge (this module never names
 * SDK parameter or result types).
 */
async function defaultAnthropicClientCreate(cfg: {
  apiKey: string;
  baseUrl?: string;
  timeoutMs: number;
}): Promise<AnthropicMessagesClient> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({
    apiKey: cfg.apiKey,
    ...(cfg.baseUrl ? { baseURL: cfg.baseUrl } : {}),
    timeout: cfg.timeoutMs,
  });
  return {
    messagesCreate: async (p) => {
      const wire = (await client.messages.create(
        p as unknown as Parameters<typeof client.messages.create>[0],
      )) as unknown as {
        content: Array<{ type?: string; text?: string }>;
        usage: { input_tokens: number; output_tokens: number };
      };
      return wire;
    },
  };
}
