import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listProductionShots,
  updateProductionShot,
  type ProductionShotCrudRepository,
  type ProductionShotRow,
} from "@/lib/core/handlers/production-shots";
import { cloudContext } from "@/lib/core/request-context";

const ctx = cloudContext("u1");
const hooks = (log: string[] = []) => ({
  onCanonicalMutation: vi.fn(async (projectOrId: string, kind: string) => {
    log.push(`hook:${kind}`);
  }),
});

const baseShot = (overrides: Record<string, unknown> = {}) => ({
  id: "shot-1",
  projectId: "p1",
  sceneNumber: 1,
  shotNumber: 1,
  shotType: "Medium shot", cameraMovement: "Static", lightingMood: "Golden hour", timeOfDay: "Afternoon",
  subject: "Mara", action: "walks", location: "The alley",
  soulPrompt: "old soul", videoPrompt: "old video",
  previewImageUrl: "https://example.com/primary.jpg",
  candidatePreviewUrls: ["https://example.com/candidate-a.jpg", "https://example.com/candidate-b.jpg"],
  ...overrides,
});

function repo(overrides: Partial<ProductionShotCrudRepository> = {}): ProductionShotCrudRepository {
  return {
    ownsProject: vi.fn(async () => true),
    list: vi.fn(async () => [{ id: "s1" }] as unknown as ProductionShotRow[]),
    findById: vi.fn(async () => baseShot() as ProductionShotRow),
    updateScoped: vi.fn(async (_projectId, _shotId, patch) =>
      ({ ...baseShot(), ...patch }) as ProductionShotRow),
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("listProductionShots", () => {
  it("403 — refuses a scope-mismatched context before the repository", async () => {
    const r = repo();
    const result = await listProductionShots(cloudContext("u1", { projectScope: "p2" }), { projectId: "p1" }, r);

    expect(result).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(r.ownsProject).not.toHaveBeenCalled();
    expect(r.list).not.toHaveBeenCalled();
  });

  it("404 — unowned project, no list read", async () => {
    const r = repo({ ownsProject: vi.fn(async () => false) });
    const result = await listProductionShots(ctx, { projectId: "p1" }, r);

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(r.ownsProject).toHaveBeenCalledWith("p1", "u1");
    expect(r.list).not.toHaveBeenCalled();
  });

  it("happy path — scoped rows pass through untouched (no shape reshape)", async () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }] as unknown as ProductionShotRow[];
    const result = await listProductionShots(ctx, { projectId: "p1" }, repo({ list: vi.fn(async () => rows) }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.shots).toBe(rows);
  });
});

