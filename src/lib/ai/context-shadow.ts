import {
  buildStaticContextDetailed,
  buildDynamicContext,
  type ContextProject,
  type StaticContextResult,
} from "./context-builder";
import { CONTEXT_POLICY_VERSION, emitContextShadowDiff, type ContextShadowDiff } from "./context-policy-version";
import { MODE_REGISTRY } from "@/lib/modes/registry";
import { estimateTokens } from "@/lib/ai/headroom";

/**
 * Phase 0 / v4 §5 Stage A — shadow comparison for the ContextPolicy.
 *
 * Builds the legacy (full-policy) context and the mode-aware candidate from the
 * SAME project data and reports the structured difference. The legacy text is
 * always the one returned for generation while the switch is in "shadow", so this
 * is a pure observability addition with zero behavioural change.
 *
 * Presence markers matched against the exact headings context-builder emits.
 * Verified against the source rather than guessed — see context-builder.ts for
 * "CHARACTERS:", "LOCATIONS:", "PLOTS:", "WORLD ELEMENTS:", "VOICE FINGERPRINT:",
 * the story-memory heading, and "OPEN STORY PROMISES".
 */
const PRESENCE_MARKERS: Record<string, string> = {
  characters: "CHARACTERS:",
  locations: "LOCATIONS:",
  plots: "PLOTS:",
  worldElements: "WORLD ELEMENTS:",
  voiceFingerprint: "VOICE FINGERPRINT:",
  memories: "STORY MEMORY - key facts from previous chapters:",
  promises: "OPEN STORY PROMISES",
};

function presenceOf(text: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [key, marker] of Object.entries(PRESENCE_MARKERS)) {
    out[key] = text.includes(marker);
  }
  return out;
}

export interface ContextBuild {
  /** The STATIC context generation should actually use, per the rollout switch. */
  staticCtx: string;
  /** The DYNAMIC context generation should actually use, per the rollout switch. */
  dynamicCtx: string;
  /** Present only when the switch builds both variants (shadow / mode-aware). */
  legacy?: { staticCtx: string; dynamicCtx: string };
  modeAware?: { staticCtx: string; dynamicCtx: string };
  /** Present only in "shadow" mode. */
  diff?: ContextShadowDiff;
  policyVersion: string;
  /** Skipped sections from the ACTIVE static build, so the caller keeps the
   *  headroom-rescue behaviour it already had. */
  skipped: { label: string; content: string }[];
}

export function buildContextForGeneration(
  p: ContextProject,
  mode?: string,
  tier?: string,
): ContextBuild {
  // Legacy is always "no mode", which resolves FULL_CONTEXT_POLICY. This is the
  // exact text the app produced before the rollout.
  const legacyStatic = buildStaticContextDetailed(p, undefined, tier);
  const legacyDynamic = buildDynamicContext(p);

  if (CONTEXT_POLICY_VERSION === "legacy") {
    return {
      staticCtx: legacyStatic.text,
      dynamicCtx: legacyDynamic,
      policyVersion: "legacy",
      skipped: legacyStatic.skipped,
    };
  }

  const modeAwareStatic = buildStaticContextDetailed(p, mode, tier);
  const modeAwareDynamic = buildDynamicContext(p, mode);
  const legacy = { staticCtx: legacyStatic.text, dynamicCtx: legacyDynamic };
  const modeAware = { staticCtx: modeAwareStatic.text, dynamicCtx: modeAwareDynamic };

  if (CONTEXT_POLICY_VERSION === "mode-aware") {
    return {
      ...modeAware,
      legacy,
      modeAware,
      policyVersion: "mode-aware",
      skipped: modeAwareStatic.skipped,
    };
  }

  // ---- shadow: return legacy, record the difference -------------------------
  const legacyCombined = legacy.staticCtx + "\n" + legacy.dynamicCtx;
  const modeAwareCombined = modeAware.staticCtx + "\n" + modeAware.dynamicCtx;
  const legacyAdmitted = new Set(legacyStatic.admitted);
  const modeAdmitted = new Set(modeAwareStatic.admitted);

  const diff: ContextShadowDiff = {
    mode: mode ?? "(none)",
    modeIsRegistered: typeof mode === "string" && mode in MODE_REGISTRY,
    droppedByPolicy: [...legacyAdmitted].filter((l) => !modeAdmitted.has(l)).sort(),
    addedByPolicy: [...modeAdmitted].filter((l) => !legacyAdmitted.has(l)).sort(),
    charDepth: {
      legacy: legacyStatic.policy.charDepth,
      modeAware: modeAwareStatic.policy.charDepth,
    },
    chars: {
      legacy: legacyCombined.length,
      modeAware: modeAwareCombined.length,
      saved: legacyCombined.length - modeAwareCombined.length,
    },
    estimatedTokens: {
      legacy: estimateTokens(legacyCombined),
      modeAware: estimateTokens(modeAwareCombined),
      saved: estimateTokens(legacyCombined) - estimateTokens(modeAwareCombined),
    },
    presence: {
      legacy: presenceOf(legacyCombined),
      modeAware: presenceOf(modeAwareCombined),
    },
  };
  emitContextShadowDiff(diff);

  return {
    ...legacy,
    legacy,
    modeAware,
    diff,
    policyVersion: "shadow",
    skipped: legacyStatic.skipped,
  };
}