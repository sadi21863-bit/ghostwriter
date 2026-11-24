/**
 * Phase 2 / v4 §7 — the loopback host's own tests.
 *
 * Previous core tests pinned the decorators' properties against request
 * SHAPES. Nothing had bound a real socket, so this file drives a genuinely
 * listening server over Node's own `fetch` (no mocked transport) and asserts
 * the properties a hostile local process or a stray web page would test:
 *
 *  - the bind address is 127.0.0.1, always — that IS the no-egress guarantee;
 *  - the token is per-launch, high-entropy, and absent/short/wrong all 401;
 *  - an unauthorized caller cannot even learn which routes exist (401 before 404);
 *  - foreign Origin 401s; loopback Origin and no-Origin both pass;
 *  - handlers' `{ ok }` unions map to real statuses, and a thrown handler
 *    becomes a 500 WITHOUT leaking its stack;
 *  - oversized and non-JSON bodies get explicit 4xx, not a hang or a 500.
 */

import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLocalHostServer,
  defaultLocalRoutes,
  dispatchLoopback,
  handlerStatus,
  matchRoute,
  type LocalHostOptions,
} from "@/lib/core/local-host";
import type { LocalHost } from "@/lib/core/local-host";
import type { ChapterRow } from "@/lib/core/repositories";
import type { CharacterCrudRepository } from "@/lib/core/handlers/characters";
import type { LocationCrudRepository } from "@/lib/core/handlers/locations";
import type { PlotThreadCrudRepository } from "@/lib/core/handlers/plot-threads";
import type { ReferenceWorkCrudRepository } from "@/lib/core/handlers/reference-works";
import type { WorldEntityCrudRepository } from "@/lib/core/handlers/world-entities";
import type { IntentionalViolationRepository } from "@/lib/core/handlers/intentional-violations";
import type { RelationshipMapRepository } from "@/lib/core/handlers/relationship-map";
import type { ProjectsCoreRepository } from "@/lib/core/handlers/projects";
import type {
  ComicPageCrudRepository,
  ComicPageRow,
  ComicPanelCrudRepository,
  ComicPanelRow,
} from "@/lib/core/handlers/comics";
import type { ProductionShotCrudRepository, ProductionShotRow } from "@/lib/core/handlers/production-shots";
import type { StoryStateRepository, StoryPromiseRow, StoryThreadRow } from "@/lib/core/handlers/story-state";
import type { StoryMemoryRepository, StoryMemoryRow } from "@/lib/core/handlers/story-memories";
import type { StoryGraphRepository } from "@/lib/core/handlers/story-graph";
import type { StoryCheckpointRepository, StoryCheckpointRow } from "@/lib/core/handlers/story-checkpoints";
import type { StoryPlanRepository, StoryPlanRow } from "@/lib/core/handlers/story-plans";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_SRC = resolve(HERE, "../local-host.ts");
const SRC = readFileSync(SERVER_SRC, "utf8");

const ownedServers: LocalHost[] = [];
afterAll(async () => {
  await Promise.all(ownedServers.map((s) => s.close().catch(() => undefined)));
});

/** Boot a server with default routes over fabricated repositories. */
async function bootServer(
  overrides: Partial<Omit<LocalHostOptions, "routes">> = {},
  extraDeps: Partial<Parameters<typeof defaultLocalRoutes>[0]> = {},
): Promise<LocalHost> {
  const routes = defaultLocalRoutes({
    chapterRepo: {
      ownsProject: async (_p, actor) => _p === "proj-1" && actor === "local",
      updateScoped: async (_p, chapterId, patch) =>
        ({ id: chapterId, projectId: _p, ...(patch as object) } as unknown as ChapterRow),
      deleteScoped: async () => undefined,
    },
    storyBibleRepo: {
      ownsProject: async () => true,
      readSections: async () => ({ characters: [{ id: "c1", name: "Mara" }] }),
    },
    storyTransactionRepo: {
      ownsProject: async () => true,
      record: async () => undefined,
      applyChanges: async () => undefined,
    },
    ...extraDeps,
  });
  const host = await createLocalHostServer({ routes, ...overrides });
  ownedServers.push(host);
  return host;
}

function authed(host: LocalHost): globalThis.RequestInit {
  return {
    headers: { authorization: `Bearer ${host.token}` },
  };
}

describe("local-host binding", () => {
  it("binds 127.0.0.1 only — the no-egress guarantee IS the bind", async () => {
    const host = await bootServer();
    const addr = host.server.address();
    expect(addr && typeof addr === "object" && addr.address).toBe("127.0.0.1");
    expect(host.host).toBe("127.0.0.1");
  });

  it("mints a per-launch high-entropy token, different every launch", async () => {
    const a = await bootServer();
    const b = await bootServer();
    expect(a.token.length).toBeGreaterThanOrEqual(32);
    expect(b.token.length).toBeGreaterThanOrEqual(32);
    expect(a.token).not.toBe(b.token);
  });

  it("refuses to boot with a caller-supplied short token", async () => {
    await expect(
      createLocalHostServer({ token: "short", routes: [] }),
    ).rejects.toThrow(/at least 32 characters/);
  });
});

