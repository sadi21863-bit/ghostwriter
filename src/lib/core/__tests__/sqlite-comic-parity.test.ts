import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";

import { createSqliteDb, type SqliteDbHandle } from "@/db/sqlite";
import { SQLITE_DDL } from "@/db/sqlite-ddl";
import { chapters, comicPages, comicPanels, projects, users } from "@/db/sqlite-schema";
import {
  createComicPage,
  createComicPanel,
  deleteComicPage,
  deployPanelImage,
  letterComicPanel,
  listComicPages,
  updateComicPanel,
  type ComicPageRow,
  type ComicPanelRow,
} from "@/lib/core/handlers/comics";
import type { ChildResourceRepository, PostCommitHooks } from "@/lib/core/repositories";
import { cloudContext } from "@/lib/core/request-context";
import {
  makeSqliteComicPageCrudRepository,
  makeSqliteComicPanelCrudRepository,
} from "@/lib/core/sqlite-comic-repos";

/**
 * The comic tracer's real-DB parity suite (docs/migration/phase3-prep.md §4):
 * the same handler functions the cloud comics routes drive, re-driven against
 * a real node:sqlite database through the sqlite-proxy drizzle baseline — no
 * mocks for reachability questions. Includes the Phase-C candidate mechanics
 * and the lettering refusal ladder driven through the REAL handlers (they own
 * promote/append-vs-overwrite/lettered-composite over the generic ports — see
 * the adapter header), plus DB-specific cases no contract mock can express
 * (FK cascades down the page→project chain, DDL presence, the json-array
 * TEXT round-trip, source purity).
 *
 * Deliberately ABSENT here: the duplicate-column join-safety pin the
 * relationship suite carries. That pin exists because pg's graph read was
 * re-expressed without a JOIN only after a manual JOIN was rejected; this
 * cluster's reads are pure sibling `findMany`s from the start — no statement
 * in the comic adapter joins two tables, so there is nothing to pin.
 */

// One fresh in-memory database per test; disposed afterEach so vitest reports
// no open async handles.
const created: SqliteDbHandle[] = [];
function fresh() {
  const handle = createSqliteDb(":memory:");
  created.push(handle);
  return handle;
}
afterEach(() => {
  for (const h of created) h.sqlite.close();
  created.length = 0;
});

const hooks = (log: string[] = []): PostCommitHooks => ({
  onCanonicalMutation: async (projectId, kind) => {
    log.push(`hook:${kind}`);
  },
});

/** Seed one user + project + chapter (comic_pages FK-chains onto chapters). */
async function seed() {
  const handle = fresh();
  const [user] = await handle.db.insert(users).values({ email: "u1@test.dev" }).returning();
  const [project] = await handle.db.insert(projects).values({ userId: user.id }).returning();
  const [chapter] = await handle.db
    .insert(chapters)
    .values({ projectId: project.id })
    .returning();
  return {
    handle,
    db: handle.db,
    user,
    project,
    chapter,
    pageRepo: makeSqliteComicPageCrudRepository(handle.db),
    panelRepo: makeSqliteComicPanelCrudRepository(handle.db),
  };
}

/** A page-ownership probe computed from real rows (the letter verb's 404 rung). */
function comicPageOwnershipProbe(handle: SqliteDbHandle): Pick<ChildResourceRepository, "owns"> {
  return {
    async owns(ref) {
      if (ref.resource !== "comic_pages") return false;
      const row = await handle.db.query.comicPages.findFirst({
        where: and(eq(comicPages.id, ref.childId), eq(comicPages.projectId, ref.projectId)),
        columns: { id: true },
      });
      return !!row;
    },
  };
}

const okCompose = async () => ({
  ok: true as const,
  lettered: Buffer.from("lettered-composite"),
});
const okUpload = async () => "https://blob.test/lettered.png";

describe("sqlite baseline — ownership probes over the relation-less schema", () => {
  it("ownsProject on both factories answers through db.query.projects.findFirst", async () => {
    const { user, project, pageRepo, panelRepo } = await seed();

    expect(await pageRepo.ownsProject(project.id, user.id)).toBe(true);
    expect(await panelRepo.ownsProject(project.id, user.id)).toBe(true);
    expect(await pageRepo.ownsProject(project.id, "stranger")).toBe(false);
    expect(await panelRepo.ownsProject(project.id, "stranger")).toBe(false);
    expect(await panelRepo.ownsProject("no-such-project", user.id)).toBe(false);
  });
});

