import { Redis } from "@upstash/redis";

// Same Upstash Redis instance already configured for rate limiting
// (src/lib/ratelimit.ts) — reused here as the shared counter store.
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

const FAILURE_THRESHOLD = 5;
const WINDOW_SECONDS = 120;

/**
 * Real gap this closes (item 71/72 research): when a provider (Segmind,
 * Higgsfield) goes down, every in-flight request still makes its own real
 * API call and pays for/waits on its own failure individually — nothing
 * stops repeatedly hammering a provider that's clearly not responding.
 *
 * Deliberately fails OPEN in every environment (unlike ratelimit.ts's
 * fail-closed-in-production convention) — a circuit breaker exists purely to
 * save wasted calls during a real outage; if its own Redis dependency is
 * unavailable, blocking real requests because of THAT would make things
 * worse, not better. There's no "unlimited free usage" risk here the way
 * there is for rate limiting, so there's nothing to protect by failing
 * closed.
 */
export async function isCircuitOpen(provider: string): Promise<boolean> {
  if (!redis) return false;
  try {
    const count = await redis.get<number>(`gw:circuit:${provider}`);
    return (count ?? 0) >= FAILURE_THRESHOLD;
  } catch {
    return false;
  }
}

/** Call on a real network-level failure or timeout — not on an HTTP error
 *  status the provider returned cleanly (a 4xx/5xx response is still a
 *  successful round-trip from this module's point of view; only a request
 *  that couldn't complete at all indicates the provider itself is down). */
export async function recordProviderFailure(provider: string): Promise<void> {
  if (!redis) return;
  try {
    const key = `gw:circuit:${provider}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW_SECONDS);
  } catch {
    // best-effort — never let circuit-breaker bookkeeping break the real call
  }
}

export async function recordProviderSuccess(provider: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`gw:circuit:${provider}`);
  } catch {
    // best-effort
  }
}
