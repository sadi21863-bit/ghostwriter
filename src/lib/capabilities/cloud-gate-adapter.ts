/**
 * Phase 1 / v4 item 9.1 — legacy cloud gate adapter.
 *
 * This is the ONE place allowed to know that "subscription" gates mean
 * `canAccessFeature(tier, FeatureGate)`. It lives at the edge deliberately:
 * `gate.ts` (Core) has no tier vocabulary, and this adapter supplies the
 * interpretation for the legacy cloud so nothing else has to.
 *
 * A local host would ship its own resolver covering `provider` / `module` /
 * `hardware` and leave `subscription` unimplemented, which is exactly the
 * portability v4 §12.1 asks for.
 */

import {
  ALLOWED,
  deny,
  type CapabilityGate,
  type GateFacts,
  type GateInterpreter,
  type GateResolver,
} from "@/lib/capabilities/gate";
import { canAccessFeature } from "@/lib/subscription";
import { FEATURE_ACCESS, type SubscriptionTier } from "@/types/subscription";

/** How long a denied gate should be presented before it can be retried. */
export const UPGRADE_REQUIRED = "upgrade_required";

/**
 * Facts shape for the legacy cloud. This is the adapter's own vocabulary — Core
 * never sees it.
 */
export type CloudGateFacts = {
  readonly tier: SubscriptionTier;
};

export const isCloudGateFacts = (facts: GateFacts): facts is unknown & CloudGateFacts =>
  typeof (facts as CloudGateFacts)?.tier === "string";

/**
 * Denials for the legacy cloud. The shape (`error` + `feature`) is what the
 * existing `/api/ai/*` routes already return, and what `setUpgradeRequired` on
 * the client already reads, so this preserves the wire contract rather than
 * inventing a new one.
 */
export function upgradeReason(feature: string): string {
  return `${UPGRADE_REQUIRED}:${feature}`;
}

export const subscriptionGateInterpreter: GateInterpreter = (gate, facts) => {
  if (!gate.value) return deny("Subscription gate has no feature key.", gate);
  if (!isCloudGateFacts(facts)) return deny("No subscription tier supplied to the cloud adapter.", gate);
  // A feature key that is not in FEATURE_ACCESS is a data bug, not an upgrade
  // prompt — distinguishing them stops a typo from telling every user to upgrade.
  if (!isKnownSubscriptionFeature(gate.value)) {
    return deny(`Unknown subscription feature "${gate.value}".`, gate);
  }
  return canAccessFeature(facts.tier, gate.value as never)
    ? ALLOWED
    : deny(upgradeReason(gate.value), gate);
};

/**
 * `canAccessFeature` returns false for unknown features, so it cannot be used to
 * detect typos. Probe the same table it uses instead — a typo'd feature key must
 * not tell every user to upgrade.
 */
function isKnownSubscriptionFeature(value: string): boolean {
  return value in FEATURE_ACCESS;
}

/** A resolver wired for the legacy cloud. */
export function cloudGateResolver(): GateResolver {
  return { subscription: subscriptionGateInterpreter };
}