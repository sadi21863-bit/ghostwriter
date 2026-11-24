import { describe, it, expect, vi } from "vitest";
import {
  PROJECT_PATCH_FIELDS,
  PROJECT_LIMIT_REACHED_BODY,
  createProject,
  deleteProject,
  listProjects,
  readProject,
  updateProject,
  type ProjectTierResolver,
} from "@/lib/core/handlers/projects";
import { cloudContext, localContext, type RequestContext } from "@/lib/core/request-context";

/**
 * Phase 2 / v4 §7 — the project CRUD business handlers.
 *
 * These tests exercise the rules directly, with no database and no Next.js —
 * the payoff of the seam, mirroring `update-chapter.test.ts` / the plot-thread
 * handler tests. One representative refusal per path plus the behavior the
 * pre-migration routes owned: the tier-cap union's exact body, the create
 * defaults, the PATCH allowlist/normalizeDensity/updatedAt rules, and the
 * §11 hook gating.
 */

const ctx = cloudContext("u1");

function repo(over: Record<string, unknown> = {}) {
  // Mock implementations take the SAME arguments as the real ports so vitest
  // infers a proper call tuple (the zero-arg `vi.fn()` gotcha — CLAUDE.md 69).
  const ownsProject = vi.fn(async (_projectId: string, _actorId: string) => true);
  const listForUser = vi.fn(async (_actorId: string) => [
    {
      id: "p1",
      name: "Existing",
      format: "Novel",
      chapters: [{ id: "c1", title: "Chapter 1", wordCount: 0, sortOrder: 0 }],
      characters: [{ id: "ch1", name: "Ana" }],
    },
  ]);
  const countForUser = vi.fn(async (_actorId: string) => 0);
  const create = vi.fn(async (_actorId: string, _data: unknown) => ({
    id: "p9",
    userId: "u1",
    name: "Untitled",
  }));
  const read = vi.fn(async (_projectId: string) => ({
    id: "p1",
    userId: "u1",
    chapters: [{ id: "c1" }],
    characters: [],
    locations: [],
  }));
  const updateScoped = vi.fn(
    async (_projectId: string, _patch: Record<string, unknown>) => ({ id: "p1", userId: "u1" }),
  );
  const deleteScoped = vi.fn(async (_projectId: string) => {});
  const res = {
    ownsProject,
    listForUser,
    countForUser,
    create,
    read,
    updateScoped,
    deleteScoped,
    ...over,
  };
  return res as unknown as {
    ownsProject: typeof ownsProject;
    listForUser: typeof listForUser;
    countForUser: typeof countForUser;
    create: typeof create;
    read: typeof read;
    updateScoped: typeof updateScoped;
    deleteScoped: typeof deleteScoped;
  };
}

const getTier = vi.fn(
  async (_userId: string) => "story_pro",
) as never as ProjectTierResolver & ReturnType<typeof vi.fn>;

describe("listProjects", () => {
  it("returns the actor's rows as produced by the port", async () => {
    const r = repo();
    const out = await listProjects(ctx, r);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.projects).toHaveLength(1);
    expect(r.listForUser).toHaveBeenCalledWith("u1");
  });
});

describe("createProject — tier cap", () => {
  it("refuses with the EXACT pre-migration 403 body when the cap is reached", async () => {
    const tier = vi.fn(async () => "free") as unknown as ProjectTierResolver;
    const r = repo({ countForUser: vi.fn(async () => 3) }); // free tier cap = 3
    const out = await createProject(ctx, { data: { name: "x" } }, r, {}, tier);
    expect(out).toEqual({
      ok: false,
      status: 403,
      reason: "project-limit",
      body: PROJECT_LIMIT_REACHED_BODY,
    });
    expect(r.create).not.toHaveBeenCalled();
  });

  it("skips the count entirely for an unlimited tier", async () => {
    const r = repo();
    await createProject(ctx, { data: {} }, r, {}, getTier);
    expect(r.countForUser).not.toHaveBeenCalled();
    expect(r.create).toHaveBeenCalled();
  });

  it("applies the pre-migration `||` create defaults", async () => {
    const r = repo();
    await createProject(ctx, { data: {} }, r, {}, getTier);
    expect(r.create).toHaveBeenCalledWith("u1", {
      name: "Untitled",
      format: "Novel",
      skillLevel: "beginner",
      genres: [],
      storyType: "linear",
      biggestChallenge: "",
    });
  });
});

