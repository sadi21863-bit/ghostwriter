import { describe, it, expect } from "vitest";
import {
  VIOLATION_PATTERNS,
  detectGenerationViolation,
  violationConfirmation,
} from "@/lib/core/policy/generation-violations";

/**
 * Unit policy for /api/ai/generate's violation gate. The route-level behaviour
 * (which transport shape a stop takes) is covered by the route tests; this file
 * owns the PATTERN semantics that previously lived untested inside the route
 * body.
 */
describe("generation violations policy", () => {
  it("has exactly the three known patterns", () => {
    // Order is contract: the first match wins, so rediscovery of this list
    // matters.
    expect(Object.keys(VIOLATION_PATTERNS)).toEqual([
      "op_protagonist",
      "villain_accent",
      "supercrip_disability",
    ]);
  });

  it("flags an overpowered protagonist", () => {
    const hit = detectGenerationViolation("a hero who is completely OP and never fails", {});
    expect(hit?.violationType).toBe("op_protagonist");
  });

  it("flags a villain accent without re-firing the OP pattern", () => {
    const hit = detectGenerationViolation("the villain's accent marks him foreign", {});
    expect(hit?.violationType).toBe("villain_accent");
  });

  it("does not flag unrelated prompts", () => {
    expect(detectGenerationViolation("Write the next scene.", {})).toBeNull();
    expect(detectGenerationViolation("describe a quiet library", {})).toBeNull();
  });

  it("does not flag a previously confirmed violation", () => {
    const hit = detectGenerationViolation("an OP protagonist, deliberately", {
      op_protagonist: { confirmed: true },
    });
    expect(hit).toBeNull();
  });

  it("an unconfirmed record still fires", () => {
    const hit = detectGenerationViolation("an OP protagonist, deliberately", {
      op_protagonist: { confirmed: false },
    });
    expect(hit?.violationType).toBe("op_protagonist");
  });

  it("first match wins when several patterns fire", () => {
    const hit = detectGenerationViolation(
      "an OP protagonist villain foreign accent disability superpower",
      {},
    );
    expect(hit?.violationType).toBe("op_protagonist");
  });

  it("shapes the confirmation contract the dialog consumes", () => {
    const hit = detectGenerationViolation("the bad guy's foreign accent", {})!;
    expect(violationConfirmation(hit)).toEqual({
      requiresConfirmation: true,
      violationType: "villain_accent",
      flagMessage: VIOLATION_PATTERNS.villain_accent.flagMessage,
      supportMode: VIOLATION_PATTERNS.villain_accent.supportMode,
    });
  });
});
