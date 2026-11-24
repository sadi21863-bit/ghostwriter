import { describe, it, expect, vi } from "vitest";
import {
  CHAPTER_WRITABLE_FIELDS,
  deleteChapter,
  deriveWordCount,
  sanitizeChapterPatch,
  updateChapter,
} from "@/lib/core/handlers/update-chapter";
import { cloudContext, localContext, type RequestContext } from "@/lib/core/request-context";
import type { ChapterRepository } from "@/lib/core/repositories";

/**
 * Phase 2 / v4 §7 — the `updateChapter` business handler.
 *
 * These tests exercise the rules directly, with no database and no Next.js. That
 * is the payoff of the seam: the mass-assignment and IDOR protections are now
 * testable in isolation instead of only through a mocked `db`.
 */

const ctx = cloudContext("u1");
const input = { projectId: "p1", chapterId: "c1" };

function repo(over: Record<string, unknown> = {}) {
  // The mock implementations take the SAME arguments as the real ports, so
  // vitest infers a `[string, string, Record<string, unknown>]` call tuple and
  // `mock.calls[0]![2]` typechecks. A zero-arg `vi.fn(async () => ...)` would
  // infer `[]` instead (CLAUDE.md item 69 gotcha).
  const ownsProject = vi.fn(async (_projectId: string, _actorId: string) => true);
  const updateScoped = vi.fn(
    async (_projectId: string, _chapterId: string, _patch: Record<string, unknown>) => ({
      id: "c1",
      projectId: "p1",
    }),
  );
  const deleteScoped = vi.fn(async (_projectId: string, _chapterId: string) => {});
  // Defaults first, overrides LAST so a test's stub actually wins. The cast is
  // only to recover the mock types lost by spreading a loose record over them.
  return { ownsProject, updateScoped, deleteScoped, ...over } as unknown as {
    ownsProject: typeof ownsProject;
    updateScoped: typeof updateScoped;
    deleteScoped: typeof deleteScoped;
  };
}

/** The patch the handler actually sent to the repository. */
const sentPatch = (r: { updateScoped: ReturnType<typeof repo>["updateScoped"] }) =>
  r.updateScoped.mock.calls[0]![2]!;

describe("sanitizeChapterPatch", () => {
  it("keeps writable fields", () => {
    expect(sanitizeChapterPatch({ title: "T", summary: "S" })).toEqual({ title: "T", summary: "S" });
  });

  it("drops every server-owned field", () => {
    // The mass-assignment guard: spreading the raw body would let a caller
    // reassign the chapter, rewrite its id, or pin a crafted embedding.
    const out = sanitizeChapterPatch({
      title: "T",
      projectId: "victim",
      id: "chosen-id",
      embedding: [0.1, 0.2],
      createdAt: "1999-01-01",
      updatedAt: "1999-01-01",
    });
    expect(out).toEqual({ title: "T" });
  });

  it("returns an empty patch for non-objects", () => {
    for (const v of [null, undefined, 42, "x", []]) {
      expect(sanitizeChapterPatch(v)).toEqual({});
    }
  });

  it("never allows projectId, id, embedding or createdAt", () => {
    for (const field of ["projectId", "id", "embedding", "createdAt"]) {
      expect(CHAPTER_WRITABLE_FIELDS.has(field)).toBe(false);
    }
  });
});

describe("word count", () => {
  it("counts whitespace-separated words", () => {
    expect(deriveWordCount("one two  three\nfour ", (s) => s)).toBe(4);
  });

  it("counts an empty document as zero", () => {
    expect(deriveWordCount("   ", (s) => s)).toBe(0);
  });

  it("uses the supplied plain-text converter for TipTap JSON", () => {
    const json = '{"doc":"stub"}';
    const toPlain = vi.fn(() => "five six");
    expect(deriveWordCount(json, toPlain)).toBe(2);
    expect(toPlain).toHaveBeenCalledWith(json);
  });
});

describe("updateChapter", () => {
  it("writes through when the actor owns the project", async () => {
    const r = repo();
    const out = await updateChapter(ctx, { ...input, patch: { title: "Ch 2" } }, r);
    expect(out).toMatchObject({ ok: true });
    expect(r.updateScoped).toHaveBeenCalledWith(
      "p1",
      "c1",
      expect.objectContaining({ title: "Ch 2" }),
    );
  });

  it("404s when the project is not owned by the actor", async () => {
    const r = repo({ ownsProject: vi.fn(async () => false) as never });
    const out = await updateChapter(ctx, { ...input, patch: { title: "x" } }, r);
    expect(out).toMatchObject({ ok: false, status: 404 });
    expect(r.updateScoped).not.toHaveBeenCalled();
  });

  it("403s when the context is scoped to a DIFFERENT project", async () => {
    // Checked before the repository, so a future adapter cannot widen access by
    // forgetting the WHERE clause.
    const scoped = localContext({ projectScope: "other" });
    const r = repo();
    const out = await updateChapter(scoped, { ...input, patch: { title: "x" } }, r);
    expect(out).toMatchObject({ ok: false, status: 403 });
    expect(r.ownsProject).not.toHaveBeenCalled();
    expect(r.updateScoped).not.toHaveBeenCalled();
  });

  it("allows a context scoped to the SAME project", async () => {
    const scoped = localContext({ projectScope: "p1" });
    const out = await updateChapter(scoped, { ...input, patch: { title: "x" } }, repo());
    expect(out).toMatchObject({ ok: true });
  });

  it("404s when the scoped write matched no row (IDOR)", async () => {
    const r = repo({ updateScoped: vi.fn(async () => null) as never });
    const out = await updateChapter(ctx, { ...input, patch: { content: "x" } }, r);
    expect(out).toMatchObject({ ok: false, status: 404 });
  });

  it("never sends a stripped field to the repository", async () => {
    const r = repo();
    await updateChapter(ctx, { ...input, patch: { title: "T", projectId: "victim", id: "x" } }, r);
    const sent = sentPatch(r);
    expect(sent).not.toHaveProperty("projectId");
    expect(sent).not.toHaveProperty("id");
  });

  it("reports which fields were dropped", async () => {
    const out = await updateChapter(
      ctx,
      { ...input, patch: { title: "T", projectId: "victim", embedding: [1] } },
      repo(),
    );
    expect(out).toMatchObject({ ok: true });
    if (out.ok) expect(out.droppedFields.sort()).toEqual(["embedding", "projectId"]);
  });

  it("derives wordCount when content is written", async () => {
    const r = repo();
    await updateChapter(ctx, { ...input, patch: { content: "a b c" } }, r, {}, (s) => s);
    expect(sentPatch(r)).toMatchObject({ wordCount: 3 });
  });

  it("ignores a non-string content instead of coercing it", async () => {
    const r = repo();
    await updateChapter(ctx, { ...input, patch: { content: 12345 } }, r);
    expect(sentPatch(r)).not.toHaveProperty("wordCount");
  });

  it("always sets a server-owned updatedAt", async () => {
    const r = repo();
    await updateChapter(ctx, { ...input, patch: { title: "x" } }, r);
    expect(sentPatch(r).updatedAt).toBeInstanceOf(Date);
  });
});

