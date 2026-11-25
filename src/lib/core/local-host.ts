/**
 * Phase 2 / v4 §7 — the loopback host itself.
 *
 * Everything it needs to deserve the name "local host" already exists: the
 * decorators that authorize a request shape (`fromLoopbackRequest`), the
 * business handlers that know no transport (`updateChapter`, `getStoryBible`,
 * `applyStoryTransaction`), and the adapter (pg-repositories) that supplies
 * their repository ports. What was missing is the binding: nothing actually
 * LISTENED, so the no-egress/auth properties were pinned by unit tests against
 * shapes, never against a real socket.
 *
 * This module is deliberately boring infrastructure. It:
 *
 *  - binds `127.0.0.1` ONLY (never `0.0.0.0`) — the hard no-egress guarantee is
 *    the bind itself; the decorator's origin check is defense in depth, not the
 *    mechanism;
 *  - mints a per-launch high-entropy token unless the host supplies one (v4:
 *    "per-launch token", so a credential from a previous session can never
 *    drive a new server);
 *  - refuses anything the decorators refuse, then dispatches to the matched
 *    route's handler with a `RequestContext`;
 *  - maps the handlers' `{ ok }` result unions onto HTTP statuses, and maps
 *    unexpected throws onto 500 WITHOUT leaking the stack or internals.
 *
 * As with every core module, it must not import transport libraries — the test
 * file reads this file's source to keep that true.
 */

import http from "node:http";
import { randomBytes } from "node:crypto";
import { fromLoopbackRequest, parseBearer } from "./auth-decorators";
import { localContext, mayAccessProject, type RequestContext } from "./request-context";
import {
  generateChapter,
  type GenerateChapterInput,
  type GenerateChapterPorts,
} from "./handlers/generate-chapter";
import { dispatchLocalAdmin, type LocalAdminRoute } from "./local-admin-registry";
import { LOCAL_SHELL_FILES } from "./local-shell";
import type { LocalProviderModelsPort } from "./local-provider-models";
import { buildEntityEditTransaction } from "@/lib/story/edit-transaction";
import { DIFF_FIELDS } from "@/lib/ai/entity-extraction";
import { runStoryDoctor, type DoctorChapter, type DoctorMemory } from "@/lib/story/story-doctor";
import {
  exportProjectSnapshot,
  importProjectSnapshot,
  type SnapshotPort,
} from "./handlers/portability";
import type { LocalProvidersReadPort } from "./local-provider-routing";
import type { GenerationOutcome } from "@/lib/ai/generation-service";
import { applyModePromptDirective, composeDynamicContext } from "@/lib/ai/generation-context";
import {
  buildRunPlan,
  runnableCapabilities,
  type GraphNodeKind,
} from "@/lib/graph/graph-program";
import type { CapabilityContext } from "@/lib/capabilities/registry";
import type { SubscriptionTier } from "@/types/subscription";
import { deleteChapter, updateChapter } from "./handlers/update-chapter";
import { getStoryBible } from "./handlers/get-story-bible";
import {
  applyStoryTransaction,
  type ApplyStoryTransactionInput,
} from "./handlers/apply-story-transaction";
import type { ChapterRepository, PostCommitHooks, ProjectRepository } from "./repositories";
import type { StoryBibleRepository } from "./handlers/get-story-bible";
import type { StoryTransactionRepository } from "./handlers/apply-story-transaction";
import type { StoryHistoryRepository } from "./handlers/story-history";
import {
  getStoryTransaction,
  listStoryTransactions,
  revertStoryTransaction,
} from "./handlers/story-history";
import {
  createCharacter,
  deleteCharacter,
  updateCharacter,
  type CharacterCreateData,
  type CharacterCrudRepository,
} from "./handlers/characters";
import {
  createLocation,
  deleteLocation,
  updateLocation,
  type LocationCreateData,
  type LocationCrudRepository,
} from "./handlers/locations";
import {
  createPlotThread,
  deletePlotThread,
  updatePlotThread,
  type PlotThreadCreateData,
  type PlotThreadCrudRepository,
  type PlotThreadPatchData,
} from "./handlers/plot-threads";
import {
  createReferenceWork,
  deleteReferenceWork,
  type ReferenceWorkCreateData,
  type ReferenceWorkCrudRepository,
} from "./handlers/reference-works";
import {
  createWorldEntity,
  deleteWorldEntity,
  listWorldEntities,
  updateWorldEntity,
  type WorldEntityCrudRepository,
} from "./handlers/world-entities";
import {
  readIntentionalViolations,
  recordIntentionalViolation,
  type IntentionalViolationRepository,
} from "./handlers/intentional-violations";
import {
  readRelationshipMap,
  upsertRelationshipMap,
  type RelationshipMapRepository,
  type RelationshipMapUpsertPayload,
} from "./handlers/relationship-map";
import {
  createProject,
  deleteProject,
  listProjects,
  readProject,
  updateProject,
  type ProjectCreateData,
  type ProjectTierResolver,
  type ProjectsCoreRepository,
} from "./handlers/projects";
import {
  createComicPage,
  deleteComicPage,
  listComicPages,
  updateComicPanel,
  type ComicPageCreateData,
  type ComicPageCrudRepository,
  type ComicPanelCrudRepository,
} from "./handlers/comics";
import {
  generatePackage,
  type LocalGeneratePackageDeps,
} from "./handlers/generate-package";
import {
  listProductionShots,
  updateProductionShot,
  type ProductionShotCrudRepository,
} from "./handlers/production-shots";
import {
  createStoryPromise,
  createStoryThread,
  listStoryState,
  updateStoryPromise,
  updateStoryThread,
  type StoryPromiseCreateData,
  type StoryPromisePatchInput,
  type StoryStateRepository,
  type StoryThreadCreateData,
  type StoryThreadPatchInput,
} from "./handlers/story-state";
import {
  createStoryMemory,
  deleteStoryMemory,
  listStoryMemories,
  type StoryMemoryRepository,
} from "./handlers/story-memories";
import { readStoryGraph, type StoryGraphRepository } from "./handlers/story-graph";
import {
  createCheckpoint,
  deleteCheckpoint,
  listCheckpoints,
  type StoryCheckpointRepository,
} from "./handlers/story-checkpoints";
import {
  deleteStoryPlan,
  listStoryPlans,
  updateStoryPlan,
  type StoryPlanRepository,
} from "./handlers/story-plans";
import { WorldEntityKindSchema, encodeWorldEntityProperties, type WorldEntityProperties } from "@/lib/types/story";
import { getUserTier } from "@/lib/subscription";
import {
  pgChapterRepository,
  pgPostCommitHooks,
  pgStoryBibleRepository,
  pgStoryHistoryRepository,
  pgStoryTransactionRepository,
} from "./pg-repositories";
import { pgCharacterCrudRepository, pgLocationCrudRepository } from "./pg-character-location-repos";
import { pgPlotThreadRepository, pgReferenceWorkRepository } from "./pg-thread-reference-repos";
import { pgIntentionalViolationRepository, pgWorldEntityRepository } from "./pg-world-entity-repos";
import { pgRelationshipMapRepository } from "./pg-relationship-repos";
import { pgProjectCrudRepository } from "./pg-project-crud";
import { pgComicPageCrudRepository, pgComicPanelCrudRepository } from "./pg-comic-repos";
import { pgProductionShotCrudRepository } from "./pg-production-shot-repos";
import {
  pgStoryStateRepository,
  pgStoryMemoryRepository,
  pgStoryGraphRepository,
  pgStoryCheckpointRepository,
  pgStoryPlanRepository,
} from "./pg-story-os-repos";

/** One business route the local host serves. Params use `:name` segments. */
export interface LocalHostRoute {
  readonly method: string;
  readonly path: string;
  readonly handle: (args: {
    readonly ctx: RequestContext;
    readonly params: Readonly<Record<string, string>>;
    /** Parsed JSON body; `{}` when the request carried none. */
    readonly body: unknown;
  }) => Promise<unknown> | unknown;
}

export interface LocalHostOptions {
  /** The authorization token. Minted per launch when omitted. */
  readonly token?: string;
  /** TCP port; 0 (ephemeral) when omitted. */
  readonly port?: number;
  /** Extra origins allowed besides loopback. */
  readonly allowedOrigins?: readonly string[];
  /** Restricts every served request to one project; unset = whole workspace. */
  readonly projectScope?: string;
  readonly routes: readonly LocalHostRoute[];
  /** Request-body cap in bytes; protects the JSON parser. Default 1 MiB. */
  readonly maxBodyBytes?: number;
  /**
   * Stage (c) — the ADMIN side-registry served on the same socket, with its
   * OWN credential domain (`requireBearer(ADMIN_SECRET)`, checked before the
   * owner gate — see the dispatch arm). Absent = no admin surface at all, and
   * the user dispatch 404s admin paths like any other unknown route.
   */
  readonly adminRegistry?: readonly LocalAdminRoute[];
  /**
   * Stage (e) — the §5.6 owner id threaded into EVERY ctx the host mints (see
   * `localContext`'s `actorOwnerId`). Unset keeps the "local" placeholder
   * actor id exactly as the tests have always seen it.
   */
  readonly localOwnerId?: string;
}

export interface LocalHost {
  readonly server: http.Server;
  /** The only address it will ever answer on. */
  readonly host: "127.0.0.1";
  readonly port: number;
  /** The per-launch credential the spawning shell must hand its client. */
  readonly token: string;
  /** Convenience base URL for the client. */
  readonly origin: string;
  close(): Promise<void>;
}

/** The response every unauthorized request gets. */
const DENIED = { error: "unauthorized" } as const;

function trimSlashes(p: string): string {
  return p.startsWith("/") ? p.slice(1) : p;
}

/**
 * Match `path` against a route, capturing `:name` params. Segment-wise and
 * exact: identical segment counts, literal segments equal, params capture. A
 * longer URL can never match a shorter route (no prefix swallowing).
 */
export function matchRoute(
  route: LocalHostRoute,
  method: string,
  path: string,
): Record<string, string> | null {
  if (route.method.toUpperCase() !== method.toUpperCase()) return null;
  const routeSegs = trimSlashes(route.path).split("/");
  const actualSegs = trimSlashes(path).split("/");
  if (routeSegs.length !== actualSegs.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < routeSegs.length; i++) {
    const r = routeSegs[i]!;
    const a = actualSegs[i]!;
    if (r.startsWith(":")) {
      if (!a) return null;
      params[r.slice(1)] = a;
    } else if (r !== a) {
      return null;
    }
  }
  return params;
}

