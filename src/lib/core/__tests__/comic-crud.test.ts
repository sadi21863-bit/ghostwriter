import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listComicPages,
  createComicPage,
  deleteComicPage,
  createComicPanel,
  updateComicPanel,
  deployPanelImage,
  letterComicPanel,
  type LetteringComposeResult,
  type ComicPageCrudRepository,
  type ComicPageRow,
  type ComicPanelCrudRepository,
  type ComicPanelRow,
  type ComicPageCreateData,
  type ComicPanelCreateData,
} from "@/lib/core/handlers/comics";
import { cloudContext } from "@/lib/core/request-context";

const ctx = cloudContext("u1");
const hooks = (log: string[] = []) => ({
  onCanonicalMutation: vi.fn(async (projectOrId: string, kind: string) => {
    log.push(`hook:${kind}`);
  }),
});

function pageRepo(overrides: Partial<ComicPageCrudRepository> = {}): ComicPageCrudRepository {
  return {
    ownsProject: vi.fn(async () => true),
    countByProject: vi.fn(async () => 0),
    listWithPanels: vi.fn(async () => []),
    create: vi.fn(async (projectId, fields) => ({
      id: "page-1",
      projectId,
      ...(fields as Record<string, unknown>),
    }) as ComicPageRow),
    deleteScoped: vi.fn(async () => {}),
    ...overrides,
  };
}

function panelRepo(overrides: Partial<ComicPanelCrudRepository> = {}): ComicPanelCrudRepository {
  return {
    ownsProject: vi.fn(async () => true),
    findScoped: vi.fn(async () => null),
    create: vi.fn(async (projectId, fields) => ({
      id: "panel-1",
      projectId,
      ...(fields as Record<string, unknown>),
    }) as ComicPanelRow),
    updateScoped: vi.fn(async (_projectId, _panelId, patch) => ({
      id: "panel-1",
      projectId: "p1",
      imageUrl: "https://example.com/primary.png",
      panelPrompt: "a panel",
      ...patch,
    }) as ComicPanelRow),
    ...overrides,
  };
}

const pageData = (over: Partial<ComicPageCreateData> = {}): ComicPageCreateData => ({
  chapterId: "ch-1",
  artStyle: "manga",
  ...over,
});
const panelData = (over: Partial<ComicPanelCreateData> = {}): ComicPanelCreateData => ({
  pageId: "page-1",
  panelIndex: 0,
  imageUrl: "https://example.com/new.png",
  panelPrompt: "a panel",
  ...over,
});

const letterDeps = (panel: ComicPanelCrudRepository) => ({
  panelRepo: panel,
  pageRepo: { owns: vi.fn(async () => true) },
  compose: vi.fn(async (_args: unknown): Promise<LetteringComposeResult> => ({
    ok: true,
    lettered: Buffer.from("lettered-png"),
  })),
  upload: vi.fn(async () => "https://blob.example/lettered.png"),
});

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------- comic pages

describe("listComicPages", () => {
  it("403 — refuses a scope-mismatched context before the repository", async () => {
    const repo = pageRepo();
    const result = await listComicPages(
      cloudContext("u1", { projectScope: "p2" }),
      { projectId: "p1" },
      repo,
    );

    expect(result).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(repo.ownsProject).not.toHaveBeenCalled();
    expect(repo.listWithPanels).not.toHaveBeenCalled();
  });

  it("404 — refuses an unowned project", async () => {
    const repo = pageRepo({ ownsProject: vi.fn(async () => false) });
    const result = await listComicPages(ctx, { projectId: "p1" }, repo);

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(repo.listWithPanels).not.toHaveBeenCalled();
  });

  it("happy path — passes the adapter's ordered read straight through", async () => {
    const pages = [{ id: "page-2", projectId: "p1" }, { id: "page-1", projectId: "p1" }];
    const repo = pageRepo({ listWithPanels: vi.fn(async () => pages as never) });
    const result = await listComicPages(ctx, { projectId: "p1" }, repo);

    expect(result).toEqual({ ok: true, pages });
    expect(repo.ownsProject).toHaveBeenCalledWith("p1", "u1");
  });
});

