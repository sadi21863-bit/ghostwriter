/**
 * Master-plan Phase 4 slice 4c — BYOK/routing over the profile (§12/§12.1).
 *
 * §12 (verbatim): "Provider choice is visible and reversible per task/global
 * setting", and "if no local provider exists, cloud/BYOK is an equally direct
 * option rather than a hidden fallback". This module ships the two seams that
 * make that real, both over the `LocalGenerationProfile` shoebox (the env
 * shape `readLocalGenerationProfile` reads):
 *
 *  - `makeProfileChooseProvider(profile)` — §12.1's per-task routing as the
 *    optional `chooseProvider` port a local generation bundle may carry. The
 *    pipeline awaits a plain `{ provider, model }` (a `StageOutcome` without a
 *    `stop`), so this is RESOLVED-STATE routing only: the mode's cloud-engine
 *    tier (`MODE_REGISTRY[mode]?.modelTier ?? "default"` — a tier outside
 *    fast/default/quality counts as default) selects the profile's model slot,
 *    and the adapter still resolves wire defaults from its endpoint. An UNSET
 *    profile composes NOTHING — the factory returns `undefined` (also when a
 *    provider id is set but every model slot is null: a routing port that can
 *    only emit placeholders must not be mounted) and the bundle OMITS the port,
 *    so the pipeline runs its own `{provider:"default", model:"default"}` path.
 *
 *  - `makeLocalProvidersReadPort(profile)` — the `LocalProvidersReadPort`
 *    behind `GET /providers`, the §12 "visible" read made real BEFORE any
 *    generation mounts: the routing profile's shoebox shape VERBATIM (the
 *    SETTING, never a resolution), key-PRESENCE booleans only (the exact env
 *    vars the profile module reads for its `hasApiKey` / `hasOpenAIKey` /
 *    `hasSegmindKey` flags — a credential VALUE never enters the object at any
 *    depth), and the DETECTED localhost providers from slice 4a's
 *    `detectLocalProviders` (a detected list of `[]` is honest reality —
 *    no local provider means cloud/BYOK stays the equally direct option).
 *
 * Presence-only discipline, verbatim from the profile module: whatever rides
 * this surface can be logged, serialized, or carried through telemetry without
 * leaking a credential. Detection is never a network call at import time and
 * never throws (probes that fail/timeout/talk nonsense are simply not
 * detected); the read is injectable on the detect fn, the detect options, and
 * the env source so composition roots and tests shape their own inputs.
 */

import type { GenerateChapterPorts } from "./handlers/generate-chapter";
import {
  detectLocalProviders,
  type DetectLocalProvidersOptions,
  type DetectedLocalProvider,
} from "./local-provider-adapter";
import type { LocalGenerationProfile } from "./local-generation-profile";
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";

/**
 * The routing profile's shoebox: the SETTING as it was read (possibly unset),
 * mirrored into the visibility read verbatim — never the resolution
 * `resolveProfileRouting` yields for a task.
 */
export interface ProfileRouting {
  readonly provider: string | null;
  readonly models: {
    readonly default: string | null;
    readonly fast: string | null;
    readonly quality: string | null;
  };
}

/**
 * §12.1 model routing, resolved per task: the profile's provider id (or the
 * pipeline's own "default" placeholder) and the model slot the mode's tier
 * selects (or the placeholder when the slot is unset). Placeholder values are
 * deliberate — the pipeline's `chooseProvider`-less path uses exactly this
 * `{provider:"default", model:"default"}` state, and the ADAPTER's endpoint
 * default is what actually resolves a real model id.
 */
export function resolveProfileRouting(
  profile: LocalGenerationProfile | null,
  mode: string,
): { provider: string; model: string } {
  const provider = profile?.provider ?? "default";
  // The registry's own documented access shape: optional chaining over the
  // (possibly-missing) mode key — "cohost" is undefined here, not an error.
  const tier: string | undefined = MODE_REGISTRY[mode as GenerationMode]?.modelTier;
  const profileTier =
    tier === "fast" || tier === "default" || tier === "quality" ? tier : "default";
  const model = profile?.models[profileTier] ?? "default";
  return { provider, model };
}

/**
 * The optional `chooseProvider` port for a `LocalGenerationDeps` bundle.
 * `undefined` when NOTHING is configured (no provider, or a provider with
 * every model slot null) — the composition must omit the port entirely and
 * let the pipeline run its own placeholder path; an adapter still resolves
 * endpoint defaults, and a mounted port that could only emit placeholders
 * would pretend to route without routing anything.
 */
export function makeProfileChooseProvider(
  profile: LocalGenerationProfile | null,
): GenerateChapterPorts["chooseProvider"] {
  const configured = Boolean(
    profile?.provider &&
      (profile.models.default || profile.models.fast || profile.models.quality),
  );
  if (!configured) return undefined;
  return async (req) => resolveProfileRouting(profile, req.mode);
}

/**
 * The provider-visibility read port. Presence-only by construction: the
 * result carries booleans, the routing shoebox, and detected localhost
 * providers — never a credential value.
 */
export interface LocalProvidersReadPort {
  read(): Promise<{
    readonly routing: ProfileRouting;
    readonly keyPresence: {
      readonly anthropic: boolean;
      readonly openai: boolean;
      readonly segmind: boolean;
    };
    readonly detected: readonly DetectedLocalProvider[];
  }>;
}

/**
 * The provider-visibility read over the profile + slice 4a's detection.
 *
 * `read()` runs detection through the injectable fn (default:
 * `detectLocalProviders` with its documented default probes and its contract
 * that it never throws), and computes key PRESENCE by the SAME `Boolean(...)`
 * reads the profile module uses — `GW_LOCAL_API_KEY` (the generation key the
 * dedicated Anthropic adapter plants), `GW_LOCAL_OPENAI_API_KEY`,
 * `GW_LOCAL_SEGMIND_API_KEY` — from the injectable env (default
 * `process.env`). It never throws and stays honest for a null profile:
 * visibility of "unset" is itself the §12 visibility.
 */
export function makeLocalProvidersReadPort(
  profile: LocalGenerationProfile | null,
  opts: {
    readonly detect?: (
      o?: DetectLocalProvidersOptions,
    ) => Promise<readonly DetectedLocalProvider[]>;
    readonly detectOpts?: DetectLocalProvidersOptions;
    readonly env?: Readonly<Record<string, string | undefined>>;
  } = {},
): LocalProvidersReadPort {
  const detect = opts.detect ?? detectLocalProviders;
  const env = opts.env ?? process.env;
  // The SETTING, mirrored verbatim at composition time (the boot-time profile,
  // not a per-read re-resolution).
  const routing: ProfileRouting = {
    provider: profile?.provider ?? null,
    models: profile?.models ?? { default: null, fast: null, quality: null },
  };
  return {
    read: async () => ({
      routing,
      keyPresence: {
        anthropic: Boolean(env["GW_LOCAL_API_KEY"]),
        openai: Boolean(env["GW_LOCAL_OPENAI_API_KEY"]),
        segmind: Boolean(env["GW_LOCAL_SEGMIND_API_KEY"]),
      },
      detected: await detect(opts.detectOpts),
    }),
  };
}