/**
 * Handlers return unions like `{ ok: true } | { ok: false, status: 403 | 404 }`.
 * The host maps them verbatim — the handler owns its status codes, the host
 * merely translates. A failure with no status (impossible in the intended
 * unions, possible in a future one) is a 500 rather than a silent 200.
 */
export function handlerStatus(result: unknown): number {
  if (result && typeof result === "object" && (result as { ok?: unknown })["ok"] === false) {
    const status = (result as { status?: unknown })["status"];
    return typeof status === "number" ? status : 500;
  }
  return 200;
}

export interface ParsedRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: {
    readonly authorization: string | null;
    readonly origin: string | null;
  };
  /** Raw request body, or null when the request carried none. */
  readonly body: Buffer | null;
}

export interface DispatchOptions {
  /**
   * The host's own token. EVERY dispatch requires it — an absent one fails
   * closed with 401, mirroring the decorator: a host that forgot its token must
   * refuse everything, never authenticate everything.
   */
  readonly expectedToken: string;
  readonly allowedOrigins?: readonly string[];
  readonly projectScope?: string;
  readonly routes: readonly LocalHostRoute[];
  /**
   * Stage (e) — see `localContext`'s `actorOwnerId`: threads a supplied
   * composition-root owner id into every ctx, so FK-linked writes use the
   * production owner-row semantics instead of the "local" placeholder.
   */
  readonly actorOwnerId?: string;
}

export type DispatchResult = { status: number; body: unknown };

/**
 * Authorize + route + execute one request. The denial hierarchy is fixed:
 * 401 BEFORE routing (an unauthorized caller must not learn which routes
 * exist), then 404, then handler statuses, then 500.
 */
export async function dispatchLoopback(
  req: ParsedRequest,
  opts: DispatchOptions,
): Promise<DispatchResult> {
  if (!opts.expectedToken) {
    // Fail closed: a host that forgot its token must authenticate nothing.
    return { status: 401, body: DENIED };
  }
  const auth = fromLoopbackRequest({
    token: parseBearer(req.headers.authorization) ?? undefined,
    expected: opts.expectedToken,
    origin: req.headers.origin ?? undefined,
    allowedOrigins: opts.allowedOrigins,
  });
  if (!auth.ok) return { status: 401, body: DENIED };

  let route: LocalHostRoute | undefined;
  let params: Record<string, string> | null = null;
  for (const r of opts.routes) {
    const p = matchRoute(r, req.method, req.path);
    if (p) {
      route = r;
      params = p;
      break;
    }
  }
  if (!route || !params) return { status: 404, body: { error: "not_found" } };

  let body: unknown = {};
  if (req.body && req.body.length > 0) {
    try {
      body = JSON.parse(req.body.toString("utf8"));
    } catch {
      return { status: 400, body: { error: "bad_request", reason: "body is not valid JSON" } };
    }
  }

  const ctx = localContext({
    projectScope: opts.projectScope,
    actorOwnerId: opts.actorOwnerId,
  });
  // The host token is deliberately NOT copied into the context: it is a
  // credential of the transport, not of the actor, and handlers must never see
  // their own auth material.

  try {
    const result = await route.handle({ ctx, params, body });
    return { status: handlerStatus(result), body: result };
  } catch (err) {
    // The stack never leaves the process; operators debug via logs.
    console.error("[local-host] handler threw:", err);
    return { status: 500, body: { error: "internal_error" } };
  }
}

/**
 * Read a request body under a hard cap. Resolves `null` on overflow (buffering
 * is abandoned; the stream is drained rather than destroyed so the connection
 * can be answered and shut down cleanly).
 */
function readBody(req: http.IncomingMessage, max: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let overflow = false;
    req.on("data", (chunk: Buffer) => {
      if (overflow) return;
      total += chunk.length;
      if (total > max) {
        overflow = true;
        chunks.length = 0;
        req.resume();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!overflow) resolve(Buffer.concat(chunks));
    });
  });
}

export async function createLocalHostServer(opts: LocalHostOptions): Promise<LocalHost> {
  const token = opts.token ?? randomBytes(32).toString("hex");
  if (token.length < 32) {
    // Fail at boot, not per request — an async throw so callers can await a
    // rejection rather than catching a synchronous one.
    throw new Error("local host token must be at least 32 characters");
  }
  const maxBodyBytes = opts.maxBodyBytes ?? 1_000_000;
  const adminRegistry = opts.adminRegistry;

  const server = http.createServer(async (httpReq, httpRes) => {
    const method = httpReq.method ?? "GET";
    const path = trimSlashes(httpReq.url ?? "").split("?")[0] ?? "";
    let sent = false;
    const send = (status: number, body: unknown): void => {
      if (sent) return;
      sent = true;
      httpRes.writeHead(status, { "content-type": "application/json" });
      httpRes.end(JSON.stringify(body));
    };

    // Fail fast on a declared oversized body; read otherwise.
    const declared = Number(httpReq.headers["content-length"] ?? 0);
    if (declared > maxBodyBytes) {
      send(413, { error: "payload_too_large", max: maxBodyBytes });
      return;
    }

    try {
      const rawBody = await readBody(httpReq, maxBodyBytes);
      if (rawBody === null) {
        send(413, { error: "payload_too_large", max: maxBodyBytes });
        return;
      }
      // The ADMIN arm runs BEFORE the ownership gate — requireBearer is its own
      // credential domain (ADMIN_SECRET, never the owner token), so a non-admin
      // bearer can NEVER authorize /admin/* and an admin bearer can NEVER
      // authorize the user routes (the loopback gate's token mismatch 401s on
      // any non-admin path it tries). Two disjoint credential domains on one
      // socket, typed (`_kind: "local-admin"`) and tested both directions.
      const path = trimSlashes(httpReq.url ?? "").split("?")[0] ?? "";
      // PLAN-v5 step 2 — the thin shell's three static assets (GET only). They
      // are unauthenticated BY NECESSITY (a browser must load the page before
      // it can present a token); every DATA route below stays bearer-gated.
      if (method === "GET") {
        const asset = LOCAL_SHELL_FILES[path];
        if (asset) {
          httpRes.writeHead(200, {
            "content-type": asset.contentType,
            "cache-control": "no-store",
          });
          httpRes.end(asset.body);
          return;
        }
      }
      // The trimmed path carries no leading slash — the registry's own paths
      // "/admin/…" are normalized the same way inside dispatchLocalAdmin.
      if (adminRegistry && path.startsWith("admin/")) {
        const outcome = await dispatchLocalAdmin(
          {
            method,
            path,
            authorization: (httpReq.headers["authorization"] as string) ?? null,
          },
          adminRegistry,
        );
        send(outcome.status, outcome.body);
        return;
      }
      const outcome = await dispatchLoopback(
        {
          method,
          path,
          headers: {
            authorization: (httpReq.headers["authorization"] as string | undefined) ?? null,
            origin: (httpReq.headers["origin"] as string | undefined) ?? null,
          },
          body: rawBody,
        },
        { ...opts, actorOwnerId: opts.localOwnerId, expectedToken: token },
      );
      send(outcome.status, outcome.body);
    } catch (err) {
      console.error("[local-host] dispatch failed:", err);
      send(500, { error: "internal_error" });
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    // The bind is the no-egress guarantee: an explicit loopback address, never
    // an omitted hostname (which on many systems means "all interfaces").
    server.listen(opts.port ?? 0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr !== "object") {
        reject(new Error("local host could not bind a TCP port"));
        return;
      }
      resolve({
        server,
        host: "127.0.0.1",
        port: addr.port,
        token,
        origin: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise<void>((res, rej) => {
            server.close((e) => (e ? rej(e) : res()));
          }),
      });
    });
  });
}

/**
 * One meter record: what was spent, on what, when. `model`/`tokensUsed` are
 * whatever the generate port actually reported — both are optional on
 * `GeneratedOutput` (generation-service.ts), so an adapter that omits them is
 * recorded as absent, never as a fabricated zero.
 */
export interface LocalGenerationMeterEntry {
  /** Stable id of the mounted path that produced the spend. */
  readonly operation: string;
  readonly model?: string;
  readonly tokensUsed?: number;
  /** Stamped by the mount; an impl may ignore it and clock itself. */
  readonly at?: Date;
}

/**
 * Phase 3 §2.3 stage (b) — the record-only generation meter. Observability,
 * never a gate: the contract has no refusal path — no status, no control
 * payload, no Response — so recording structurally CANNOT refuse a generation
 * the way the cloud meter's `reserve` control can. Implementations may still
 * reject (any async can); the mount treats that as fail-open logging
 * (fire-and-forget with a warn), never as a generation failure. Where records
 * are STORED — a local table, a file — is the composition root's decision;
 * this slice defines only the port and its call-site.
 */
export interface LocalGenerationMeter {
  readonly record: (entry: LocalGenerationMeterEntry) => Promise<void>;
}

/**
 * Phase 3 §2 — the generation bundle a composition root plants to mount
 * `POST /ai/generate`. Meterless and ungated AT THE PIPELINE BY SHAPE:
 * `reserve`/`finalizeUsage` (no meter refusal can reach the pipeline),
 * `gates`/`gateFacts`/`gateResolver` (ungated), `parse`/
 * `proposeTransactions` (unused by `generateChapter` on either host), and
 * `onStage` (no streaming) are outside this pick. `generateChapter` builds the
 * pipeline ports from only these fields, so extra keys riding on the object —
 * even smuggled in through a cast — are dropped by construction, not by trust.
 * The record-only `meter` rides on the bundle but stays OUT of the pipeline
 * ports: metering is the MOUNT's call-site, never a pipeline stage.
 */
export type LocalGenerationDeps = Pick<
  GenerateChapterPorts,
  "buildContext" | "chooseProvider" | "loadViolations" | "persist"
> & {
  /**
   * Required — `GenerationPorts.generate` is nominally optional at type level,
   * but the pipeline throws "no generate port supplied" at runtime without it,
   * so a bundle that cannot generate is a bundle that cannot exist.
   */
  readonly generate: NonNullable<GenerateChapterPorts["generate"]>;
  /**
   * Phase 3 §2.3 stage (b) — optional record-only observability. Consulted at
   * the mount after a successful outcome only, fire-and-forget: recording adds
   * no response latency, cannot refuse, and its failures are warn-logged.
   */
  readonly meter?: LocalGenerationMeter;
};

