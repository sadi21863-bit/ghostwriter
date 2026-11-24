import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GATE_KINDS,
  ALLOWED,
  deny,
  isGateKind,
  resolveGate,
  resolveGates,
  subscriptionGate,
  toCapabilityGate,
  type CapabilityGate,
  type GateInterpreter,
  type GateResolver,
} from "@/lib/capabilities/gate";

// This file is src/lib/capabilities/__tests__/x.test.ts — FOUR levels below root.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** Permissive resolver: allows everything, records what it saw. */
const allowAll: GateResolver = Object.fromEntries(
  GATE_KINDS.map((k) => [k, (() => ALLOWED) as GateInterpreter]),
);

/** Strip comments so these assertions test CODE, not the prose documenting it. */
function codeOf(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("CapabilityGate is generic (v4 §9.1)", () => {
  it("Core does not import subscription types or Razorpay", () => {
    // The whole point of the generic gate. Read the source rather than trust a
    // comment, and forbid the coupling it was introduced to remove.
    const code = codeOf("src/lib/capabilities/gate.ts");
    const imports = [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);

    expect(imports).toEqual([]); // no imports at all
    expect(code).not.toMatch(/SubscriptionTier|FeatureGate|razorpay/i);
    expect(code).not.toMatch(/story_modes_advanced|story_pro|creator_pro|all_access/);
  });

  it("declares exactly the five gate kinds v4 specifies", () => {
    expect([...GATE_KINDS].sort()).toEqual([
      "experimental",
      "hardware",
      "module",
      "provider",
      "subscription",
    ]);
  });

  it("never branches on the opaque value", () => {
    // If Core started comparing gate.value it would have re-acquired the
    // vocabulary it exists to avoid.
    const body = codeOf("src/lib/capabilities/gate.ts");
    const start = body.indexOf("export function resolveGates");
    expect(start).toBeGreaterThan(-1);
    expect(body.slice(start)).not.toMatch(/gate\.value\s*===|gate\.value\s*!==|switch\s*\(\s*gate\.value/);
  });
});

describe("resolveGates", () => {
  it("allows an ungated capability", () => {
    expect(resolveGates(null, {}, allowAll).decision.allowed).toBe(true);
    expect(resolveGates([], {}, allowAll).decision.allowed).toBe(true);
    expect(resolveGates([null, undefined], {}, allowAll).decision.allowed).toBe(true);
  });

  it("allows when every gate passes", () => {
    const r = resolveGates(
      [subscriptionGate("story_modes_advanced"), { kind: "module", value: "local" }],
      {},
      allowAll,
    );
    expect(r.decision.allowed).toBe(true);
    expect(r.consulted).toHaveLength(2);
  });

  it("denies on the first failing gate and names it", () => {
    const boom: GateInterpreter = (g) => deny("needs a GPU", g);
    const r = resolveGates(
      [{ kind: "hardware", value: "gpu" }, subscriptionGate("style_dna")],
      {},
      { ...allowAll, hardware: boom },
    );
    expect(r.decision.allowed).toBe(false);
    if (!r.decision.allowed) {
      expect(r.decision.reason).toBe("needs a GPU");
      expect(r.decision.gate.kind).toBe("hardware");
    }
    // Short-circuits: the second gate is never consulted.
    expect(r.consulted).toHaveLength(1);
  });

  it("fails CLOSED when a gate kind has no interpreter", () => {
    // A new gate kind must not silently unlock paid content just because the host
    // forgot to implement it.
    const r = resolveGates([{ kind: "module", value: "unimplemented" }], {}, {
      subscription: () => ALLOWED,
    });
    expect(r.decision.allowed).toBe(false);
    if (!r.decision.allowed) {
      expect(r.decision.reason).toMatch(/No interpreter registered/);
      expect(r.decision.reason).toMatch(/"module"/);
    }
  });

  it("is order-sensitive: the first denial is the one reported", () => {
    const first: GateInterpreter = (g) => deny("first", g);
    const second: GateInterpreter = (g) => deny("second", g);
    const r = resolveGates([{ kind: "module" }, { kind: "provider" }], {}, {
      module: first,
      provider: second,
    });
    expect(r.decision.allowed).toBe(false);
    if (!r.decision.allowed) expect(r.decision.reason).toBe("first");
  });

  it("resolveGate is the single-gate convenience form", () => {
    expect(resolveGate(null, {}, allowAll).allowed).toBe(true);
    expect(resolveGate({ kind: "experimental", value: "x" }, {}, allowAll).allowed).toBe(true);
  });
});

describe("subscriptionGate and toCapabilityGate", () => {
  it("subscriptionGate tags the legacy vocabulary without importing it", () => {
    const g: CapabilityGate = subscriptionGate("style_dna");
    expect(g.kind).toBe("subscription");
    expect(g.value).toBe("style_dna");
  });

  it("treats a bare string as a legacy subscription gate", () => {
    expect(toCapabilityGate("style_dna")).toEqual({ kind: "subscription", value: "style_dna" });
  });

  it("passes a well-formed generic gate through", () => {
    expect(toCapabilityGate({ kind: "provider", value: "segmind" })).toEqual({
      kind: "provider",
      value: "segmind",
    });
    expect(toCapabilityGate({ kind: "hardware" })).toEqual({ kind: "hardware" });
  });

  it("returns null for nullish and malformed input rather than inventing a gate", () => {
    expect(toCapabilityGate(null)).toBeNull();
    expect(toCapabilityGate(undefined)).toBeNull();
    expect(toCapabilityGate({ kind: "not-a-kind" })).toBeNull();
    expect(toCapabilityGate(42)).toBeNull();
  });

  it("isGateKind rejects near-misses, not just unknown strings", () => {
    expect(isGateKind("subscription")).toBe(true);
    expect(isGateKind("Subscription")).toBe(false);
    expect(isGateKind("__proto__")).toBe(false);
    expect(isGateKind("toString")).toBe(false);
    expect(isGateKind(7)).toBe(false);
  });
});