describe("local-host authentication", () => {
  let host: LocalHost;
  beforeAll(async () => {
    host = await bootServer();
  });

  it("401s a request with no Authorization header", async () => {
    const res = await fetch(`${host.origin}/projects/proj-1/story-bible`);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("401s a wrong token", async () => {
    const res = await fetch(`${host.origin}/projects/proj-1/story-bible`, {
      headers: { authorization: `Bearer ${"x".repeat(64)}` },
    });
    expect(res.status).toBe(401);
  });

  it("401s a short token even if some other host reused it", async () => {
    const res = await fetch(`${host.origin}/projects/proj-1/story-bible`, {
      headers: { authorization: "Bearer shorttoken" },
    });
    expect(res.status).toBe(401);
  });

  it("401s before routing — an unauthorized caller learns no route list", async () => {
    const unauth = await fetch(`${host.origin}/definitely-not-a-real-route`);
    expect(unauth.status).toBe(401);
    expect(unauth.status).not.toBe(404);
  });

  it("serves an authorized request end-to-end over a real socket", async () => {
    const res = await fetch(`${host.origin}/projects/proj-1/story-bible`, {
      headers: { authorization: `Bearer ${host.token}` },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; bible: { contentRevision: unknown; sections: { characters: unknown[] } } };
    expect(json.ok).toBe(true);
    expect(json.bible.sections.characters).toHaveLength(1);
    // §11: the revision stays null until Phase 5A — "unknown" is distinct from "zero".
    expect(json.bible.contentRevision).toBeNull();
  });
});

describe("local-host origin policy", () => {
  let host: LocalHost;
  beforeAll(async () => {
    host = await bootServer();
  });

  it("401s a foreign Origin (a web page must not drive the local host)", async () => {
    const res = await fetch(`${host.origin}/projects/proj-1/story-bible`, {
      headers: { ...authed(host).headers, origin: "https://evil.example" },
    });
    expect(res.status).toBe(401);
  });

  it("allows a loopback Origin", async () => {
    const res = await fetch(`${host.origin}/projects/proj-1/story-bible`, {
      headers: { ...authed(host).headers, origin: "http://localhost:3001" },
    });
    expect(res.status).toBe(200);
  });

  it("allows no Origin at all (non-browser clients legitimately omit it)", async () => {
    const res = await fetch(`${host.origin}/projects/proj-1/story-bible`, authed(host));
    expect(res.status).toBe(200);
  });
});

describe("local-host routing and error mapping", () => {
  let host: LocalHost;
  beforeAll(async () => {
    host = await bootServer();
  });

  it("404s an unknown path for an AUTHORIZED caller (auth checked first)", async () => {
    const res = await fetch(`${host.origin}/nope`, authed(host));
    expect(res.status).toBe(404);
  });

  it("404s a known path with the wrong method", async () => {
    const res = await fetch(`${host.origin}/projects/proj-1/story-bible`, {
      method: "POST",
      ...authed(host),
    });
    expect(res.status).toBe(404);
  });

  it("does not prefix-swallow: a longer URL is not a shorter route", () => {
    const routes = [{ method: "GET", path: "/a", handle: () => 1 }];
    expect(matchRoute(routes[0]!, "GET", "/a/b/c")).toBeNull();
  });

  it("accepts a caller-supplied explicit port", async () => {
    const host2 = await bootServer({ port: 0 });
    expect(host2.port).toBeGreaterThan(0);
  });

  it("maps a thrown handler to 500 without leaking the stack", async () => {
    const throwing = await createLocalHostServer({
      token: "t".repeat(64),
      routes: [{ method: "GET", path: "/boom", handle: () => { throw new Error("secret-stack-leak"); } }],
    });
    ownedServers.push(throwing);
    const res = await fetch(`${throwing.origin}/boom`, {
      headers: { authorization: `Bearer ${throwing.token}` },
    });
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string; message?: string };
    expect(json.error).toBe("internal_error");
    expect(JSON.stringify(json)).not.toContain("secret-stack-leak");
  });

  it("carries handler failure statuses verbatim (403/404/422)", async () => {
    expect(handlerStatus({ ok: false, status: 403, reason: "x" })).toBe(403);
    expect(handlerStatus({ ok: true })).toBe(200);
    // A status-less failure maps to 500, never to a silent success.
    expect(handlerStatus({ ok: false })).toBe(500);
  });
});

describe("local-host request bodies", () => {
  let host: LocalHost;
  beforeAll(async () => {
    host = await bootServer({ maxBodyBytes: 64 });
  });

  it("413s an oversized body instead of hanging the parser", async () => {
    const res = await fetch(`${host.origin}/projects/proj-1/chapters/ch1`, {
      method: "PATCH",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ patch: { title: "y".repeat(200) } }),
    });
    expect(res.status).toBe(413);
  });

  it("400s a non-JSON body", async () => {
    const res = await fetch(`${host.origin}/projects/proj-1/chapters/ch1`, {
      method: "PATCH",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: "this is { not json",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "bad_request" });
  });

  it("PATCHes a chapter through the real route and shells non-writable fields", async () => {
    const res = await fetch(`${host.origin}/projects/proj-1/chapters/ch1`, {
      method: "PATCH",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ patch: { title: "New", embedding: "attacker-controlled" } }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; chapter: Record<string, unknown>; droppedFields: string[] };
    expect(json.ok).toBe(true);
    expect(json.chapter.title).toBe("New");
    // The mass-assignment guarantee, now served by the local host too.
    expect(json.droppedFields).toContain("embedding");
  });
});

describe("local-host dispatch unit level", () => {
  it("401s in dispatch too — the decorator contract holds without a socket", async () => {
    const out = await dispatchLoopback(
      { method: "GET", path: "/x", headers: { authorization: null, origin: null }, body: null },
      { expectedToken: "t".repeat(64), routes: [] },
    );
    expect(out.status).toBe(401);
  });

  it("401s a correct-length but WRONG token — the value must match, not just entropy", async () => {
    // Negative control for the comparison itself: this failed before the
    // decorator ever compared values (any 32+ char string was accepted), which
    // is what a shape-only test could never have caught.
    const routes = [
      { method: "GET", path: "/a", handle: () => ({ ok: true }) },
    ];
    const good = await dispatchLoopback(
      { method: "GET", path: "/a", headers: { authorization: `Bearer ${"t".repeat(64)}`, origin: null }, body: null },
      { expectedToken: "t".repeat(64), routes },
    );
    expect(good.status).toBe(200);
    const wrong = await dispatchLoopback(
      { method: "GET", path: "/a", headers: { authorization: `Bearer ${"x".repeat(64)}`, origin: null }, body: null },
      { expectedToken: "t".repeat(64), routes },
    );
    expect(wrong.status).toBe(401);
  });

  it("fails closed when the host forgot its own token", async () => {
    // A host with no expected token must not authenticate everything.
    // TS guards the type; the runtime guard mirrors it for JS callers.
    const out = await dispatchLoopback(
      {
        method: "GET",
        path: "/a",
        headers: { authorization: `Bearer ${"t".repeat(64)}`, origin: null },
        body: null,
      },
      { expectedToken: undefined as unknown as string, routes: [{ method: "GET", path: "/a", handle: () => ({ ok: true }) }] },
    );
    expect(out.status).toBe(401);
  });

  it("applies projectScope to every request it serves", async () => {
    // A scoped host must hand the handler a scoped context; the handler's own
    // guard then refuses other projects with 403.
    const routes = defaultLocalRoutes({
      chapterRepo: {
        ownsProject: async () => true,
        updateScoped: async () => null,
        deleteScoped: async () => undefined,
      },
      storyBibleRepo: {
        ownsProject: async () => true,
        readSections: async () => ({}),
      },
      storyTransactionRepo: {
        ownsProject: async () => true,
        record: async () => undefined,
        applyChanges: async () => undefined,
      },
    });
    const out = await dispatchLoopback(
      {
        method: "GET",
        path: "/projects/other-project/story-bible",
        headers: { authorization: "Bearer " + "t".repeat(64), origin: null },
        body: null,
      },
      { expectedToken: "t".repeat(64), routes, projectScope: "proj-1" },
    );
    expect(out.status).toBe(403);
  });
});

