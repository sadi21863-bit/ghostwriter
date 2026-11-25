/**
 * Master-plan Phase 4 slice 4d (§9 item 5) — the composed bundle. §9 item 5,
 * verbatim: "The composed bundle then carries a REAL `buildContext` +
 * `chooseProvider` (4c) + `generate` (4a/4b) + `persist`/`loadViolations`
 * (sqlite)". This module is the composition DECISION a spawn root plants as
 * `DefaultRouteDeps.generation`; the adapters (4a/4b), the routing (4c) and
 * the context binder (4d) are imported ready-made — what lives HERE is only
 * the §5.6 split, stated verbatim-category:
 *
 *  - **Localhost providers may be auto-composed via detection** — localhost
 *    servers carry no credential and no external spend, so
 *    `GW_LOCAL_GENERATION=auto` composes the FIRST detected localhost target
 *    with NO key of any kind (the endpoint never even carries a cloud-key
 *    field);
 *  - **anything reading a cloud/BYOK key stays an explicit operator plant
 *    via env** — `GW_LOCAL_GENERATION=generic` (optional `GW_LOCAL_API_KEY`
 *    VALUE), `GW_LOCAL_GENERATION=opencode` (the Go/Console lane: key +
 *    model required, the Go inference base by default, and the required
 *    `x-opencode-session` header injected here) and
 *    `GW_LOCAL_GENERATION=anthropic` (`GW_LOCAL_API_KEY` + `GW_LOCAL_MODEL`
 *    both REQUIRED, the key VALUE riding the operator's env decision, never
 *    the profile object);
 *  - **the boot default is OFF** — `GW_LOCAL_GENERATION` unset (or empty)
 *    composes NOTHING: no bundle, `POST /ai/generate` answers 501, no log
 *    noise.
 *
 * `GW_LOCAL_TIMEOUT_MS` (PLAN-v5) raises the real adapters' per-call timeout
 * for slow local hardware; it never touches the injected test factories.
 *
 * Secret-egress pin (the auto lane): composing a detected localhost target
 * must not attach `GW_LOCAL_OPENAI_API_KEY` even when the profile carries its
 * PRESENCE — a detected localhost server takes credentials from nothing (the
 * `LocalGenerationProfile` object is presence-only by its own discipline; a
 * key VALUE may only ever ride an explicit operator env plant, per §5.6).
 *
 * The meter is deliberately NOT planted here: no local meter sink exists yet
 * (phase 3 §2.3 stage (b) stays record-only observability, and a record with
 * nowhere to land would be a fiction). `LocalGenerationMeter` rides the
 * `LocalGenerationDeps` shape OPTIONALly, so an operator may plant one at the
 * spawn root; this composition's omission keeps the default surface
 * meterless rather than writing records into nothing.
 *
 * Import discipline: `LocalGenerationDeps` from `./local-host` (type-only);
 * the adapters from `./local-provider-adapter` / `./local-anthropic-adapter`;
 * routing from `./local-provider-routing`; the §4d binder factory as the
 * default `buildContextBuilder`. NO `@/db` value import (a type-only
 * `DrizzleSqliteDb` is the established exception, same as the binder module),
 * NO `next/*`, NO Neon.
 */

import type { DrizzleSqliteDb } from "@/db/sqlite";
import { randomUUID } from "node:crypto";
import type { SubscriptionTier } from "@/types/subscription";
import type { GenerateChapterPorts } from "./handlers/generate-chapter";
import type { LocalGenerationDeps } from "./local-host";
import type { LocalGenerationProfile } from "./local-generation-profile";
import {
  detectLocalProviders,
  makeOpenAICompatibleGenerate,
  type DetectLocalProvidersOptions,
  type DetectedLocalProvider,
  type LocalOpenAIEndpoint,
} from "./local-provider-adapter";
import {
  makeAnthropicGenerate,
  type LocalAnthropicEndpoint,
} from "./local-anthropic-adapter";
import { makeProfileChooseProvider } from "./local-provider-routing";
import { makeLocalContextBuilder } from "./local-generation-context";

