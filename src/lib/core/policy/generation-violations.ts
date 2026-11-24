/**
 * Content-policy detection for /api/ai/generate (v4 §7).
 *
 * Moved out of the route so the PATTERNS and the confirmation contract are one
 * testable unit, and so a local Story OS host can reuse or replace the policy
 * without inheriting the route's transport. The detection is deliberately pure:
 * given a prompt and the caller's record of previously confirmed violations, it
 * either returns the pattern that fired or null. Nothing here knows about HTTP,
 * sessions, or databases.
 *
 * Shaping the RESPONSE is also policy (it is what the client's confirm dialog
 * consumes), so it lives here too — a host wraps it in its own transport.
 *
 * Byte-identical migration from the route: the patterns, the messages, the
 * iteration order, and the confirm-record lookup are exactly what
 * `/api/ai/generate` did inline before this module existed.
 */

export interface ViolationPattern {
  /** True when the prompt should be flagged for this pattern. */
  detect: (prompt: string) => boolean;
  flagMessage: string;
  supportMode: string;
}

/** Iteration order is part of the contract: the first match wins. */
export const VIOLATION_PATTERNS: Record<string, ViolationPattern> = {
  op_protagonist: {
    detect: (p) => /overpowered|(?<!\w)OP(?!\w)|perfect.*protagonist|no.*weakness|always win|never fail/i.test(p),
    flagMessage:
      "This request appears to involve an overpowered/perfect protagonist. If intentional (power fantasy, isekai wish-fulfillment, parody), confirm below and I'll generate with full craft support for that specific mode. If unintentional, consider adding external constraints — who they care about, what they refuse to do, information gaps — to create tension without reducing their power.",
    supportMode:
      "The OP character's tension is external: stakes come from who they love, what they won't do, and costs to others. I'll write with this in mind.",
  },
  villain_accent: {
    detect: (p) => /villain.*accent|evil.*accent|bad.*guy.*foreign/i.test(p),
    flagMessage:
      "Assigning a foreign/non-standard accent to a villain activates a documented harmful trope. If intentional (the story is explicitly about this bias, or you're subverting it), confirm. Otherwise, consider: what if the villain speaks with the prestige accent, and the most trustworthy character has the stigmatized accent?",
    supportMode:
      "Using accent subversion to challenge reader assumptions. The villain's prestige accent is their armor. I'll write this with full awareness.",
  },
  supercrip_disability: {
    detect: (p) => /blind.*radar|deaf.*super|disability.*superpower|disability.*gift/i.test(p),
    flagMessage:
      "This appears to use a disability as a superpower source (the 'Supercrip' trope). If intentional subversion or genre-aware choice, confirm. Otherwise, consider: the disability is one dimension of a whole person, not the source of their extraordinary ability.",
    supportMode:
      "Writing disability with full human complexity. The superpower, if present, comes from something other than the disability itself.",
  },
};

/** The caller's per-project record of previously confirmed violations. */
export type ConfirmedViolations = Record<string, unknown>;

export interface ViolationHit {
  violationType: string;
  flagMessage: string;
  supportMode: string;
}

/**
 * Detect the first unconfirmed violation in a prompt.
 *
 * A previously confirmed violation does not re-fire — `confirmed` maps
 * violationType → its confirmation record, and a truthy `confirmed` entry means
 * the caller already acknowledged this (possibly intentional) use.
 */
export function detectGenerationViolation(
  prompt: string,
  confirmed: ConfirmedViolations,
): ViolationHit | null {
  for (const [violationType, pattern] of Object.entries(VIOLATION_PATTERNS)) {
    if (pattern.detect(prompt) && !(confirmed[violationType] as { confirmed?: boolean } | undefined)?.confirmed) {
      return {
        violationType,
        flagMessage: pattern.flagMessage,
        supportMode: pattern.supportMode,
      };
    }
  }
  return null;
}

/**
 * The control response the endpoint answers with when a violation needs the
 * caller's confirmation. The client reads `requiresConfirmation` to open its
 * dialog and re-sends the request with `bypassViolationCheck` after the caller
 * confirms.
 */
export function violationConfirmation(hit: ViolationHit) {
  return {
    requiresConfirmation: true,
    violationType: hit.violationType,
    flagMessage: hit.flagMessage,
    supportMode: hit.supportMode,
  };
}