describe("local-host source hygiene", () => {
  it("imports no transport libraries — same rule as request-context", () => {
    expect(SRC).not.toMatch(/from\s+["'](next|next\/server|next-auth|@\/db)["']/);
    expect(SRC).not.toMatch(/getRequiredSession/);
  });

  it("never hands its token to the handler context", () => {
    // The token is a transport credential. The ctx construction must not
    // reference it, so a future handler can never see its own auth material.
    const ctxLine = (SRC.match(/const ctx = localContext\([^\n]*/) ?? [""])[0];
    expect(ctxLine).toContain("localContext(");
    expect(ctxLine).not.toContain("token");
  });
});

describe("story-history routes (§13.1 slice 2)", () => {
  it("501-free degradation: GET list without storyHistoryRepo configured answers 501", async () => {
    const host = await bootServer();
    const res = await fetch(`${host.origin}/projects/proj-1/story-transactions`, authed(host));
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "Story history is not configured for this host.",
    });
  });

  it("200s the list with a stubbed storyHistoryRepo, transaction summarized verbatim", async () => {
    const tx = {
      id: "tx_1",
      source: "model-proposal" as const,
      createdAt: new Date(0),
      changes: [
        { entityKey: "characters" as const, entityId: "c1", field: "desires", oldValue: "", newValue: "escape" },
      ],
    };
    const host = await bootServer(
      {},
      {
        storyHistoryRepo: {
          ownsProject: async () => true,
          listTransactions: async () => [tx],
          getTransaction: async () => null,
          revertChanges: async () => [],
        },
      },
    );
    const res = await fetch(`${host.origin}/projects/proj-1/story-transactions`, authed(host));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      count: 1,
      transactions: [{ ...tx, createdAt: new Date(0).toISOString() }],
    });
  });

  it("404s an unknown transaction id within an owned project", async () => {
    const host = await bootServer(
      {},
      {
        storyHistoryRepo: {
          ownsProject: async () => true,
          listTransactions: async () => [],
          getTransaction: async () => null,
          revertChanges: async () => [],
        },
      },
    );
    const res = await fetch(
      `${host.origin}/projects/proj-1/story-transactions/tx_404`,
      authed(host),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, status: 404, reason: "Not found" });
  });

  it("200s a clean revert and fires onCanonicalMutation with the revert kind", async () => {
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => undefined);
    const change = {
      entityKey: "characters" as const,
      entityId: "c1",
      field: "desires",
      oldValue: "",
      newValue: "escape",
    };
    const host = await bootServer(
      {},
      {
        hooks: { onCanonicalMutation },
        storyHistoryRepo: {
          ownsProject: async () => true,
          listTransactions: async () => [],
          getTransaction: async () => ({
            id: "tx_1",
            source: "model-proposal" as const,
            createdAt: new Date(0),
            changes: [change],
          }),
          revertChanges: async () => [],
        },
      },
    );
    const res = await fetch(
      `${host.origin}/projects/proj-1/story-transactions/tx_1/revert`,
      { method: "POST", ...authed(host) },
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
    expect(onCanonicalMutation).toHaveBeenCalledWith("proj-1", "storyTransaction.revert");
  });

  it("409s a later-edit conflict and never fires the hook", async () => {
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => undefined);
    const host = await bootServer(
      {},
      {
        hooks: { onCanonicalMutation },
        storyHistoryRepo: {
          ownsProject: async () => true,
          listTransactions: async () => [],
          getTransaction: async () => ({
            id: "tx_1",
            source: "model-proposal" as const,
            createdAt: new Date(0),
            changes: [
              {
                entityKey: "characters" as const,
                entityId: "c1",
                field: "desires",
                oldValue: "",
                newValue: "escape",
              },
            ],
          }),
          revertChanges: async () => [
            {
              entityKey: "characters" as const,
              entityId: "c1",
              field: "desires",
              current: "settled down instead",
            },
          ],
        },
      },
    );
    const res = await fetch(
      `${host.origin}/projects/proj-1/story-transactions/tx_1/revert`,
      { method: "POST", ...authed(host) },
    );
    expect(res.status).toBe(409);
    const json = (await res.json()) as { reason: string; conflicts: { field: string }[] };
    expect(json.reason).toBe("Later edits conflict with this revert; nothing was changed.");
    expect(json.conflicts[0]?.field).toBe("desires");
    expect(onCanonicalMutation).not.toHaveBeenCalled();
  });
});

/**
 * §7 wave 2 — the migrated World Bible / projects clusters over real routes.
 * Per cluster: (a) 501 when the optional dep is omitted, (b) one happy path
 * through the real handler with a stub dep, (c) one 404 (or edge-400) pin —
 * mirroring the story-history entries' style exactly.
 */