export interface LocalGenerationCompositionDeps {
  /** The composition's ONE SQLite db handle (never a Neon import). */
  readonly db: DrizzleSqliteDb;
  /** §5.6 — the single local owner's users-row id the binder scopes to. */
  readonly localOwnerId: string;
  /** The boot-time profile shoebox (presence-only); null = unset. */
  readonly profile: LocalGenerationProfile | null;
  /** The resolved subscription tier the binder's prose-augmentation guard reads. */
  readonly tier: SubscriptionTier;
  /** The operator env the GW_LOCAL_* decisions read; defaults to process.env. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Injectable detection (tests drive a fixture; default: the real probes). */
  readonly detect?: (
    o?: DetectLocalProvidersOptions,
  ) => Promise<readonly DetectedLocalProvider[]>;
  readonly makeOpenAIAdapter?: (
    endpoint: LocalOpenAIEndpoint,
  ) => NonNullable<GenerateChapterPorts["generate"]>;
  readonly makeAnthropicAdapter?: (
    endpoint: LocalAnthropicEndpoint,
  ) => NonNullable<GenerateChapterPorts["generate"]>;
  /**
   * The §4d context binder factory — injectable ONLY for tests (the default is
   * the real `makeLocalContextBuilder` import). A test double returns marker
   * ports; the composition never inspects their behavior.
   */
  readonly buildContextBuilder?: typeof makeLocalContextBuilder;
}

/**
 * PLAN-v5 — a local model on CPU-only hardware can legitimately exceed the
 * adapters' 300s default (the A9-9420 laptop needs minutes of prefill+decode
 * for a scene). `GW_LOCAL_TIMEOUT_MS` raises the ceiling on the REAL adapter
 * path only; injected factories are test seams and keep their one-argument
 * shape. Garbage/non-positive values are ignored (the default stands).
 */
