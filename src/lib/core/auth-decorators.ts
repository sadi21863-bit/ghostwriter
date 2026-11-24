/**
 * Phase 2 / v4 §7 — auth decorators.
 *
 * The adapters that turn an authentication FACT into a `RequestContext`. This is
 * the only new module allowed to know about both transports; the handlers behind
 * them know neither.
 *
 * The loopback adapter enforces the two properties v4 names for the local host:
 * it binds loopback only, and uses a per-launch high-entropy token. The token
 * check is timing-safe, and a token that is absent/short/mismatched fails CLOSED
 * — an unset token must never mean "authenticated", or a local host started by
 * mistake is remotely writable.
 */

import { timingSafeEqual } from "node:crypto";
import {
  cloudContext,
  localContext,
  type Permission,
  type RequestContext,
  type Services,
} from "@/lib/core/request-context";

/**
 * The session shape NextAuth produces, declared structurally.
 *
 * Declaring it here instead of importing the NextAuth `Session` type is
 * deliberate: it keeps this file's dependency on the auth library at the
 * adapter edge, and makes the contract a test can fabricate.
 */
export interface SessionLike {
  user?: { id?: string | null } | null;
}

/** Minimal structural view of a NextAuth session. */
export function fromSession(
  session: SessionLike | null | undefined,
  opts: { projectScope?: string; permissions?: Permission[]; services?: Services } = {},
): RequestContext {
  const id = session?.user?.id;
  if (!id) throw new AuthRequiredError("No session user.");
  return cloudContext(id, opts);
}

export class AuthRequiredError extends Error {
  readonly status = 401;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

/** A local host token is high-entropy; anything shorter is rejected outright. */
export const MIN_LOCAL_TOKEN_LENGTH = 32;

export type LoopbackAuth = { ok: true; ctx: RequestContext } | { ok: false; status: 401 };

/** Constant-time compare that does not leak length via early return. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    // Still burn a comparison so the failure path costs the same either way.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/**
 * Accept only a well-formed `Authorization: Bearer <token>` header value.
 * Anything else — including a bare token, a wrong scheme, or an array (what a
 * duplicated header parses to) — is a refusal, not a best-effort match.
 */
export function parseBearer(header: string | null | undefined): string | null {
  if (typeof header !== "string") return null;
  const m = /^Bearer\s+(.+)$/.exec(header.trim());
  // Trim the captured value too: `Bearer   abc` leaves leading whitespace on the
  // token, which would then never match the real one — a confusing auth failure
  // rather than an obvious malformed header.
  return m ? m[1]!.trim() || null : null;
}

export interface LoopbackOptions {
  token: string | undefined;
  /**
   * The host's own token. When supplied (as a real host must), the presented
   * token must EQUAL it, compared in constant time. Without it this function
   * only validates the presented token's shape — which is why the loopback
   * server must always pass it: entropy alone is NOT a proof of identity, and
   * any 32+ character guess must not open the host.
   */
  expected?: string;
  projectScope?: string;
  permissions?: Permission[];
  services?: Services;
  /** Extra origins that are allowed to call the local host. */
  allowedOrigins?: readonly string[];
  /** Origin of the request being authorized, when known. */
  origin?: string;
}

/**
 * Authorize a local-host request.
 *
 * Denial order: origin first (leaks nothing about the token), then shape,
 * then the constant-time value comparison. Origin checking is deny-by-default:
 * a request with no Origin header is allowed (non-browser clients legitimately
 * omit it), but any Origin that is not loopback is refused unless explicitly
 * allowed. This is the "no-egress" half of §7 — a page on any other site must
 * not be able to drive the local host.
 */
export function fromLoopbackRequest(opts: LoopbackOptions): LoopbackAuth {
  if (opts.origin && !isLoopbackOrigin(opts.origin) && !opts.allowedOrigins?.includes(opts.origin)) {
    return { ok: false, status: 401 };
  }
  if (!opts.token || opts.token.length < MIN_LOCAL_TOKEN_LENGTH) return { ok: false, status: 401 };
  if (opts.expected !== undefined && !safeEqual(opts.token, opts.expected)) {
    return { ok: false, status: 401 };
  }
  return { ok: true, ctx: localContext(opts) };
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"]);

export function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return LOOPBACK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** True when a network target is loopback. Used by the no-egress guard. */
export function isLoopbackUrl(url: string): boolean {
  try {
    return isLoopbackOrigin(url);
  } catch {
    return false;
  }
}