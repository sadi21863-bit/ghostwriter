/**
 * PLAN-v5 step 2 — the thin shell + the Settings persistence route.
 *
 * Pins the two halves of the step:
 *  - the three static assets are served at `/`, `/app.js`, `/app.css` WITHOUT
 *    the owner bearer (a browser must load the page before it can present a
 *    token) and carry the right content-types;
 *  - EVERY data route stays behind the bearer, and GET/POST `/settings` are
 *    501 until the composition root plants a settings port — then they
 *    validate and persist through it.
 *
 * Own suite (never edits the big local-host pins); the established 20000ms
 * timeout convention; no network beyond the loopback socket.
 */
import { afterAll, describe, expect, it } from "vitest";
import {
  createLocalHostServer,
  defaultLocalRoutes,
  type LocalHost,
  type LocalSettingsPort,
} from "@/lib/core/local-host";
import type { ProjectsCoreRepository } from "@/lib/core/handlers/projects";

const owned: LocalHost[] = [];
afterAll(async () => {
  await Promise.all(owned.map((h) => h.close().catch(() => undefined)));
});

async function boot(
  extra: Partial<Parameters<typeof defaultLocalRoutes>[0]> = {},
): Promise<LocalHost> {
  const routes = defaultLocalRoutes({
    chapterRepo: {
      ownsProject: async () => true,
      updateScoped: async (_p, chapterId, patch) =>
        ({ id: chapterId, ...(patch as object) }) as never,
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
    ...extra,
  });
  const host = await createLocalHostServer({ routes });
  owned.push(host);
  return host;
}

function bearer(host: LocalHost): Record<string, string> {
  return { authorization: `Bearer ${host.token}` };
}

async function get(host: LocalHost, path: string, headers: Record<string, string> = {}) {
  return fetch(`${host.origin}${path}`, { headers });
}

async function post(host: LocalHost, path: string, body: unknown, authed = true) {
  return fetch(`${host.origin}${path}`, {
    method: "POST",
    headers: { ...(authed ? bearer(host) : {}), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("thin shell assets (PLAN-v5 step 2)", () => {
  it(
    "GET / serves the shell HTML without a bearer, with the three view markers",
    async () => {
      const host = await boot();
      const res = await get(host, "/");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      const body = await res.text();
      expect(body).toContain("Ghostwriter — local");
      expect(body).toContain('data-view="write"');
      expect(body).toContain('data-view="bible"');
      expect(body).toContain('data-view="settings"');
      expect(body).toContain('src="/app.js"');
    },
    20000,
  );

  it(
    "GET /app.js and /app.css serve their assets with the right content-types",
    async () => {
      const host = await boot();
      const js = await get(host, "/app.js");
      expect(js.status).toBe(200);
      expect(js.headers.get("content-type")).toContain("javascript");
      expect(await js.text()).toContain("PLAN-v5 step 2");
      const css = await get(host, "/app.css");
      expect(css.status).toBe(200);
      expect(css.headers.get("content-type")).toContain("text/css");
      expect(await css.text()).toContain("--accent");
    },
    20000,
  );

  it(
    "the DATA routes stay bearer-gated — the shell never widens the token contract",
    async () => {
      const host = await boot();
      const anon = await get(host, "/projects");
      expect(anon.status).toBe(401);
      const authed = await get(host, "/projects", bearer(host));
      // No projectsCoreRepo planted → the handler's 501, but AUTHENTICATED.
      expect(authed.status).toBe(501);
      const providersAnon = await get(host, "/providers");
      expect(providersAnon.status).toBe(401);
    },
    20000,
  );

  it(
    "an unknown static-looking path is NOT served from the shell map",
    async () => {
      const host = await boot();
      const res = await get(host, "/secrets.txt");
      expect(res.status).toBe(401); // routed as a data path, bearer first
    },
    20000,
  );
});

describe("POST /projects/:projectId/entity-proposals (PLAN-v5 step 4)", () => {
  it(
    "bearer-gated, validates entityKey, and builds the shared user-edit transaction",
    async () => {
      const host = await boot();
      const anon = await post(host, "/projects/p1/entity-proposals", {}, false);
      expect(anon.status).toBe(401);

      const badKey = await post(host, "/projects/p1/entity-proposals", {
        entityKey: "nope",
        entity: {},
        draft: {},
      });
      expect(badKey.status).toBe(400);

      const res = await post(host, "/projects/p1/entity-proposals", {
        entityKey: "characters",
        entity: { id: "c1", name: "Mara", personality: "old", voiceId: "v1" },
        draft: { name: "Mara", personality: "new", voiceId: "v2" },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        proposal?: { changes?: unknown[]; excluded?: Record<string, unknown> };
      };
      // Only the real diff, canonical-encoded, in draft-key order.
      expect(body.proposal?.changes).toEqual([
        {
          entityKey: "characters",
          entityId: "c1",
          field: "personality",
          oldValue: "old",
          newValue: "new",
        },
      ]);
      // Non-allowlisted fields are reported, never silently written.
      expect(body.proposal?.excluded).toEqual({ voiceId: "v2" });
    },
    20000,
  );

  it(
    "ACCEPT writes through the existing story-transactions route — one recorded transaction",
    async () => {
      const recorded: unknown[] = [];
      const applied: unknown[] = [];
      const host = await boot({
        storyTransactionRepo: {
          ownsProject: async () => true,
          record: async (tx) => {
            recorded.push(tx);
          },
          applyChanges: async (_projectId, tx) => {
            applied.push(tx);
          },
        },
      });
      const res = await post(host, "/projects/p1/story-transactions", {
        source: "user-edit",
        changes: [
          {
            entityKey: "characters",
            entityId: "c1",
            field: "personality",
            oldValue: "old",
            newValue: "new",
          },
        ],
      });
      expect(res.status).toBe(200);
      expect(recorded).toHaveLength(1);
      expect(applied).toHaveLength(1);
      expect((recorded[0] as { source: string }).source).toBe("user-edit");
      const body = (await res.json()) as { transaction?: { changes?: unknown[] } };
      expect(body.transaction?.changes).toHaveLength(1);
    },
    20000,
  );

  it(
    "the shell carries the loop: propose endpoint, Accept/Reject, and no auto-save copy",
    async () => {
      const host = await boot();
      const js = await (await get(host, "/app.js")).text();
      expect(js).toContain("/entity-proposals");
      expect(js).toContain("acceptProposal");
      expect(js).toContain("rejectProposal");
      const html = await (await get(host, "/")).text();
      expect(html).toContain('id="accept-proposal"');
      expect(html).toContain('id="reject-proposal"');
      expect(html).toContain("nothing is saved until you accept");
    },
    20000,
  );
});

describe("GET /projects/:projectId/story-doctor (PLAN-v5 step 5)", () => {
  function repo(double: Partial<ProjectsCoreRepository>): ProjectsCoreRepository {
    return {
      ownsProject: async () => true,
      listForUser: async () => [],
      countForUser: async () => 0,
      create: async () => {
        throw new Error("unused in these pins");
      },
      read: async () => null,
      updateScoped: async () => null,
      deleteScoped: async () => undefined,
      ...double,
    } as unknown as ProjectsCoreRepository;
  }

  it(
    "401 without the bearer; 404 for a project this host does not own",
    async () => {
      const host = await boot({ projectsCoreRepo: repo({ ownsProject: async () => false }) });
      const anon = await get(host, "/projects/p1/story-doctor");
      expect(anon.status).toBe(401);
      const notOwned = await get(host, "/projects/p1/story-doctor", bearer(host));
      expect(notOwned.status).toBe(404);
    },
    20000,
  );

  it(
    "finds both planted defects from the project graph the editor reads",
    async () => {
      const host = await boot({
        projectsCoreRepo: repo({
          read: async () =>
            ({
              chapters: [
                {
                  title: "The Canal",
                  sortOrder: 0,
                  content: "Mara slid the brass key into the canal gate.",
                },
                { title: "The Lesson", sortOrder: 1, content: "Tamsin explained the lock." },
              ],
              storyMemories: [
                {
                  chapterIndex: 0,
                  structuredData: { openPromisesCreated: ["The key must be returned"] },
                },
                {
                  chapterIndex: 1,
                  structuredData: {
                    knowledgeShifts: [
                      { character: "Mara", learned: "the brass key opens the canal gate" },
                    ],
                  },
                },
              ],
            }) as never,
        }),
      });
      const res = await get(host, "/projects/p1/story-doctor", bearer(host));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        ok: boolean;
        issues: { kind: string }[];
        checked: { chapters: number };
      };
      expect(body.ok).toBe(true);
      expect(body.issues.map((i) => i.kind).sort()).toEqual([
        "knowledge-conflict",
        "unresolved-promise",
      ]);
      expect(body.checked.chapters).toBe(2);
    },
    20000,
  );

  it(
    "the shell carries the Doctor action and its results panel",
    async () => {
      const host = await boot();
      const js = await (await get(host, "/app.js")).text();
      expect(js).toContain("/story-doctor");
      expect(js).toContain("runDoctor");
      const html = await (await get(host, "/")).text();
      expect(html).toContain('id="run-doctor"');
      expect(html).toContain('id="doctor-results"');
    },
    20000,
  );
});

describe("GET /provider-models/:provider (PLAN-v5)", () => {
  it(
    "501 by default and bearer-gated like every optional cluster",
    async () => {
      const host = await boot();
      const anon = await get(host, "/provider-models/opencode");
      expect(anon.status).toBe(401);
      const authed = await get(host, "/provider-models/opencode", bearer(host));
      expect(authed.status).toBe(501);
    },
    20000,
  );

  it(
    "with a planted port: returns the list; a provider error surfaces as 400 with its words",
    async () => {
      const host = await boot({
        providerModels: {
          list: async (provider) => {
            if (provider === "boom") throw new Error("GW_LOCAL_API_KEY is not configured");
            return [{ id: "deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash 1017" }];
          },
        },
      });
      const ok = await get(host, "/provider-models/opencode", bearer(host));
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({
        ok: true,
        models: [{ id: "deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash 1017" }],
      });
      const bad = await get(host, "/provider-models/boom", bearer(host));
      expect(bad.status).toBe(400);
      const body = (await bad.json()) as { reason?: string };
      expect(body.reason).toContain("GW_LOCAL_API_KEY");
    },
    20000,
  );

  it(
    "the shell carries the provider/model pickers fed by that route",
    async () => {
      const host = await boot();
      const html = await (await get(host, "/")).text();
      expect(html).toContain('id="settings-model-picker"');
      expect(html).toContain('value="opencode"');
      const js = await (await get(host, "/app.js")).text();
      expect(js).toContain("/provider-models/");
      expect(js).toContain("loadModelChoices");
    },
    20000,
  );
});

describe("GET/POST /settings (PLAN-v5 step 2)", () => {
  it(
    "501 by default — the host owns no settings file without a plant",
    async () => {
      const host = await boot();
      const res = await get(host, "/settings", bearer(host));
      expect(res.status).toBe(501);
      const body = (await res.json()) as { reason?: string };
      expect(body.reason).toContain("not configured");
      const post = await fetch(`${host.origin}/settings`, {
        method: "POST",
        headers: { ...bearer(host), "content-type": "application/json" },
        body: JSON.stringify({ provider: "auto" }),
      });
      expect(post.status).toBe(501);
    },
    20000,
  );

  it(
    "with a planted port: GET reads, POST validates + persists, bearer required",
    async () => {
      const saved: Record<string, unknown> = { provider: "off" };
      const writes: Record<string, unknown>[] = [];
      const localSettings: LocalSettingsPort = {
        read: async () => ({ ...saved }),
        write: async (patch) => {
          writes.push(patch);
          Object.assign(saved, patch);
          return { ...saved };
        },
      };
      const host = await boot({ localSettings });

      const anon = await get(host, "/settings");
      expect(anon.status).toBe(401);

      const read = await get(host, "/settings", bearer(host));
      expect(read.status).toBe(200);
      expect(await read.json()).toEqual({ ok: true, settings: { provider: "off" } });

      const bad = await fetch(`${host.origin}/settings`, {
        method: "POST",
        headers: { ...bearer(host), "content-type": "application/json" },
        body: JSON.stringify({ provider: "nope" }),
      });
      expect(bad.status).toBe(400);

      const badType = await fetch(`${host.origin}/settings`, {
        method: "POST",
        headers: { ...bearer(host), "content-type": "application/json" },
        body: JSON.stringify({ model: 42 }),
      });
      expect(badType.status).toBe(400);

      const ok = await fetch(`${host.origin}/settings`, {
        method: "POST",
        headers: { ...bearer(host), "content-type": "application/json" },
        body: JSON.stringify({ provider: "anthropic", model: "claude-sonnet-4-5", endpointUrl: "" }),
      });
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({
        ok: true,
        settings: { provider: "anthropic", model: "claude-sonnet-4-5", endpointUrl: "" },
      });
      expect(writes).toEqual([
        { provider: "anthropic", model: "claude-sonnet-4-5", endpointUrl: "" },
      ]);
    },
    20000,
  );
});