describe("createProject — hooks", () => {
  it("fires onCanonicalMutation('project.create') and the analytics hook after the insert", async () => {
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => {});
    const onCreated = vi.fn(async (_userId: string, _format: string) => {});
    const r = repo({ create: vi.fn(async () => ({ id: "p9", userId: "u1" })) });
    await createProject(ctx, { data: { name: "N", format: "Comic" } }, r, { onCanonicalMutation, onCreated }, getTier);
    expect(onCanonicalMutation).toHaveBeenCalledWith("p9", "project.create");
    expect(onCreated).toHaveBeenCalledWith("u1", "Comic");
  });

  it("does NOT fire hooks when the tier cap refused", async () => {
    const onCanonicalMutation = vi.fn(async () => {});
    const onCreated = vi.fn();
    const tier = vi.fn(async () => "free") as unknown as ProjectTierResolver;
    const r = repo({ countForUser: vi.fn(async () => 3) });
    await createProject(ctx, { data: {} }, r, { onCanonicalMutation, onCreated }, tier);
    expect(onCanonicalMutation).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });
});

describe("readProject", () => {
  it("403s for a context scoped to a DIFFERENT project, before any repository work", async () => {
    const scoped = localContext({ projectScope: "other" });
    const r = repo();
    const out = await readProject(scoped, { projectId: "p1" }, r);
    expect(out).toMatchObject({ ok: false, status: 403 });
    expect(r.ownsProject).not.toHaveBeenCalled();
    expect(r.read).not.toHaveBeenCalled();
  });

  it("404s when the project is not owned by the actor", async () => {
    const r = repo({ ownsProject: vi.fn(async () => false) });
    const out = await readProject(ctx, { projectId: "p1" }, r);
    expect(out).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(r.read).not.toHaveBeenCalled();
  });

  it("passes the full graph row through", async () => {
    const r = repo();
    const out = await readProject(ctx, { projectId: "p1" }, r);
    expect(out.ok).toBe(true);
    expect(r.read).toHaveBeenCalledWith("p1");
    if (out.ok) expect(out.project).toMatchObject({ id: "p1", chapters: [{ id: "c1" }] });
  });
});