describe("post-commit hooks", () => {
  it("refreshes the embedding only after the write matched a row", async () => {
    const onChapterContentChanged = vi.fn();
    const r = repo();
    await updateChapter(
      ctx,
      { ...input, patch: { content: "new text" } },
      r,
      { onChapterContentChanged },
      (s) => s,
    );
    expect(onChapterContentChanged).toHaveBeenCalledWith("c1", "new text");
  });

  it("does NOT refresh the embedding when the write matched nothing", async () => {
    // The IDOR regression: an attacker-supplied chapterId must not be able to
    // write an embedding into another user's chapter.
    const onChapterContentChanged = vi.fn();
    const r = repo({ updateScoped: vi.fn(async () => null) as never });
    await updateChapter(ctx, { ...input, patch: { content: "new text" } }, r, {
      onChapterContentChanged,
    });
    expect(onChapterContentChanged).not.toHaveBeenCalled();
  });

  it("does not fire the embedding hook when content was not part of the patch", async () => {
    const onChapterContentChanged = vi.fn();
    await updateChapter(ctx, { ...input, patch: { title: "x" } }, repo(), {
      onChapterContentChanged,
    });
    expect(onChapterContentChanged).not.toHaveBeenCalled();
  });

  it("announces a canonical mutation for the Phase 5A revision counter", async () => {
    const onCanonicalMutation = vi.fn(async () => {});
    await updateChapter(ctx, { ...input, patch: { title: "x" } }, repo(), { onCanonicalMutation });
    expect(onCanonicalMutation).toHaveBeenCalledWith("p1", "chapter.update");
  });

  it("does not announce a mutation when nothing was written", async () => {
    const onCanonicalMutation = vi.fn(async () => {});
    const r = repo({ updateScoped: vi.fn(async () => null) as never });
    await updateChapter(ctx, { ...input, patch: { title: "x" } }, r, { onCanonicalMutation });
    expect(onCanonicalMutation).not.toHaveBeenCalled();
  });

  it("survives a repository that returns no hooks at all", async () => {
    const out = await updateChapter(ctx, { ...input, patch: { title: "x" } }, repo());
    expect(out).toMatchObject({ ok: true });
  });
});

describe("deleteChapter", () => {
  it("deletes when the project is owned", async () => {
    const r = repo();
    expect(await deleteChapter(ctx, input, r)).toEqual({ ok: true });
    expect(r.deleteScoped).toHaveBeenCalledWith("p1", "c1");
  });

  it("404s when not owned and does not delete", async () => {
    const r = repo({ ownsProject: vi.fn(async () => false) as never });
    expect(await deleteChapter(ctx, input, r)).toMatchObject({ ok: false, status: 404 });
    expect(r.deleteScoped).not.toHaveBeenCalled();
  });

  it("403s for a mismatched scope", async () => {
    const r = repo();
    const out = await deleteChapter(localContext({ projectScope: "other" }), input, r);
    expect(out).toMatchObject({ ok: false, status: 403 });
    expect(r.deleteScoped).not.toHaveBeenCalled();
  });

  /**
   * §11 — deleting a chapter is a canonical mutation, so the revision bumps
   * with it. The hook must fire POST-delete (only when the scoped delete ran)
   * and never on the refusal paths, so a mismatched scope can never bump
   * someone else's project revision.
   */
  describe("deleteChapter — post-commit revision hook (§11)", () => {
    it("bumps the revision after a successful scoped delete", async () => {
      const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => {});
      const r = repo();
      const out = await deleteChapter(ctx, input, r, { onCanonicalMutation });
      expect(out).toEqual({ ok: true });
      expect(onCanonicalMutation).toHaveBeenCalledTimes(1);
      expect(onCanonicalMutation).toHaveBeenCalledWith("p1", "chapter.delete");
    });

    it("does not bump the revision when the delete is refused", async () => {
      const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => {});
      const r404 = repo({ ownsProject: vi.fn(async () => false) as never });
      await deleteChapter(ctx, input, r404, { onCanonicalMutation });

      const r403 = repo();
      await deleteChapter(localContext({ projectScope: "other" }), input, r403, {
        onCanonicalMutation,
      });

      expect(onCanonicalMutation).not.toHaveBeenCalled();
    });
  });
});