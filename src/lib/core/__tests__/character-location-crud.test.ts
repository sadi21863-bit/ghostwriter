import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCharacter,
  updateCharacter,
  deleteCharacter,
  type CharacterCrudRepository,
  type CharacterCreateData,
  type CharacterRow,
} from "@/lib/core/handlers/characters";
import {
  createLocation,
  updateLocation,
  deleteLocation,
  type LocationCrudRepository,
  type LocationRow,
} from "@/lib/core/handlers/locations";
import { cloudContext } from "@/lib/core/request-context";

const ctx = cloudContext("u1");
const hooks = (log: string[] = []) => ({
  onCanonicalMutation: vi.fn(async (projectOrId: string, kind: string) => {
    log.push(`hook:${kind}`);
  }),
});

function characterRepo(overrides: Partial<CharacterCrudRepository> = {}): CharacterCrudRepository {
  return {
    ownsProject: vi.fn(async () => true),
    findProjectFormat: vi.fn(async () => "Novel"),
    create: vi.fn(async (projectId, fields) => ({
      id: "c1",
      projectId,
      name: (fields as { name: string }).name,
      ...fields,
    })),
    findScoped: vi.fn(async () => []),
    updateScoped: vi.fn(async (_projectId, _characterId, patch) => ({
      id: "c1",
      projectId: "p1",
      name: "Mara",
      ...patch,
    }) as CharacterRow),
    deleteScoped: vi.fn(async () => {}),
    ...overrides,
  };
}

function locationRepo(overrides: Partial<LocationCrudRepository> = {}): LocationCrudRepository {
  return {
    ownsProject: vi.fn(async () => true),
    create: vi.fn(async (projectId, fields) => ({
      id: "l1",
      projectId,
      name: (fields as { name: string }).name,
      ...fields,
    })),
    findScoped: vi.fn(async () => []),
    updateScoped: vi.fn(async (_projectId, _locationId, patch) => ({
      id: "l1",
      projectId: "p1",
      name: "The Old Mill",
      ...patch,
    }) as LocationRow),
    deleteScoped: vi.fn(async () => {}),
    ...overrides,
  };
}

const charData = (name = "Mara"): CharacterCreateData => ({
  name,
  role: "Protagonist",
  appearance: "scarred",
  personality: "stubborn",
});
const locData = (name = "The Old Mill") => ({ name, description: "Abandoned" });

beforeEach(() => vi.clearAllMocks());