describe("updateProject", () => {
  it("403s for a mismatched scope", async () => {
    const scoped = localContext({ projectScope: "other" });
    const r = repo();
    const out = await updateProject(scoped, { projectId: "p1", patch: { name: "x" } }, r);
    expect(out).toMatchObject({ ok: false, status: 403 });
    expect(r.updateScoped).not.toHaveBeenCalled();
  });

  it("404s when the project is not owned and writes nothing", async () => {
    const r = repo({ ownsProject: vi.fn(async () => false) });
    const out = await updateProject(ctx, { projectId: "p1", patch: { name: "x" } }, r);
    expect(out).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(r.updateScoped).not.toHaveBeenCalled();
  });

  it("filters through the 19-field allowlist, drops server-owned fields, and normalizes density", async () => {
    const r = repo();
    await updateProject(
      ctx,
      {
        projectId: "p1",
        patch: {
          name: "N", densityLevel: "simple", junk: 1,
          id: "attacker", userId: "victim", contentRevision: 999, createdAt: "1999-01-01",
        },
      },
      r,
    );
    const sent = r.updateScoped.mock.calls[0]![1] as Record<string, unknown>;
    expect(sent).toMatchObject({ name: "N", densityLevel: "simple" });
    expect(sent).not.toHaveProperty("junk");
    expect(sent).not.toHaveProperty("id");
    expect(sent).not.toHaveProperty("userId");
    expect(sent).not.toHaveProperty("contentRevision");
    expect(sent).not.toHaveProperty("createdAt");
    for (const serverOwned of ["id", "userId", "createdAt"]) {
      expect(PROJECT_PATCH_FIELDS.has(serverOwned)).toBe(false);
    }
  });

  it("coerces densityLevel (any stored/garbage value falls back to standard)", async () => {
    const r = repo();
    await updateProject(ctx, { projectId: "p1", patch: { densityLevel: "bogus" } }, r);
    const sent = r.updateScoped.mock.calls[0]![1] as Record<string, unknown>;
    expect(sent.densityLevel).toBe("standard");
  });

  it("always stamps a server-owned updatedAt, even for an empty patch", async () => {
    const r = repo();
    await updateProject(ctx, { projectId: "p1", patch: {} }, r);
    const sent = r.updateScoped.mock.calls[0]![1] as Record<string, unknown>;
    expect(sent.updatedAt).toBeInstanceOf(Date);
    expect(Object.keys(sent)).toEqual(["updatedAt"]);
  });

  it("fires 'project.update' only on a non-empty surviving patch, and only after the write matched", async () => {
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => {});
    const r = repo();
    await updateProject(ctx, { projectId: "p1", patch: { name: "N" } }, r, { onCanonicalMutation });
    expect(onCanonicalMutation).toHaveBeenCalledWith("p1", "project.update");

    // Empty patch: touch only, no canon bump.
    const silent = vi.fn(async () => {});
    const r2 = repo();
    await updateProject(ctx, { projectId: "p1", patch: {} }, r2, { onCanonicalMutation: silent });
    expect(silent).not.toHaveBeenCalled();

    // No row matched: no bump.
    const r3 = repo({ updateScoped: vi.fn(async () => null) });
    await updateProject(ctx, { projectId: "p1", patch: { name: "N" } }, r3, { onCanonicalMutation: silent });
    expect(silent).not.toHaveBeenCalled();
  });
});

describe("deleteProject", () => {
  it("deletes and returns { ok: true }", async () => {
    const r = repo();
    await expect(deleteProject(ctx, { projectId: "p1" }, r)).resolves.toEqual({ ok: true });
    expect(r.deleteScoped).toHaveBeenCalledWith("p1");
  });

  it("403s scoped-mismatch / 404s unowned without deleting", async () => {
    const r = repo({ ownsProject: vi.fn(async () => false) });
    await expect(deleteProject(ctx, { projectId: "p1" }, r)).resolves.toEqual({
      ok: false,
      status: 404,
      reason: "Not found",
    });
    expect(r.deleteScoped).not.toHaveBeenCalled();

    const scoped = localContext({ projectScope: "other" });
    await expect(deleteProject(scoped, { projectId: "p1" }, repo())).resolves.toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("fires 'project.delete' POST-delete, never on a refusal", async () => {
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => {});
    const r = repo();
    await deleteProject(ctx, { projectId: "p1" }, r, { onCanonicalMutation });
    expect(onCanonicalMutation).toHaveBeenCalledWith("p1", "project.delete");
    // Post-ordering: the hook happens after the scoped delete actually ran.
    const deleteOrder = r.deleteScoped.mock.invocationCallOrder[0]!;
    const hookOrder = onCanonicalMutation.mock.invocationCallOrder[0]!;
    expect(hookOrder).toBeGreaterThan(deleteOrder);

    const refused = vi.fn(async () => {});
    const r404 = repo({ ownsProject: vi.fn(async () => false) });
    await deleteProject(ctx, { projectId: "p1" }, r404, { onCanonicalMutation: refused });
    expect(refused).not.toHaveBeenCalled();
  });
});
