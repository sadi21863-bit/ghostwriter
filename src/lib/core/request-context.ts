/**
 * Phase 2 / v4 §7 — RequestContext and the shared handler registry seam.
 *
 * v4: "Business handlers never call NextAuth or parse loopback tokens
 * themselves." Today every route opens with `getRequiredSession()` and threads
 * `session.user.id` through helpers by hand. That makes two facts impossible to
 * state in one place — WHO is acting, and WHICH environment they are acting in —
 * so a local-first host would have to fork every handler to answer them.
 *
 * This module is the answer. `RequestContext` is the single input every business
 * handler takes. Auth becomes a decorator that PRODUCES a context:
 *
 *   NextAuth session ──▶ fromSessionAdapter ──┐
 *                                           ├──▶ RequestContext ──▶ handler
 *   loopback token ────▶ fromTokenAdapter ────┘
 *
 * Nothing here imports NextAuth, `next-auth`, or any transport type, and
 * `request-context.test.ts` reads this file's source to keep that true. The
 * adapters live in `auth-decorators.ts` so the dependency sits at the edge.
 */

export type ActorKind = "user" | "local-owner";

export type Environment = "legacy-cloud" | "local";

export interface Actor {
  readonly kind: ActorKind;
  readonly id: string;
}

export interface Permission {
  /** Capability or resource the actor may act on, e.g. "project:123". */
  readonly resource: string;
  readonly action: string;
}

/**
 * Host-supplied services. Core names the slots it needs; it never constructs
 * them, so a local host can supply a filesystem repository where the cloud host
 * supplies a Postgres one without either leaking into the handler.
 */
export interface Services {
  readonly repositories?: Readonly<Record<string, unknown>>;
  readonly providers?: Readonly<Record<string, unknown>>;
  readonly [slot: string]: unknown;
}

export interface RequestContext {
  readonly actor: Actor;
  /**
   * Restricts the request to one project. When set, every handler MUST scope its
   * queries by it — a handler that ignores it has an authorization bug, so this
   * is a first-class field rather than something re-derived per route.
   */
  readonly projectScope?: string;
  readonly environment: Environment;
  readonly permissions: readonly Permission[];
  readonly services: Services;
}

/** Handlers receive a context and their input, and nothing else. */
export type BusinessHandler<Input, Output> = (
  ctx: RequestContext,
  input: Input,
) => Promise<Output> | Output;

export const LOCAL_ACTOR: Actor = { kind: "local-owner", id: "local" };

export function cloudContext(
  userId: string,
  opts: { projectScope?: string; permissions?: Permission[]; services?: Services } = {},
): RequestContext {
  return {
    actor: { kind: "user", id: userId },
    projectScope: opts.projectScope,
    environment: "legacy-cloud",
    permissions: opts.permissions ?? [],
    services: opts.services ?? {},
  };
}

/**
 * The single-machine local host: one owner, no account, optionally scoped to one
 * project. v4 §12 requires project creation/editing/Bible/planning/export to work
 * with no account and no model, which is exactly this context.
 */
export function localContext(
  opts: {
    projectScope?: string;
    permissions?: Permission[];
    services?: Services;
    /**
     * Stage (e) — the §5.6 `localOwnerId` convention at the TRANSPORT level:
     * when a composition root supplies it, every ctx's actor id becomes the
     * ONE real users-row id (so handlers whose rows FK to the users table can
     * write with the production `actor.id === row.userId` semantics). Unset =
     * the "local" placeholder id (the exact pre-stage-(e) behavior — this
     * wires an override onto the default, not a veto on the tests).
     */
    actorOwnerId?: string;
  } = {},
): RequestContext {
  return {
    actor: opts.actorOwnerId
      ? { kind: "local-owner", id: opts.actorOwnerId }
      : LOCAL_ACTOR,
    projectScope: opts.projectScope,
    environment: "local",
    permissions: opts.permissions ?? [],
    services: opts.services ?? {},
  };
}

/**
 * A context for an actor may act within `projectScope`. Returns a new context —
 * never mutates the caller's, because a shared parent context reused across
 * requests would leak one request's scope into another.
 */
export function withProjectScope(ctx: RequestContext, projectScope: string): RequestContext {
  if (ctx.projectScope && ctx.projectScope !== projectScope) {
    throw new Error(
      `Refusing to widen scope: context is already scoped to ${ctx.projectScope}.`,
    );
  }
  return { ...ctx, projectScope };
}

export function isLocal(ctx: RequestContext): boolean {
  return ctx.environment === "local";
}

/** True when this context may act on the given project. */
export function mayAccessProject(ctx: RequestContext, projectId: string): boolean {
  return ctx.projectScope === undefined || ctx.projectScope === projectId;
}

export function hasPermission(ctx: RequestContext, resource: string, action: string): boolean {
  return ctx.permissions.some((p) => p.resource === resource && p.action === action);
}