describe("createComicPage through the real adapter", () => {
  it("happy path — uuid id, returning fidelity (defaults + Date), pageNumber = count + 1, hook fires", async () => {
    const log: string[] = [];
    const { user, project, chapter, pageRepo } = await seed();
    const ctx = cloudContext(user.id);

    const first = await createComicPage(
      ctx,
      { projectId: project.id, data: { chapterId: chapter.id, artStyle: "manga" } },
      pageRepo,
      hooks(log),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    // Ids are client-generated uuids ($defaultFn in sqlite-schema.ts).
    expect(first.page.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.page.projectId).toBe(project.id);
    expect(first.page.chapterId).toBe(chapter.id);
    // The schema default surfaces through .returning(): pageNumber 1, artStyle "manga".
    // The handler computed the number itself (existing pages + 1) — pinned below.
    expect(first.page.pageNumber).toBe(1);
    expect(first.page.artStyle).toBe("manga");
    // epoch-ms integer column surfaces as a real Date object (timestamp_ms mode),
    // Date-in/Date-out parity with pg rows.
    expect(first.page.createdAt).toBeInstanceOf(Date);
    expect(log).toEqual(["hook:comicPage.create"]);

    const second = await createComicPage(
      ctx,
      { projectId: project.id, data: { chapterId: chapter.id, artStyle: "cartoon" } },
      pageRepo,
      hooks(log),
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    // The pre-migration rule verbatim: existing pages.length + 1.
    expect(second.page.pageNumber).toBe(2);
    expect(second.page.createdAt).toBeInstanceOf(Date);
    expect(log).toEqual(["hook:comicPage.create", "hook:comicPage.create"]);
  });

  it("403/404 refusal orderings write nothing and fire nothing", async () => {
    const { handle, user, project, chapter, pageRepo } = await seed();
    const log: string[] = [];
    const before = await handle.db.select().from(comicPages).where(eq(comicPages.projectId, project.id));

    const r403 = await createComicPage(
      cloudContext(user.id, { projectScope: "other-project" }),
      { projectId: project.id, data: { chapterId: chapter.id, artStyle: "manga" } },
      pageRepo,
      hooks(log),
    );
    const r404 = await createComicPage(
      cloudContext("stranger"),
      { projectId: project.id, data: { chapterId: chapter.id, artStyle: "manga" } },
      pageRepo,
      hooks(log),
    );

    expect(r403).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(r404).toEqual({ ok: false, status: 404, reason: "Not found" });
    const after = await handle.db.select().from(comicPages).where(eq(comicPages.projectId, project.id));
    expect(after).toEqual(before);
    expect(log).toEqual([]);
  });
});

describe("listWithPanels — pg's relational read re-expressed as sibling scoped queries", () => {
  it("newest-first pages, panels nested in panelIndex order, zero-panel page keeps panels: []", async () => {
    const { user, project, chapter, pageRepo, panelRepo } = await seed();
    // Explicit createdAt values make the desc ordering deterministic without sleeps.
    const first = await pageRepo.create(project.id, {
      chapterId: chapter.id,
      pageNumber: 1,
      artStyle: "manga",
      createdAt: new Date(Date.UTC(2026, 0, 1)),
    });
    const second = await pageRepo.create(project.id, {
      chapterId: chapter.id,
      pageNumber: 2,
      artStyle: "cartoon",
      createdAt: new Date(Date.UTC(2026, 0, 2)),
    });
    if (!first || !second) throw new Error("seed failed");

    // Insert panels out of index order (2, 0, 1) on the first page; the nested
    // read must re-sort them exactly like pg's `with: { panels }` did.
    for (const idx of [2, 0, 1]) {
      await panelRepo.create(project.id, {
        pageId: first.id,
        panelIndex: idx,
        imageUrl: `https://cdn.test/p1-${idx}.png`,
        panelPrompt: `prompt ${idx}`,
      });
    }

    const result = await listComicPages(
      cloudContext(user.id),
      { projectId: project.id },
      pageRepo,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Newest-first (createdAt DESC), the exact ordering pg's parent read had.
    expect(result.pages.map((p) => p.pageNumber)).toEqual([2, 1]);
    expect(result.pages[0].createdAt).toEqual(new Date(Date.UTC(2026, 0, 2)));
    // The `panels` key is not on the typed interface (rows flow verbatim);
    // this cast only pins the NESTED shape for assertions.
    const nested = (page: ComicPageRow) => page.panels as ComicPanelRow[];
    // Panels nested by the relation's own predicate (pageId), panelIndex ASC.
    expect(nested(result.pages[1])).toHaveLength(3);
    expect(nested(result.pages[1]).map((p) => p.panelIndex)).toEqual([0, 1, 2]);
    expect(result.pages[1].id).toBe(first.id);
    // The second page has no panels — the relational read always attaches the
    // array (empty), and the sibling re-expression preserves that shape.
    expect(nested(result.pages[0])).toEqual([]);
    // Full panel rows round-trip through the sibling read.
    expect(nested(result.pages[1])[0].imageUrl).toBe("https://cdn.test/p1-0.png");
    expect(nested(result.pages[1])[0].createdAt).toBeInstanceOf(Date);
  });

  it("is project-scoped end to end: another project's pages and panels never leak", async () => {
    const { handle, user, project, chapter, pageRepo, panelRepo } = await seed();
    const page = await pageRepo.create(project.id, {
      chapterId: chapter.id,
      pageNumber: 1,
      artStyle: "manga",
    });
    const foreignPage = await pageRepo.create(project.id, {
      chapterId: chapter.id,
      pageNumber: 2,
      artStyle: "manga",
    });
    const panelRow = await panelRepo.create(project.id, {
      pageId: page!.id,
      panelIndex: 0,
      imageUrl: "https://cdn.test/a.png",
      panelPrompt: "prompt",
    });
    if (!foreignPage || !panelRow) throw new Error("seed failed");

    // A foreign project in the same database: its empty list must stay empty.
    const [otherOwner] = await handle.db
      .insert(users)
      .values({ email: "u2@test.dev" })
      .returning();
    const [otherProject] = await handle.db
      .insert(projects)
      .values({ userId: otherOwner.id })
      .returning();

    const other = await listComicPages(
      cloudContext(otherOwner.id),
      { projectId: otherProject.id },
      pageRepo,
    );
    expect(other).toEqual({ ok: true, pages: [] });

    // Adapter-level 404/403 predicates on a sibling project's ids.
    expect(await panelRepo.findScoped(otherProject.id, panelRow.id)).toBe(null);
    expect(await panelRepo.findScoped("no-such-project", panelRow.id)).toBe(null);
    expect(
      await panelRepo.updateScoped(otherProject.id, panelRow.id, { imageUrl: "evil" }),
    ).toBe(null);
    // The panel is untouched — the direct `projectId` predicate refused it.
    const untouched = await panelRepo.findScoped(project.id, panelRow.id);
    expect(untouched?.imageUrl).toBe("https://cdn.test/a.png");
  });

  it("an empty project lists as zero pages (no panels query even runs — no inArray([]) edge)", async () => {
    const { user, project, pageRepo } = await seed();
    const result = await listComicPages(cloudContext(user.id), { projectId: project.id }, pageRepo);
    expect(result).toEqual({ ok: true, pages: [] });
  });
});

describe("createComicPanel + candidate arrays round-trip through TEXT", () => {
  it("happy path — returning fidelity: uuid, Date, typed column defaults decoded, hook fires", async () => {
    const log: string[] = [];
    const { handle, user, project, chapter, pageRepo, panelRepo } = await seed();
    const page = await pageRepo.create(project.id, {
      chapterId: chapter.id,
      pageNumber: 1,
      artStyle: "manga",
    });
    if (!page) throw new Error("seed failed");

    const result = await createComicPanel(
      cloudContext(user.id),
      {
        projectId: project.id,
        data: {
          pageId: page.id,
          panelIndex: 0,
          imageUrl: "https://cdn.test/raw.png",
          panelPrompt: "panel prompt",
        },
      },
      panelRepo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.panel.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.panel.projectId).toBe(project.id);
    expect(result.panel.pageId).toBe(page.id);
    expect(result.panel.imageUrl).toBe("https://cdn.test/raw.png");
    expect(result.panel.panelPrompt).toBe("panel prompt");
    // DDL defaults exactly where pg applied its schema defaults — the
    // json default decodes back to a typed EMPTY ARRAY, never a string.
    expect(result.panel.candidateImageUrls).toEqual([]);
    expect(result.panel.letteredImageUrl).toBe("");
    expect(result.panel.bubbleType).toBe("speech");
    expect(result.panel.reviewStatus).toBe("draft");
    expect(result.panel.characterName).toBe("");
    expect(result.panel.dialogue).toBe("");
    expect(result.panel.qualityScore).toBeNull();
    expect(result.panel.createdAt).toBeInstanceOf(Date);
    expect(log).toEqual(["hook:comicPanel.create"]);

    // The TEXT round-trip is observable raw: the column stores the JSON
    // encoding (single-column probe — no duplicate-name merge risk, the
    // join-safety pin is not needed for a read that never joins).
    const raw = handle.sqlite
      .prepare("SELECT candidate_image_urls FROM comic_panels WHERE id = ?")
      .get(result.panel.id) as { candidate_image_urls: string };
    expect(raw.candidate_image_urls).toBe("[]");
  });

  it("a written candidateImageUrls array survives TEXT storage byte-for-byte as a typed array", async () => {
    const { handle, project, chapter, pageRepo, panelRepo } = await seed();
    const page = await pageRepo.create(project.id, {
      chapterId: chapter.id,
      pageNumber: 1,
      artStyle: "manga",
    });
    if (!page) throw new Error("seed failed");

    const candidates = [
      "https://cdn.test/take-a.png",
      "https://cdn.test/a-very-long-url-when-decoded-must-not-be-corrupted-?q=1&x=2.png",
      "https://cdn.test/中文-named-candidate.png",
    ];
    const panel = await panelRepo.create(project.id, {
      pageId: page.id,
      panelIndex: 0,
      imageUrl: "https://cdn.test/primary.png",
      panelPrompt: "prompt",
      candidateImageUrls: candidates,
    });
    if (!panel) throw new Error("seed failed");

    const raw = handle.sqlite
      .prepare("SELECT candidate_image_urls FROM comic_panels WHERE id = ?")
      .get(panel.id) as { candidate_image_urls: string };
    expect(raw.candidate_image_urls).toBe(JSON.stringify(candidates));

    const read = await panelRepo.findScoped(project.id, panel.id);
    // Exact array semantics — same slots, same order, no string leak.
    expect(read?.candidateImageUrls).toEqual(candidates);
    expect(Array.isArray(read?.candidateImageUrls)).toBe(true);
  });
});

describe("updateComicPanel through the real adapter — Phase-C promote is handler-owned over the ports", () => {
  it("promoteCandidateUrl: promoted → primary, old primary appended to the remaining candidates", async () => {
    const log: string[] = [];
    const { user, project, chapter, pageRepo, panelRepo } = await seed();
    const page = await pageRepo.create(project.id, {
      chapterId: chapter.id,
      pageNumber: 1,
      artStyle: "manga",
    });
    if (!page) throw new Error("seed failed");
    const created = await panelRepo.create(project.id, {
      pageId: page.id,
      panelIndex: 0,
      imageUrl: "https://cdn.test/primary.png",
      panelPrompt: "prompt",
      candidateImageUrls: ["https://cdn.test/alt-a.png", "https://cdn.test/alt-b.png"],
    });
    if (!created) throw new Error("seed failed");

    const result = await updateComicPanel(
      cloudContext(user.id),
      {
        projectId: project.id,
        panelId: created.id,
        patch: {},
        promoteCandidateUrl: "https://cdn.test/alt-a.png",
      },
      panelRepo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The swap, over real TEXT-stored arrays: promoted candidate becomes the
    // primary; the old primary goes back into the pool; promoted is filtered
    // out (no duplicate seating).
    expect(result.panel.imageUrl).toBe("https://cdn.test/alt-a.png");
    expect(result.panel.candidateImageUrls).toEqual([
      "https://cdn.test/alt-b.png",
      "https://cdn.test/primary.png",
    ]);
    // FIX B1 adjacent invariant holds across the whole verb chain: the
    // lettering composite field is never touched by the image swap.
    expect(result.panel.letteredImageUrl).toBe("");
    expect(log).toEqual(["hook:comicPanel.update"]);
  });

  it("unknown candidate → exact route 400; non-string promote is ignored; refusals write nothing", async () => {
    const { user, project, chapter, pageRepo, panelRepo } = await seed();
    const page = await pageRepo.create(project.id, {
      chapterId: chapter.id,
      pageNumber: 1,
      artStyle: "manga",
    });
    if (!page) throw new Error("seed failed");
    const created = await panelRepo.create(project.id, {
      pageId: page.id,
      panelIndex: 0,
      imageUrl: "https://cdn.test/primary.png",
      panelPrompt: "prompt",
      candidateImageUrls: ["https://cdn.test/alt-a.png"],
    });
    if (!created) throw new Error("seed failed");

    const unknown = await updateComicPanel(
      cloudContext(user.id),
      {
        projectId: project.id,
        panelId: created.id,
        patch: {},
        promoteCandidateUrl: "https://cdn.test/never-a-candidate.png",
      },
      panelRepo,
    );
    expect(unknown).toEqual({ ok: false, status: 400, reason: "Not a known candidate for this panel." });

    // A non-string promote rides through ignored — the old route's
    // typeof === "string" guard, verbatim through the handler.
    const ignored = await updateComicPanel(
      cloudContext(user.id),
      {
        projectId: project.id,
        panelId: created.id,
        patch: { characterName: "Mara" },
        promoteCandidateUrl: 42,
      },
      panelRepo,
    );
    expect(ignored.ok).toBe(true);
    if (!ignored.ok) return;
    expect(ignored.panel.characterName).toBe("Mara");
    // The primary was NOT swapped away by the ignored non-string promote.
    expect(ignored.panel.imageUrl).toBe("https://cdn.test/primary.png");
    expect(ignored.panel.candidateImageUrls).toEqual(["https://cdn.test/alt-a.png"]);
  });

  it("promoting on a FOREIGN panel id → 404 'Panel not found' (findScoped's direct projectId predicate)", async () => {
    const { user, project, chapter, pageRepo, panelRepo } = await seed();
    const page = await pageRepo.create(project.id, {
      chapterId: chapter.id,
      pageNumber: 1,
      artStyle: "manga",
    });
    if (!page) throw new Error("seed failed");
    const created = await panelRepo.create(project.id, {
      pageId: page.id,
      panelIndex: 0,
      imageUrl: "https://cdn.test/primary.png",
      panelPrompt: "prompt",
      candidateImageUrls: ["https://cdn.test/alt-a.png"],
    });
    if (!created) throw new Error("seed failed");

    // Foreign project + same panel id: no such project → the ownership probe
    // fails first and the handler 404s before findScoped ever runs.
    const foreign = await updateComicPanel(
      cloudContext(user.id),
      {
        projectId: "some-other-project",
        panelId: created.id,
        patch: {},
        promoteCandidateUrl: "https://cdn.test/alt-a.png",
      },
      panelRepo,
    );
    expect(foreign).toEqual({ ok: false, status: 404, reason: "Not found" });

    // A scoped PATCH on a real project with a nonexistent panel id: ownership
    // passes, then the PROMOTE path's findScoped misses → the handler's
    // specialized 404 body ("Panel not found", the route's own wording).
    const missing = await updateComicPanel(
      cloudContext(user.id),
      {
        projectId: project.id,
        panelId: "no-such-panel",
        patch: {},
        promoteCandidateUrl: "https://cdn.test/alt-a.png",
      },
      panelRepo,
    );
    expect(missing).toEqual({ ok: false, status: 404, reason: "Panel not found" });

    // Contrast: WITHOUT a promote, the miss surfaces only at updateScoped
    // (null) → the generic "Not found" body — the two 404 bodies are
    // reachable through the same port on distinct conditions.
    const missingNoPromo = await updateComicPanel(
      cloudContext(user.id),
      {
        projectId: project.id,
        panelId: "no-such-panel",
        patch: { characterName: "Mara" },
      },
      panelRepo,
    );
    expect(missingNoPromo).toEqual({ ok: false, status: 404, reason: "Not found" });
  });
});

describe("deployPanelImage through the real adapter — keepAsCandidate append-vs-overwrite", () => {
  it("keepAsCandidate appends to the candidates and leaves the primary untouched", async () => {
    const log: string[] = [];
    const { user, project, chapter, pageRepo, panelRepo } = await seed();
    const page = await pageRepo.create(project.id, {
      chapterId: chapter.id,
      pageNumber: 1,
      artStyle: "manga",
    });
    if (!page) throw new Error("seed failed");
    const created = await panelRepo.create(project.id, {
      pageId: page.id,
      panelIndex: 0,
      imageUrl: "https://cdn.test/primary.png",
      panelPrompt: "prompt",
      candidateImageUrls: ["https://cdn.test/old-a.png"],
    });
    if (!created) throw new Error("seed failed");

    const result = await deployPanelImage(
      cloudContext(user.id),
      {
        projectId: project.id,
        panelId: created.id,
        imageUrl: "https://cdn.test/fresh.png",
        keepAsCandidate: true,
        existingCandidateUrls: ["https://cdn.test/old-a.png"],
      },
      panelRepo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.panel.imageUrl).toBe("https://cdn.test/primary.png");
    expect(result.panel.candidateImageUrls).toEqual([
      "https://cdn.test/old-a.png",
      "https://cdn.test/fresh.png",
    ]);
    expect(log).toEqual(["hook:comicPanel.regenerate"]);
  });

  it("overwrite branch replaces the primary and leaves the candidate pool alone", async () => {
    const { user, project, chapter, pageRepo, panelRepo } = await seed();
    const page = await pageRepo.create(project.id, {
      chapterId: chapter.id,
      pageNumber: 1,
      artStyle: "manga",
    });
    if (!page) throw new Error("seed failed");
    const created = await panelRepo.create(project.id, {
      pageId: page.id,
      panelIndex: 0,
      imageUrl: "https://cdn.test/primary.png",
      panelPrompt: "prompt",
      candidateImageUrls: ["https://cdn.test/old-a.png"],
    });
    if (!created) throw new Error("seed failed");

    const result = await deployPanelImage(
      cloudContext(user.id),
      {
        projectId: project.id,
        panelId: created.id,
        imageUrl: "https://cdn.test/fresh.png",
        keepAsCandidate: false,
      },
      panelRepo,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.panel.imageUrl).toBe("https://cdn.test/fresh.png");
    expect(result.panel.candidateImageUrls).toEqual(["https://cdn.test/old-a.png"]);
  });

  it("a foreign panel is 404 with no write (adapter no-match returns null)", async () => {
    const { user, project, panelRepo, handle } = await seed();
    const result = await deployPanelImage(
      cloudContext(user.id),
      {
        projectId: project.id,
        panelId: "no-such-panel",
        imageUrl: "https://cdn.test/fresh.png",
        keepAsCandidate: false,
      },
      panelRepo,
    );
    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(await handle.db.select().from(comicPanels)).toEqual([]);
  });
});

describe("letterComicPanel through the real adapter — FIX B1 never overwrites the raw imageUrl", () => {
  it("the composite write lands in letteredImageUrl and the raw primary survives untouched", async () => {
    const log: string[] = [];
    const { handle, user, project, chapter, pageRepo, panelRepo } = await seed();
    const page = await pageRepo.create(project.id, {
      chapterId: chapter.id,
      pageNumber: 1,
      artStyle: "manga",
    });
    if (!page) throw new Error("seed failed");
    const created = await panelRepo.create(project.id, {
      pageId: page.id,
      panelIndex: 0,
      imageUrl: "https://cdn.test/raw-art.png",
      panelPrompt: "prompt",
      dialogue: "We must go back.",
      bubbleType: "speech",
    });
    if (!created) throw new Error("seed failed");

    let composeCalls = 0;
    let uploadCalls = 0;
    const result = await letterComicPanel(
      cloudContext(user.id),
      { projectId: project.id, pageId: page.id, panelId: created.id },
      {
        panelRepo,
        pageRepo: comicPageOwnershipProbe(handle),
        compose: async () => {
          composeCalls += 1;
          return okCompose();
        },
        upload: async () => {
          uploadCalls += 1;
          return okUpload();
        },
      },
      hooks(log),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The lettered composite persists into its own column…
    expect(result.panel.letteredImageUrl).toBe("https://blob.test/lettered.png");
    // …and the raw art is never overwritten — re-lettering after a text edit
    // must never re-run generation (the FIX B1 storage invariant).
    expect(result.panel.imageUrl).toBe("https://cdn.test/raw-art.png");
    expect(composeCalls).toBe(1);
    expect(uploadCalls).toBe(1);
    expect(log).toEqual(["hook:comicPanel.letter"]);

    // Storage-level pin: the two URL fields are separate DDL columns.
    const raw = handle.sqlite
      .prepare("SELECT image_url, lettered_image_url FROM comic_panels WHERE id = ?")
      .get(created.id) as { image_url: string; lettered_image_url: string };
    expect(raw.image_url).toBe("https://cdn.test/raw-art.png");
    expect(raw.lettered_image_url).toBe("https://blob.test/lettered.png");
  });

  it("the refusal ladder holds its route order — nothing composes until all gates pass", async () => {
    const { handle, user, project, chapter, pageRepo, panelRepo } = await seed();
    const page = await pageRepo.create(project.id, {
      chapterId: chapter.id,
      pageNumber: 1,
      artStyle: "manga",
    });
    if (!page) throw new Error("seed failed");
    const silent = await panelRepo.create(project.id, {
      pageId: page.id,
      panelIndex: 0,
      imageUrl: "https://cdn.test/raw-art.png",
      panelPrompt: "prompt",
      // No dialogue, no caption — the terminal 400 rung's subject.
    });

    // 1. scope mismatch → 403; 2. stranger → 404 "Not found".
    const scoped = await letterComicPanel(
      cloudContext(user.id, { projectScope: "other-project" }),
      { projectId: project.id, pageId: page.id, panelId: "no-such-panel" },
      {
        panelRepo,
        pageRepo: comicPageOwnershipProbe(handle),
        compose: async () => {
          throw new Error("compose must never run on a refusal path");
        },
        upload: async () => {
          throw new Error("upload must never run on a refusal path");
        },
      },
    );
    expect(scoped).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    const stranger = await letterComicPanel(
      cloudContext("stranger"),
      { projectId: project.id, pageId: page.id, panelId: "no-such-panel" },
      {
        panelRepo,
        pageRepo: comicPageOwnershipProbe(handle),
        compose: async () => {
          throw new Error("compose must never run on a refusal path");
        },
        upload: async () => {
          throw new Error("upload must never run on a refusal path");
        },
      },
    );
    expect(stranger).toEqual({ ok: false, status: 404, reason: "Not found" });

    // 3. real actor, unknown panel → 404 "Panel not found" (compose/upload
    // still never run).
    const noPanel = await letterComicPanel(
      cloudContext(user.id),
      { projectId: project.id, pageId: page.id, panelId: "no-such-panel" },
      {
        panelRepo,
        pageRepo: comicPageOwnershipProbe(handle),
        compose: async () => {
          throw new Error("compose must never run on a refusal path");
        },
        upload: async () => {
          throw new Error("upload must never run on a refusal path");
        },
      },
    );
    expect(noPanel).toEqual({ ok: false, status: 404, reason: "Panel not found" });

    // 4. real panel, ghost page → 404 "Page not found" (the probe rung).
    if (!silent) throw new Error("seed failed");
    const noPage = await letterComicPanel(
      cloudContext(user.id),
      { projectId: project.id, pageId: "no-such-page", panelId: silent.id },
      {
        panelRepo,
        pageRepo: comicPageOwnershipProbe(handle),
        compose: async () => {
          throw new Error("compose must never run on a refusal path");
        },
        upload: async () => {
          throw new Error("upload must never run on a refusal path");
        },
      },
    );
    expect(noPage).toEqual({ ok: false, status: 404, reason: "Page not found" });

    // 5. panel exists and is owned, page owned, but no dialogue/caption → the
    // exact route 400 body.
    const empty = await letterComicPanel(
      cloudContext(user.id),
      { projectId: project.id, pageId: page.id, panelId: silent.id },
      {
        panelRepo,
        pageRepo: comicPageOwnershipProbe(handle),
        compose: async () => {
          throw new Error("compose must never run on a refusal path");
        },
        upload: async () => {
          throw new Error("upload must never run on a refusal path");
        },
      },
    );
    expect(empty).toEqual({
      ok: false,
      status: 400,
      reason: "Add dialogue or a caption before lettering this panel.",
    });

    // Nothing was written anywhere by any refusal rung.
    expect(await handle.db.select().from(comicPanels).where(eq(comicPanels.letteredImageUrl, "https://blob.test/lettered.png"))).toEqual([]);
  });

  it("deleteComicPage — scoped delete is idempotent and the hook fires each call", async () => {
    const log: string[] = [];
    const { user, project, chapter, pageRepo, panelRepo } = await seed();
    const page = await pageRepo.create(project.id, {
      chapterId: chapter.id,
      pageNumber: 1,
      artStyle: "manga",
    });
    if (!page) throw new Error("seed failed");
    await panelRepo.create(project.id, {
      pageId: page.id,
      panelIndex: 0,
      imageUrl: "https://cdn.test/a.png",
      panelPrompt: "prompt",
    });

    const first = await deleteComicPage(
      cloudContext(user.id),
      { projectId: project.id, pageId: page.id },
      pageRepo,
      hooks(log),
    );
    const second = await deleteComicPage(
      cloudContext(user.id),
      { projectId: project.id, pageId: page.id },
      pageRepo,
      hooks(log),
    );
    expect(first).toEqual({ ok: true });
    // Matches zero rows silently — the original DELETE's behavior, preserved.
    expect(second).toEqual({ ok: true });
    expect(log).toEqual(["hook:comicPage.delete", "hook:comicPage.delete"]);
    expect(await pageRepo.countByProject(project.id)).toBe(0);
  });
});

describe("real-DB-specific — FK cascade + DDL presence", () => {
  it("deleting a page cascades its panels; deleting the project cascades both", async () => {
    const { handle, project, chapter, pageRepo, panelRepo } = await seed();
    const page = await pageRepo.create(project.id, {
      chapterId: chapter.id,
      pageNumber: 1,
      artStyle: "manga",
    });
    if (!page) throw new Error("seed failed");
    await panelRepo.create(project.id, {
      pageId: page.id,
      panelIndex: 0,
      imageUrl: "https://cdn.test/a.png",
      panelPrompt: "prompt",
    });
    await panelRepo.create(project.id, {
      pageId: page.id,
      panelIndex: 1,
      imageUrl: "https://cdn.test/b.png",
      panelPrompt: "prompt",
    });
    expect(await handle.db.select().from(comicPanels)).toHaveLength(2);

    // Panels die with their page (pageId FK ON DELETE cascade).
    await handle.db.delete(comicPages).where(eq(comicPages.id, page.id));
    expect(await handle.db.select().from(comicPanels)).toEqual([]);
    expect(await handle.db.select().from(comicPages)).toEqual([]);

    // Pages (and any remaining panels) die with the project. A FRESH page
    // first — the previous page row is gone, and page_id is NOT NULL with an
    // FK, so the panel needs a real parent to point at.
    const revived = await pageRepo.create(project.id, {
      chapterId: chapter.id,
      pageNumber: 1,
      artStyle: "manga",
    });
    if (!revived) throw new Error("seed failed");
    await panelRepo.create(project.id, {
      pageId: revived.id,
      panelIndex: 0,
      imageUrl: "https://cdn.test/c.png",
      panelPrompt: "prompt",
    });
    await handle.db.delete(projects).where(eq(projects.id, project.id));
    expect(await handle.db.select().from(comicPages)).toEqual([]);
    expect(await handle.db.select().from(comicPanels)).toEqual([]);
  });

  it("the vendored DDL carries both comic tables with the Phase-B/C columns", () => {
    expect(SQLITE_DDL).toContain('CREATE TABLE "comic_pages"');
    expect(SQLITE_DDL).toContain('CREATE TABLE "comic_panels"');
    // The candidate / lettering / critic columns the ports round-trip.
    expect(SQLITE_DDL).toContain('"candidate_image_urls"');
    expect(SQLITE_DDL).toContain('"lettered_image_url"');
    expect(SQLITE_DDL).toContain('"quality_score"');
    expect(SQLITE_DDL).toContain('"review_status"');
  });

  it("the DDL encodes both cascade chains the parity suite exercises", () => {
    const panelBlock = SQLITE_DDL.slice(
      SQLITE_DDL.indexOf('CREATE TABLE "comic_panels"'),
      SQLITE_DDL.indexOf("CREATE TABLE", SQLITE_DDL.indexOf('CREATE TABLE "comic_panels"') + 1),
    );
    expect(panelBlock).toContain(
      'FOREIGN KEY ("page_id") REFERENCES "comic_pages"("id") ON UPDATE no action ON DELETE cascade',
    );
    expect(panelBlock).toContain(
      'FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade',
    );
  });
});

describe("source purity of the sqlite layer (live-shell-reachability convention)", () => {
  // This file pins the immutable db trio plus ITS OWN adapter only; each
  // sibling parity suite already pins the whole set from its wave, so the
  // union stays complete without editing those tests.
  const FILES = [
    join(__dirname, "../../../db/sqlite.ts"),
    join(__dirname, "../../../db/sqlite-schema.ts"),
    join(__dirname, "../../../db/sqlite-ddl.ts"),
    join(__dirname, "../sqlite-comic-repos.ts"),
  ];

  it("the sqlite layer never imports the Neon side or the Next runtime", () => {
    for (const file of FILES) {
      const source = readFileSync(file, "utf-8");
      // Exact `@/db` alias (quote-delimited) and the pg schema alias — the
      // sqlite layer's legitimate imports are `@/db/sqlite` / `@/db/sqlite-schema` /
      // `@/db/sqlite-ddl`, which these regexes deliberately do not match.
      expect(source, file).not.toMatch(/"@\/db"|'@\/db'|"@\/db\/schema"|'@\/db\/schema'/);
      expect(source, file).not.toMatch(/"next(\/|-auth)?"/);
      expect(source, file).not.toMatch(/@neondatabase\/serverless/);
    }
  }, 20000);
});
