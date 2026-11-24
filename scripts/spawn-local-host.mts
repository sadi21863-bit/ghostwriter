/**
 * Phase 3 stage (e) — the PRODUCTION composition root. The first piece this
 * migration ever builds that actually SPAWNS the loopback host outside the
 * tests: every stage-a/b/c/d bundle lands here as the composition root's
 * decisions, over the SQLite twin line (no Neon import anywhere in the
 * process), containing:
 *
 *  - the SQLite file db (`GW_LOCAL_DB`, default `data/local-ghostwriter.sqlite`,
 *    WAL mode via `createSqliteDb`),
 *  - the ONE `localOwnerId` users row the §5.6 convention needs
 *    (`owner@local`, provisioning it on first boot),
 *  - every §7 adapter factory (all nine clusters + the trio) wired into one
 *    `DefaultRouteDeps` bundle,
 *  - the revision hooks (`makeSqlitePostCommitHooks` — contentRevision bumps
 *    land in the same file db),
 *  - the tier resolver from the profile, defaulting to `all_access` (a local
 *    owner is not billed; the cap logic still runs through the same seam the
 *    cloud does),
 *  - the run-plan bundle from `readLocalGenerationProfile` (profile tier +
 *    provider-key presence; the mount stays OFF if unset, same 501 contract),
 *  - the canonical project snapshot port (`makeSqliteProjectSnapshotPort`) —
 *    master-plan §10/§10.1: GET /projects/:id/export and POST /projects/import
 *    go LIVE over this host's file db, re-owning every import to the ONE
 *    `localOwnerId` users row (§5.6),
 *  - the §12 provider-visibility read (`makeLocalProvidersReadPort`, slice 4c)
 *    — GET /providers goes LIVE with detected localhost providers + key
 *    PRESENCE booleans + the routing profile's shoebox shape (values never
 *    escape),
 *  - the composed generation bundle (`makeLocalGenerationDeps`, slice 4d) —
 *    GW_LOCAL_GENERATION-gated; unset keeps POST /ai/generate at 501,
 *  - NO provider-dependent mounts planted: `generation` (POST /ai/generate)
 *    and `generatePackage` stay 501 until an operator supplies their
 *    provider ports — real external spend is a named, separately-reviewed
 *    step, never a boot default,
 *  - the admin registry (`LOCAL_ADMIN_ROUTES`) is planted, so its own
 *    credential domain (ADMIN_SECRET) works on the same socket the owner
 *    token drives — and the two remain disjoint by construction (verified in
 *    `local-host-admin.test.ts`).
 *
 * Run: `npx tsx scripts/spawn-local-host.mts`
 * Env: GW_LOCAL_DB, GW_LOCAL_HOST_PORT, GW_LOCAL_TIER,
 *      GW_LOCAL_SEGMIND_API_KEY / GW_LOCAL_OPENAI_API_KEY (presence),
 *      ADMIN_SECRET (to turn the admin surface on).
 * The per-launch owner token is printed to STDERR (an operator reads it;
 * nothing writes it to disk).
 */

import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createLocalHostServer, defaultLocalRoutes } from "@/lib/core/local-host";
import { LOCAL_ADMIN_ROUTES } from "@/lib/core/local-admin-registry";
import { readLocalGenerationProfile } from "@/lib/core/local-generation-profile";
import { createSqliteDb } from "@/db/sqlite";
import {
  makeSqliteChapterRepository,
  makeSqliteProjectRepository,
  makeSqliteStoryBibleRepository,
  makeSqlitePostCommitHooks,
  makeSqliteStoryTransactionRepository,
  makeSqliteStoryHistoryRepository,
} from "@/lib/core/sqlite-repositories";
import {
  makeSqliteCharacterCrudRepository,
  makeSqliteLocationCrudRepository,
} from "@/lib/core/sqlite-character-location-repos";
import {
  makeSqlitePlotThreadCrudRepository,
  makeSqliteReferenceWorkCrudRepository,
} from "@/lib/core/sqlite-thread-reference-repos";
import {
  makeSqliteWorldEntityCrudRepository,
  makeSqliteIntentionalViolationRepository,
} from "@/lib/core/sqlite-world-entity-repos";
import { makeSqliteRelationshipMapRepository } from "@/lib/core/sqlite-relationship-repos";
import { makeSqliteProjectCrudRepository } from "@/lib/core/sqlite-project-crud";
import {
  makeSqliteComicPageCrudRepository,
  makeSqliteComicPanelCrudRepository,
} from "@/lib/core/sqlite-comic-repos";
import { makeSqliteProductionShotCrudRepository } from "@/lib/core/sqlite-production-shot-repos";
import {
  makeSqliteStoryStateRepository,
  makeSqliteStoryMemoryRepository,
  makeSqliteStoryGraphRepository,
  makeSqliteStoryCheckpointRepository,
  makeSqliteStoryPlanRepository,
} from "@/lib/core/sqlite-story-os-repos";
import { makeSqliteProjectSnapshotPort } from "@/lib/core/sqlite-project-snapshot";
import { makeLocalProvidersReadPort } from "@/lib/core/local-provider-routing";
import { makeLocalGenerationDeps } from "@/lib/core/local-generation-composition";
import { users, type SubscriptionTier } from "@/db/sqlite-schema";
import { eq } from "drizzle-orm";

