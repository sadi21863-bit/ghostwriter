import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison of a caller-supplied bearer token against an expected
 * secret.
 *
 * `===` on strings short-circuits at the first differing byte, which leaks the
 * secret's prefix length through response timing. Every admin/cron route in this
 * codebase compared with `===`, so all of them were exposed to that.
 *
 * timingSafeEqual requires equal-length buffers and throws otherwise, so length
 * is compared first. That comparison is itself not constant-time, which is
 * acceptable here: ADMIN_SECRET/CRON_SECRET are high-entropy 32+ byte random
 * values, so their length is not a meaningful secret.
 */
export function safeSecretEquals(candidate: string | null | undefined, expected: string | null | undefined): boolean {
  if (!candidate || !expected) return false;
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Extracts the bearer token from an Authorization header and compares it to an
 * environment secret in constant time. Returns a 401 Response when the secret is
 * not configured, so a missing env var can never accidentally authorize anyone.
 */
export function requireBearer(authorization: string | null, envVarName: "ADMIN_SECRET" | "CRON_SECRET"): Response | null {
  const expected = process.env[envVarName];
  if (!expected) {
    return new Response(`Server misconfigured: ${envVarName} not set`, { status: 500 });
  }
  const candidate = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
  if (!safeSecretEquals(candidate, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}