/**
 * PLAN-v5 step 2 — the shell's provider-picker persistence port. The host
 * never touches the filesystem itself; a composition root supplies this over
 * its own settings file (`local-settings.json` beside the SQLite db), so the
 * shell can save the writer's provider choice while the boot-time composition
 * stays the single place that reads it.
 */
export interface LocalSettingsPort {
  /** The persisted settings object (shape owned by the composition root). */
  read(): Promise<Record<string, unknown>>;
  /** Merge + persist a validated patch; returns the full saved object. */
  write(patch: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/**
 * The default business surface: the §7 CRUD handlers over well-known paths.
 * The AI-generation surface mounts OFF here by default — `POST /ai/generate`
 * ships in this registry, but `defaultLocalRouteDeps()` never plants the
 * `generation` bundle, so the route answers 501 until a composition root
 * supplies one (see `LocalGenerationDeps` and phase 3 §2).
 */
export interface DefaultRouteDeps {
  readonly chapterRepo: Pick<
    ChapterRepository,
    "ownsProject" | "updateScoped" | "deleteScoped"
  >;
  readonly storyBibleRepo: StoryBibleRepository;
  readonly storyTransactionRepo: StoryTransactionRepository;
  /** §13.1 slice 2 — inspect + revert the story-transaction trail. */
  readonly storyHistoryRepo?: StoryHistoryRepository;
  /** §7 wave 2 — World Bible character CRUD. */
  readonly characterRepo?: CharacterCrudRepository;
  /** §7 wave 2 — World Bible location CRUD. */
  readonly locationRepo?: LocationCrudRepository;
  /** §7 wave 2 — plot-thread CRUD. */
  readonly plotThreadRepo?: PlotThreadCrudRepository;
  /** §7 wave 2 — reference-work (Style DNA) create/delete. */
  readonly referenceWorkRepo?: ReferenceWorkCrudRepository;
  /** §7 wave 2 — kind-tagged world-entity CRUD. */
  readonly worldEntityRepo?: WorldEntityCrudRepository;
  /** §7 wave 2 — intentional-violation acknowledgements. */
  readonly violationRepo?: IntentionalViolationRepository;
  /** §7 wave 2 — relationship graph read + pair upserts. */
  readonly relationshipMapRepo?: RelationshipMapRepository;
  /** §7 wave 2 — project list/create/read/edit/delete (tier cap inside). */
  readonly projectsCoreRepo?: ProjectsCoreRepository;
  /**
   * §7 wave 3 — comic PAGE list/create/delete. The generation orchestration
   * the cloud POST route runs around its CRUD piece (Claude scene breakdown,
   * Segmind panel generation, Blob upload, critic sweep) stays at the transport
   * edge — a local host cannot fire Segmind/Claude spend through the CRUD
   * surface, so its POST persists the page row alone.
   */
  readonly comicPageRepo?: ComicPageCrudRepository;
  /** §7 wave 3 — comic PANEL PATCH (fused allowlist write + Phase-C promote). */
  readonly comicPanelRepo?: ComicPanelCrudRepository;
  /** §7 wave 3 — production-shot list + PATCH (promote branch inside). */
  readonly productionShotRepo?: ProductionShotCrudRepository;
  /** §7 wave 3 — Promise Tracker thread/promise read + write. */
  readonly storyStateRepo?: StoryStateRepository;
  /** §7 wave 3 — story-memory list/create/delete. */
  readonly storyMemoryRepo?: StoryMemoryRepository;
  /** §7 wave 3 — Story Graph health read. */
  readonly storyGraphRepo?: StoryGraphRepository;
  /** §7 wave 3 — checkpoint list/create/delete (health snapshot inside). */
  readonly storyCheckpointRepo?: StoryCheckpointRepository;
  /** §7 wave 3 — beat-sheet plan GET/PATCH/DELETE (metered POST stays at the edge). */
  readonly storyPlanRepo?: StoryPlanRepository;
  /**
   * Phase 3 §2 — the generation bundle behind POST /ai/generate. Absent in the
   * default surface by decision (`defaultLocalRouteDeps()` never plants it),
   * so the route answers 501 — never a silent half-mount — until a
   * composition root supplies a bundle (see `LocalGenerationDeps`).
   */
  readonly generation?: LocalGenerationDeps;
  /**
   * Phase 3 §2.5 stage (d) — the run-plan preflight surface behind
   * POST /projects/:projectId/graph/run-plan. Absent in the default surface
   * by decision (the route answers 501): a PURE preflight (never executes
   * anything), whose provider-availability context is the composition root's
   * profile (§5.6 env-only), never a hardcoded shape. The row's `format`
   * always comes from the owned project row, not the profile — one less
   * per-host setting to drift.
   */
  readonly runPlan?: {
    /** Full-row ownership proof + the row's own `format`. */
    readonly projectRepository: Pick<ProjectRepository, "findOwned">;
    /**
     * §5.6's settled `localOwnerId` convention — the ONE users-row id the
     * composition root knows. `findOwned` predicates on `actor.id ===
     * row.userId`, and the loopback transport's ctx actor is the host, not a
     * users row: the bundle supplies the owner id so ownership reads use the
     * production semantics exactly.
     */
    readonly localOwnerId: string;
    /** Profile-derived provider availability + tier (env-only per §5.6). */
    readonly tier: SubscriptionTier;
    readonly hasSegmindKey: boolean;
    readonly hasOpenAIKey: boolean;
  };
  /**
   * Phase 3 §2.5 stage (d) part 2 — the Director write-half behind POST
   * /projects/:projectId/production/generate-package. Absent in the default
   * surface by decision (`defaultLocalRouteDeps()` never plants it — like
   * `generation`/`runPlan`, the route answers 501 until a composition root
   * supplies one). Twinning the cloud route's write half with §5's settled
   * decisions, NOT its orchestration: meter-less (§5.5 — the metered
   * `runDirectorCall` is replaced by the injected `directorPackage` provider
   * port, so there is no refusal-then-refund path at all), non-streaming
   * (§5.4 — the mount refuses `stream: true`), NO Soul ID bootstrap (several
   * real Segmind/Higgsfield calls stay cloud-owned), and a ZERO `§11` hook
   * census (the cloud route fires none — its writes are raw Drizzle — so the
   * bundle carries no hooks seam at all; see the handler's file header). The
   * fresh-slate shot wipe + bulk insert, the character/location rows created
   * from the model's sheets, and the verbatim payload are the whole surface.
   */
  readonly generatePackage?: LocalGeneratePackageDeps;
  /**
   * Master-plan Phase 3 (§10/§10.1) — the canonical portable project snapshot
   * behind GET /projects/:projectId/export + POST /projects/import. Absent in
   * the default surface by decision: the route pair answers 501 until a
   * composition root plants the bundle (`makeSqliteProjectSnapshotPort(db,
   * localOwnerId)` — its readers are owner-bound and its writes are atomic,
   * re-owned, and carry ONE §11.1 revision bump).
   */
  readonly portability?: SnapshotPort;
  /**
   * Master-plan Phase 4 slice 4c (§12) — the provider-visibility read behind
   * GET /providers: detected localhost targets, key-PRESENCE booleans (values
   * never escape), and the routing profile's shoebox shape. Absent in the
   * default surface by decision — the route answers 501 like every optional
   * cluster — until the composition root plants the
   * `providersRead: makeLocalProvidersReadPort(readLocalGenerationProfile())`
   * visibility port (`local-provider-routing.ts`).
   */
  readonly providersRead?: LocalProvidersReadPort;
  /**
   * PLAN-v5 — the shell Settings model picker's data source: OpenCode Go's
   * live catalogue (with the operator key), Anthropic's static ids, or the
   * detected localhost models. Absent → GET /provider-models/:provider 501.
   */
  readonly providerModels?: LocalProviderModelsPort;
  /**
   * PLAN-v5 step 2 — the thin shell's Settings persistence. The host stays
   * fs-free: the composition root supplies a port over its own settings file
   * (the sibling of the SQLite db); absent → GET/POST /settings answer 501
   * like every optional cluster.
   */
  readonly localSettings?: LocalSettingsPort;
  /**
   * §7 wave 2 — the embedding seam behind the World Bible create routes
   * (characters/locations/world-entities). The local host has NO embedding
   * provider in its default surface: when omitted, the fail-open `noEmbedText`
   * below stores rows without embeddings, so duplicate detection stays
   * silently OFF until a local embedding provider exists — the same fail-open
   * class as the pg-side embedding failures.
   */
  readonly createEmbedText?: (text: string) => Promise<number[] | null>;
  /** §7 wave 2 — the tier resolver behind POST /projects' plan cap. */
  readonly getTier?: ProjectTierResolver;
  readonly hooks?: PostCommitHooks;
}

/**
 * The fail-open embedding seam for the default surface: no embedding provider
 * exists on a local host yet, so World Bible creates store rows without
 * embeddings and duplicate detection stays silently off — the same fail-open
 * class as the pg-side embedding failures (the row is written either way;
 * only the similarity warning never fires).
 */
const noEmbedText = async (): Promise<number[] | null> => null;

/**
 * Picks only the named keys off a parsed body — the transport-edge field pin
 * the cloud routes enforce by destructuring. Absent keys are carried through
 * as `undefined`, exactly like destructure-the-whole-shape did pre-migration.
 */
function pinFields(body: unknown, keys: readonly string[]): Record<string, unknown> {
  const source = (body ?? {}) as Record<string, unknown>;
  const pinned: Record<string, unknown> = {};
  for (const key of keys) pinned[key] = source[key];
  return pinned;
}

/** The create-field pins the World Bible POST routes enforce at the edge. */
const CHARACTER_CREATE_FIELDS = [
  "name", "role", "age", "appearance", "personality", "thinkingStyle", "behavior",
  "habits", "fears", "desires", "speechPattern", "backstory", "arc",
  "alwaysInContext", "sortOrder", "contextVisibility",
] as const;
const LOCATION_CREATE_FIELDS = [
  "name", "description", "atmosphere", "history", "sensoryDetails",
  "alwaysInContext", "sortOrder",
] as const;
const PLOT_THREAD_FIELDS = [
  "name", "description", "status", "stakes", "connections",
  "alwaysInContext", "sortOrder",
] as const;
const REFERENCE_WORK_CREATE_FIELDS = ["title", "attributes"] as const;
const RELATIONSHIP_MAP_FIELDS = [
  "characterAId", "characterBId", "trustLevel", "relationshipType", "notes",
  "fourHorsemen", "powerDifferential", "emotionalRegister", "knowledgeAsymmetry",
  "dependencyStructure", "attachmentStyleA", "arcTrajectory",
] as const;
/** §7 wave 3 — the create-field pin the cloud comics POST carried into the handler. */
const COMIC_PAGE_CREATE_FIELDS = ["chapterId", "artStyle"] as const;
/** §7 wave 3 — the panel PATCH's exact allowlist (unknown keys dropped silently). */
const COMIC_PANEL_PATCH_FIELDS = [
  "dialogue", "caption", "speakerName", "bubbleType", "reviewStatus", "panelIndex", "candidateImageUrls",
] as const;
/** §7 wave 3 — the shot PATCH's exact ALLOWED_FIELDS projection (verbatim from the route). */
const PRODUCTION_SHOT_PATCH_FIELDS = [
  "shotType", "cameraMovement", "lightingMood", "timeOfDay",
  "subject", "action", "location", "mood", "soulPrompt", "videoPrompt",
  "dialogue", "speaker", "cameraPreset", "viralPreset",
  "characterEmotion", "focalLength", "duration", "aspectRatio", "generatedVideoUrl",
  "reviewStatus", "sortOrder", "candidatePreviewUrls", "trimStartSec", "trimEndSec",
] as const;
/** §7 wave 3 — story-state POST create field pins (per body.type branch). */
const STORY_THREAD_CREATE_FIELDS = ["name", "threadType", "notes"] as const;
const STORY_PROMISE_CREATE_FIELDS = ["threadId", "setup", "setupChapterId", "payoffIntent", "priority"] as const;
/** §7 wave 3 — story-state PATCH field pins (per threadId/promiseId branch). */
const STORY_THREAD_PATCH_FIELDS = ["status", "resolvedAtChapterId", "notes"] as const;
const STORY_PROMISE_PATCH_FIELDS = ["status", "payoffChapterId", "payoffIntent"] as const;

/**
 * Phase 3 §2 — POST /ai/generate over the loopback transport.
 *
 * The mount mirrors the cloud route's pipeline behaviour with the metering
 * ports and the gates removed by shape (`LocalGenerationDeps` carries neither
 * `reserve`/`finalizeUsage` nor any gate port — the record-only meter, if
 * planted, consults this mount after a success, never the pipeline):
 * validate → authorize (the violation gate, only when the bundle can load
 * confirmations) → buildContext → generate, and stops map to the same
 * statuses. Three deliberate local differences:
 * - `stream: true` is refused at the edge — the socket has no stream channel;
 * - `body.context` participates ONLY in the oversize count (it is the legacy
 *   raw-context field, not a static block here);
 * - the mount carries its own buildContext ceiling (the max-tier budget the
 *   cloud route enforced before its builder ran; local has no tiers, so the
 *   guard lives here rather than in per-tier policy).
 */

/** The cloud route's max-tier context budget, enforced by the mount itself. */
const LOCAL_GENERATE_CONTEXT_CEILING = 150000;

/**
 * Phase 3 §2.3 stage (b) — the stable operation id every record the generate
 * mount stamps carries (distinct from the cloud meter's `"generate"`
 * operation, so a future store can tell the two apart).
 */
const LOCAL_GENERATE_METER_OPERATION = "local-generate";

/**
 * The POST body. `context`/`additionalContext` are the two client-side blocks
 * the cloud route read — the former counts toward the oversize ceiling only,
 * the latter joins the dynamic context block. `narrativeStructure`,
 * `skipBlueprint`, and `groundInResearch` are cloud-only integrations and are
 * deliberately not part of the local contract.
 *
 * NOTE: `stream` is read defensively off the raw body (not typed here) so it
 * can be refused without widening the contract that says "no streaming".
 */
type LocalGenerateBody = GenerateChapterInput & {
  /** The legacy raw-context field — counted by the oversize ceiling only. */
  readonly context?: string;
  /** Client-supplied context that joins the dynamic block locally. */
  readonly additionalContext?: string;
};

const noGeneration = (): { ok: false; status: 501; reason: string } => ({
  ok: false,
  status: 501,
  reason: "AI generation is not configured for this host.",
});

/** Post-generate failure bodies, verbatim from the cloud route's mapping. */
function mapGenerationOutcome(outcome: GenerationOutcome): unknown {
  if (outcome.ok) {
    // The cloud route's success body, byte-shaped: a local client cannot tell
    // the hosts apart (internal telemetry like `gates` stays transport-local).
    return { text: outcome.text, model: outcome.model, tokensUsed: outcome.tokensUsed };
  }

  if (outcome.control !== undefined) {
    if (outcome.control instanceof Response) {
      // Unreachable while the bundle carries no meter — a control Response
      // only comes from the billing ports — but a half-mounted bundle must
      // fail loudly rather than ride an unusable Response over JSON.
      return {
        ok: false,
        status: 500,
        reason: "A control response cannot ride the local transport.",
      };
    }
    const control = outcome.control as Record<string, unknown>;
    // A violation confirmation is a control, not an error: the client opens
    // its dialog and retries with `bypassViolationCheck`, so the local host
    // answers it 200 exactly as the cloud route did.
    if (outcome.stoppedAt === "authorize") return control;
    return { ok: false, status: 400, ...control };
  }

  if (outcome.gateRef) {
    // Unreachable while the bundle carries no gates port; should a future
    // bundle ever mount one, the surface still answers the cloud vocabulary.
    return { ok: false, status: 403, error: "upgrade_required", feature: outcome.gateRef.value };
  }

  // Post-generate (no stoppedAt): the exact reason→status mapping the cloud
  // route ran, so the local client sees the same bodies. The provider's own
  // words are logged, never shown.
  console.error("[local-host] generation failed:", (outcome.reason ?? "").slice(0, 300));
  const msg = outcome.reason ?? "";
  if (msg.includes("rate_limit") || msg.includes("529")) {
    return {
      ok: false,
      status: 429,
      error: "Anthropic rate limit hit. Wait a moment and try again.",
      retryable: true,
    };
  }
  if (msg.includes("context_length") || msg.includes("too long")) {
    return {
      ok: false,
      status: 400,
      error: "Context too long. Reduce World Bible detail or clear old memories.",
    };
  }
  return { ok: false, status: 500, error: "Generation failed. Please try again." };
}

async function localGenerate(
  ctx: RequestContext,
  generation: LocalGenerationDeps,
  raw: unknown,
): Promise<unknown> {
  const body = (raw ?? {}) as LocalGenerateBody;

  // `projectScope` is the host's first-class contract, and no port below
  // would enforce it (no gates, no meter, no ownership probe in the bundle),
  // so the check rides here, before the pipeline runs anything.
  if (body.projectId !== undefined && !mayAccessProject(ctx, body.projectId)) {
    return { ok: false, status: 403, reason: "Project is out of scope for this host." };
  }

  // Non-streaming by decision, not by omission. Refusing before the pipeline
  // means no spend and no build happens for a stream the transport cannot
  // carry back.
  if ((body as { stream?: unknown }).stream === true) {
    return { ok: false, status: 400, reason: "Streaming is not supported on the local host." };
  }

  const input: GenerateChapterInput = {
    mode: body.mode,
    prompt: body.prompt,
    projectId: body.projectId,
    chapterId: body.chapterId,
    bypassViolationCheck: body.bypassViolationCheck,
    staticContext: body.staticContext,
    dynamicContext: body.dynamicContext,
    additionalContext: body.additionalContext,
    format: body.format,
  };

  // Cloud parity: the prompt the generate port receives carries the mode's
  // directive suffix (the built-in builder applies it below), while records
  // still see the raw prompt — the tier-capped-then-suffixed chain, minus the
  // tier cap.
  let effectivePrompt = body.prompt ?? "";

  // The ports are built EXPLICITLY from the picked fields — never spread
  // wholesale from `generation` — so no cast can smuggle a meter or a gate
  // in; `generateChapter` forwards whatever it is handed, so the mount is
  // where the shape is actually enforced.
  const ports: GenerateChapterPorts = {
    generate: async (req, genCtx) =>
      await generation.generate(
        req.prompt === effectivePrompt ? req : { ...req, prompt: effectivePrompt },
        genCtx,
      ),
    // The oversize ceiling rides AHEAD of whichever builder the bundle
    // planted: it is the mount's pre-spend guard, not part of one
    // provider's context assembly.
    buildContext: async (req) => {
      if (
        (body.context ?? "").length + (body.prompt ?? "").length >
        LOCAL_GENERATE_CONTEXT_CEILING
      ) {
        return {
          stop: {
            ok: false,
            stoppedAt: "buildContext",
            control: {
              error: "Context too large. Try reducing your World Bible or clearing old memories.",
            },
          },
        };
      }
      if (generation.buildContext) {
        const built = await generation.buildContext(req);
        // Cloud parity: the generate port receives the directive-suffixed
        // prompt while records keep the raw one. A planted builder returns
        // only {static, dynamic} (the pipeline port stops there); the MOUNT
        // owns effectivePrompt, so the directive applies here — the cloud's
        // cap→suffix order, minus the cap.
        effectivePrompt = applyModePromptDirective(req.mode, effectivePrompt);
        return built;
      }
      // Floor assembly — deliberate local differences (§2.2 open decisions):
      // no tier cap (local has no tiers), no series/universe builders
      // (userId-keyed), no aiisms/prose augmentation (tier- and db-gated).
      effectivePrompt = applyModePromptDirective(req.mode, effectivePrompt);
      return {
        ...(body.staticContext === undefined ? {} : { static: body.staticContext }),
        ...(composeDynamicContext([body.dynamicContext, body.additionalContext]).length
          ? { dynamic: composeDynamicContext([body.dynamicContext, body.additionalContext]) }
          : {}),
      };
    },
    ...(generation.chooseProvider ? { chooseProvider: generation.chooseProvider } : {}),
    ...(generation.loadViolations ? { loadViolations: generation.loadViolations } : {}),
    ...(generation.persist ? { persist: generation.persist } : {}),
  };

  const outcome = await generateChapter(input, ctx, ports);

  // Phase 3 §2.3 stage (b) — record-only metering, the MOUNT's job, never a
  // pipeline stage. Only a successful outcome records (stops and failures all
  // return ok:false, including the 200 authorize-stop confirmation). The
  // record is fire-and-forget: it must add no latency to the response, and a
  // metering failure is fail-open logging, never a generation failure. The
  // meter's contract has no refusal path and no control, so a rejection here
  // cannot mean "the generation should stop" — it is caught and warned, and
  // never escapes into an unhandled rejection or this response.
  if (outcome.ok && generation.meter) {
    void generation.meter
      .record({
        operation: LOCAL_GENERATE_METER_OPERATION,
        model: outcome.model,
        tokensUsed: outcome.tokensUsed,
        at: new Date(),
      })
      .catch((e) => {
        console.warn(
          "[local-host] generation meter record failed:",
          e instanceof Error ? e.message : e,
        );
      });
  }

  return mapGenerationOutcome(outcome);
}

export function defaultLocalRoutes(deps: DefaultRouteDeps): readonly LocalHostRoute[] {
  const storyHistoryRepo = deps.storyHistoryRepo;
  const noHistory = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Story history is not configured for this host.",
  });
  // §7 wave 2 — optional per-cluster deps; absent = an explicit 501, mirroring
  // the story-history pattern above.
  const characterRepo = deps.characterRepo;
  const locationRepo = deps.locationRepo;
  const plotThreadRepo = deps.plotThreadRepo;
  const referenceWorkRepo = deps.referenceWorkRepo;
  const worldEntityRepo = deps.worldEntityRepo;
  const violationRepo = deps.violationRepo;
  const relationshipMapRepo = deps.relationshipMapRepo;
  const projectsCoreRepo = deps.projectsCoreRepo;
  const noProjects = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Project storage is not configured for this host.",
  });
  const noCharacters = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Character storage is not configured for this host.",
  });
  const noLocations = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Location storage is not configured for this host.",
  });
  const noThreads = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Plot thread storage is not configured for this host.",
  });
  const noReferenceWorks = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Reference work storage is not configured for this host.",
  });
  const noWorldEntities = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "World entity storage is not configured for this host.",
  });
  const noViolations = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Intentional violation storage is not configured for this host.",
  });
  const noRelationshipMap = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Relationship map storage is not configured for this host.",
  });
  // §7 wave 3 — optional per-cluster deps; absent = an explicit 501, mirroring
  // the wave-2 pattern above.
  const comicPageRepo = deps.comicPageRepo;
  const comicPanelRepo = deps.comicPanelRepo;
  const productionShotRepo = deps.productionShotRepo;
  // phase 3 §2.5 stage (d) — the run-plan preflight bundle; absent = 501 like
  // every other optional cluster.
  const runPlanDep = deps.runPlan;
  const noRunPlan = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "The run-plan preflight is not configured for this host.",
  });
  // phase 3 §2.5 stage (d) part 2 — the Director write-half bundle; absent =
  // 501 like every other optional cluster (see DefaultRouteDeps.generatePackage
  // for the settled §5 posture it mounts behind).
  const generatePackageDep = deps.generatePackage;
  const noGeneratePackage = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "The Director package surface is not configured for this host.",
  });
  // Master-plan Phase 3 — the canonical snapshot pair; absent = 501 like every
  // other optional cluster.
  const portability = deps.portability;
  const noPortability = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Project snapshot portability is not configured for this host.",
  });  const storyStateRepo = deps.storyStateRepo;
  const storyMemoryRepo = deps.storyMemoryRepo;
  const storyGraphRepo = deps.storyGraphRepo;
  const storyCheckpointRepo = deps.storyCheckpointRepo;
  const storyPlanRepo = deps.storyPlanRepo;
  // Phase 3 §2 — the AI-generation mount. OFF in the default surface:
  // `defaultLocalRouteDeps()` never plants this bundle, so the route answers
  // 501 (noGeneration) until a composition root supplies one.
  const generation = deps.generation;
  // Master-plan Phase 4 slice 4c (§12) — the provider-visibility read; absent
  // = 501 like every other optional cluster.
  const providersRead = deps.providersRead;
  const noProvidersRead = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Provider visibility is not configured for this host.",
  });
  // PLAN-v5 step 2 — the shell's Settings persistence; absent = 501.
  const localSettings = deps.localSettings;
  const noLocalSettings = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Local settings are not configured for this host.",
  });
  // PLAN-v5 — model lists for the Settings picker; absent = 501.
  const providerModels = deps.providerModels;
  const noProviderModels = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Provider model lists are not configured for this host.",
  });
  const noComicPages = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Comic page storage is not configured for this host.",
  });
  const noComicPanels = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Comic panel storage is not configured for this host.",
  });
  const noProductionShots = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Production shot storage is not configured for this host.",
  });
  const noStoryState = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Story state storage is not configured for this host.",
  });
  const noStoryMemories = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Story memory storage is not configured for this host.",
  });
  const noStoryGraph = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Story graph storage is not configured for this host.",
  });
  const noStoryCheckpoints = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Story checkpoint storage is not configured for this host.",
  });
  const noStoryPlans = (): { ok: false; status: 501; reason: string } => ({
    ok: false,
    status: 501,
    reason: "Story plan storage is not configured for this host.",
  });
  const embedText = deps.createEmbedText ?? noEmbedText;
  return [
    {
      method: "PATCH",
      path: "/projects/:projectId/chapters/:chapterId",
      handle: ({ ctx, params, body }) =>
        updateChapter(
          ctx,
          {
            projectId: params.projectId!,
            chapterId: params.chapterId!,
            // Accept either `{ patch: {...} }` (the cloud route's shape) or a
            // bare patch object — both, rather than guessing one.
            patch: extractPatch(body),
          },
          deps.chapterRepo,
          deps.hooks,
        ),
    },
    {
      method: "DELETE",
      path: "/projects/:projectId/chapters/:chapterId",
      handle: ({ ctx, params }) =>
        deleteChapter(
          ctx,
          { projectId: params.projectId!, chapterId: params.chapterId! },
          deps.chapterRepo,
        ),
    },
    {
      method: "GET",
      path: "/projects/:projectId/story-bible",
      handle: ({ ctx, params }) =>
        getStoryBible(ctx, { projectId: params.projectId! }, deps.storyBibleRepo, deps.hooks),
    },
    {
      method: "POST",
      path: "/projects/:projectId/story-transactions",
      handle: ({ ctx, params, body }) =>
        applyStoryTransaction(
          ctx,
          {
            projectId: params.projectId!,
            // projectId comes from the path params, never the body.
            ...(body as Omit<ApplyStoryTransactionInput, "projectId">),
          },
          deps.storyTransactionRepo,
          deps.hooks,
        ),
    },
    // -------- PLAN-v5 step 4 — the accept/reject loop's PREVIEW half
    // PURE: builds the SAME user-edit transaction the cloud form-save adapter
    // builds (one shared builder: `buildEntityEditTransaction`), so the shell
    // can show old→new per field and write NOTHING until the writer accepts.
    // Accept posts the returned change list to the story-transactions route
    // above; Reject never calls the server at all.
    {
      method: "POST",
      path: "/projects/:projectId/entity-proposals",
      handle: ({ body }) => {
        const b = (body ?? {}) as Record<string, unknown>;
        const key = b["entityKey"];
        if (typeof key !== "string" || !(key in DIFF_FIELDS)) {
          return {
            ok: false,
            status: 400,
            reason: "entityKey must be one of characters|locations|plotThreads|worldEntities",
          };
        }
        const entity = b["entity"];
        const draft = b["draft"];
        if (
          !entity || typeof entity !== "object" || Array.isArray(entity) ||
          !draft || typeof draft !== "object" || Array.isArray(draft)
        ) {
          return { ok: false, status: 400, reason: "entity and draft are required objects" };
        }
        const built = buildEntityEditTransaction(
          key as Parameters<typeof buildEntityEditTransaction>[0],
          entity as Record<string, unknown>,
          draft as Record<string, unknown>,
        );
        return { ok: true, proposal: built };
      },
    },
    // -------- PLAN-v5 step 5 — Story Doctor v1 (EXACTLY two checks)
    // Deterministic, provider-free: knowledge conflicts (a character acting on
    // information before the timeline says they learned it) + unresolved
    // promises (setups never paid off by the final chapter). Reads the SAME
    // project graph the editor reads; no LLM, no cost, no network.
    {
      method: "GET",
      path: "/projects/:projectId/story-doctor",
      handle: async ({ ctx, params }) => {
        if (!projectsCoreRepo) return noProjects();
        if (!mayAccessProject(ctx, params.projectId!)) {
          return { ok: false, status: 403, reason: "Project is out of scope for this host." };
        }
        const owns = await projectsCoreRepo.ownsProject(params.projectId!, ctx.actor.id);
        if (!owns) return { ok: false, status: 404, reason: "Not found" };
        const graph = (await projectsCoreRepo.read(params.projectId!)) as unknown as {
          chapters?: DoctorChapter[];
          storyMemories?: DoctorMemory[];
        } | null;
        if (!graph) return { ok: false, status: 404, reason: "Not found" };
        const report = runStoryDoctor({
          chapters: graph.chapters ?? [],
          memories: graph.storyMemories ?? [],
        });
        return { ok: true, ...report };
      },
    },
    {
      method: "GET",
      path: "/projects/:projectId/story-transactions",
      handle: ({ ctx, params }) => {
        if (!storyHistoryRepo) return noHistory();
        return listStoryTransactions(ctx, { projectId: params.projectId! }, storyHistoryRepo);
      },
    },
    {
      method: "GET",
      path: "/projects/:projectId/story-transactions/:transactionId",
      handle: ({ ctx, params }) => {
        if (!storyHistoryRepo) return noHistory();
        return getStoryTransaction(
          ctx,
          { projectId: params.projectId!, transactionId: params.transactionId! },
          storyHistoryRepo,
        );
      },
    },
    {
      method: "POST",
      path: "/projects/:projectId/story-transactions/:transactionId/revert",
      handle: ({ ctx, params }) => {
        if (!storyHistoryRepo) return noHistory();
        return revertStoryTransaction(
          ctx,
          { projectId: params.projectId!, transactionId: params.transactionId! },
          storyHistoryRepo,
          deps.hooks ?? {},
        );
      },
    },
    // -------------------------------------------------- §7 wave 2 — projects
    {
      method: "GET",
      path: "/projects",
      handle: ({ ctx }) => {
        if (!projectsCoreRepo) return noProjects();
        return listProjects(ctx, projectsCoreRepo);
      },
    },
    {
      method: "POST",
      path: "/projects",
      handle: ({ ctx, body }) => {
        if (!projectsCoreRepo) return noProjects();
        return createProject(
          ctx,
          { data: (body ?? {}) as ProjectCreateData },
          projectsCoreRepo,
          deps.hooks,
          // The tier resolver the cloud route always supplied via getUserTier.
          deps.getTier ?? getUserTier,
        );
      },
    },
    {
      method: "GET",
      path: "/projects/:projectId",
      handle: ({ ctx, params }) => {
        if (!projectsCoreRepo) return noProjects();
        return readProject(ctx, { projectId: params.projectId! }, projectsCoreRepo);
      },
    },
    {
      method: "PATCH",
      path: "/projects/:projectId",
      handle: ({ ctx, params, body }) => {
        if (!projectsCoreRepo) return noProjects();
        return updateProject(
          ctx,
          { projectId: params.projectId!, patch: body },
          projectsCoreRepo,
          deps.hooks,
        );
      },
    },
    {
      method: "DELETE",
      path: "/projects/:projectId",
      handle: ({ ctx, params }) => {
        if (!projectsCoreRepo) return noProjects();
        return deleteProject(ctx, { projectId: params.projectId! }, projectsCoreRepo, deps.hooks);
      },
    },
    // ------------------------------------------------- §7 wave 2 — characters
    {
      method: "POST",
      path: "/projects/:projectId/characters",
      handle: ({ ctx, params, body }) => {
        if (!characterRepo) return noCharacters();
        const b = (body ?? {}) as Record<string, unknown>;
        // Same `name is required` 400 the cloud route kept at the edge.
        if (typeof b["name"] !== "string" || !b["name"]) {
          return { ok: false, status: 400, reason: "name is required" };
        }
        return createCharacter(
          ctx,
          {
            projectId: params.projectId!,
            data: pinFields(body, CHARACTER_CREATE_FIELDS) as unknown as CharacterCreateData,
          },
          characterRepo,
          deps.hooks,
          embedText,
          // `postCreate` (the AI intelligence bootstrap) left unset — the AI
          // surface stays OFF by default; generation itself mounts behind the
          // optional `generation` bundle (phase 3 §2), only from a composition
          // root that plants it.
        );
      },
    },
    {
      method: "PATCH",
      path: "/projects/:projectId/characters/:characterId",
      handle: ({ ctx, params, body }) => {
        if (!characterRepo) return noCharacters();
        return updateCharacter(
          ctx,
          {
            projectId: params.projectId!,
            characterId: params.characterId!,
            patch: (body ?? {}) as Record<string, unknown>,
          },
          characterRepo,
          deps.hooks,
        );
      },
    },
    {
      method: "DELETE",
      path: "/projects/:projectId/characters/:characterId",
      handle: ({ ctx, params }) => {
        if (!characterRepo) return noCharacters();
        return deleteCharacter(
          ctx,
          { projectId: params.projectId!, characterId: params.characterId! },
          characterRepo,
          deps.hooks,
        );
      },
    },
    // -------------------------------------------------- §7 wave 2 — locations
    {
      method: "POST",
      path: "/projects/:projectId/locations",
      handle: ({ ctx, params, body }) => {
        if (!locationRepo) return noLocations();
        const b = (body ?? {}) as Record<string, unknown>;
        if (typeof b["name"] !== "string" || !b["name"]) {
          return { ok: false, status: 400, reason: "name is required" };
        }
        return createLocation(
          ctx,
          {
            projectId: params.projectId!,
            data: pinFields(body, LOCATION_CREATE_FIELDS) as unknown as LocationCreateData,
          },
          locationRepo,
          deps.hooks,
          embedText,
        );
      },
    },
    {
      method: "PATCH",
      path: "/projects/:projectId/locations/:locationId",
      handle: ({ ctx, params, body }) => {
        if (!locationRepo) return noLocations();
        return updateLocation(
          ctx,
          {
            projectId: params.projectId!,
            locationId: params.locationId!,
            patch: (body ?? {}) as Record<string, unknown>,
          },
          locationRepo,
          deps.hooks,
        );
      },
    },
    {
      method: "DELETE",
      path: "/projects/:projectId/locations/:locationId",
      handle: ({ ctx, params }) => {
        if (!locationRepo) return noLocations();
        return deleteLocation(
          ctx,
          { projectId: params.projectId!, locationId: params.locationId! },
          locationRepo,
          deps.hooks,
        );
      },
    },
    // ----------------------------------------------- §7 wave 2 — plot threads
    {
      method: "POST",
      path: "/projects/:projectId/plot-threads",
      handle: ({ ctx, params, body }) => {
        if (!plotThreadRepo) return noThreads();
        const b = (body ?? {}) as Record<string, unknown>;
        if (typeof b["name"] !== "string" || !b["name"]) {
          return { ok: false, status: 400, reason: "name is required" };
        }
        return createPlotThread(
          ctx,
          {
            projectId: params.projectId!,
            data: pinFields(body, PLOT_THREAD_FIELDS) as unknown as PlotThreadCreateData,
          },
          plotThreadRepo,
          deps.hooks,
        );
      },
    },
    {
      method: "PATCH",
      path: "/projects/:projectId/plot-threads/:threadId",
      handle: ({ ctx, params, body }) => {
        if (!plotThreadRepo) return noThreads();
        return updatePlotThread(
          ctx,
          {
            projectId: params.projectId!,
            threadId: params.threadId!,
            patch: pinFields(body, PLOT_THREAD_FIELDS) as unknown as PlotThreadPatchData,
          },
          plotThreadRepo,
          deps.hooks,
        );
      },
    },
    {
      method: "DELETE",
      path: "/projects/:projectId/plot-threads/:threadId",
      handle: ({ ctx, params }) => {
        if (!plotThreadRepo) return noThreads();
        return deletePlotThread(
          ctx,
          { projectId: params.projectId!, threadId: params.threadId! },
          plotThreadRepo,
          deps.hooks,
        );
      },
    },
    // -------------------------------------------- §7 wave 2 — reference works
    {
      method: "POST",
      path: "/projects/:projectId/reference-works",
      handle: ({ ctx, params, body }) => {
        if (!referenceWorkRepo) return noReferenceWorks();
        const b = (body ?? {}) as Record<string, unknown>;
        if (typeof b["title"] !== "string" || !b["title"]) {
          return { ok: false, status: 400, reason: "title is required" };
        }
        return createReferenceWork(
          ctx,
          {
            projectId: params.projectId!,
            data: pinFields(body, REFERENCE_WORK_CREATE_FIELDS) as unknown as ReferenceWorkCreateData,
          },
          referenceWorkRepo,
          deps.hooks,
        );
      },
    },
    {
      method: "DELETE",
      path: "/projects/:projectId/reference-works/:refId",
      handle: ({ ctx, params }) => {
        if (!referenceWorkRepo) return noReferenceWorks();
        return deleteReferenceWork(
          ctx,
          { projectId: params.projectId!, refId: params.refId! },
          referenceWorkRepo,
          deps.hooks,
        );
      },
    },
    // --------------------------------------------- §7 wave 2 — world entities
    {
      method: "POST",
      path: "/projects/:projectId/world-entities",
      handle: ({ ctx, params, body }) => {
        if (!worldEntityRepo) return noWorldEntities();
        const b = (body ?? {}) as Record<string, unknown>;
        // The cloud route's edge guards, in its order: `name is required`,
        // kind normalization (a `.catch` enum, so it never throws), then
        // `invalid properties` → 400.
        if (typeof b["name"] !== "string" || !b["name"]) {
          return { ok: false, status: 400, reason: "name is required" };
        }
        const kind = WorldEntityKindSchema.parse(b["kind"] ?? "object");
        let properties: WorldEntityProperties;
        try {
          properties = encodeWorldEntityProperties(b["properties"] ?? {});
        } catch {
          return { ok: false, status: 400, reason: "invalid properties" };
        }
        return createWorldEntity(
          ctx,
          {
            projectId: params.projectId!,
            entity: {
              kind,
              name: b["name"] as string,
              summary: b["summary"] as string | undefined,
              description: b["description"] as string | undefined,
              properties,
              linkedCharacterIds: b["linkedCharacterIds"] as string[] | undefined,
              linkedLocationIds: b["linkedLocationIds"] as string[] | undefined,
              linkedPlotThreadIds: b["linkedPlotThreadIds"] as string[] | undefined,
              linkedEntityIds: b["linkedEntityIds"] as string[] | undefined,
              alwaysInContext: b["alwaysInContext"] as boolean | undefined,
              sortOrder: b["sortOrder"] as number | undefined,
            },
          },
          worldEntityRepo,
          deps.hooks,
          embedText,
        );
      },
    },
    {
      method: "GET",
      path: "/projects/:projectId/world-entities",
      handle: ({ ctx, params }) => {
        if (!worldEntityRepo) return noWorldEntities();
        return listWorldEntities(ctx, { projectId: params.projectId! }, worldEntityRepo);
      },
    },
    {
      method: "PATCH",
      path: "/projects/:projectId/world-entities/:entityId",
      handle: ({ ctx, params, body }) => {
        if (!worldEntityRepo) return noWorldEntities();
        return updateWorldEntity(
          ctx,
          {
            projectId: params.projectId!,
            entityId: params.entityId!,
            patch: (body ?? {}) as Record<string, unknown>,
          },
          worldEntityRepo,
          deps.hooks,
        );
      },
    },
    {
      method: "DELETE",
      path: "/projects/:projectId/world-entities/:entityId",
      handle: ({ ctx, params }) => {
        if (!worldEntityRepo) return noWorldEntities();
        return deleteWorldEntity(
          ctx,
          { projectId: params.projectId!, entityId: params.entityId! },
          worldEntityRepo,
          deps.hooks,
        );
      },
    },
    // ------------------------------------- §7 wave 2 — intentional violations
    {
      method: "GET",
      path: "/projects/:projectId/intentional-violation",
      handle: ({ ctx, params }) => {
        if (!violationRepo) return noViolations();
        return readIntentionalViolations(ctx, { projectId: params.projectId! }, violationRepo);
      },
    },
    {
      method: "POST",
      path: "/projects/:projectId/intentional-violation",
      handle: ({ ctx, params, body }) => {
        if (!violationRepo) return noViolations();
        const b = (body ?? {}) as Record<string, unknown>;
        return recordIntentionalViolation(
          ctx,
          {
            projectId: params.projectId!,
            violationType: b["violationType"] as string | undefined,
            purpose: b["purpose"] as string | undefined,
          },
          violationRepo,
          deps.hooks,
        );
      },
    },
    // ----------------------------------------- §7 wave 2 — relationship map
    {
      method: "GET",
      path: "/projects/:projectId/relationship-map",
      handle: ({ ctx, params }) => {
        if (!relationshipMapRepo) return noRelationshipMap();
        return readRelationshipMap(ctx, { projectId: params.projectId! }, relationshipMapRepo);
      },
    },
    {
      method: "PATCH",
      path: "/projects/:projectId/relationship-map",
      handle: ({ ctx, params, body }) => {
        if (!relationshipMapRepo) return noRelationshipMap();
        const b = (body ?? {}) as Record<string, unknown>;
        if (!b["characterAId"] || !b["characterBId"]) {
          return {
            ok: false,
            status: 400,
            reason: "characterAId and characterBId required",
          };
        }
        return upsertRelationshipMap(
          ctx,
          {
            // projectId from the URL outranks anything the client sent.
            ...(pinFields(body, RELATIONSHIP_MAP_FIELDS) as unknown as RelationshipMapUpsertPayload),
            projectId: params.projectId!,
          },
          relationshipMapRepo,
          deps.hooks,
        );
      },
    },
    // ------------------------------------------------- §7 wave 3 — comic pages
    {
      method: "GET",
      path: "/projects/:projectId/comics",
      handle: ({ ctx, params }) => {
        if (!comicPageRepo) return noComicPages();
        return listComicPages(ctx, { projectId: params.projectId! }, comicPageRepo);
      },
    },
    {
      method: "POST",
      path: "/projects/:projectId/comics",
      handle: ({ ctx, params, body }) => {
        if (!comicPageRepo) return noComicPages();
        // CRUD only: the cloud POST's Claude scene breakdown, Segmind/StoryDiffusion
        // panel generation, Blob uploads and the critic sweep stayed at the
        // transport edge, so this verb persists the page row alone (the page
        // NUMBER rule and the §11 bump are the handler's).
        return createComicPage(
          ctx,
          {
            projectId: params.projectId!,
            data: pinFields(body, COMIC_PAGE_CREATE_FIELDS) as unknown as ComicPageCreateData,
          },
          comicPageRepo,
          deps.hooks,
        );
      },
    },
    {
      method: "DELETE",
      path: "/projects/:projectId/comics/:pageId",
      handle: ({ ctx, params }) => {
        if (!comicPageRepo) return noComicPages();
        return deleteComicPage(
          ctx,
          { projectId: params.projectId!, pageId: params.pageId! },
          comicPageRepo,
          deps.hooks,
        );
      },
    },
    // ------------------------------------------------- §7 wave 3 — comic panels
    {
      method: "PATCH",
      path: "/projects/:projectId/comics/:pageId/panels/:panelId",
      handle: ({ ctx, params, body }) => {
        if (!comicPanelRepo) return noComicPanels();
        const b = (body ?? {}) as Record<string, unknown>;
        return updateComicPanel(
          ctx,
          {
            projectId: params.projectId!,
            // pageId is carried by the URL shape, but (as the cloud route
            // documents) the verb itself never uses it.
            panelId: params.panelId!,
            patch: pinFields(body, COMIC_PANEL_PATCH_FIELDS) as Record<string, unknown>,
            promoteCandidateUrl: b["promoteCandidateUrl"],
          },
          comicPanelRepo,
          deps.hooks,
        );
      },
    },
    // ---------------------------------------------- §7 wave 3 — production shots
    {
      method: "GET",
      path: "/projects/:projectId/production/shots",
      handle: ({ ctx, params }) => {
        if (!productionShotRepo) return noProductionShots();
        return listProductionShots(ctx, { projectId: params.projectId! }, productionShotRepo);
      },
    },
    {
      method: "PATCH",
      path: "/projects/:projectId/production/shots/:shotId",
      handle: ({ ctx, params, body }) => {
        if (!productionShotRepo) return noProductionShots();
        const b = (body ?? {}) as Record<string, unknown>;
        return updateProductionShot(
          ctx,
          {
            projectId: params.projectId!,
            shotId: params.shotId!,
            patch: pinFields(body, PRODUCTION_SHOT_PATCH_FIELDS) as Record<string, unknown>,
            promoteCandidateUrl: b["promoteCandidateUrl"],
          },
          productionShotRepo,
          deps.hooks,
        );
      },
    },
    // ---------------------------------------------- §7 wave 3 — story-state (OS)
    {
      method: "GET",
      path: "/projects/:projectId/story-state",
      handle: ({ ctx, params }) => {
        if (!storyStateRepo) return noStoryState();
        return listStoryState(ctx, { projectId: params.projectId! }, storyStateRepo);
      },
    },
    {
      method: "POST",
      path: "/projects/:projectId/story-state",
      handle: ({ ctx, params, body }) => {
        if (!storyStateRepo) return noStoryState();
        const b = (body ?? {}) as Record<string, unknown>;
        // The type/threadId/promiseId discriminators were the route's transport
        // concern — kept at the edge in the route's branch order, with its
        // exact 400 bodies.
        if (b["type"] === "thread") {
          return createStoryThread(
            ctx,
            {
              projectId: params.projectId!,
              data: pinFields(body, STORY_THREAD_CREATE_FIELDS) as unknown as StoryThreadCreateData,
            },
            storyStateRepo,
            deps.hooks,
          );
        }
        if (b["type"] === "promise") {
          // embedSetup (the fire-and-forget promise-embedding refresh that
          // powers knowledge_audit's semantic cross-referencing) left unset:
          // the handler's fail-open no-op default stands in, so a local host
          // without an embedding service creates un-embedded promises — the
          // same fail-open class as createEmbedText above. The cloud route
          // binds updatePromiseEmbedding into this seam.
          return createStoryPromise(
            ctx,
            {
              projectId: params.projectId!,
              data: pinFields(body, STORY_PROMISE_CREATE_FIELDS) as unknown as StoryPromiseCreateData,
            },
            storyStateRepo,
            deps.hooks,
          );
        }
        return { ok: false, status: 400, reason: "type required: thread or promise" };
      },
    },
    {
      method: "PATCH",
      path: "/projects/:projectId/story-state",
      handle: ({ ctx, params, body }) => {
        if (!storyStateRepo) return noStoryState();
        const b = (body ?? {}) as Record<string, unknown>;
        if (b["threadId"]) {
          return updateStoryThread(
            ctx,
            {
              projectId: params.projectId!,
              threadId: b["threadId"] as string,
              patch: pinFields(body, STORY_THREAD_PATCH_FIELDS) as unknown as StoryThreadPatchInput,
            },
            storyStateRepo,
            deps.hooks,
          );
        }
        if (b["promiseId"]) {
          return updateStoryPromise(
            ctx,
            {
              projectId: params.projectId!,
              promiseId: b["promiseId"] as string,
              patch: pinFields(body, STORY_PROMISE_PATCH_FIELDS) as unknown as StoryPromisePatchInput,
            },
            storyStateRepo,
            deps.hooks,
          );
        }
        return { ok: false, status: 400, reason: "threadId or promiseId required" };
      },
    },
    // ---------------------------------------------- §7 wave 3 — story memories
    {
      method: "GET",
      path: "/projects/:projectId/story-memories",
      handle: ({ ctx, params }) => {
        if (!storyMemoryRepo) return noStoryMemories();
        return listStoryMemories(ctx, { projectId: params.projectId! }, storyMemoryRepo);
      },
    },
    {
      method: "POST",
      path: "/projects/:projectId/story-memories",
      handle: ({ ctx, params, body }) => {
        if (!storyMemoryRepo) return noStoryMemories();
        const b = (body ?? {}) as Record<string, unknown>;
        // The `fact is required` 400 stayed at the edge (same transport class
        // as `name is required` on the World Bible verbs). The structuredData
        // normalization is the handler's (it never rejects).
        const fact = b["fact"];
        if (typeof fact !== "string" || !fact.trim()) {
          return { ok: false, status: 400, reason: "fact required" };
        }
        return createStoryMemory(
          ctx,
          {
            projectId: params.projectId!,
            fact,
            category: b["category"] ?? "general",
            structuredData: b["structuredData"],
          },
          storyMemoryRepo,
          deps.hooks,
        );
      },
    },
    {
      method: "DELETE",
      path: "/projects/:projectId/story-memories",
      handle: ({ ctx, params, body }) => {
        if (!storyMemoryRepo) return noStoryMemories();
        const b = (body ?? {}) as Record<string, unknown>;
        // memoryId arrives in the BODY — the route's original transport shape.
        return deleteStoryMemory(
          ctx,
          { projectId: params.projectId!, memoryId: b["memoryId"] },
          storyMemoryRepo,
          deps.hooks,
        );
      },
    },
    // ------------------------------------------------ §7 wave 3 — story graph
    {
      method: "GET",
      path: "/projects/:projectId/story-graph",
      handle: async ({ ctx, params }) => {
        if (!storyGraphRepo) return noStoryGraph();
        const result = await readStoryGraph(ctx, { projectId: params.projectId! }, storyGraphRepo);
        if (!result.ok) return result;
        // The cloud route spreads graph+health+trim as top-level body keys;
        // emit the same shape so a consumer can't tell the hosts apart.
        return { ...result.graph, health: result.health, contextTrimmed: result.contextTrimmed };
      },
    },
    // ---------------------------------------------- §7 wave 3 — story checkpoints
    {
      method: "GET",
      path: "/projects/:projectId/checkpoints",
      handle: ({ ctx, params }) => {
        if (!storyCheckpointRepo) return noStoryCheckpoints();
        return listCheckpoints(ctx, { projectId: params.projectId! }, storyCheckpointRepo);
      },
    },
    {
      method: "POST",
      path: "/projects/:projectId/checkpoints",
      handle: ({ ctx, params, body }) => {
        if (!storyCheckpointRepo) return noStoryCheckpoints();
        const b = (body ?? {}) as Record<string, unknown>;
        return createCheckpoint(
          ctx,
          { projectId: params.projectId!, name: b["name"], notes: b["notes"] },
          storyCheckpointRepo,
          deps.hooks,
        );
      },
    },
    {
      method: "DELETE",
      path: "/projects/:projectId/checkpoints",
      handle: async ({ ctx, params, body }) => {
        if (!storyCheckpointRepo) return noStoryCheckpoints();
        const b = (body ?? {}) as Record<string, unknown>;
        // checkpointId arrives in the BODY (the route's transport shape); the
        // success body matches the cloud route's distinctive `{success:true}`.
        const result = await deleteCheckpoint(
          ctx,
          { projectId: params.projectId!, checkpointId: b["checkpointId"] },
          storyCheckpointRepo,
          deps.hooks,
        );
        if (!result.ok) return result;
        return { success: true };
      },
    },
    // -------------------------------------------------- §7 wave 3 — story plans
    {
      method: "GET",
      path: "/projects/:projectId/story-plans",
      handle: ({ ctx, params }) => {
        if (!storyPlanRepo) return noStoryPlans();
        return listStoryPlans(ctx, { projectId: params.projectId! }, storyPlanRepo);
      },
    },
    {
      method: "PATCH",
      path: "/projects/:projectId/story-plans",
      handle: ({ ctx, params, body }) => {
        if (!storyPlanRepo) return noStoryPlans();
        const b = (body ?? {}) as Record<string, unknown>;
        // planId arrives in the BODY. The "Invalid beats shape." 400 is owned
        // by the handler AFTER ownership, so a wrong-project caller still 404s.
        return updateStoryPlan(
          ctx,
          {
            projectId: params.projectId!,
            planId: b["planId"] as string,
            title: b["title"],
            beats: b["beats"],
          },
          storyPlanRepo,
        );
      },
    },
    {
      method: "DELETE",
      path: "/projects/:projectId/story-plans",
      handle: ({ ctx, params, body }) => {
        if (!storyPlanRepo) return noStoryPlans();
        const b = (body ?? {}) as Record<string, unknown>;
        // planId arrives in the BODY; a scoped zero-match delete stays a
        // silent ok, exactly as the route did.
        return deleteStoryPlan(
          ctx,
          { projectId: params.projectId!, planId: b["planId"] },
          storyPlanRepo,
        );
      },
    },
    // ------------------- phase 3 §2.5 stage (d) — the run-plan preflight
    {
      method: "POST",
      path: "/projects/:projectId/graph/run-plan",
      handle: async ({ ctx, params, body }) => {
        if (!runPlanDep) return noRunPlan();
        // The scope check runs before the port — a ctx scoped elsewhere is an
        // explicit 403 that pages nothing (same convention as every mount).
        if (ctx.projectScope !== undefined && ctx.projectScope !== params.projectId) {
          return { ok: false, status: 403, reason: "Context is not scoped to this project." };
        }
        const project = await runPlanDep.projectRepository.findOwned(
          params.projectId!,
          runPlanDep.localOwnerId,
        );
        if (!project) return { ok: false, status: 404, reason: "Not found" };
        const b = (body ?? {}) as Record<string, unknown>;
        // The cloud route's exact body keys, with its tolerance for mere junk
        // (non-array kinds/nodeIds degrade to the empty preflight).
        const kinds: GraphNodeKind[] = Array.isArray(b["kinds"]) ? (b["kinds"] as GraphNodeKind[]) : [];
        const nodeIds: string[] = Array.isArray(b["nodeIds"]) ? (b["nodeIds"] as string[]) : [];
        const capabilityId = typeof b["capabilityId"] === "string" ? (b["capabilityId"] as string) : undefined;
        // Profile-derived provider availability + tier (the composition's env);
        // the row's own format — never a per-host format setting to drift.
        const cctx: CapabilityContext = {
          tier: runPlanDep.tier,
          hasSegmindKey: runPlanDep.hasSegmindKey,
          hasOpenAIKey: runPlanDep.hasOpenAIKey,
          format: project.format as string,
        };
        if (capabilityId) {
          const plan = buildRunPlan(capabilityId, nodeIds, cctx);
          if (!plan) return { ok: false, status: 400, reason: "Unknown capability" };
          return { plan };
        }
        return { options: runnableCapabilities({ kinds, nodeIds }, cctx) };
      },
    },
    // ------------------- phase 3 §2.5 stage (d) part 2 — the Director write-half
    {
      method: "POST",
      path: "/projects/:projectId/production/generate-package",
      handle: async ({ ctx, params, body }) => {
        if (!generatePackageDep) return noGeneratePackage();
        // §5.4's non-streaming deferral, in the stage-(a) convention: an
        // explicit refusal BEFORE the bundle runs, so a stream request spends
        // nothing on a socket that cannot carry the deltas back. The cloud
        // body's non-stream default (`stream` absent) behaves identically to
        // the pre-fix route.
        if ((body as { stream?: unknown }).stream === true) {
          return { ok: false, status: 400, reason: "Streaming is not supported on the local host." };
        }
        const result = await generatePackage(
          ctx,
          { projectId: params.projectId! },
          generatePackageDep,
        );
        if (!result.ok) return result;
        // The cloud route answers `NextResponse.json(result.payload)` on
        // success — return the payload VERBATIM (no `{ok:true,…}` envelope) so
        // a local client cannot tell the hosts apart (the checkpoints mount's
        // reshape precedent, and this mount's analog of `mapGenerationOutcome`).
        return result.payload;
      },
    },
    // -------- master-plan Phase 4 slice 4c (§12) — the provider-visibility read
    // The §12 "visible and reversible" read made real BEFORE any generation
    // mounts: detected localhost targets + key PRESENCE booleans (values never
    // escape) + the routing profile's shape. 501 like every optional cluster.
    {
      method: "GET",
      path: "/providers",
      handle: async () => {
        if (!providersRead) return noProvidersRead();
        return providersRead.read();
      },
    },
    // -------- PLAN-v5 — provider model lists for the Settings picker
    // Path params, not a query string: `dispatchLoopback` strips the query before
    // matching. Errors surface as a 400 with the provider's own words (e.g. a
    // missing key), never as an unhandled throw.
    {
      method: "GET",
      path: "/provider-models/:provider",
      handle: async ({ params }) => {
        if (!providerModels) return noProviderModels();
        try {
          const models = await providerModels.list(params.provider!);
          return { ok: true, models };
        } catch (err) {
          return {
            ok: false,
            status: 400,
            reason: err instanceof Error ? err.message : String(err),
          };
        }
      },
    },
    // -------- PLAN-v5 step 2 — the thin shell's Settings persistence
    // The shell's provider picker saves through the composition root's own
    // settings file (the host stays fs-free). Validated here: the provider is
    // one of the four boot modes and the strings are strings — the port only
    // persists. 501 like every optional cluster; bearer-gated like all data.
    {
      method: "GET",
      path: "/settings",
      handle: async () => {
        if (!localSettings) return noLocalSettings();
        return { ok: true, settings: await localSettings.read() };
      },
    },
    {
      method: "POST",
      path: "/settings",
      handle: async ({ body }) => {
        if (!localSettings) return noLocalSettings();
        const b = (body ?? {}) as Record<string, unknown>;
        const provider = b["provider"];
        if (
          provider !== undefined &&
          !["off", "auto", "generic", "anthropic"].includes(String(provider))
        ) {
          return {
            ok: false,
            status: 400,
            reason: "provider must be one of off|auto|generic|anthropic",
          };
        }
        const patch: Record<string, unknown> = {};
        if (provider !== undefined) patch["provider"] = provider;
        for (const key of ["model", "endpointUrl"] as const) {
          const value = b[key];
          if (value === undefined) continue;
          if (typeof value !== "string") {
            return { ok: false, status: 400, reason: `${key} must be a string` };
          }
          patch[key] = value;
        }
        return { ok: true, settings: await localSettings.write(patch) };
      },
    },
    // -------- master-plan Phase 3 — the canonical portable project snapshot
    {
      method: "GET",
      path: "/projects/:projectId/export",
      handle: async ({ ctx, params }) => {
        if (!portability) return noPortability();
        const out = await exportProjectSnapshot(
          ctx,
          { projectId: params.projectId! },
          portability,
        );
        if (!out.ok) return out;
        // Verbatim envelope on the wire (the generate-package payload rule):
        // the file a client saves is exactly the envelope it POSTs back.
        return out.payload;
      },
    },
    {
      method: "POST",
      path: "/projects/import",
      handle: async ({ ctx, body }) => {
        if (!portability) return noPortability();
        // The envelope IS the body — a client posts the file it downloaded, no
        // wrapper. A wrapped body fails validation with this mount's clearest
        // available reason, 400 "Snapshot format must be …".
        const out = await importProjectSnapshot(ctx, { snapshot: body }, portability);
        if (!out.ok) return out;
        return out.payload;
      },
    },
    // ---------------------------------------- phase 3 §2 — AI generation
    {
      method: "POST",
      path: "/ai/generate",
      handle: ({ ctx, body }) => {
        if (!generation) return noGeneration();
        return localGenerate(ctx, generation, body);
      },
    },
  ];
}

