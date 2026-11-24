/**
 * Phase 3 §2.7 — the provider/model profile a local composition root reads at
 * boot to shape its `LocalGenerationDeps` bundle (the `generation` entry in
 * `DefaultRouteDeps`).
 *
 * Env-first (`GW_LOCAL_*`), because a gitignored-file format is the STILL-OPEN
 * §5.6 decision and a fixed shape would pre-empt it; the env read is injectable
 * (`env` param) so tests and composition roots can shape their own source.
 *
 * Deliberately consumed by nothing yet — the default surface mounts
 * `POST /ai/generate` OFF (see `DefaultRouteDeps.generation`), and how a
 * composition root turns this profile into a `LocalGenerationDeps` bundle is
 * its decision, not this module's.
 *
 * The API key is read for PRESENCE ONLY (`hasApiKey`) — its value never enters
 * this object, so the profile can be logged, serialized, or carried through
 * telemetry without leaking the credential. Whatever client the composition
 * root builds reads the key itself from the same environment.
 *
 * Stage (d) evolution (settled §5.6: env-only, still presence-from-env): the
 * run-plan preflight surface consumes `tier` + the two media-provider key
 * PRESENCE flags (`GW_LOCAL_SEGMIND_API_KEY`/`GW_LOCAL_OPENAI_API_KEY` —
 * Values never enter the profile, the same discipline as the API key) to
 * build a local `CapabilityContext`. No generation consumer binds these yet —
 * the bundle configuration stays the composition root's decision.
 */

import type { SubscriptionTier } from "@/types/subscription";

export interface LocalGenerationProfile {
  /** The provider id the local engine serves `generate` through; null = unset. */
  readonly provider: string | null;
  /** Model per usage slot; a null slot means "fall to the provider's default". */
  readonly models: {
    readonly default: string | null;
    readonly fast: string | null;
    readonly quality: string | null;
  };
  /** The mount's buildContext ceiling override; null = keep the built-in one. */
  readonly contextCap: number | null;
  /** A key is present in the environment — presence only, never the value. */
  readonly hasApiKey: boolean;
  /**
   * Stage (d) — the tier the run-plan preflight treats as the owner's; null =
   * unset (the composition root maps it or supplies its own). SubscriptionTier
   * because the run-plan bundle threads it straight into a CapabilityContext.
   */
  readonly tier: SubscriptionTier | null;
  /** Stage (d) — Segmind image/video provider key present (never the value). */
  readonly hasSegmindKey: boolean;
  /** Stage (d) — OpenAI provider key present (never the value). */
  readonly hasOpenAIKey: boolean;
}

const readString = (v: string | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

/** Strict: a whole positive integer, or nothing — "0"/"-5"/"abc" are unset. */
const readContextCap = (v: string | undefined): number | null => {
  const t = v?.trim();
  if (!t || !/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
};

/**
 * Strict: an actual tier literal, or nothing — an unknown tier id is unset
 * rather than silently typed into the run-plan preflight (the composition
 * root can still map its own id, but "free"/"story_pro"/"creator_pro"/
 * "all_access" is the whole vocabulary the graph capability gates know).
 */
const readTier = (v: string | undefined): SubscriptionTier | null => {
  const t = v?.trim();
  if (!t) return null;
  return t === "free" || t === "story_pro" || t === "creator_pro" || t === "all_access"
    ? (t as SubscriptionTier)
    : null;
};

export function readLocalGenerationProfile(
  env: Record<string, string | undefined> = process.env,
): LocalGenerationProfile {
  return {
    provider: readString(env["GW_LOCAL_PROVIDER"]),
    models: {
      default: readString(env["GW_LOCAL_MODEL"]),
      fast: readString(env["GW_LOCAL_FAST_MODEL"]),
      quality: readString(env["GW_LOCAL_QUALITY_MODEL"]),
    },
    contextCap: readContextCap(env["GW_LOCAL_CONTEXT_CAP"]),
    hasApiKey: Boolean(env["GW_LOCAL_API_KEY"]),
    tier: readTier(env["GW_LOCAL_TIER"]),
    hasSegmindKey: Boolean(env["GW_LOCAL_SEGMIND_API_KEY"]),
    hasOpenAIKey: Boolean(env["GW_LOCAL_OPENAI_API_KEY"]),
  };
}