describe("world-entity + intentional-violation route clusters (§7 wave 2)", () => {
  function stubWorldEntities(over: Partial<WorldEntityCrudRepository> = {}): WorldEntityCrudRepository {
    return {
      ownsProject: async (projectId) => projectId === "proj-1",
      create: async (projectId, fields) => ({
        id: "we-1",
        projectId,
        kind: String(fields["kind"]),
        name: String(fields["name"]),
      }),
      findScoped: async () => [],
      updateScoped: async (projectId, entityId) => ({
        id: entityId,
        projectId,
        kind: "object",
        name: "Ride",
      }),
      deleteScoped: async () => undefined,
      ...over,
    };
  }

  function stubViolations(over: Partial<IntentionalViolationRepository> = {}): IntentionalViolationRepository {
    return {
      ownsProject: async (projectId) => projectId === "proj-1",
      readAcknowledgements: async () => ({
        pedophilia: { confirmed: true, purpose: "dark thriller", timestamp: new Date(0).toISOString() },
      }),
      recordAcknowledgement: async () => undefined,
      ...over,
    };
  }

  it("501-free degradation: GET world-entities without worldEntityRepo answers 501", async () => {
    const host = await bootServer();
    const res = await fetch(`${host.origin}/projects/proj-1/world-entities`, authed(host));
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "World entity storage is not configured for this host.",
    });
  });

  it("200s a world-entity create through the real handler, kind normalized + embed seam wired", async () => {
    const create = vi.fn(async (_projectId: string, fields: Record<string, unknown>) => ({
      id: "we-1",
      projectId: _projectId,
      kind: String(fields["kind"]),
      name: String(fields["name"]),
    }));
    const host = await bootServer(
      {},
      {
        // An in-test embedding provider to prove the DI seam flows: the scan
        // pool then contains one identical-vector row, which the fixture's own
        // cosineSimilarity scores at exactly 1 — above the 0.87 bar.
        createEmbedText: async () => [1, 0],
        worldEntityRepo: stubWorldEntities({
          create: create as unknown as WorldEntityCrudRepository["create"],
          findScoped: async () => [
            { id: "we-0", projectId: "proj-1", kind: "weapon", name: "Wagon deck (old)", embedding: [1, 0] },
          ],
        }),
      },
    );
    const res = await fetch(`${host.origin}/projects/proj-1/world-entities`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "Wagon deck", kind: "weapon", properties: {} }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      entity: { id: string };
      similarEntities: { id: string; similarity: number }[];
    };
    expect(json.ok).toBe(true);
    expect(json.entity.id).toBe("we-1");
    expect(json.similarEntities).toEqual([
      { id: "we-0", name: "Wagon deck (old)", similarity: 1 },
    ]);
    // The body's kind survives normalization into the stored fields.
    expect(create).toHaveBeenCalledWith(
      "proj-1",
      expect.objectContaining({ kind: "weapon" }),
    );
  });

  it("400s a name-less world-entity create — the edge guard the cloud route kept", async () => {
    const host = await bootServer({}, { worldEntityRepo: stubWorldEntities() });
    const res = await fetch(`${host.origin}/projects/proj-1/world-entities`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ properties: {} }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, status: 400, reason: "name is required" });
  });

  it("404s a world-entity patch against another project's entityId", async () => {
    const host = await bootServer(
      {},
      { worldEntityRepo: stubWorldEntities({ updateScoped: async () => null }) },
    );
    const res = await fetch(`${host.origin}/projects/proj-1/world-entities/we-lonely`, {
      method: "PATCH",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "Renamed" }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, status: 404, reason: "Not found" });
  });

  it("501s the intentional-violation read when violationRepo is omitted", async () => {
    const host = await bootServer();
    const res = await fetch(`${host.origin}/projects/proj-1/intentional-violation`, authed(host));
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "Intentional violation storage is not configured for this host.",
    });
  });

  it("200s an acknowledgement through the real handler and fires violation.acknowledge", async () => {
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => undefined);
    const record = vi.fn(async (_projectId: string, _payload: unknown) => undefined);
    const host = await bootServer(
      {},
      {
        hooks: { onCanonicalMutation },
        violationRepo: stubViolations({
          recordAcknowledgement: record as unknown as IntentionalViolationRepository["recordAcknowledgement"],
        }),
      },
    );
    const res = await fetch(`${host.origin}/projects/proj-1/intentional-violation`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ violationType: "violence", purpose: "war story" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()) as { ok: boolean }).toEqual({ ok: true });
    expect(record).toHaveBeenCalled();
    expect(onCanonicalMutation).toHaveBeenCalledWith("proj-1", "violation.acknowledge");
  });

  it("404s the acknowledgement read on a project the actor does not own", async () => {
    const host = await bootServer({}, { violationRepo: stubViolations() });
    const res = await fetch(
      `${host.origin}/projects/not-mine/intentional-violation`,
      authed(host),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, status: 404, reason: "Not found" });
  });
});

describe("character + location route clusters (§7 wave 2)", () => {
  function stubCharacters(over: Partial<CharacterCrudRepository> = {}): CharacterCrudRepository {
    return {
      ownsProject: async (projectId) => projectId === "proj-1",
      findProjectFormat: async () => "Novel",
      create: async (projectId, fields) => ({
        id: "char-1",
        projectId,
        name: String((fields as { name?: unknown })["name"]),
      }),
      findScoped: async () => [],
      updateScoped: async (projectId, characterId) => ({
        id: characterId,
        projectId,
        name: "Whomever",
      }),
      deleteScoped: async () => undefined,
      ...over,
    };
  }

  function stubLocations(over: Partial<LocationCrudRepository> = {}): LocationCrudRepository {
    return {
      ownsProject: async (projectId) => projectId === "proj-1",
      create: async (projectId, fields) => ({
        id: "loc-1",
        projectId,
        name: String((fields as { name?: unknown })["name"]),
      }),
      findScoped: async () => [],
      updateScoped: async (projectId, locationId) => ({
        id: locationId,
        projectId,
        name: "Somewhere",
      }),
      deleteScoped: async () => undefined,
      ...over,
    };
  }

  it("501s a character create when characterRepo is omitted", async () => {
    const host = await bootServer();
    const res = await fetch(`${host.origin}/projects/proj-1/characters`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "Mara" }),
    });
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "Character storage is not configured for this host.",
    });
  });

  it("200s a character create through the real handler (no embedding → no scan)", async () => {
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => undefined);
    const host = await bootServer(
      {},
      {
        hooks: { onCanonicalMutation },
        characterRepo: stubCharacters(),
      },
    );
    const res = await fetch(`${host.origin}/projects/proj-1/characters`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "Kessler" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      character: { id: string; name: string };
      similarEntities: unknown[];
    };
    expect(json.ok).toBe(true);
    expect(json.character).toMatchObject({ id: "char-1", name: "Kessler" });
    // The default fail-open seam stores no embedding, so the duplicate scan
    // pool stays empty and similarEntities is [].
    expect(json.similarEntities).toEqual([]);
    expect(onCanonicalMutation).toHaveBeenCalledWith("proj-1", "character.create");
  });

  it("404s a character patch against another project's characterId", async () => {
    const host = await bootServer(
      {},
      { characterRepo: stubCharacters({ updateScoped: async () => null }) },
    );
    const res = await fetch(`${host.origin}/projects/proj-1/characters/char-lonely`, {
      method: "PATCH",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "Renamed" }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, status: 404, reason: "Not found" });
  });

  it("501s a location create when locationRepo is omitted", async () => {
    const host = await bootServer();
    const res = await fetch(`${host.origin}/projects/proj-1/locations`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "The Track" }),
    });
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "Location storage is not configured for this host.",
    });
  });

  it("200s a location create through the real handler", async () => {
    const host = await bootServer({}, { locationRepo: stubLocations() });
    const res = await fetch(`${host.origin}/projects/proj-1/locations`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "Coaster Station" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      location: { id: string; name: string };
      similarEntities: unknown[];
    };
    expect(json.ok).toBe(true);
    expect(json.location).toMatchObject({ id: "loc-1", name: "Coaster Station" });
    expect(json.similarEntities).toEqual([]);
  });

  it("404s a location patch against another project's locationId", async () => {
    const host = await bootServer(
      {},
      { locationRepo: stubLocations({ updateScoped: async () => null }) },
    );
    const res = await fetch(`${host.origin}/projects/proj-1/locations/loc-lonely`, {
      method: "PATCH",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "Renamed" }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, status: 404, reason: "Not found" });
  });
});

