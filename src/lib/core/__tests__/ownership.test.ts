import { describe, it, expect, vi } from "vitest";
import { mayUseChild, ownsChildResource } from "@/lib/core/ownership";
import { cloudContext, localContext } from "@/lib/core/request-context";
import { pgChildResourceRepository } from "@/lib/core/pg-repositories";
import type { ChildResourceRef } from "@/lib/core/repositories";

/**
 * Phase 2 / v4 §7 — Core ownership.
 *
 * Replaces `verifyChildOwnership(table, childId, projectId)`, which bound
 * authorization to a Drizzle table and trusted the caller for the projectId.
 * Two guarantees are new and are what these tests exist to hold:
 *
 *  - a context already scoped to another project is refused WITHOUT consulting
 *    the repository, so no adapter can widen access by forgetting a WHERE clause;
 *  - an unknown resource name resolves to NOT-owned, never to owned.
 */

const ctx = cloudContext("u1");
const ref: ChildResourceRef = { resource: "comic_pages", childId: "page-1", projectId: "proj-1" };

const repo = (owned: boolean) => ({ owns: vi.fn(async () => owned) });

describe("ownsChildResource", () => {
  it("allows a child the repository confirms", async () => {
    expect(await ownsChildResource(ctx, ref, repo(true))).toEqual({ ok: true });
  });

  it("reports not-found when the repository does not confirm it", async () => {
    expect(await ownsChildResource(ctx, ref, repo(false))).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("refuses an out-of-scope request WITHOUT consulting the repository", async () => {
    const r = repo(true);
    const scoped = localContext({ projectScope: "other-project" });
    expect(await ownsChildResource(scoped, ref, r)).toEqual({
      ok: false,
      reason: "out-of-scope",
    });
    // The whole point: no adapter can be talked into allowing this.
    expect(r.owns).not.toHaveBeenCalled();
  });

  it("allows a context scoped to the SAME project", async () => {
    const scoped = localContext({ projectScope: "proj-1" });
    expect(await ownsChildResource(scoped, ref, repo(true))).toEqual({ ok: true });
  });

  it("allows any project when the context is unscoped", async () => {
    const unscoped = localContext();
    const other = { ...ref, projectId: "proj-9" };
    expect(await ownsChildResource(unscoped, other, repo(true))).toEqual({ ok: true });
  });

  it("passes the resource reference through untouched", async () => {
    const r = repo(true);
    await ownsChildResource(ctx, ref, r);
    expect(r.owns).toHaveBeenCalledWith(ref);
  });

  it("mayUseChild is the boolean form", async () => {
    expect(await mayUseChild(ctx, ref, repo(true))).toBe(true);
    expect(await mayUseChild(ctx, ref, repo(false))).toBe(false);
    expect(await mayUseChild(localContext({ projectScope: "x" }), ref, repo(true))).toBe(false);
  });
});

describe("ownership is generic over its repository", () => {
  // The Postgres adapter's own behaviour — including the prototype-key guard —
  // is covered in `pg-child-resources.test.ts`, which mocks `@/db`.
  it("never requires a concrete adapter shape", async () => {
    const minimal = { owns: async () => true };
    expect(await ownsChildResource(ctx, ref, minimal)).toEqual({ ok: true });
  });
});