function readTimeoutMs(env: Readonly<Record<string, string | undefined>>): number | undefined {
  const raw = env["GW_LOCAL_TIMEOUT_MS"];
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * PLAN-v5 — one stable OpenCode session id per host process. Go REQUIRES a
 * stable `x-opencode-session` per conversation so routing and prompt caching
 * are consistent; a fresh process is a fresh conversation.
 */
const OPENCODE_SESSION = `ses_gw_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

/**
 * Compose the generation bundle from the mode decision, or compose NOTHING.
 * Returns `null` when `GW_LOCAL_GENERATION` stays undecided (boot default
 * OFF), when a mode's required env decision is missing (loudly logged), or
 * when auto-detection finds no localhost provider (warn-logged) — in every
 * null case the spawn root omits `generation` and `POST /ai/generate`
 * answers 501. The bundle composition itself is IDENTICAL for every mode that
 * resolved a target.
 */
export async function makeLocalGenerationDeps(
  deps: LocalGenerationCompositionDeps,
): Promise<LocalGenerationDeps | null> {
  const env = deps.env ?? process.env;
  const mode = env["GW_LOCAL_GENERATION"];
  if (!mode) return null; // boot default OFF — unset or "", no logging noise

  let generate: NonNullable<GenerateChapterPorts["generate"]>;

  if (mode === "auto") {
    // §5.6: localhost carries no credential and no external spend — detection
    // composes WITHOUT any key. The endpoint is built bare: even when the
    // profile carries `hasOpenAIKey` and the env the key's VALUE, neither
    // ever reaches this endpoint (presence-only discipline verbatim).
    const detected = deps.detect
      ? await deps.detect()
      : await detectLocalProviders({ timeoutMs: 750 });
    // PLAN-v5 — a chosen model disambiguates between several live localhost
    // servers (e.g. Ollama on :11434 and the portable llamafile on :8080):
    // when some detected provider serves GW_LOCAL_MODEL, that provider wins;
    // otherwise the documented probe order decides.
    const preferred = env["GW_LOCAL_MODEL"];
    const matched =
      preferred !== undefined
        ? detected.find((d) => d.models.includes(preferred))
        : undefined;
    const first = matched ?? detected[0];
    if (!first) {
      console.warn(
        "[local-generation] no localhost provider detected — generation stays OFF",
      );
      return null;
    }
    const endpoint = {
      baseUrl: first.baseUrl,
      model: matched && preferred ? preferred : first.models[0] ?? "default",
    };
    const timeoutMs = readTimeoutMs(env);
    generate = deps.makeOpenAIAdapter
      ? deps.makeOpenAIAdapter(endpoint)
      : makeOpenAICompatibleGenerate(endpoint, timeoutMs === undefined ? {} : { timeoutMs });
  } else if (mode === "generic") {
    // An explicit operator plant: the endpoint URL is the decision that is
    // missing when absent; the optional key is the VALUE the operator planted
    // — never read from the profile object.
    const baseUrl = env["GW_LOCAL_ENDPOINT_URL"];
    if (!baseUrl) {
      console.error(
        "[local-generation] GW_LOCAL_GENERATION=generic requires GW_LOCAL_ENDPOINT_URL — generation stays OFF",
      );
      return null;
    }
    const model = env["GW_LOCAL_MODEL"] ?? deps.profile?.models.default ?? "default";
    const apiKey = env["GW_LOCAL_API_KEY"];
    const endpoint = { baseUrl, model, ...(apiKey ? { apiKey } : {}) };
    const timeoutMs = readTimeoutMs(env);
    generate = deps.makeOpenAIAdapter
      ? deps.makeOpenAIAdapter(endpoint)
      : makeOpenAICompatibleGenerate(endpoint, timeoutMs === undefined ? {} : { timeoutMs });
  } else if (mode === "opencode") {
    // OpenCode Go/Console — the operator's key against the Go inference base
    // (Chat Completions). Go REQUIRES a stable `x-opencode-session` header and
    // asks clients to identify themselves with their own user agent; both ride
    // extraHeaders. The model must be named (env or the profile's default slot).
    const apiKey = env["GW_LOCAL_API_KEY"];
    const model = env["GW_LOCAL_MODEL"] ?? deps.profile?.models.default;
    if (!apiKey || !model) {
      console.error(
        "[local-generation] GW_LOCAL_GENERATION=opencode requires GW_LOCAL_API_KEY and GW_LOCAL_MODEL — generation stays OFF",
      );
      return null;
    }
    const baseUrl = env["GW_LOCAL_ENDPOINT_URL"] ?? "https://opencode.ai/inference/go/openai/v1";
    const endpoint = { baseUrl, model, apiKey };
    const timeoutMs = readTimeoutMs(env);
    const extraHeaders = {
      "x-opencode-session": OPENCODE_SESSION,
      "user-agent": "ghostwriter-local/1.0",
    };
    generate = deps.makeOpenAIAdapter
      ? deps.makeOpenAIAdapter(endpoint)
      : makeOpenAICompatibleGenerate(endpoint, {
          ...(timeoutMs === undefined ? {} : { timeoutMs }),
          extraHeaders,
        });
  } else if (mode === "anthropic") {
    // The dedicated adapter's key is REQUIRED by type — a composition root
    // literally cannot build this path without the operator's env decision
    // (§5.6), and the model must be named by env or the profile slot.
    const apiKey = env["GW_LOCAL_API_KEY"];
    const model = env["GW_LOCAL_MODEL"] ?? deps.profile?.models.default;
    if (!apiKey || !model) {
      console.error(
        "[local-generation] GW_LOCAL_GENERATION=anthropic requires GW_LOCAL_API_KEY and GW_LOCAL_MODEL — generation stays OFF",
      );
      return null;
    }
    const endpoint = { model, apiKey };
    const timeoutMs = readTimeoutMs(env);
    generate = deps.makeAnthropicAdapter
      ? deps.makeAnthropicAdapter(endpoint)
      : makeAnthropicGenerate(endpoint, timeoutMs === undefined ? {} : { timeoutMs });
  } else {
    // An explicit-but-unrecognized value must not silently equal OFF — the
    // operator should learn their decision was not honored.
    console.error(
      `[local-generation] unknown GW_LOCAL_GENERATION mode "${mode}" — recognized values are "auto" | "generic" | "opencode" | "anthropic"; generation stays OFF`,
    );
    return null;
  }

  // The composed bundle — identical for every mode that resolved a target:
  // a REAL context binder (4d), the profile's routing port when the profile
  // has an opinion (4c; omitted wholesale when it composes NOTHING), and the
  // adapter's generate (4a/4b). The meter is deliberately absent (header).
  const ports = (deps.buildContextBuilder ?? makeLocalContextBuilder)({
    db: deps.db,
    ownerId: deps.localOwnerId,
    tier: deps.tier,
  });
  const chooseProvider = makeProfileChooseProvider(deps.profile);
  return {
    generate,
    buildContext: ports.buildContext,
    loadViolations: ports.loadViolations,
    persist: ports.persist,
    ...(chooseProvider ? { chooseProvider } : {}),
  };
}