/**
 * The pg-backed default assembly for `DefaultRouteDeps`: every §7 handler
 * cluster served through the real Postgres adapters — the same composition
 * each Next.js route file performs by hand (`pgCharacterCrudRepository`,
 * `pgProjectCrudRepository`, …, plus `getUserTier` and `pgPostCommitHooks`).
 * Hosts wanting a different storage (tests, a Phase 3 local adapter) spread
 * over it or hand-assemble a `DefaultRouteDeps`; omitting a cluster from a
 * hand-assembled deps object is what makes its routes answer 501.
 */
export function defaultLocalRouteDeps(): DefaultRouteDeps {
  return {
    chapterRepo: pgChapterRepository,
    storyBibleRepo: pgStoryBibleRepository,
    storyTransactionRepo: pgStoryTransactionRepository,
    storyHistoryRepo: pgStoryHistoryRepository,
    characterRepo: pgCharacterCrudRepository,
    locationRepo: pgLocationCrudRepository,
    plotThreadRepo: pgPlotThreadRepository,
    referenceWorkRepo: pgReferenceWorkRepository,
    worldEntityRepo: pgWorldEntityRepository,
    violationRepo: pgIntentionalViolationRepository,
    relationshipMapRepo: pgRelationshipMapRepository,
    projectsCoreRepo: pgProjectCrudRepository,
    // §7 wave 3 — the comic / production-shot / story-OS clusters, assembled
    // exactly the way each Next.js route file does it by hand.
    comicPageRepo: pgComicPageCrudRepository,
    comicPanelRepo: pgComicPanelCrudRepository,
    productionShotRepo: pgProductionShotCrudRepository,
    storyStateRepo: pgStoryStateRepository,
    storyMemoryRepo: pgStoryMemoryRepository,
    storyGraphRepo: pgStoryGraphRepository,
    storyCheckpointRepo: pgStoryCheckpointRepository,
    storyPlanRepo: pgStoryPlanRepository,
    getTier: getUserTier,
    hooks: pgPostCommitHooks,
  };
}

/**
 * The PATCH body may be `{ patch: {...} }` or the patch itself. A missing key
 * yields `{}`, which `sanitizeChapterPatch` treats as an empty (no-op) patch —
 * never as `undefined=crash`.
 */
function extractPatch(body: unknown): unknown {
  if (body && typeof body === "object" && "patch" in (body as Record<string, unknown>)) {
    return (body as Record<string, unknown>)["patch"];
  }
  return body ?? {};
}