const DEFAULT_TIER: SubscriptionTier = "all_access";
const OWNER_EMAIL = "owner@local";

async function provisionLocalOwner(handle: ReturnType<typeof createSqliteDb>): Promise<string> {
  const [existing] = await handle.db.select().from(users).where(eq(users.email, OWNER_EMAIL));
  if (existing) return existing.id;
  const [created] = await handle.db.insert(users).values({ email: OWNER_EMAIL }).returning();
  return created!.id;
}

async function main() {
  const profile = readLocalGenerationProfile();
  const tier: SubscriptionTier = profile.tier ?? DEFAULT_TIER;

  const dbLocation = resolve(
    process.env["GW_LOCAL_DB"] ?? "data/local-ghostwriter.sqlite",
  );
  const dbDir = dirname(dbLocation);
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
  const handle = createSqliteDb(dbLocation);

  const localOwnerId = await provisionLocalOwner(handle);
  const hooks = makeSqlitePostCommitHooks(handle.db);

  // Master-plan §12 slice 4d — the composed generation bundle. Boot default OFF:
  // GW_LOCAL_GENERATION decides (auto = localhost detection; generic/anthropic =
  // explicit operator plants via env). Unset ⇒ no bundle, POST /ai/generate 501.
  const generationDeps = await makeLocalGenerationDeps({
    db: handle.db, localOwnerId, profile, tier, env: process.env,
  });

  const routes = defaultLocalRoutes({
    chapterRepo: makeSqliteChapterRepository(handle.db),
    storyBibleRepo: makeSqliteStoryBibleRepository(handle.db),
    storyTransactionRepo: makeSqliteStoryTransactionRepository(handle.db),
    storyHistoryRepo: makeSqliteStoryHistoryRepository(handle.db),
    characterRepo: makeSqliteCharacterCrudRepository(handle.db),
    locationRepo: makeSqliteLocationCrudRepository(handle.db),
    plotThreadRepo: makeSqlitePlotThreadCrudRepository(handle.db),
    referenceWorkRepo: makeSqliteReferenceWorkCrudRepository(handle.db),
    worldEntityRepo: makeSqliteWorldEntityCrudRepository(handle.db),
    violationRepo: makeSqliteIntentionalViolationRepository(handle.db),
    relationshipMapRepo: makeSqliteRelationshipMapRepository(handle.db),
    projectsCoreRepo: makeSqliteProjectCrudRepository(handle.db),
    comicPageRepo: makeSqliteComicPageCrudRepository(handle.db),
    comicPanelRepo: makeSqliteComicPanelCrudRepository(handle.db),
    productionShotRepo: makeSqliteProductionShotCrudRepository(handle.db),
    storyStateRepo: makeSqliteStoryStateRepository(handle.db),
    storyMemoryRepo: makeSqliteStoryMemoryRepository(handle.db),
    storyGraphRepo: makeSqliteStoryGraphRepository(handle.db),
    storyCheckpointRepo: makeSqliteStoryCheckpointRepository(handle.db),
    storyPlanRepo: makeSqliteStoryPlanRepository(handle.db),
    // Master-plan §10/§10.1 — the canonical portable project snapshot. Over
    // THIS host's file db, re-owning every import to the ONE localOwnerId
    // users row (§5.6): GET /projects/:id/export + POST /projects/import.
    portability: makeSqliteProjectSnapshotPort(handle.db, localOwnerId),
    // Master-plan §12 slice 4c — the provider-visibility read: GET /providers
    // lists detected localhost providers + key PRESENCE booleans + the
    // routing profile's shape (values never escape).
    providersRead: makeLocalProvidersReadPort(profile),
    ...(generationDeps ? { generation: generationDeps } : {}),
    getTier: async () => tier,
    hooks,
    runPlan: {
      projectRepository: makeSqliteProjectRepository(handle.db),
      localOwnerId,
      tier,
      hasSegmindKey: profile.hasSegmindKey,
      hasOpenAIKey: profile.hasOpenAIKey,
    },
    // generation + generatePackage deliberately ABSENT — the two mounts whose
    // ports fire real provider spend answer 501 on the default surface, per
    // the stage-(a)/(d) contracts. An operator plant goes here: a real
    // Director provider port + `makeSqliteGeneratePackageWriteSeams(handle.db,
    // localOwnerId)` (from the same trio adapters) for the write half.
    adminRegistry: LOCAL_ADMIN_ROUTES,
  });

  const host = await createLocalHostServer({
    port: process.env["GW_LOCAL_HOST_PORT"] ? Number(process.env["GW_LOCAL_HOST_PORT"]) : undefined,
    routes,
    localOwnerId,
    adminRegistry: LOCAL_ADMIN_ROUTES,
  });

  console.error(`[local-host] spawned                  : ${host.origin}`);
  console.error(`[local-host] owner token (per launch) : ${host.token}`);
  console.error(`[local-host] db                       : ${dbLocation}`);
  console.error(`[local-host] localOwnerId             : ${localOwnerId}`);
  console.error(`[local-host] tier                     : ${tier}`);
  if (!process.env["ADMIN_SECRET"]) {
    console.error("[local-host] ADMIN_SECRET is unset — /admin/* answers 500 fail-closed");
  }

  process.on("SIGINT", async () => {
    await host.close().catch(() => undefined);
    handle.sqlite.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[local-host] spawn failed:", err);
  process.exit(1);
});