describe("plot-thread + reference-work + relationship-map clusters (§7 wave 2)", () => {
  function stubThreads(over: Partial<PlotThreadCrudRepository> = {}): PlotThreadCrudRepository {
    return {
      ownsProject: async (projectId) => projectId === "proj-1",
      create: async (projectId, data) => ({ id: "thread-1", projectId, name: data.name }),
      findScoped: async () => null,
      updateScoped: async (projectId, threadId) => ({
        id: threadId,
        projectId,
        name: "Thread",
      }),
      deleteScoped: async () => undefined,
      ...over,
    };
  }

  function stubReferenceWorks(over: Partial<ReferenceWorkCrudRepository> = {}): ReferenceWorkCrudRepository {
    return {
      ownsProject: async (projectId) => projectId === "proj-1",
      create: async (projectId, data) => ({ id: "ref-1", projectId, title: data.title }),
      deleteScoped: async () => undefined,
      ...over,
    };
  }

  function stubRelationships(over: Partial<RelationshipMapRepository> = {}): RelationshipMapRepository {
    return {
      ownsProject: async (projectId) => projectId === "proj-1",
      readGraph: async () => ({
        nodes: [{ id: "c1", name: "Mara", role: null, portraitUrl: null }],
        edges: [],
        isolated: [],
      }),
      upsertRelationships: async () => null,
      ...over,
    };
  }

  it("501s a plot-thread create when plotThreadRepo is omitted", async () => {
    const host = await bootServer();
    const res = await fetch(`${host.origin}/projects/proj-1/plot-threads`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "Dead Man's Hand" }),
    });
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "Plot thread storage is not configured for this host.",
    });
  });

  it("200s a plot-thread create through the real handler", async () => {
    const host = await bootServer({}, { plotThreadRepo: stubThreads() });
    const res = await fetch(`${host.origin}/projects/proj-1/plot-threads`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "The Ride Never Ends", status: "Simmering" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      thread: { id: string; name: string };
    };
    expect(json.ok).toBe(true);
    expect(json.thread).toMatchObject({ id: "thread-1", name: "The Ride Never Ends" });
  });

  it("404s a plot-thread patch against another project's threadId", async () => {
    const host = await bootServer(
      {},
      { plotThreadRepo: stubThreads({ updateScoped: async () => null }) },
    );
    const res = await fetch(`${host.origin}/projects/proj-1/plot-threads/thread-lonely`, {
      method: "PATCH",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "Renamed" }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, status: 404, reason: "Not found" });
  });

  it("501s a reference-work create when referenceWorkRepo is omitted", async () => {
    const host = await bootServer();
    const res = await fetch(`${host.origin}/projects/proj-1/reference-works`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ title: "Dune" }),
    });
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "Reference work storage is not configured for this host.",
    });
  });

  it("200s a reference-work create through the real handler", async () => {
    const host = await bootServer({}, { referenceWorkRepo: stubReferenceWorks() });
    const res = await fetch(`${host.origin}/projects/proj-1/reference-works`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ title: "Dune", attributes: { voice: "measured" } }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      reference: { id: string; title: string };
    };
    expect(json.ok).toBe(true);
    expect(json.reference).toMatchObject({ id: "ref-1", title: "Dune" });
  });

  it("404s a reference-work delete on a project the actor does not own", async () => {
    const host = await bootServer({}, { referenceWorkRepo: stubReferenceWorks() });
    const res = await fetch(`${host.origin}/projects/not-mine/reference-works/ref-1`, {
      method: "DELETE",
      ...authed(host),
    });
    // Ownership is re-proved by the handler, so a foreign project 404s even
    // though the DELETE adapter itself is fire-and-forget.
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, status: 404, reason: "Not found" });
  });

  it("501s the relationship-map read when relationshipMapRepo is omitted", async () => {
    const host = await bootServer();
    const res = await fetch(`${host.origin}/projects/proj-1/relationship-map`, authed(host));
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "Relationship map storage is not configured for this host.",
    });
  });

  it("200s the relationship-map graph through the real handler", async () => {
    const host = await bootServer({}, { relationshipMapRepo: stubRelationships() });
    const res = await fetch(`${host.origin}/projects/proj-1/relationship-map`, authed(host));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      graph: {
        nodes: [{ id: "c1", name: "Mara", role: null, portraitUrl: null }],
        edges: [],
        isolated: [],
      },
    });
  });

  it("404s a relationship-map upsert whose row vanishes between read and write", async () => {
    // upsertRelationships already returns null in the stub: the handler shapes
    // the vanished-row outcome as the same 404 business error.
    const host = await bootServer({}, { relationshipMapRepo: stubRelationships() });
    const res = await fetch(`${host.origin}/projects/proj-1/relationship-map`, {
      method: "PATCH",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ characterAId: "c1", characterBId: "c2" }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, status: 404, reason: "Not found" });
  });
});

describe("projects route cluster (§7 wave 2)", () => {
  function stubProjects(over: Partial<ProjectsCoreRepository> = {}): ProjectsCoreRepository {
    return {
      ownsProject: async (projectId) => projectId === "proj-1",
      listForUser: async () => [{ id: "proj-1", name: "The Ride Never Ends" }],
      countForUser: async () => 0,
      create: async (actorId, data) => ({ id: "proj-new", userId: actorId, ...(data as object) }),
      read: async () => ({ id: "proj-1", userId: "local" }),
      updateScoped: async (projectId, patch) => ({ id: projectId, userId: "local", ...(patch as object) }),
      deleteScoped: async () => undefined,
      ...over,
    };
  }

  it("501s the project list when projectsCoreRepo is omitted", async () => {
    const host = await bootServer();
    const res = await fetch(`${host.origin}/projects`, authed(host));
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "Project storage is not configured for this host.",
    });
  });

  it("200s GET /projects through a stubbed projectsCoreRepo", async () => {
    const host = await bootServer({}, { projectsCoreRepo: stubProjects() });
    const res = await fetch(`${host.origin}/projects`, authed(host));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      projects: [{ id: "proj-1", name: "The Ride Never Ends" }],
    });
  });

  it("creates a project through the tier cap — getTier + §11 hook wired", async () => {
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => undefined);
    const create = vi.fn(async (_actorId: string, _data: unknown) => ({
      id: "proj-new",
      userId: _actorId,
    }));
    const host = await bootServer(
      {},
      {
        hooks: { onCanonicalMutation },
        projectsCoreRepo: stubProjects({ create }),
        // all_access carries a -1 cap: the count is skipped entirely.
        getTier: async () => "all_access",
      },
    );
    const res = await fetch(`${host.origin}/projects`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "New", format: "Screenplay" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; project: { id: string } };
    expect(json.ok).toBe(true);
    expect(json.project.id).toBe("proj-new");
    // The create defaults ride along (b.format || "Novel").
    expect(create).toHaveBeenCalledWith(
      "local",
      expect.objectContaining({ name: "New", format: "Screenplay" }),
    );
    expect(onCanonicalMutation).toHaveBeenCalledWith("proj-new", "project.create");
  });

  it("404s PATCH /projects/:projectId for a project the actor does not own", async () => {
    const host = await bootServer({}, { projectsCoreRepo: stubProjects() });
    const res = await fetch(`${host.origin}/projects/not-mine`, {
      method: "PATCH",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "hijack" }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, status: 404, reason: "Not found" });
  });
});

