/**
 * Phase 1 / v4 item 9.1 — CapabilityGate stays generic.
 *
 * v4: "Legacy cloud interprets subscription gates. Local Story OS interprets
 * provider/module/hardware/experimental availability. **Core does not depend on
 * Razorpay or subscription types.**"
 *
 * The problem this solves: `src/lib/capabilities/registry.ts` types every
 * capability's `gate` as `FeatureGate | null`, where `FeatureGate` is a union of
 * subscription feature keys ("story_modes_advanced" | "style_dna" | …) from
 * `@/types/subscription`. That bakes Razorpay's tier vocabulary into the
 * capability spine, so the local-first Story OS cannot express "this needs a
 * module you have not installed" or "this needs a GPU" without inventing a
 * fake subscription feature for it.
 *
 * The fix is to separate WHAT a gate is from WHO interprets it:
 *
 *   - Core only knows a gate is a `{ kind, value }` pair and asks an injected
 *     interpreter whether it passes. It has no vocabulary of its own.
 *   - The legacy cloud adapter interprets `kind: "subscription"` via the
 *     existing `canAccessFeature` / tier ladder.
 *   - A local host would add `provider` / `module` / `hardware` interpreters.
 *
 * `value` is deliberately an opaque string. Core must not branch on it, or it has
 * re-acquired the coupling it was built to remove.
 *
 * Nothing in this module imports `@/types/subscription`, Razorpay, or any tier
 * type. `gate-genericity.test.ts` asserts that by reading this file's import
 * graph, so the constraint cannot rot.
 */

export type GateKind =
  /** Billing/entitlement. Interpreted by the legacy cloud adapter. */
  | "subscription"
  /** An optional module that may not be installed (local host). */
  | "module"
  /** Requires a configured provider / API key (local host). */
  | "provider"
  /** Requires specific hardware (local host). */
  | "hardware"
  /** Opt-in capability not yet promoted to a default. */
  | "experimental";

export const GATE_KINDS: readonly GateKind[] = [
  "subscription",
  "module",
  "provider",
  "hardware",
  "experimental",
];

export interface CapabilityGate {
  readonly kind: GateKind;
  /**
   * Opaque to Core. Interpreted entirely by the host adapter. For the legacy
   * cloud this is a `FeatureGate` key such as "story_modes_advanced"; for a local
   * host it might be a module id or a provider name.
   */
  readonly value?: string;
}

export type GateDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string; readonly gate: CapabilityGate };

export const ALLOWED: GateDecision = { allowed: true };

export function deny(reason: string, gate: CapabilityGate): GateDecision {
  return { allowed: false, reason, gate };
}

/**
 * Host-supplied facts. Deliberately untyped: Core has no idea what a subscription
 * tier or an installed module looks like, and must not grow a field for either.
 */
export type GateFacts = Readonly<Record<string, unknown>>;

/**
 * A host's evaluator for ONE gate kind. Hosts implement these; Core only
 * dispatches to them.
 */
export type GateInterpreter = (gate: CapabilityGate, facts: GateFacts) => GateDecision;

/** A host's full gate resolution strategy: one interpreter per kind it supports. */
export type GateResolver = Partial<Record<GateKind, GateInterpreter>>;

export type ResolveResult = {
  readonly decision: GateDecision;
  /** The gates actually consulted, in order. Useful for telemetry and debugging. */
  readonly consulted: readonly CapabilityGate[];
};

/**
 * Evaluate a capability's gates. `null`/`undefined` means ungated and allowed.
 *
 * Every gate must pass (AND). The first denial short-circuits and is returned
 * with the gate that caused it, so a caller can tell the user exactly which
 * requirement they are missing.
 */
export function resolveGates(
  gates: readonly (CapabilityGate | null | undefined)[] | null | undefined,
  facts: GateFacts,
  resolver: GateResolver,
): ResolveResult {
  const list = (gates ?? []).filter((g): g is CapabilityGate => g != null);
  const consulted: CapabilityGate[] = [];
  for (const gate of list) {
    consulted.push(gate);
    const interpret = resolver[gate.kind];
    // An unknown kind is NOT silently allowed. Failing closed here means a new
    // gate kind added to a capability without a matching interpreter surfaces as
    // a clear "no interpreter" error instead of quietly unlocking paid content.
    const decision = interpret
      ? interpret(gate, facts)
      : deny(`No interpreter registered for gate kind "${gate.kind}".`, gate);
    if (!decision.allowed) return { decision, consulted };
  }
  return { decision: ALLOWED, consulted };
}

/** Convenience for the very common single-gate case. */
export function resolveGate(
  gate: CapabilityGate | null | undefined,
  facts: GateFacts,
  resolver: GateResolver,
): GateDecision {
  return resolveGates([gate], facts, resolver).decision;
}

/**
 * Wraps a capability whose gate was declared in the legacy subscription
 * vocabulary, so migrating a capability to the generic gate shape does not
 * require rewriting every entry at once.
 *
 * The subscription meaning stays in the adapter (see `cloud-gate-adapter.ts`);
 * only the `kind` tag is added here.
 */
export function subscriptionGate(value: string): CapabilityGate {
  return { kind: "subscription", value };
}

/** Narrow an unknown value to a GateKind, tolerating sloppy persisted data. */
export function isGateKind(value: unknown): value is GateKind {
  return typeof value === "string" && (GATE_KINDS as readonly string[]).includes(value);
}

/** Normalize loose input into a CapabilityGate, or null when ungated. */
export function toCapabilityGate(input: unknown): CapabilityGate | null {
  if (input == null) return null;
  if (typeof input === "string") return subscriptionGate(input);
  if (typeof input === "object" && isGateKind((input as CapabilityGate).kind)) {
    const g = input as CapabilityGate;
    return g.value === undefined ? { kind: g.kind } : { kind: g.kind, value: g.value };
  }
  return null;
}