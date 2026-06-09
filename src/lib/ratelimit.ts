import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// Fail open if env vars missing (dev environment without Upstash configured)
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// 20 AI requests per user per minute
export const aiRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      analytics: true,
      prefix: "gw:ai",
    })
  : null;

// 100 requests per user per minute for general routes
export const generalRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      analytics: true,
      prefix: "gw:general",
    })
  : null;

// 5 requests per hour for auth endpoints (register, forgot-password)
export const authRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      analytics: true,
      prefix: "gw:auth",
    })
  : null;

// 10 AI generations per free user per day
export const freeGenerationLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(10, "1 d"),
      analytics: true,
      prefix: "gw:free:daily",
    })
  : null;

/**
 * Returns a 429 NextResponse if the user is rate-limited, or null if they're allowed.
 * Call immediately after getRequiredSession() in every AI route.
 */
export async function checkAiRateLimit(userId: string): Promise<NextResponse | null> {
  if (!aiRatelimit) return null;
  const { success, limit, remaining, reset } = await aiRatelimit.limit(userId);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 20 AI requests per minute." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
        },
      }
    );
  }
  return null;
}

/**
 * IP-based rate limit for auth endpoints. 5 requests per hour per IP.
 * Fails open if Upstash is not configured.
 */
export async function checkAuthRateLimit(ip: string): Promise<NextResponse | null> {
  if (!authRatelimit) return null;
  const { success } = await authRatelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429 }
    );
  }
  return null;
}

/**
 * General IP-based rate limit. 100 requests per minute per IP.
 * Fails open if Upstash is not configured.
 */
export async function checkGeneralRateLimit(ip: string): Promise<NextResponse | null> {
  if (!generalRatelimit) return null;
  const { success } = await generalRatelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429 }
    );
  }
  return null;
}