describe("updateProductionShot — core PATCH mechanics", () => {
  it("403 — refusal before the repository; nothing read, nothing written", async () => {
    const r = repo();
    const log: string[] = [];
    const result = await updateProductionShot(
      cloudContext("u1", { projectScope: "p2" }),
      { projectId: "p1", shotId: "shot-1", patch: { reviewStatus: "approved" } },
      r,
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(r.findById).not.toHaveBeenCalled();
    expect(r.updateScoped).not.toHaveBeenCalled();
    expect(log).toEqual([]);
  });

  it("404 — unowned project: no current-row read, no write, no hook", async () => {
    const log: string[] = [];
    const r = repo({ ownsProject: vi.fn(async () => false) });
    const result = await updateProductionShot(
      ctx,
      { projectId: "p1", shotId: "shot-1", patch: { reviewStatus: "approved" } },
      r,
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(r.findById).not.toHaveBeenCalled();
    expect(log).toEqual([]);
  });

  it("404 — Shot not found when the (project-scoped) row is missing; the old message preserved", async () => {
    const log: string[] = [];
    const r = repo({ findById: vi.fn(async () => null) });
    const result = await updateProductionShot(
      ctx,
      { projectId: "p1", shotId: "shot-9", patch: { reviewStatus: "approved" } },
      r,
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 404, reason: "Shot not found" });
    expect(r.findById).toHaveBeenCalledWith("p1", "shot-9");
    expect(r.updateScoped).not.toHaveBeenCalled();
    expect(log).toEqual([]);
  });

  it("happy path — patch survives, server stamps updatedAt LAST, hook shot.update fires after the write", async () => {
    const events: string[] = [];
    const r = repo({
      updateScoped: vi.fn(async (_p, _s, patch) => {
        events.push(`write:${Object.keys(patch).join(",")}`);
        return { ...baseShot(), ...patch } as ProductionShotRow;
      }),
    });
    const result = await updateProductionShot(
      ctx,
      { projectId: "p1", shotId: "shot-1", patch: { reviewStatus: "approved", trimStartSec: 0.5 } },
      r,
      { onCanonicalMutation: vi.fn(async (pid, kind) => { events.push(`hook:${kind}:${pid}`); }) },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const patchArg = (r.updateScoped as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(patchArg.reviewStatus).toBe("approved");
    expect(patchArg.trimStartSec).toBe(0.5);
    expect(patchArg.updatedAt).toBeInstanceOf(Date);
    expect(events).toEqual(["write:reviewStatus,trimStartSec,updatedAt", "hook:shot.update:p1"]);
  });

  it("empty patch — still a touch (fresh updatedAt), never a canon mutation", async () => {
    const log: string[] = [];
    const r = repo();
    const result = await updateProductionShot(ctx, { projectId: "p1", shotId: "shot-1", patch: {} }, r, hooks(log));

    expect(result.ok).toBe(true);
    const patchArg = (r.updateScoped as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(patchArg.updatedAt).toBeInstanceOf(Date);
    expect(log).toEqual([]);
  });

  it("no prompt rebuild — reviewStatus/trim may not touch soulPrompt/videoPrompt", async () => {
    const r = repo();
    await updateProductionShot(ctx, { projectId: "p1", shotId: "shot-1", patch: { reviewStatus: "approved" } }, r);

    const patchArg = (r.updateScoped as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(patchArg.soulPrompt).toBeUndefined();
    expect(patchArg.videoPrompt).toBeUndefined();
  });

  it("prompt rebuild — ANY param field triggers both prompts from the MERGED values, translated", async () => {
    const r = repo({ findById: vi.fn(async () => baseShot({ lightingMood: "Neon night" }) as ProductionShotRow) });
    const result = await updateProductionShot(
      ctx,
      { projectId: "p1", shotId: "shot-1", patch: { shotType: "Close-up" } },
      r,
    );

    if (!result.ok) throw new Error("expected ok");
    const patchArg = (r.updateScoped as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(typeof patchArg.soulPrompt).toBe("string");
    const soul = patchArg.soulPrompt as string;
    const video = patchArg.videoPrompt as string;
    // Merged values: subject/action/location from the CURRENT row, plus the
    // client patch's shotType, and the unchanged Neon night lighting.
    expect(soul).toBe("Mara. walks. The alley. close-up shot, face or object detail, emotional intimacy, static camera, stable, composed, deliberate framing, neon-lit night, vibrant colored light reflections, urban atmosphere, time of day: Afternoon. Photorealistic portrait quality.");
    expect(video).toBe("walks. The alley. close-up shot, face or object detail, emotional intimacy, static camera, stable, composed, deliberate framing, neon-lit night, vibrant colored light reflections, urban atmosphere, time of day: Afternoon. Cinematic motion.");
  });

  it("explicit client prompts win — soulPrompt/videoPrompt already in the patch are not rebuilt", async () => {
    const r = repo();
    await updateProductionShot(
      ctx,
      { projectId: "p1", shotId: "shot-1", patch: { shotType: "Close-up", soulPrompt: "mine", videoPrompt: "also mine" } },
      r,
    );

    const patchArg = (r.updateScoped as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(patchArg.soulPrompt).toBe("mine");
    expect(patchArg.videoPrompt).toBe("also mine");
  });

  it("mixed — explicit soulPrompt shielded, videoPrompt rebuilt from the merged shot", async () => {
    const r = repo();
    await updateProductionShot(
      ctx,
      { projectId: "p1", shotId: "shot-1", patch: { lightingMood: "Candlelit", soulPrompt: "mine" } },
      r,
    );

    const patchArg = (r.updateScoped as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(patchArg.soulPrompt).toBe("mine");
    expect(String(patchArg.videoPrompt)).toContain("candlelight, flickering shadows");
  });
});

describe("updateProductionShot — promoteCandidateUrl (Phase C keep-N-candidates)", () => {
  it("promotes a known candidate to primary and returns the old primary to candidates — even with an empty patch", async () => {
    const log: string[] = [];
    const r = repo();
    const result = await updateProductionShot(
      ctx,
      { projectId: "p1", shotId: "shot-1", patch: {}, promoteCandidateUrl: "https://example.com/candidate-a.jpg" },
      r,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    const patchArg = (r.updateScoped as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(patchArg.previewImageUrl).toBe("https://example.com/candidate-a.jpg");
    expect(patchArg.candidatePreviewUrls).toEqual([
      "https://example.com/candidate-b.jpg",
      "https://example.com/primary.jpg",
    ]);
    expect(patchArg.updatedAt).toBeInstanceOf(Date);
    // The promote request itself is a canon mutation even with an empty patch.
    expect(log).toEqual(["hook:shot.update"]);
  });

  it("400 — a URL that isn't a known candidate; no write, no hook (old message/order preserved)", async () => {
    const log: string[] = [];
    const r = repo();
    const result = await updateProductionShot(
      ctx,
      { projectId: "p1", shotId: "shot-1", patch: {}, promoteCandidateUrl: "https://example.com/not-a-candidate.jpg" },
      r,
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 400, reason: "Not a known candidate for this shot." });
    expect(r.updateScoped).not.toHaveBeenCalled();
    expect(log).toEqual([]);
  });

  it("no primary yet — the falsy previewImageUrl is never appended to candidates (old `if` verbatim)", async () => {
    const r = repo({ findById: vi.fn(async () => baseShot({ previewImageUrl: "" }) as ProductionShotRow) });
    await updateProductionShot(
      ctx,
      { projectId: "p1", shotId: "shot-1", patch: {}, promoteCandidateUrl: "https://example.com/candidate-b.jpg" },
      r,
    );

    const patchArg = (r.updateScoped as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(patchArg.candidatePreviewUrls).toEqual(["https://example.com/candidate-a.jpg"]);
  });

  it("non-string promoteCandidateUrl (null/undefined) — branch silently skipped, plain patch semantics", async () => {
    const log: string[] = [];
    for (const promote of [null, undefined, 42]) {
      const r = repo();
      const result = await updateProductionShot(
        ctx,
        { projectId: "p1", shotId: "shot-1", patch: {}, promoteCandidateUrl: promote },
        r,
        hooks(log),
      );
      const patchArg = (r.updateScoped as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
      expect(patchArg.previewImageUrl).toBeUndefined();
      expect(patchArg.candidatePreviewUrls).toBeUndefined();
      expect(log).toEqual([]);
      expect(result.ok).toBe(true);
    }
  });

  it("promote + real patch — both mutations land in one write, one hook", async () => {
    const log: string[] = [];
    const r = repo();
    await updateProductionShot(
      ctx,
      { projectId: "p1", shotId: "shot-1", patch: { reviewStatus: "approved" }, promoteCandidateUrl: "https://example.com/candidate-b.jpg" },
      r,
      hooks(log),
    );

    const patchArg = (r.updateScoped as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(patchArg.reviewStatus).toBe("approved");
    expect(patchArg.previewImageUrl).toBe("https://example.com/candidate-b.jpg");
    expect(log.filter((k) => k.includes("shot.update"))).toHaveLength(1);
  });

  it("adapter invariant — the row vanishing between read and write is a 404 refusal, no hook (race window, documented deviation)", async () => {
    const log: string[] = [];
    const r = repo({ updateScoped: vi.fn(async () => null) });
    const result = await updateProductionShot(
      ctx,
      { projectId: "p1", shotId: "shot-1", patch: { reviewStatus: "approved" } },
      r,
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 404, reason: "Shot not found" });
    expect(log).toEqual([]);
  });
});