describe("createComicPage", () => {
  it("403 — refuses a scope-mismatched context", async () => {
    const repo = pageRepo();
    const result = await createComicPage(
      cloudContext("u1", { projectScope: "p2" }),
      { projectId: "p1", data: pageData() },
      repo,
    );

    expect(result).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("404 — unowned project: no count, no insert, no hook", async () => {
    const log: string[] = [];
    const repo = pageRepo({ ownsProject: vi.fn(async () => false) });
    const result = await createComicPage(ctx, { projectId: "p1", data: pageData() }, repo, hooks(log));

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(repo.countByProject).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
    expect(log).toEqual([]);
  });

  it("happy path — pageNumber is existing pages + 1 (the pre-migration rule), hook comicPage.create fires", async () => {
    const log: string[] = [];
    const repo = pageRepo({ countByProject: vi.fn(async () => 4) });
    const result = await createComicPage(ctx, { projectId: "p1", data: pageData() }, repo, hooks(log));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(repo.ownsProject).toHaveBeenCalledWith("p1", "u1");
    const fields = (repo.create as ReturnType<typeof vi.fn>).mock.calls[0][1] as Record<string, unknown>;
    expect(fields).toEqual({ chapterId: "ch-1", pageNumber: 5, artStyle: "manga" });
    expect(log).toEqual(["hook:comicPage.create"]);
  });

  it("adapter invariant — a create that yields no row is a 404 refusal, hook never fires", async () => {
    const log: string[] = [];
    const result = await createComicPage(
      ctx,
      { projectId: "p1", data: pageData() },
      pageRepo({ create: vi.fn(async () => null) }),
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(log).toEqual([]);
  });
});

describe("deleteComicPage", () => {
  it("403 — refusal fires no hook and deletes nothing", async () => {
    const log: string[] = [];
    const repo = pageRepo();
    const result = await deleteComicPage(
      cloudContext("u1", { projectScope: "p2" }),
      { projectId: "p1", pageId: "page-1" },
      repo,
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(repo.deleteScoped).not.toHaveBeenCalled();
    expect(log).toEqual([]);
  });

  it("404 — unowned project: no delete, no hook", async () => {
    const log: string[] = [];
    const result = await deleteComicPage(
      ctx,
      { projectId: "p1", pageId: "page-1" },
      pageRepo({ ownsProject: vi.fn(async () => false) }),
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(log).toEqual([]);
  });

  it("happy path — post-delete ordering: scoped delete runs THEN the hook (even when no row matched)", async () => {
    const events: string[] = [];
    const repo = pageRepo({
      deleteScoped: vi.fn(async () => {
        events.push("delete");
      }),
    });
    const result = await deleteComicPage(ctx, { projectId: "p1", pageId: "page-1" }, repo, {
      onCanonicalMutation: vi.fn(async () => {
        events.push("hook");
      }),
    });

    expect(result).toEqual({ ok: true });
    expect(events).toEqual(["delete", "hook"]);
  });
});

// --------------------------------------------------------------- comic panels

describe("createComicPanel", () => {
  it("403 — refuses a scope-mismatched context", async () => {
    const repo = panelRepo();
    const result = await createComicPanel(
      cloudContext("u1", { projectScope: "p2" }),
      { projectId: "p1", data: panelData() },
      repo,
    );

    expect(result).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("404 — unowned project: no insert, no hook", async () => {
    const log: string[] = [];
    const result = await createComicPanel(
      ctx,
      { projectId: "p1", data: panelData() },
      panelRepo({ ownsProject: vi.fn(async () => false) }),
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(log).toEqual([]);
  });

  it("happy path — inserts with the caller-resolved generation fields, hook comicPanel.create fires", async () => {
    const log: string[] = [];
    const repo = panelRepo();
    const result = await createComicPanel(
      ctx,
      {
        projectId: "p1",
        data: panelData({
          panelIndex: 2,
          imageUrl: "u",
          panelPrompt: "wide shot",
          referenceImageUrl: "soul-uuid",
          characterName: "Arthur",
          artStylePreset: "Anime",
        }),
      },
      repo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.panel.panelIndex).toBe(2);
    const fields = (repo.create as ReturnType<typeof vi.fn>).mock.calls[0][1] as Record<string, unknown>;
    expect(fields).toEqual({
      pageId: "page-1",
      panelIndex: 2,
      imageUrl: "u",
      panelPrompt: "wide shot",
      referenceImageUrl: "soul-uuid",
      characterName: "Arthur",
      artStylePreset: "Anime",
    });
    expect(log).toEqual(["hook:comicPanel.create"]);
  });

  it("adapter invariant — a create that yields no row is a 404 refusal", async () => {
    const log: string[] = [];
    const result = await createComicPanel(
      ctx,
      { projectId: "p1", data: panelData() },
      panelRepo({ create: vi.fn(async () => null) }),
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(log).toEqual([]);
  });
});

describe("updateComicPanel", () => {
  it("403 — refuses a scope-mismatched context", async () => {
    const repo = panelRepo();
    const result = await updateComicPanel(
      cloudContext("u1", { projectScope: "p2" }),
      { projectId: "p1", panelId: "panel-1", patch: {} },
      repo,
    );

    expect(result).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(repo.updateScoped).not.toHaveBeenCalled();
  });

  it("404 — unowned project: no write, no hook", async () => {
    const log: string[] = [];
    const result = await updateComicPanel(
      ctx,
      { projectId: "p1", panelId: "panel-1", patch: { dialogue: "hi" } },
      panelRepo({ ownsProject: vi.fn(async () => false) }),
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(log).toEqual([]);
  });

  it("404 — no row matched (wrong panelId): updateScoped ran, hook did not", async () => {
    const log: string[] = [];
    const result = await updateComicPanel(
      ctx,
      { projectId: "p1", panelId: "panel-9", patch: { dialogue: "hi" } },
      panelRepo({ updateScoped: vi.fn(async () => null) }),
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(log).toEqual([]);
  });

  it("happy path — allowlisted patch gets written, hook comicPanel.update fires", async () => {
    const log: string[] = [];
    const repo = panelRepo();
    const result = await updateComicPanel(
      ctx,
      { projectId: "p1", panelId: "panel-1", patch: { dialogue: "hi", reviewStatus: "approved" } },
      repo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.panel.dialogue).toBe("hi");
    const patchArg = (repo.updateScoped as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(patchArg).toEqual({ dialogue: "hi", reviewStatus: "approved" });
    expect(log).toEqual(["hook:comicPanel.update"]);
  });

  it("empty patch — the degenerate update still runs (no updatedAt column on comicPanels), no hook", async () => {
    const log: string[] = [];
    const repo = panelRepo();
    await updateComicPanel(ctx, { projectId: "p1", panelId: "panel-1", patch: {} }, repo, hooks(log));

    expect(repo.updateScoped).toHaveBeenCalled();
    expect(log).toEqual([]);
  });

  it("non-string promoteCandidateUrl is ignored (the old route's typeof guard), even on an empty patch", async () => {
    const log: string[] = [];
    const findScoped = vi.fn();
    await updateComicPanel(
      ctx,
      { projectId: "p1", panelId: "panel-1", patch: {}, promoteCandidateUrl: true },
      panelRepo({ findScoped }),
      hooks(log),
    );

    expect(findScoped).not.toHaveBeenCalled();
    expect(log).toEqual([]);
  });

  describe("promoteCandidateUrl — the Phase-C swap", () => {
    const promoting = (over: Partial<ComicPanelRow> = {}, repoOver: Partial<ComicPanelCrudRepository> = {}) =>
      panelRepo({
        findScoped: vi.fn(async () => ({
          id: "panel-1",
          projectId: "p1",
          imageUrl: "https://example.com/primary.png",
          candidateImageUrls: ["https://example.com/a.png", "https://example.com/b.png"],
          ...over,
        }) as ComicPanelRow),
        ...repoOver,
      });

    it("400 — an unknown candidate is refused with the route's exact message, nothing written", async () => {
      const log: string[] = [];
      const updateScoped = vi.fn();
      const result = await updateComicPanel(
        ctx,
        { projectId: "p1", panelId: "panel-1", patch: { dialogue: "hi" }, promoteCandidateUrl: "https://example.com/other.png" },
        promoting({}, { updateScoped }),
        hooks(log),
      );

      expect(result).toEqual({ ok: false, status: 400, reason: "Not a known candidate for this panel." });
      expect(updateScoped).not.toHaveBeenCalled();
      expect(log).toEqual([]);
    });

    it("404 — the panel vanished between route probe and the promotion read", async () => {
      const result = await updateComicPanel(
        ctx,
        { projectId: "p1", panelId: "panel-1", patch: {}, promoteCandidateUrl: "https://example.com/a.png" },
        panelRepo({ findScoped: vi.fn(async () => null) }),
      );

      expect(result).toEqual({ ok: false, status: 404, reason: "Panel not found" });
    });
  });

  it("promote happy path — the swap lands in the written patch alongside allowlisted fields, hook fires", async () => {
    const log: string[] = [];
    const repo = panelRepo({
      findScoped: vi.fn(async () => ({
        id: "panel-1",
        projectId: "p1",
        imageUrl: "https://example.com/primary.png",
        candidateImageUrls: ["https://example.com/a.png", "https://example.com/b.png"],
      }) as ComicPanelRow),
    });
    const result = await updateComicPanel(
      ctx,
      { projectId: "p1", panelId: "panel-1", patch: { dialogue: "hi" }, promoteCandidateUrl: "https://example.com/a.png" },
      repo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    const patchArg = (repo.updateScoped as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(patchArg.imageUrl).toBe("https://example.com/a.png");
    expect(patchArg.candidateImageUrls).toEqual(["https://example.com/b.png", "https://example.com/primary.png"]);
    expect(patchArg.dialogue).toBe("hi");
    expect(log).toEqual(["hook:comicPanel.update"]);
  });
});

describe("deployPanelImage", () => {
  it("403 — refuses a scope-mismatched context", async () => {
    const repo = panelRepo();
    const result = await deployPanelImage(
      cloudContext("u1", { projectScope: "p2" }),
      { projectId: "p1", panelId: "panel-1", imageUrl: "u", keepAsCandidate: false },
      repo,
    );

    expect(result).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(repo.updateScoped).not.toHaveBeenCalled();
  });

  it("404 — unowned project: no write, no hook", async () => {
    const log: string[] = [];
    const result = await deployPanelImage(
      ctx,
      { projectId: "p1", panelId: "panel-1", imageUrl: "u", keepAsCandidate: false },
      panelRepo({ ownsProject: vi.fn(async () => false) }),
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(log).toEqual([]);
  });

  it("default — overwrites the primary image, hook comicPanel.regenerate fires after the write", async () => {
    const events: string[] = [];
    const repo = panelRepo({
      updateScoped: vi.fn(async (_p, _i, patch) => {
        events.push("write");
        return {
          id: "panel-1",
          projectId: "p1",
          imageUrl: "https://example.com/primary.png",
          panelPrompt: "a panel",
          ...patch,
        } as ComicPanelRow;
      }),
    });
    const result = await deployPanelImage(
      ctx,
      { projectId: "p1", panelId: "panel-1", imageUrl: "https://example.com/new.png", keepAsCandidate: false },
      repo,
      {
        onCanonicalMutation: vi.fn(async () => {
          events.push("hook");
        }),
      },
    );

    expect(result.ok).toBe(true);
    const patchArg = (repo.updateScoped as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(patchArg).toEqual({ imageUrl: "https://example.com/new.png" });
    expect(events).toEqual(["write", "hook"]);
  });

  it("keepAsCandidate — appends to the caller-supplied candidates instead of touching the primary", async () => {
    const log: string[] = [];
    const repo = panelRepo();
    const result = await deployPanelImage(
      ctx,
      {
        projectId: "p1",
        panelId: "panel-1",
        imageUrl: "https://example.com/new.png",
        keepAsCandidate: true,
        existingCandidateUrls: ["https://example.com/old-candidate.png"],
      },
      repo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    const patchArg = (repo.updateScoped as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(patchArg).toEqual({
      candidateImageUrls: ["https://example.com/old-candidate.png", "https://example.com/new.png"],
    });
    expect(log).toEqual(["hook:comicPanel.regenerate"]);
  });

  it("404 — no row matched (panelId foreign or gone): hook never fires", async () => {
    const log: string[] = [];
    const result = await deployPanelImage(
      ctx,
      { projectId: "p1", panelId: "panel-9", imageUrl: "u", keepAsCandidate: false },
      panelRepo({ updateScoped: vi.fn(async () => null) }),
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(log).toEqual([]);
  });
});

// ------------------------------------------------------------------- lettering

describe("letterComicPanel", () => {
  const letterInput = { projectId: "p1", pageId: "page-1", panelId: "panel-1" };
  const panelWithText = (over: Partial<ComicPanelRow> = {}): ComicPanelRow => ({
    id: "panel-1",
    pageId: "page-1",
    projectId: "p1",
    panelIndex: 0,
    imageUrl: "https://example.com/raw.png",
    panelPrompt: "a panel",
    dialogue: "We meet again.",
    caption: "",
    speakerName: "Kessler",
    bubbleType: "speech",
    ...over,
  });

  it("403 — refuses a scope-mismatched context", async () => {
    const panel = panelRepo();
    const deps = letterDeps(panel);
    const result = await letterComicPanel(
      cloudContext("u1", { projectScope: "p2" }),
      letterInput,
      deps,
    );

    expect(result).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(panel.ownsProject).not.toHaveBeenCalled();
  });

  it("404 — unowned project", async () => {
    const panel = panelRepo({ ownsProject: vi.fn(async () => false) });
    const result = await letterComicPanel(ctx, letterInput, letterDeps(panel));

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(panel.findScoped).not.toHaveBeenCalled();
  });

  it("404 — panel not found (wrong panelId), before the page check", async () => {
    const panel = panelRepo({ findScoped: vi.fn(async () => null) });
    const deps = letterDeps(panel);
    const result = await letterComicPanel(ctx, letterInput, deps);

    expect(result).toEqual({ ok: false, status: 404, reason: "Panel not found" });
    expect(deps.pageRepo.owns).not.toHaveBeenCalled();
  });

  it("404 — the page is the transport's page-shaped refusal, compose untouched", async () => {
    const panel = panelRepo({ findScoped: vi.fn(async () => panelWithText()) });
    const deps = {
      ...letterDeps(panel),
      pageRepo: { owns: vi.fn(async () => false) },
    };
    const result = await letterComicPanel(ctx, letterInput, deps);

    expect(result).toEqual({ ok: false, status: 404, reason: "Page not found" });
    expect(deps.compose).not.toHaveBeenCalled();
  });

  it("400 — the dialogue/caption gate fires before compose", async () => {
    const panel = panelRepo({ findScoped: vi.fn(async () => panelWithText({ dialogue: "", caption: "  " })) });
    const deps = letterDeps(panel);
    const result = await letterComicPanel(ctx, letterInput, deps);

    expect(result).toEqual({ ok: false, status: 400, reason: "Add dialogue or a caption before lettering this panel." });
    expect(deps.compose).not.toHaveBeenCalled();
  });

  it("compose refusals pass through with their own status and reason", async () => {
    const unconfigured: LetteringComposeResult = { ok: false, status: 500, reason: "Blob storage is not configured." };
    const panel = panelRepo({ findScoped: vi.fn(async () => panelWithText()) });
    const result = await letterComicPanel(ctx, letterInput, {
      ...letterDeps(panel),
      compose: vi.fn(async () => unconfigured),
    });

    expect(result).toEqual({ ok: false, status: 500, reason: "Blob storage is not configured." });
  });

  it("502 — an unfetchable source image stops before upload and write", async () => {
    const panel = panelRepo({ findScoped: vi.fn(async () => panelWithText()) });
    const updateScoped = panel.updateScoped as ReturnType<typeof vi.fn>;
    const deps = {
      ...letterDeps(panel),
      compose: vi.fn(async (): Promise<LetteringComposeResult> => ({
        ok: false,
        status: 502,
        reason: "Could not fetch the panel's source image.",
      })),
    };
    const result = await letterComicPanel(ctx, letterInput, deps);

    expect(result).toEqual({ ok: false, status: 502, reason: "Could not fetch the panel's source image." });
    expect(deps.upload).not.toHaveBeenCalled();
    expect(updateScoped).not.toHaveBeenCalled();
  });

  it("happy path — compose THEN upload THEN scoped write THEN hook, full order pinned", async () => {
    const events: string[] = [];
    const panel = panelRepo({ findScoped: vi.fn(async () => panelWithText()) });
    const deps = {
      panelRepo: panel,
      pageRepo: { owns: vi.fn(async () => true) },
      compose: vi.fn(async () => {
        events.push("compose");
        return { ok: true, lettered: Buffer.from("lettered") } satisfies LetteringComposeResult;
      }),
      upload: vi.fn(async () => {
        events.push("upload");
        return "https://blob.example/lettered.png";
      }),
    };
    const result = await letterComicPanel(ctx, letterInput, deps, {
      onCanonicalMutation: vi.fn(async () => {
        events.push("hook");
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.panel.letteredImageUrl).toBe("https://blob.example/lettered.png");
    const patchArg = (panel.updateScoped as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(patchArg).toEqual({ letteredImageUrl: "https://blob.example/lettered.png" });
    expect(events).toEqual(["compose", "upload", "hook"]);
  });

  it("compose is handed the panel row plus its scopes, upload receives the composited buffer", async () => {
    const panel = panelRepo({ findScoped: vi.fn(async () => panelWithText()) });
    const deps = letterDeps(panel);
    await letterComicPanel(ctx, letterInput, deps);

    expect(deps.compose).toHaveBeenCalledWith(
      expect.objectContaining({ panel: expect.objectContaining({ id: "panel-1" }), projectId: "p1", pageId: "page-1" }),
    );
    expect(deps.upload).toHaveBeenCalledWith(
      expect.objectContaining({ lettered: expect.any(Buffer), panel: expect.objectContaining({ id: "panel-1" }) }),
    );
  });

  it("the terminal write refuses as 404 (ownership vanished mid-flight) — hook fires independently only on success", async () => {
    const log: string[] = [];
    const events: string[] = [];
    const panel = panelRepo({
      findScoped: vi.fn(async () => panelWithText()),
      updateScoped: vi.fn(async () => {
        events.push("write");
        return null;
      }),
    });
    const deps = {
      ...letterDeps(panel),
      compose: vi.fn(async () => {
        events.push("compose");
        return { ok: true, lettered: Buffer.from("lettered") } satisfies LetteringComposeResult;
      }),
      upload: vi.fn(async () => {
        events.push("upload");
        return "https://blob.example/lettered.png";
      }),
    };
    const result = await letterComicPanel(ctx, letterInput, deps, hooks(log));

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(events).toEqual(["compose", "upload", "write"]);
    expect(log).toEqual([]);
  });
});
