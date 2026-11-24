import { describe, it, expect, vi } from "vitest";
import {
  STORY_BIBLE_SECTIONS,
  bibleSize,
  emptySections,
  getStoryBible,
  type StoryBibleRepository,
  type StoryBibleSectionName,
} from "@/lib/core/handlers/get-story-bible";
import { cloudContext, localContext } from "@/lib/core/request-context";

/**
 * Phase 2 / v4 §7 — `getStoryBible`.
 *
 * The behaviour worth pinning is the normalization: a repository that omits a
 * section must not produce `undefined` sections that the UI iterates over, and an
 * empty project must be a successful empty read rather than an error.
 */

const ctx = cloudContext("u1");
const projectId = "proj-1";

function repo(over: Partial<StoryBibleRepository> = {}): StoryBibleRepository {
  return {
    ownsProject: vi.fn(async () => true),
    readSections: vi.fn(async () => ({ characters: [{ id: "c1", name: "Mara" }] })),
    ...over,
  } as unknown as StoryBibleRepository;
}

describe("story bible shape", () => {
  it("declares exactly the seven World Bible collections", () => {
    expect([...STORY_BIBLE_SECTIONS].sort()).toEqual([
      "characterRelationships",
      "characters",
      "locations",
      "plotThreads",
      "referenceWorks",
      "storyMemories",
      "worldEntities",
    ]);
  });

  it("emptySections returns a fresh object each call", () => {
    const a = emptySections();
    const b = emptySections();
    expect(a).not.toBe(b);
    expect(a.characters).not.toBe(b.characters);
    // Sections are exposed readonly; mutate through a cast purely to prove the
    // next call is unaffected by a previous one's mutation.
    (a.characters as Record<string, unknown>[]).push({ id: "x" });
    expect(emptySections().characters).toEqual([]);
  });
});

describe("authorization", () => {
  it("serves the bible when the actor owns the project", async () => {
    const r = await getStoryBible(ctx, { projectId }, repo());
    expect(r).toMatchObject({ ok: true });
  });

  it("404s when the project is not owned", async () => {
    const r = repo({ ownsProject: vi.fn(async () => false) as never });
    expect(await getStoryBible(ctx, { projectId }, r)).toMatchObject({ ok: false, status: 404 });
  });

  it("403s for a context scoped to a different project, without reading anything", async () => {
    const r = repo();
    const scoped = localContext({ projectScope: "other" });
    expect(await getStoryBible(scoped, { projectId }, r)).toMatchObject({ ok: false, status: 403 });
    expect(r.readSections).not.toHaveBeenCalled();
  });

  it("allows a context scoped to the same project", async () => {
    const r = repo();
    const scoped = localContext({ projectScope: projectId });
    expect(await getStoryBible(scoped, { projectId }, r)).toMatchObject({ ok: true });
  });
});

describe("section normalization", () => {
  it("fills every omitted section with an empty array", async () => {
    const r = repo();
    const out = await getStoryBible(ctx, { projectId }, r);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    for (const key of STORY_BIBLE_SECTIONS) {
      expect(Array.isArray(out.bible.sections[key])).toBe(true);
    }
    expect(out.bible.sections.characters).toHaveLength(1);
    expect(out.bible.sections.worldEntities).toEqual([]);
  });

  it("returns all sections empty for a brand-new project, without erroring", async () => {
    const r = repo({ readSections: vi.fn(async () => ({})) as never });
    const out = await getStoryBible(ctx, { projectId }, r);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(bibleSize(out.bible)).toBe(0);
  });

  it("preserves sections the repository does return", async () => {
    const r = repo({
      readSections: vi.fn(async () => ({
        characters: [{ id: "c1" }],
        locations: [{ id: "l1" }, { id: "l2" }],
      })) as never,
    });
    const out = await getStoryBible(ctx, { projectId }, r);
    if (!out.ok) throw new Error("expected ok");
    expect(out.bible.sections.locations).toHaveLength(2);
    expect(bibleSize(out.bible)).toBe(3);
  });

  it("counts rows across all sections", async () => {
    const oneEach = Object.fromEntries(
      STORY_BIBLE_SECTIONS.map((k) => [k, [{ id: k }]]),
    ) as unknown as Record<StoryBibleSectionName, Record<string, unknown>[]>;
    const r = repo({ readSections: vi.fn(async () => oneEach) as never });
    const out = await getStoryBible(ctx, { projectId }, r);
    if (!out.ok) throw new Error("expected ok");
    expect(bibleSize(out.bible)).toBe(STORY_BIBLE_SECTIONS.length);
  });

  it("scopes the read to exactly one project", async () => {
    const r = repo();
    await getStoryBible(ctx, { projectId }, r);
    expect(r.readSections).toHaveBeenCalledWith(projectId);
    expect((r.readSections as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([projectId]);
  });
});

describe("contentRevision (§11 handoff)", () => {
  it("reports null when the host cannot supply a revision", async () => {
    const r = repo();
    delete (r as Partial<StoryBibleRepository>).readContentRevision;
    const out = await getStoryBible(ctx, { projectId }, r);
    if (!out.ok) throw new Error("expected ok");
    // null, not 0 — "unknown" must be distinguishable from "zero".
    expect(out.bible.contentRevision).toBeNull();
  });

  it("passes through a real revision", async () => {
    const r = repo({ readContentRevision: vi.fn(async () => 7) as never });
    const out = await getStoryBible(ctx, { projectId }, r);
    if (!out.ok) throw new Error("expected ok");
    expect(out.bible.contentRevision).toBe(7);
  });

  it("reads the revision AFTER the sections, so a concurrent mutation cannot produce a stale stamp", async () => {
    // Ordering matters: a revision older than the data it labels is silent
    // staleness. Reading sections first means the stamp is always >= the data.
    const order: string[] = [];
    const r = repo({
      readSections: vi.fn(async () => {
        order.push("sections");
        return { characters: [] };
      }) as never,
      readContentRevision: vi.fn(async () => {
        order.push("revision");
        return 3;
      }) as never,
    });
    await getStoryBible(ctx, { projectId }, r);
    expect(order).toEqual(["sections", "revision"]);
  });

  it("echoes the project it served", async () => {
    const out = await getStoryBible(ctx, { projectId }, repo());
    if (!out.ok) throw new Error("expected ok");
    expect(out.bible.projectId).toBe(projectId);
  });
});