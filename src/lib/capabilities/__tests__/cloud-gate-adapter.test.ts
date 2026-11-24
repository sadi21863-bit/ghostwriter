import { describe, it, expect } from "vitest";
import { subscriptionGate, type GateFacts } from "@/lib/capabilities/gate";
import {
  cloudGateResolver,
  isCloudGateFacts,
  subscriptionGateInterpreter,
  upgradeReason,
  UPGRADE_REQUIRED,
} from "@/lib/capabilities/cloud-gate-adapter";

/**
 * The legacy cloud adapter is the ONLY module allowed to know that a
 * "subscription" gate means a Razorpay-backed tier check. These tests pin the
 * wire contract it must preserve while Core stays generic.
 */

const facts = (tier: string) => ({ tier }) as unknown as GateFacts;

describe("subscriptionGateInterpreter", () => {
  it("allows a tier that has the feature", () => {
    expect(
      subscriptionGateInterpreter(subscriptionGate("story_modes_advanced"), facts("story_pro")).allowed,
    ).toBe(true);
  });

  it("denies a tier that lacks the feature, with the legacy upgrade payload", () => {
    const d = subscriptionGateInterpreter(subscriptionGate("story_modes_advanced"), facts("free"));
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      // The `/api/ai/*` routes and `setUpgradeRequired` on the client already
      // parse this shape; changing it would break the paywall prompt.
      expect(d.reason).toBe(upgradeReason("story_modes_advanced"));
      expect(d.reason.startsWith(UPGRADE_REQUIRED)).toBe(true);
    }
  });

  it("treats an unknown feature key as a data bug, NOT an upgrade prompt", () => {
    // Otherwise a typo silently tells every user to upgrade.
    const d = subscriptionGateInterpreter(subscriptionGate("not_a_real_feature"), facts("free"));
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).not.toMatch(UPGRADE_REQUIRED);
  });

  it("denies when no feature key is supplied", () => {
    const d = subscriptionGateInterpreter({ kind: "subscription" }, facts("story_pro"));
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toMatch(/no feature key/i);
  });

  it("denies when the caller supplies no tier", () => {
    const d = subscriptionGateInterpreter(subscriptionGate("style_dna"), {});
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toMatch(/No subscription tier/i);
  });
});

describe("isCloudGateFacts", () => {
  it("requires a string tier", () => {
    expect(isCloudGateFacts({ tier: "story_pro" })).toBe(true);
    expect(isCloudGateFacts({ tier: 7 })).toBe(false);
    expect(isCloudGateFacts({})).toBe(false);
  });
});

describe("cloudGateResolver", () => {
  it("only interprets subscription gates", () => {
    // A local host ships provider/module/hardware resolvers and deliberately
    // leaves subscription unimplemented — that is the portability v4 §12.1 wants.
    const r = cloudGateResolver();
    expect(Object.keys(r)).toEqual(["subscription"]);
  });
});