describe("createCharacter", () => {
  it("403 — refuses when the context is scoped to another project, without touching the repository", async () => {
    const repo = characterRepo();
    const result = await createCharacter(
      cloudContext("u1", { projectScope: "p2" }),
      { projectId: "p1", data: charData() },
      repo,
    );

    expect(result).toEqual({
      ok: false,
      status: 403,
      reason: "Context is not scoped to this project.",
    });
    expect(repo.ownsProject).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("404 — refuses an unowned project and never fires the hook", async () => {
    const log: string[] = [];
    const repo = characterRepo({ ownsProject: vi.fn(async () => false) });
    const result = await createCharacter(ctx, { projectId: "p1", data: charData() }, repo, hooks(log));

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(repo.ownsProject).toHaveBeenCalledWith("p1", "u1");
    expect(repo.create).not.toHaveBeenCalled();
    expect(log).toEqual([]);
  });

  it("201-shaped happy path — inserts with the embedded text, fires hook character.create, no postCreate by default", async () => {
    const log: string[] = [];
    const hook = hooks(log);
    const embedText = vi.fn(async (_text: string) => null);
    const similar = vi.fn();
    const result = await createCharacter(
      ctx,
      { projectId: "p1", data: charData() },
      characterRepo({ findScoped: similar }),
      hook,
      embedText,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.character.id).toBe("c1");
    expect(result.similarEntities).toEqual([]);
    expect(similar).not.toHaveBeenCalled();
    expect(embedText).toHaveBeenCalledWith("Mara. Protagonist. scarred. stubborn");
    expect(log).toEqual(["hook:character.create"]);
  });

  it("duplicate detection — scans the project's other embedded rows and passes matches through", async () => {
    const repo = characterRepo({
      findScoped: vi.fn(async () => [
        { id: "existing", projectId: "p1", name: "Sara", embedding: [1, 0] },
      ]),
    });
    const result = await createCharacter(
      ctx,
      { projectId: "p1", data: charData("Sarah") },
      repo,
      undefined,
      async () => [1, 0],
    );

    expect(result.ok && result.similarEntities).toEqual([
      { id: "existing", name: "Sara", similarity: 1 },
    ]);
    expect(repo.findScoped).toHaveBeenCalledWith("p1", {
      excludeId: "c1",
      onlyWithEmbedding: true,
    });
  });

  it("duplication scan is skipped (fail-open) when the embedding service returns null", async () => {
    const similar = vi.fn();
    await createCharacter(
      ctx,
      { projectId: "p1", data: charData() },
      characterRepo({ findScoped: similar }),
      undefined,
      async () => null,
    );

    expect(similar).not.toHaveBeenCalled();
  });

  it("postCreate — receives the created row and project format only after a scoped write + hook", async () => {
    const log: string[] = [];
    const postCreate = vi.fn((row) => {
      log.push(`post:${row.id}`);
    });
    const result = await createCharacter(
      ctx,
      { projectId: "p1", data: charData() },
      characterRepo(),
      hooks(log),
      async () => null,
      postCreate,
    );

    expect(result.ok).toBe(true);
    expect(log[0]).toBe("hook:character.create");
    expect(log[1]).toBe("post:c1");
    expect(postCreate).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", projectId: "p1", name: "Mara" }), "Novel");
  });

  it("postCreate — never invoked on the refusal paths", async () => {
    const postCreate = vi.fn();
    await createCharacter(
      cloudContext("u1", { projectScope: "p2" }),
      { projectId: "p1", data: charData() },
      characterRepo(),
      undefined,
      undefined,
      postCreate,
    );
    await createCharacter(
      ctx,
      { projectId: "p1", data: charData() },
      characterRepo({ ownsProject: vi.fn(async () => false) }),
      undefined,
      undefined,
      postCreate,
    );

    expect(postCreate).not.toHaveBeenCalled();
  });

  it("adapter invariant — a create that yields no row is a 404 refusal, not an undefined row", async () => {
    const log: string[] = [];
    const result = await createCharacter(
      ctx,
      { projectId: "p1", data: charData() },
      characterRepo({ create: vi.fn(async () => null) }),
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(log).toEqual([]);
  });
});

describe("updateCharacter", () => {
  it("403 — refuses a scope-mismatched context before the repository", async () => {
    const repo = characterRepo();
    const result = await updateCharacter(
      cloudContext("u1", { projectScope: "p2" }),
      { projectId: "p1", characterId: "c1", patch: { name: "Mara" } },
      repo,
    );

    expect(result).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(repo.updateScoped).not.toHaveBeenCalled();
  });

  it("404 — unowned project: no write, no hook", async () => {
    const log: string[] = [];
    const result = await updateCharacter(
      ctx,
      { projectId: "p1", characterId: "c1", patch: { name: "Mara" } },
      characterRepo({ ownsProject: vi.fn(async () => false) }),
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(log).toEqual([]);
  });

  it("404 — no row matched (wrong characterId): updateScoped ran, hook did not", async () => {
    const log: string[] = [];
    const hook = hooks(log);
    const repo = characterRepo({ updateScoped: vi.fn(async () => null) });
    const result = await updateCharacter(ctx, { projectId: "p1", characterId: "c9", patch: { name: "Mara" } }, repo, hook);

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(repo.updateScoped).toHaveBeenCalledWith(
      "p1",
      "c9",
      expect.objectContaining({ name: "Mara" }),
    );
    expect(log).toEqual([]);
  });

  it("happy path — server stamps updatedAt AFTER the patch, hook character.update fires", async () => {
    const log: string[] = [];
    const repo = characterRepo();
    const result = await updateCharacter(
      ctx,
      { projectId: "p1", characterId: "c1", patch: { name: "Mara Voss" } },
      repo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.character.name).toBe("Mara Voss");
    const patchArg = (repo.updateScoped as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(patchArg.updatedAt).toBeInstanceOf(Date);
    expect(patchArg.name).toBe("Mara Voss");
    expect(log).toEqual(["hook:character.update"]);
  });

  it("empty patch — still a touch, but never a canon mutation", async () => {
    const log: string[] = [];
    const repo = characterRepo();
    const result = await updateCharacter(ctx, { projectId: "p1", characterId: "c1", patch: {} }, repo, hooks(log));

    expect(result.ok).toBe(true);
    const patchArg = (repo.updateScoped as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(patchArg.updatedAt).toBeInstanceOf(Date);
    expect(log).toEqual([]);
  });
});

describe("deleteCharacter", () => {
  it("403 — refusal fires no hook and deletes nothing", async () => {
    const log: string[] = [];
    const repo = characterRepo();
    const result = await deleteCharacter(
      cloudContext("u1", { projectScope: "p2" }),
      { projectId: "p1", characterId: "c1" },
      repo,
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(repo.deleteScoped).not.toHaveBeenCalled();
    expect(log).toEqual([]);
  });

  it("happy path — post-delete ordering: the scoped delete runs, THEN the hook", async () => {
    const events: string[] = [];
    const repo = characterRepo({
      deleteScoped: vi.fn(async () => {
        events.push("delete");
      }),
    });
    const result = await deleteCharacter(ctx, { projectId: "p1", characterId: "c1" }, repo, {
      onCanonicalMutation: vi.fn(async () => {
        events.push("hook");
      }),
    });

    expect(result).toEqual({ ok: true });
    expect(events).toEqual(["delete", "hook"]);
  });

  it("404 — unowned project: no delete, no hook", async () => {
    const events: string[] = [];
    const repo = characterRepo({ ownsProject: vi.fn(async () => false) });
    const result = await deleteCharacter(ctx, { projectId: "p1", characterId: "c1" }, repo, {
      onCanonicalMutation: vi.fn(async () => {
        events.push("hook");
      }),
    });

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(repo.deleteScoped).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });
});

describe("createLocation", () => {
  it("403 — refuses a scope-mismatched context", async () => {
    const repo = locationRepo();
    const result = await createLocation(
      cloudContext("u1", { projectScope: "p2" }),
      { projectId: "p1", data: locData() },
      repo,
    );

    expect(result).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("happy path — location embedding text, hook location.create, duplicate scan through the pool", async () => {
    const log: string[] = [];
    const repo = locationRepo({
      findScoped: vi.fn(async () => [{ id: "other", projectId: "p1", name: "Old Mill", embedding: [1, 0] }]),
    });
    const result = await createLocation(
      ctx,
      { projectId: "p1", data: locData("The Old Mill") },
      repo,
      hooks(log),
      async () => [1, 0],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.location.name).toBe("The Old Mill");
    expect(result.similarEntities).toEqual([{ id: "other", name: "Old Mill", similarity: 1 }]);
    expect(repo.findScoped).toHaveBeenCalledWith("p1", {
      excludeId: "l1",
      onlyWithEmbedding: true,
    });
    expect(log).toEqual(["hook:location.create"]);
  });

  it("embedding failure is fail-open: row still created, no scan, hook still fires", async () => {
    const log: string[] = [];
    const similar = vi.fn();
    const result = await createLocation(
      ctx,
      { projectId: "p1", data: locData() },
      locationRepo({ findScoped: similar }),
      hooks(log),
      async () => {
        throw new Error("embeddings down");
      },
    );

    expect(result.ok).toBe(true);
    expect(similar).not.toHaveBeenCalled();
    expect(log).toEqual(["hook:location.create"]);
  });
});

describe("updateLocation / deleteLocation", () => {
  it("update 404 — no row matched: hook never fires", async () => {
    const log: string[] = [];
    const result = await updateLocation(
      ctx,
      { projectId: "p1", locationId: "l9", patch: { description: "x" } },
      locationRepo({ updateScoped: vi.fn(async () => null) }),
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(log).toEqual([]);
  });

  it("update happy — hook location.update fires only for a non-empty patch", async () => {
    const log: string[] = [];
    await updateLocation(ctx, { projectId: "p1", locationId: "l1", patch: { description: "x" } }, locationRepo(), hooks(log));
    expect(log).toEqual(["hook:location.update"]);

    const emptyLog: string[] = [];
    await updateLocation(ctx, { projectId: "p1", locationId: "l1", patch: {} }, locationRepo(), hooks(emptyLog));
    expect(emptyLog).toEqual([]);
  });

  it("delete happy — post-delete ordering, hook location.delete", async () => {
    const events: string[] = [];
    const repo = locationRepo({
      deleteScoped: vi.fn(async () => {
        events.push("delete");
      }),
    });
    const result = await deleteLocation(ctx, { projectId: "p1", locationId: "l1" }, repo, {
      onCanonicalMutation: vi.fn(async () => {
        events.push("hook");
      }),
    });

    expect(result).toEqual({ ok: true });
    expect(events).toEqual(["delete", "hook"]);
  });

  it("delete 403 — refusal before the repository", async () => {
    const repo = locationRepo();
    const result = await deleteLocation(
      cloudContext("u1", { projectScope: "p2" }),
      { projectId: "p1", locationId: "l1" },
      repo,
    );

    expect(result).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(repo.deleteScoped).not.toHaveBeenCalled();
  });
});