describe("comic page/panel routes (§7 wave 3)", () => {
  function stubComicPages(over: Partial<ComicPageCrudRepository> = {}): ComicPageCrudRepository {
    return {
      ownsProject: async (projectId) => projectId === "proj-1",
      countByProject: async () => 2,
      listWithPanels: async () => [],
      create: async (projectId, fields) =>
        ({ id: "pg-new", projectId, ...fields } as unknown as ComicPageRow),
      deleteScoped: async () => undefined,
      ...over,
    };
  }

  function stubComicPanels(over: Partial<ComicPanelCrudRepository> = {}): ComicPanelCrudRepository {
    const current: ComicPanelRow = {
      id: "pn-1",
      pageId: "pg-1",
      projectId: "proj-1",
      panelIndex: 0,
      imageUrl: "old",
      panelPrompt: "p",
      candidateImageUrls: ["cand-1", "cand-2"],
    };
    return {
      ownsProject: async (projectId) => projectId === "proj-1",
      findScoped: async () => current,
      create: async () => current,
      updateScoped: async (_projectId, _panelId, patch) => ({ ...current, ...patch }),
      ...over,
    };
  }

  it("501s the comic list when comicPageRepo is omitted", async () => {
    const host = await bootServer();
    const res = await fetch(`${host.origin}/projects/proj-1/comics`, authed(host));
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "Comic page storage is not configured for this host.",
    });
  });

  it("creates the next comic page through the pageNumber rule — §11 hook wired", async () => {
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => undefined);
    const host = await bootServer(
      {},
      {
        hooks: { onCanonicalMutation },
        comicPageRepo: stubComicPages(),
        comicPanelRepo: stubComicPanels(),
      },
    );
    const res = await fetch(`${host.origin}/projects/proj-1/comics`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ chapterId: "ch-3", artStyle: "manga", soulPrompt: "HACK" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; page: ComicPageRow };
    expect(json.ok).toBe(true);
    // Two existing pages → pageNumber 3 (the pre-migration rule verbatim),
    // the create allowlist held (soulPrompt never reached the repo), and the
    // canonical bump fired once the insert ran.
    expect(json.page.pageNumber).toBe(3);
    expect(json.page.chapterId).toBe("ch-3");
    expect(json.page.artStyle).toBe("manga");
    expect(json.page).not.toHaveProperty("soulPrompt");
    expect(onCanonicalMutation).toHaveBeenCalledWith("proj-1", "comicPage.create");
  });

  it("promotes a panel candidate — the Phase-C swap runs with §11 comicPanel.update", async () => {
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => undefined);
    const host = await bootServer(
      {},
      {
        hooks: { onCanonicalMutation },
        comicPageRepo: stubComicPages(),
        comicPanelRepo: stubComicPanels(),
      },
    );
    const res = await fetch(`${host.origin}/projects/proj-1/comics/pg-1/panels/pn-1`, {
      method: "PATCH",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ promoteCandidateUrl: "cand-1" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; panel: ComicPanelRow };
    expect(json.ok).toBe(true);
    // Promoted candidate becomes the primary, the old primary goes back into
    // the candidates array — the exact swap mechanics.
    expect(json.panel.imageUrl).toBe("cand-1");
    expect(json.panel.candidateImageUrls).toEqual(["cand-2", "old"]);
    expect(onCanonicalMutation).toHaveBeenCalledWith("proj-1", "comicPanel.update");
  });

  it("refuses an unknown panel candidate with the route's exact 400", async () => {
    const updateScoped = vi.fn();
    const host = await bootServer(
      {},
      { comicPageRepo: stubComicPages(), comicPanelRepo: stubComicPanels({ updateScoped }) },
    );
    const res = await fetch(`${host.origin}/projects/proj-1/comics/pg-1/panels/pn-1`, {
      method: "PATCH",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ promoteCandidateUrl: "ghost" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      status: 400,
      reason: "Not a known candidate for this panel.",
    });
    // Nothing was written — the refusal happens before any update.
    expect(updateScoped).not.toHaveBeenCalled();
  });

  it("404s a comic page DELETE for a project the actor does not own", async () => {
    const host = await bootServer(
      {},
      { comicPageRepo: stubComicPages(), comicPanelRepo: stubComicPanels() },
    );
    const res = await fetch(`${host.origin}/projects/not-mine/comics/pg-1`, {
      method: "DELETE",
      headers: authed(host).headers,
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, status: 404, reason: "Not found" });
  });
});

describe("production shot routes (§7 wave 3)", () => {
  const baseShot: ProductionShotRow = { id: "shot-1", projectId: "proj-1", reviewStatus: "pending" };

  function stubShots(over: Partial<ProductionShotCrudRepository> = {}): ProductionShotCrudRepository {
    return {
      ownsProject: async (projectId) => projectId === "proj-1",
      findById: async (projectId, shotId) =>
        projectId === "proj-1" && shotId === "shot-1" ? baseShot : null,
      list: async () => [baseShot],
      updateScoped: async (_projectId, _shotId, patch) => ({ ...baseShot, ...patch }),
      ...over,
    };
  }

  it("501s the shot list when productionShotRepo is omitted", async () => {
    const host = await bootServer();
    const res = await fetch(`${host.origin}/projects/proj-1/production/shots`, authed(host));
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "Production shot storage is not configured for this host.",
    });
  });

  it("PATCHes a shot through the allowlist — fields land, updatedAt stamped, §11 shot.update fires", async () => {
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => undefined);
    const host = await bootServer({}, { hooks: { onCanonicalMutation }, productionShotRepo: stubShots() });
    const res = await fetch(`${host.origin}/projects/proj-1/production/shots/shot-1`, {
      method: "PATCH",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ reviewStatus: "approved", id: "HACK" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; shot: ProductionShotRow };
    expect(json.ok).toBe(true);
    // The allowlisted field landed; the non-allowlisted id override never did
    // (a PATCH can never rewrite its own identity). The server-owned updatedAt
    // stamp rides along with the write.
    expect(json.shot.reviewStatus).toBe("approved");
    expect(json.shot.id).toBe("shot-1");
    expect(json.shot.updatedAt).toBeTruthy();
    expect(onCanonicalMutation).toHaveBeenCalledWith("proj-1", "shot.update");
  });

  it("404s a shot PATCH whose shotId is not in the project", async () => {
    const host = await bootServer({}, { productionShotRepo: stubShots({ findById: async () => null }) });
    const res = await fetch(`${host.origin}/projects/proj-1/production/shots/shot-9`, {
      method: "PATCH",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ reviewStatus: "approved" }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, status: 404, reason: "Shot not found" });
  });
});

