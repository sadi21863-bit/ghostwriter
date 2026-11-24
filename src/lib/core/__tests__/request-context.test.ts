import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LOCAL_ACTOR,
  cloudContext,
  hasPermission,
  isLocal,
  localContext,
  mayAccessProject,
  withProjectScope,
  type BusinessHandler,
  type RequestContext,
} from "@/lib/core/request-context";
import {
  AuthRequiredError,
  MIN_LOCAL_TOKEN_LENGTH,
  fromLoopbackRequest,
  fromSession,
  isLoopbackOrigin,
  isLoopbackUrl,
  parseBearer,
  safeEqual,
} from "@/lib/core/auth-decorators";

// This file is src/lib/core/__tests__/x.test.ts — FOUR levels below root.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

const TOKEN = "a".repeat(MIN_LOCAL_TOKEN_LENGTH);

describe("Core is transport-agnostic (v4 §7)", () => {
  it("request-context.ts imports nothing at all", () => {
    // "Business handlers never call NextAuth or parse loopback tokens
    // themselves." This is the file that would violate that, so it must have no
    // transport dependency to violate it with.
    const src = readFileSync(join(ROOT, "src/lib/core/request-context.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect([...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!)).toEqual([]);
  });

  it("request-context.ts never mentions NextAuth or a session", () => {
    const src = readFileSync(join(ROOT, "src/lib/core/request-context.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/next-?auth|getServerSession|session\b/i);
  });
});

describe("contexts", () => {
  it("cloud context carries a user actor", () => {
    const ctx = cloudContext("u1");
    expect(ctx.actor).toEqual({ kind: "user", id: "u1" });
    expect(ctx.environment).toBe("legacy-cloud");
    expect(isLocal(ctx)).toBe(false);
  });

  it("local context has one owner and no account", () => {
    const ctx = localContext();
    expect(ctx.actor).toEqual(LOCAL_ACTOR);
    expect(ctx.environment).toBe("local");
    expect(isLocal(ctx)).toBe(true);
  });

  it("an unscoped context may access any project", () => {
    const ctx = localContext();
    expect(mayAccessProject(ctx, "p1")).toBe(true);
    expect(mayAccessProject(ctx, "p2")).toBe(true);
  });

  it("a scoped context may access only its project", () => {
    const ctx = localContext({ projectScope: "p1" });
    expect(mayAccessProject(ctx, "p1")).toBe(true);
    expect(mayAccessProject(ctx, "p2")).toBe(false);
  });

  it("permissions are explicit and default to none", () => {
    expect(hasPermission(localContext(), "project", "write")).toBe(false);
    const ctx = localContext({ permissions: [{ resource: "project", action: "write" }] });
    expect(hasPermission(ctx, "project", "write")).toBe(true);
    expect(hasPermission(ctx, "project", "delete")).toBe(false);
  });

  it("withProjectScope never mutates the caller's context", () => {
    const parent = cloudContext("u1");
    const child = withProjectScope(parent, "p1");
    expect(child.projectScope).toBe("p1");
    expect(parent.projectScope).toBeUndefined();
  });

  it("refuses to widen an already-scoped context", () => {
    const scoped = withProjectScope(cloudContext("u1"), "p1");
    expect(() => withProjectScope(scoped, "p2")).toThrow(/Refusing to widen scope/);
  });
});

describe("both adapters produce the same handler-facing shape", () => {
  it("a handler cannot tell which adapter produced its context", () => {
    // This is the whole point of the seam: one handler, two hosts.
    const seen: RequestContext[] = [];
    const handler: BusinessHandler<{ x: number }, number> = (ctx, input) => {
      seen.push(ctx);
      return input.x;
    };
    const viaCloud = handler(fromSession({ user: { id: "u1" } }), { x: 1 });
    const viaLocal = handler(fromLoopbackRequest({ token: TOKEN }).ok
      ? (fromLoopbackRequest({ token: TOKEN }) as { ok: true; ctx: RequestContext }).ctx
      : cloudContext("fallback"), { x: 1 });

    expect(viaCloud).toBe(1);
    expect(viaLocal).toBe(1);
    expect(Object.keys(seen[0]!).sort()).toEqual(Object.keys(seen[1]!).sort());
  });
});

describe("session adapter", () => {
  it("builds a cloud context from a user id", () => {
    expect(fromSession({ user: { id: "u9" } }).actor).toEqual({ kind: "user", id: "u9" });
  });

  it("throws AuthRequiredError when there is no user", () => {
    expect(() => fromSession(null)).toThrow(AuthRequiredError);
    expect(() => fromSession({ user: { id: null } })).toThrow(AuthRequiredError);
    expect(() => fromSession({ user: {} })).toThrow(AuthRequiredError);
  });

  it("carries a 401 status on the error", () => {
    try {
      fromSession(null);
      expect.unreachable();
    } catch (e) {
      expect((e as AuthRequiredError).status).toBe(401);
    }
  });
});

describe("loopback adapter", () => {
  it("accepts a high-entropy token", () => {
    const r = fromLoopbackRequest({ token: TOKEN });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ctx.actor).toEqual(LOCAL_ACTOR);
  });

  it("fails CLOSED when no token is configured", () => {
    // The critical case: an unset token must never mean "authenticated".
    expect(fromLoopbackRequest({ token: undefined }).ok).toBe(false);
    expect(fromLoopbackRequest({ token: "" }).ok).toBe(false);
  });

  it("rejects a short, guessable token", () => {
    expect(fromLoopbackRequest({ token: "short" }).ok).toBe(false);
    expect(fromLoopbackRequest({ token: "a".repeat(MIN_LOCAL_TOKEN_LENGTH - 1) }).ok).toBe(false);
  });

  it("accepts a token of exactly the minimum length", () => {
    expect(fromLoopbackRequest({ token: "a".repeat(MIN_LOCAL_TOKEN_LENGTH) }).ok).toBe(true);
  });
});

describe("no-egress guard", () => {
  it("allows loopback origins", () => {
    for (const o of ["http://localhost:3001", "http://127.0.0.1:8080", "http://[::1]:5173"]) {
      expect(isLoopbackOrigin(o)).toBe(true);
    }
  });

  it("refuses every non-loopback origin", () => {
    for (const o of [
      "https://evil.example.com",
      "http://localhost.evil.com",
      "http://127.0.0.1.evil.com",
      "file:///etc/passwd",
      "not a url",
      "",
    ]) {
      expect(isLoopbackOrigin(o)).toBe(false);
    }
  });

  it("refuses a request from a non-loopback origin even with a valid token", () => {
    const r = fromLoopbackRequest({ token: TOKEN, origin: "https://evil.example.com" });
    expect(r).toEqual({ ok: false, status: 401 });
  });

  it("permits an explicitly allowed origin", () => {
    const r = fromLoopbackRequest({
      token: TOKEN,
      origin: "https://studio.local",
      allowedOrigins: ["https://studio.local"],
    });
    expect(r.ok).toBe(true);
  });

  it("allows a request with no Origin (non-browser clients omit it)", () => {
    expect(fromLoopbackRequest({ token: TOKEN }).ok).toBe(true);
  });

  it("still accepts shape-only validation when no expected token is given", () => {
    // Legacy behavior: without `expected`, the decorator validates entropy only.
    // The loopback host ALWAYS passes `expected`, so this path only exists for
    // shape-only callers — and is asserted here so the contract is explicit.
    expect(fromLoopbackRequest({ token: "x".repeat(64) }).ok).toBe(true);
  });

  it("rejects a correct-length token that is not the host's token", () => {
    // The comparison is the actual identity proof; entropy alone would accept
    // any 32+ character guess. Constant-time comes from `safeEqual`.
    expect(
      fromLoopbackRequest({ token: "x".repeat(64), expected: TOKEN }).ok,
    ).toBe(false);
    expect(
      fromLoopbackRequest({ token: TOKEN, expected: TOKEN }).ok,
    ).toBe(true);
  });

  it("isLoopbackUrl matches the origin rules for full URLs", () => {
    expect(isLoopbackUrl("http://127.0.0.1:11434/v1/chat")).toBe(true);
    expect(isLoopbackUrl("https://api.openai.com/v1/chat")).toBe(false);
  });
});

describe("bearer parsing", () => {
  it("accepts a well-formed bearer header", () => {
    expect(parseBearer("Bearer abc123")).toBe("abc123");
    expect(parseBearer("  Bearer   abc123  ")).toBe("abc123");
  });

  it("refuses anything that is not exactly Bearer <token>", () => {
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer(undefined)).toBeNull();
    expect(parseBearer("abc123")).toBeNull();
    expect(parseBearer("Basic abc123")).toBeNull();
    expect(parseBearer("Bearer")).toBeNull();
    // A duplicated header parses to an array in some runtimes; must not match.
    expect(parseBearer(["Bearer a", "Bearer b"] as unknown as string)).toBeNull();
  });
});

describe("safeEqual", () => {
  it("compares equal strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
  });

  it("rejects different strings and different lengths", () => {
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "a")).toBe(false);
  });
});