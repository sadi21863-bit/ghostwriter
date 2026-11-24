/**
 * Phase 0 / v4 item 8 — experimental capability registry.
 *
 * v4's rule for `sceneBlueprint`: "Keep the capability only if its Haiku/provider
 * call is covered by contract tests and budget/gate metadata. It does not ship as
 * a silent disabled production path."
 *
 * This module is that metadata. A capability may only appear here if it names:
 *   - the exact provider + model + token budget it spends,
 *   - a measured cost estimate, so it can be reasoned about before it is enabled,
 *   - the contract test that covers its provider call,
 *   - the explicit gate that decides whether it runs,
 *   - and a lifecycle status, so "experimental" cannot quietly become permanent.
 *
 * It exists as its own module rather than as a field in
 * `src/lib/capabilities/cost.ts` because those costs are for PAID EXTERNAL
 * capabilities (image/video/TTS providers with per-item billing). A single internal
 * Haiku pre-pass is a different shape and folding it in there would imply it is
 * user-metered spend, which it is not.
 */

export type CapabilityStatus = "experimental" | "promoted" | "retired";

export interface ExperimentalCapability {
  id: string;
  description: string;
  provider: string;
  model: string;
  /** Hard ceiling on the single provider call this capability makes. */
  maxTokens: number;
  /** USD per invocation, from published provider pricing at these token counts. */
  estimatedUsdPerCall: number;
  /** How the estimate was arrived at, so it can be re-checked when prices move. */
  costBasis: string;
  /** The test that covers the provider call itself. */
  contractTest: string;
  /** What actually decides whether this runs at runtime. */
  gate: string;
  status: CapabilityStatus;
}

export const SCENE_BLUEPRINT_CAPABILITY: ExperimentalCapability = {
  id: "scene_blueprint",
  description:
    "Fast Haiku pre-pass that turns a next-scene request into a labelled scene blueprint injected into the Writer's dynamic context.",
  provider: "anthropic",
  model: "claude-haiku-4-5-20251001",
  maxTokens: 350,
  // Haiku 4.5 is $1/MTok in, $5/MTok out. At 350 output tokens plus a few
  // thousand context tokens this lands around half a cent — well under
  // DEFAULT_UNIT_USD (0.05), which is why this is a "cheap but not free"
  // capability rather than one of the metered operations.
  estimatedUsdPerCall: 0.006,
  costBasis: "Haiku 4.5 at $1/MTok in + $5/MTok out; 350 max_tokens out plus ~4k context in.",
  contractTest: "src/lib/ai/__tests__/scene-blueprint.test.ts",
  gate: "GrowthBook flag `scene_blueprint`, default OFF, server-checked per request via isFeatureOnServer().",
  status: "experimental",
};

export const EXPERIMENTAL_CAPABILITIES: readonly ExperimentalCapability[] = [
  SCENE_BLUEPRINT_CAPABILITY,
];

export function isExperimental(id: string): boolean {
  return EXPERIMENTAL_CAPABILITIES.some((c) => c.id === id);
}