describe("story-state routes (§7 wave 3)", () => {
  function stubStoryState(over: Partial<StoryStateRepository> = {}): StoryStateRepository {
    return {
      ownsProject: async (projectId) => projectId === "proj-1",
      findThreads: async () => [{ id: "th-1", projectId: "proj-1", name: "Dead Man's Hand" }],
      createThread: async (projectId, fields) =>
        ({ id: "th-new", projectId, ...fields }) as unknown as StoryThreadRow,
      createPromise: async (projectId, fields) =>
        ({ id: "pr-new", projectId, ...fields }) as unknown as StoryPromiseRow,
      updateThreadScoped: async (projectId, threadId, patch) =>
        ({ id: threadId, projectId, ...patch }) as unknown as StoryThreadRow,
      updatePromiseScoped: async (projectId, promiseId, patch) =>
        ({ id: promiseId, projectId, ...patch }) as unknown as StoryPromiseRow,
      ...over,
    };
  }

  it("501s the story-state read when storyStateRepo is omitted", async () => {
    const host = await bootServer();
    const res = await fetch(`${host.origin}/projects/proj-1/story-state`, authed(host));
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "Story state storage is not configured for this host.",
    });
  });

  it("creates a promise through the POST branch — route defaults applied, §11 hook wired", async () => {
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => undefined);
    const createPromise = vi.fn(
      async (projectId: string, fields: Record<string, unknown>) =>
        ({ id: "pr-new", projectId, ...fields }) as unknown as StoryPromiseRow,
    );
    const host = await bootServer(
      {},
      { hooks: { onCanonicalMutation }, storyStateRepo: stubStoryState({ createPromise }) },
    );
    const res = await fetch(`${host.origin}/projects/proj-1/story-state`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ type: "promise", setup: "The cards always get paid" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
    // The route's INSERT defaults (no thread link, empty payoff intent, B
    // priority) are carried through — and the local host's fail-open no-op
    // embedSetup means the promise simply saves without an embedding.
    expect(createPromise).toHaveBeenCalledWith(
      "proj-1",
      expect.objectContaining({
        setup: "The cards always get paid",
        threadId: null,
        payoffIntent: "",
        priority: "B",
      }),
    );
    expect(onCanonicalMutation).toHaveBeenCalledWith("proj-1", "storyPromise.create");
  });

  it("400s a POST with no type discriminator — the route's exact body", async () => {
    const host = await bootServer({}, { storyStateRepo: stubStoryState() });
    const res = await fetch(`${host.origin}/projects/proj-1/story-state`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      status: 400,
      reason: "type required: thread or promise",
    });
  });
});

describe("story memory routes (§7 wave 3)", () => {
  function stubMemories(over: Partial<StoryMemoryRepository> = {}): StoryMemoryRepository {
    return {
      ownsProject: async (projectId) => projectId === "proj-1",
      findScoped: async () => [{ id: "mem-1", projectId: "proj-1", fact: "Mara cheats left-handed" }],
      create: async (projectId, fields) =>
        ({ id: "mem-new", projectId, ...fields }) as unknown as StoryMemoryRow,
      deleteScoped: async () => undefined,
      ...over,
    };
  }

  it("501s the memory list when storyMemoryRepo is omitted", async () => {
    const host = await bootServer();
    const res = await fetch(`${host.origin}/projects/proj-1/story-memories`, authed(host));
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "Story memory storage is not configured for this host.",
    });
  });

  it("creates a memory — fact stored trimmed, category defaulted, normalized structuredData, §11 hook wired", async () => {
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => undefined);
    const create = vi.fn(
      async (projectId: string, fields: Record<string, unknown>) =>
        ({ id: "mem-new", projectId, ...fields }) as unknown as StoryMemoryRow,
    );
    const host = await bootServer(
      {},
      { hooks: { onCanonicalMutation }, storyMemoryRepo: stubMemories({ create }) },
    );
    const res = await fetch(`${host.origin}/projects/proj-1/story-memories`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ fact: "  Mara collects brass buttons  " }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
    // The trim + the category default + the lenient (never-rejecting)
    // structuredData normalization + the human-authored stamp.
    expect(create).toHaveBeenCalledWith(
      "proj-1",
      expect.objectContaining({
        fact: "Mara collects brass buttons",
        category: "general",
        structuredData: null,
        autoExtracted: false,
      }),
    );
    expect(onCanonicalMutation).toHaveBeenCalledWith("proj-1", "memory.create");
  });

  it("400s a blank fact before any ownership probe can run", async () => {
    const ownsProject = vi.fn(async (projectId: string) => projectId === "proj-1");
    const host = await bootServer({}, { storyMemoryRepo: stubMemories({ ownsProject }) });
    const res = await fetch(`${host.origin}/projects/proj-1/story-memories`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ fact: "   " }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, status: 400, reason: "fact required" });
    expect(ownsProject).not.toHaveBeenCalled();
  });
});

describe("story graph route (§7 wave 3)", () => {
  function stubStoryGraph(over: Partial<StoryGraphRepository> = {}): StoryGraphRepository {
    return {
      ownsProject: async (projectId) => projectId === "proj-1",
      readGraphData: async () => ({
        // The same minimal stub project the cloud route test used — the graph
        // builder composes over whatever entities exist (none here).
        project: {
          id: "proj-1",
          userId: "local",
          title: "The Dealer",
          characters: [],
          locations: [],
          plotThreads: [],
          chapters: [],
          worldEntities: [],
        },
        storedRels: [],
      }),
      ...over,
    };
  }

  it("501s the graph read when storyGraphRepo is omitted", async () => {
    const host = await bootServer();
    const res = await fetch(`${host.origin}/projects/proj-1/story-graph`, authed(host));
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "Story graph storage is not configured for this host.",
    });
  });

  it("returns graph+health+contextTrimmed flattened, matching the cloud body", async () => {
    const host = await bootServer({}, { storyGraphRepo: stubStoryGraph() });
    const res = await fetch(`${host.origin}/projects/proj-1/story-graph`, authed(host));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      graph?: unknown;
      nodes: unknown[];
      health: { score: number; issues: unknown[] };
      contextTrimmed: boolean;
    };
    // Cloud `/story-graph` spreads the graph and flattens health/contextTrimmed
    // to top-level keys; the local host emits that same body verbatim.
    expect(json.graph).toBeUndefined();
    expect(Array.isArray(json.nodes)).toBe(true);
    expect(json.health).toHaveProperty("score");
    expect(json.health).toHaveProperty("issues");
    expect(typeof json.contextTrimmed).toBe("boolean");
  });
});

describe("checkpoint routes (§7 wave 3)", () => {
  function stubCheckpoints(over: Partial<StoryCheckpointRepository> = {}): StoryCheckpointRepository {
    return {
      ownsProject: async (projectId) => projectId === "proj-1",
      readSnapshotInputs: async () => ({
        chapters: [
          { id: "c-1", title: "Deal in", wordCount: 200, arcPosition: "setup" },
          { id: "c-2", title: "Dead Man's Hand", wordCount: 1000, arcPosition: "rising" },
        ],
        plotThreads: [
          { id: "pt-1", status: "open", starvationWarning: true },
          { id: "pt-2", status: "open", starvationWarning: false },
        ],
        storyPromises: [
          { id: "sp-1", status: "open" },
          { id: "sp-2", status: "open" },
          { id: "sp-3", status: "open" },
        ],
      }),
      findScoped: async () => [],
      create: async (projectId, fields) =>
        ({ id: "cp-new", projectId, ...fields }) as unknown as StoryCheckpointRow,
      deleteScoped: async () => undefined,
      ...over,
    };
  }

  it("501s the checkpoint list when storyCheckpointRepo is omitted", async () => {
    const host = await bootServer();
    const res = await fetch(`${host.origin}/projects/proj-1/checkpoints`, authed(host));
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "Story checkpoint storage is not configured for this host.",
    });
  });

  it("creates a checkpoint — defaulted name, the healthScore snapshot, §11 hook wired", async () => {
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => undefined);
    const create = vi.fn(
      async (projectId: string, fields: Record<string, unknown>) =>
        ({ id: "cp-new", projectId, ...fields }) as unknown as StoryCheckpointRow,
    );
    const host = await bootServer(
      {},
      { hooks: { onCanonicalMutation }, storyCheckpointRepo: stubCheckpoints({ create }) },
    );
    const res = await fetch(`${host.origin}/projects/proj-1/checkpoints`, {
      method: "POST",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
    // Snapshot math on the fixture: 100 − 1 starvation warning×5 − 1 thin
    // chapter×3, no open-promise penalty (3 ≤ 5) = 92.
    expect(create).toHaveBeenCalledWith(
      "proj-1",
      expect.objectContaining({
        notes: "",
        snapshot: expect.objectContaining({
          totalWordCount: 1200,
          chapterCount: 2,
          openThreadCount: 2,
          openPromises: 3,
          healthScore: 92,
        }),
      }),
    );
    // The defaulted name carries today's date.
    expect(create.mock.calls[0]?.[1]?.["name"]).toMatch(/^Checkpoint — /);
    expect(onCanonicalMutation).toHaveBeenCalledWith("proj-1", "checkpoint.create");
  });

  it("deletes a checkpoint whose id arrives in the BODY, §11 hook wired", async () => {
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => undefined);
    const deleteScoped = vi.fn(async (_projectId: string, checkpointId: unknown) => undefined);
    const host = await bootServer(
      {},
      { hooks: { onCanonicalMutation }, storyCheckpointRepo: stubCheckpoints({ deleteScoped }) },
    );
    const res = await fetch(`${host.origin}/projects/proj-1/checkpoints`, {
      method: "DELETE",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ checkpointId: "cp-9" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    // checkpointId arrives straight from the body (the route's transport shape).
    expect(deleteScoped).toHaveBeenCalledWith("proj-1", "cp-9");
    expect(onCanonicalMutation).toHaveBeenCalledWith("proj-1", "checkpoint.delete");
  });
});

describe("story plan routes (§7 wave 3)", () => {
  function stubPlans(over: Partial<StoryPlanRepository> = {}): StoryPlanRepository {
    return {
      ownsProject: async (projectId) => projectId === "proj-1",
      findScoped: async () =>
        [
          { id: "plan-1", projectId: "proj-1", kind: "chapter", title: "Chapter 1 beats" },
        ] as unknown as StoryPlanRow[],
      updateScoped: async (_projectId, _planId, patch) =>
        ({ id: "plan-1", projectId: "proj-1", ...patch }) as unknown as StoryPlanRow,
      deleteScoped: async () => undefined,
      ...over,
    };
  }

  it("501s the plan list when storyPlanRepo is omitted", async () => {
    const host = await bootServer();
    const res = await fetch(`${host.origin}/projects/proj-1/story-plans`, authed(host));
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "Story plan storage is not configured for this host.",
    });
  });

  it("PATCHes a plan whose planId arrives in the BODY — beats encoded, no §11 hook", async () => {
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => undefined);
    const host = await bootServer(
      {},
      {
        hooks: { onCanonicalMutation },
        storyPlanRepo: stubPlans({
          updateScoped: async (_projectId, _planId, patch) =>
            ({ id: "plan-1", projectId: "proj-1", ...patch }) as unknown as StoryPlanRow,
        }),
      },
    );
    const res = await fetch(`${host.origin}/projects/proj-1/story-plans`, {
      method: "PATCH",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({
        planId: "plan-1",
        title: "Chapter 1 beats (v2)",
        beats: [{ id: "b1", order: 1, label: "Open", summary: "The deal goes down" }],
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; plan: { title: string; beats: unknown[] } };
    expect(json.ok).toBe(true);
    expect(json.plan.title).toBe("Chapter 1 beats (v2)");
    // encodeStoryBeats round-trips the beat through the zod schema.
    expect(json.plan.beats).toEqual([
      expect.objectContaining({ id: "b1", order: 1, label: "Open", summary: "The deal goes down" }),
    ]);
    // Planning artifacts are NOT canon — beats edits never bump a revision.
    expect(onCanonicalMutation).not.toHaveBeenCalled();
  });

  it("400s invalid beats AFTER ownership — 404 still beats 400", async () => {
    const host = await bootServer({}, { storyPlanRepo: stubPlans() });
    const res = await fetch(`${host.origin}/projects/proj-1/story-plans`, {
      method: "PATCH",
      headers: { ...authed(host).headers, "content-type": "application/json" },
      body: JSON.stringify({ planId: "plan-1", beats: [{}] }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, status: 400, reason: "Invalid beats shape." });
  });
});
