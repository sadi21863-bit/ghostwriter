/**
 * Phase 3 §2.5 stage (d) part 2 — the generate-package WRITE HALF as a
 * port-conscious business handler.
 *
 * docs/migration/phase3-prep.md §2.5: "`generate-package` — the write half
 * (fresh-slate shot insert, character/location row creation from the model's
 * sheets) is exactly the CRUD-half pattern comics used. The blocking
 * involvements are the metered `runDirectorCall` and the fire-and-forget Soul
 * ID bootstrap. Local version: provider port for the Director call, NO Soul ID
 * bootstrap, shot writes through `ProductionShotCrudRepository`."
 *
 * Previously inlined in
 * `src/app/api/projects/[projectId]/production/generate-package/route.ts`'s
 * `runGeneratePackage` (item 72's split): everything after the metered Director
 * call was a raw Drizzle write pass with no handler to host it. The handler
 * below takes a `RequestContext` and constructor-injected ports — no NextAuth,
 * no `@/db`, no `next/server`, no Anthropic client — so a local host can serve
 * the same write-half rules without the transport, the meter, or the provider
 * spend being hardwired (the comics.ts template).
 *
 * What is deliberately NOT here (twin, never speculative additions):
 *  - the metered `runDirectorCall` (save/refund credits, gate bodies) — §5.5
 *    SETTLED "never for a single-owner host": the local surface is meter-less,
 *    so there is no refusal path and no `refundCredits` seam;
 *  - the fire-and-forget Soul ID bootstrap (several real Segmind/Higgsfield
 *    calls) — external spend stays cloud-owned;
 *  - `buildPromiseLedger` and the entire prompt build (system + user prompt,
 *    chapters/elements text) — that is the context half feeding the model call,
 *    composition-root/provider-side by the §2.5 split, touching no local write;
 *  - streaming (`?stream` NDJSON) — §5.4 defers; the local MOUNT refuses
 *    `stream: true` explicitly.
 *
 * Hook census (verified by reading the route): the cloud generate-package
 * route fires ZERO `onCanonicalMutation` kinds — it is a raw-Drizzle route
 * (no `PostCommitHooks` import at all), and §11's `CanonicalMutationKind` has
 * no `shot.create`/`shot.delete` members to this day (only `shot.update`, from
 * the PATCH handler). Parity, not omission: the local handler therefore fires
 * NO hook on any of its writes, and `LocalGeneratePackageDeps` carries no hooks
 * seam AT ALL (not even an ignored one) so a future adapter cannot silently
 * invent a revision bump the cloud route never made. If the cloud route ever
 * migrates to handlers and starts bumping, that is a NEW §11 slice, not this
 * port's business.
 *
 * The write pass, in the route's exact order and with its exact defaults:
 *   1. resolve existing characters lowercase-name→id (`project.characters`);
 *   2. for each model sheet with a NEW name, create a character row
 *      `{name, role, appearance: soulIdPrompt, speechPattern: voiceNotes}`;
 *   3. resolve existing locations lowercase-name→id, then create location rows
 *      `{name, description: visualDescription, atmosphere: moodKeywords.join(", ")}`;
 *   4. resolve existing chapters lowercase-title→id;
 *   5. DELETE every shot row of the project (the fresh slate, unconditional);
 *   6. map `scenes` sceneNumber→multiShotScript;
 *   7. ONE bulk shot insert returning the created rows, with the field
 *      defaults below verbatim and `sortOrder` = the shot's index in the
 *      package's `shots` array;
 *   8. payload verbatim: `{brief, characterSheets, locationSheets, shotCount}`.
 *
 * Port shape decision (recorded per the stage brief): a NEW fused port set
 * lives HERE instead of bolting a `create?` member onto
 * `ProductionShotCrudRepository` — the same choice `handlers/comics.ts` made
 * by declaring its own `ComicPageCrudRepository`/`ComicPanelCrudRepository`
 * at the single consumption site. Reasons: (i) an OPTIONAL member on the
 * shared shot port would widen every existing implementer's contract and make
 * "forgot to implement create" a silent-onset runtime hazard, the opposite of
 * this migration's narrowing direction; (ii) the write half also needs verbs
 * that lie outside the shot domain entirely (the chapter-title read — NO list
 * verb exists on `ChapterRepository` — plus the character/location
 * create+scoped-read verbs), and one declared seam expresses the whole
 * consumption contract in one place. Character/location verbs are PINNED off
 * the ESTABLISHED ports (`Pick<…>` of `CharacterCrudRepository`/
 * `LocationCrudRepository`) rather than re-declared, so the sheet→row writes
 * ride the exact inserts the characters/locations POST allowlists enforce.
 *
 * Ownership follows §5.6's settled `localOwnerId` convention (the run-plan
 * bundle's precedent): the loopback transport's ctx actor is `LOCAL_ACTOR`
 * ("local"), NOT a users row, so every repo predicate must key on the bundle's
 * `localOwnerId` — one real users-row id — exactly as the cloud route
 * ownership-checked once against `session.user.id`. Ownership is proved ONCE
 * (up front, like the route's `verifyOwnership`), never re-proved per row.
 *
 * Faithful-twin guards, recorded (the route was `any`-typed and would have
 * CRASHED into a generic 500 mid-write on these; locally they carry on like
 * the route's own falsy-name skips do):
 *  - a sheet whose `name` is present but NOT a string is skipped (the route's
 *    `.toLowerCase()` would have thrown);
 *  - a `moodKeywords` that is not an array joins to "" (the route's
 *    `(x ?? []).join` only tolerated null/undefined);
 *  - a chapter row whose `title` is not a string resolves nothing (the route's
 *    `.toLowerCase()` assumes the column's NOT NULL default);
 *  - a shot entry that is not an object is skipped, keeping `sortOrder`
 *    faithful to the package's own array positions;
 *  - truthy-but-non-ARRAY `shots` still passes the presence gate and still
 *    throws on `.map`, exactly as the route did — no invented guard.
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { ProjectRepository } from "@/lib/core/repositories";
import type { CharacterCrudRepository } from "./characters";
import type { LocationCrudRepository } from "./locations";
import type { ProductionShotRow } from "./production-shots";

// ------------------------------------------------------------------- ports

/**
 * The parsed Director output — the shape contract comes from the cloud route's
 * OWN response parsing (`safeParseJson(result.text)`): only `shots` is
 * structurally gated (the route's `if (!pkg?.shots)`), everything else rides
 * through to the payload verbatim, and every field may be junk. Deliberately
 * NOT the parsed-and-validated shape of some hypothetical zod layer: the route
 * never had one, and inventing one here would silently start rejecting
 * packages the model actually produces.
 */
export interface DirectorPackage {
  /** `pkg.projectBrief` — the payload's `brief`, verbatim. */
  brief?: unknown;
  characterSheets?: unknown[];
  locationSheets?: unknown[];
  /** sceneNumber → multiShotScript, read into the shots' `multiShotScript`. */
  scenes?: unknown[];
  /** The presence gate: falsy → the route's "Failed to analyze story" 500. */
  shots?: unknown[];
}

/**
 * The Director provider call port — the meter-less replacement for the metered
 * `runDirectorCall` (§5.5: never for a single-owner host). The composition
 * root supplies whatever client it built (the cloud's own prompt + Anthropic
 * client, a different provider, a fixture); the handler consumes only the
 * PARSED package, never raw text, never a provider SDK type.
 *
 * The failure union mirrors `handlers/comics.ts`' `LetteringComposeResult`
 * (a transport-side DI seam that can refuse with a status): the cloud route
 * passed the meter's `result.response` (402/429 bodies) through verbatim, and
 * a composition root reusing the real Director call will want its meter-free
 * failures to carry the same shape in the same field positions.
 */
export type DirectorCallOutcome =
  | { ok: true; pkg: DirectorPackage }
  | { ok: false; status: number; reason: string };

export type DirectorPackagePort = (args: {
  projectId: string;
  /** §5.6 — the one users-row id, so a real provider can identify its owner. */
  localOwnerId: string;
}) => Promise<DirectorCallOutcome>;

/**
 * The two shot verbs that exist on NO repository port today. Every prior
 * consumer of shot rows reads/patches them (`ProductionShotCrudRepository`;
 * its header documents that rows were SEEDED, never created, until this
 * extraction made the route's write pass hostable). Keep them narrow — one
 * fresh-slate wipe + the seeded bulk insert, modelled on
 * `ChildResourceRepository`'s one-verb-at-a-time growth precedent.
 */
export interface GeneratePackageShotWrites {
  /**
   * The route's unconditional fresh-slate step: `DELETE … WHERE project_id`
   * for the whole project, before any insert — the wipe runs even when the
   * package carries zero shots (whose insert then is the driver's own
   * empty-values refusal, identical on pg and the sqlite driver — no local
   * guard was invented for that shared crash).
   */
  deleteAllShots(projectId: string): Promise<void>;
  /**
   * ONE bulk insert (`values(rows).returning()`), each row already stamped
   * with its `projectId` — the route's single statement, not a per-row loop.
   */
  createAllShots(
    projectId: string,
    rows: readonly DirectorShotInsert[],
  ): Promise<readonly ProductionShotRow[]>;
}

/**
 * One seeded shot row exactly as the route built it. The `??`-defaulted
 * fields are typed `unknown` on purpose: the route passed the model's values
 * through after only `??` (any junk a package carried RODE into the insert on
 * the cloud side too, and the stores do their own typing/refusal), while the
 * two RESOLVED columns and the array index get precise types.
 */
export interface DirectorShotInsert {
  projectId: string;
  /** chapterTitle→id resolution; unwresolvable titles are null. */
  chapterId: string | null;
  /** primaryCharacterName→id resolution; unresolved names are null. */
  primaryCharacterId: string | null;
  /** The shot's index in the package's `shots` array (the route's `i`). */
  sortOrder: number;
  /** `sceneNumber ?? 1` — junk rides, stores type-check it. */
  sceneNumber: unknown;
  shotNumber: unknown;
  /** `shotType ?? "Medium shot"` — the remaining route defaults, same shape. */
  shotType: unknown;
  cameraMovement: unknown;
  lightingMood: unknown;
  timeOfDay: unknown;
  subject: unknown;
  action: unknown;
  location: unknown;
  mood: unknown;
  soulPrompt: unknown;
  videoPrompt: unknown;
  /** sceneNumber→multiShotScript resolution; an unknown scene is "". */
  multiShotScript: unknown;
  dialogue: unknown;
  speaker: unknown;
}

/**
 * The stage-(d) bundle a composition root plants to host
 * `POST /projects/:projectId/production/generate-package` — the run-plan
 * bundle's self-contained shape (it does NOT borrow `DefaultRouteDeps`
 * members: a composition root should be able to plant THIS surface without
 * also committing the §7 CRUD clusters, and vice versa). Meter-less, hooks
 * carry no seam at all, and ownership keys on `localOwnerId` per §5.6.
 */
export interface LocalGeneratePackageDeps {
  /** Full-row ownership proof — the ONE authorization decision per request. */
  readonly projectRepository: Pick<ProjectRepository, "findOwned">;
  /**
   * §5.6's settled `localOwnerId` convention — the ONE users-row id the
   * composition root knows. `findOwned` predicates `actor.id === row.userId`,
   * and the loopback transport's ctx actor is the host, not a users row: the
   * bundle supplies the owner id so ownership reads use the production
   * semantics exactly (verbatim from the run-plan bundle's field comment).
   */
  readonly localOwnerId: string;
  /**
   * The sheet→row seams ride the ESTABLISHED World Bible CRUD ports (the
   * exact `create` verbs the characters/locations POST allowlists enforce —
   * the sheet mapping writes only their allowlisted fields), plus the scoped
   * (id, name) reads that resolve names before anything is created.
   */
  readonly characterRepo: Pick<CharacterCrudRepository, "findScoped" | "create">;
  readonly locationRepo: Pick<LocationCrudRepository, "findScoped" | "create">;
  /**
   * The chapter-title read the route got for free from its relational
   * `with: { chapters }` — no list verb exists on `ChapterRepository`, so this
   * narrow seam supplies it. Rows must arrive in the project's chapter order
   * (the route's ascending `sortOrder`): duplicate lowercased titles resolve
   * to the LAST one, the route's exact edge.
   */
  readonly listChapters: (
    projectId: string,
  ) => Promise<Array<{ id: string; title: unknown }>>;
  /** The fresh-slate shot write pair (see `GeneratePackageShotWrites`). */
  readonly shotWrites: GeneratePackageShotWrites;
  /** The Director provider port (meter-less, §5.5). */
  readonly directorPackage: DirectorPackagePort;
}

// ------------------------------------------------------------------ result

/**
 * The route's success payload verbatim (`NextResponse.json(result.payload)`):
 * keys pass through as-is, so an absent model field drops out of the JSON exactly
 * like it did on the cloud side. The MOUNT returns this payload — not an
 * `{ok:true,…}` envelope — so a local client cannot tell the hosts apart
 * (the run-plan mount's byte-parity precedent).
 */
export interface GeneratePackagePayload {
  brief?: unknown;
  characterSheets?: unknown;
  locationSheets?: unknown;
  shotCount: number;
}

export type GeneratePackageOutcome =
  | { ok: true; payload: GeneratePackagePayload }
  | { ok: false; status: number; reason: string };

/** The route's exact parse-failure body (its 500, minus the meterless refund). */
const FAILED_TO_ANALYZE = "Failed to analyze story. Try adding chapter content first.";

// ----------------------------------------------------------------- handler

/** The model's sheet fields the route actually touched (`any` today). */
interface DirectorCharacterSheet {
  name?: unknown;
  role?: unknown;
  soulIdPrompt?: unknown;
  voiceNotes?: unknown;
}
interface DirectorLocationSheet {
  name?: unknown;
  visualDescription?: unknown;
  moodKeywords?: unknown;
}
interface DirectorScene {
  sceneNumber?: unknown;
  multiShotScript?: unknown;
}
interface DirectorShot {
  chapterTitle?: unknown;
  sceneNumber?: unknown;
  shotNumber?: unknown;
  shotType?: unknown;
  cameraMovement?: unknown;
  lightingMood?: unknown;
  timeOfDay?: unknown;
  subject?: unknown;
  action?: unknown;
  location?: unknown;
  mood?: unknown;
  primaryCharacterName?: unknown;
  soulPrompt?: unknown;
  videoPrompt?: unknown;
  dialogue?: unknown;
  speaker?: unknown;
}

/**
 * The write half of `runGeneratePackage`, verbatim in status vocabulary,
 * refusal order, write order, field defaults, and payload shape — with the
 * meter, the Soul ID bootstrap, and the prompt build replaced by the injected
 * provider port (see the file header for the full NOT-here list).
 */
export async function generatePackage(
  ctx: RequestContext,
  input: { projectId: string },
  deps: LocalGeneratePackageDeps,
): Promise<GeneratePackageOutcome> {
  // Every handler's convention BEFORE anything reads or writes: a scope
  // mismatch is an explicit 403 that pages nothing.
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }

  // The route's ownership ladder, verbatim: POST → `verifyOwnership` → 404,
  // then `runGeneratePackage`'s own project read → 404 on top. ONE `findOwned`
  // proves both halves here (§5.6: the bundle's users-row id, since the ctx
  // actor is the loopback host, never a users row).
  const project = await deps.projectRepository.findOwned(input.projectId, deps.localOwnerId);
  if (!project) return { ok: false, status: 404, reason: "Not found" };

  // The provider seam stands where the metered call stood. A refusal passes
  // through VERBATIM — the local analog of the route's
  // `if (!result.ok) return { ok: false, response: result.response }`, with no
  // meter of our own to add yours to (§5.5).
  const call = await deps.directorPackage({
    projectId: input.projectId,
    localOwnerId: deps.localOwnerId,
  });
  if (!call.ok) return { ok: false, status: call.status, reason: call.reason };
  const pkg = call.pkg;

  // The route's only structural gate on the model output, before ANY write:
  // no shots → same 500 body, no refund (meter-less), nothing wiped.
  if (!pkg?.shots) {
    return { ok: false, status: 500, reason: FAILED_TO_ANALYZE };
  }

  // ---- the write pass, in the route's exact order ----

  // 1. Resolve existing characters, lowercase-name keyed (route's charMap).
  //    `findScoped(projectId, {})` is the port's scoped (id, name) read — the
  //    duplicate-scan pool minus its filters.
  const charMap: Record<string, string> = {};
  for (const row of await deps.characterRepo.findScoped(input.projectId, {})) {
    if (typeof row.name === "string") charMap[row.name.toLowerCase()] = row.id;
  }
  // 2. Create World Bible rows for characters the package introduces (so shots
  //    stay linked for portrait consistency). Existing names are skipped —
  //    never overwritten — and a second sheet with the same name is skipped by
  //    the same map short-circuit, exactly the route's loop. The written
  //    fields are the exact `CharacterCreateData`-allowlist subset the route's
  //    insert carried. No hooks, no embedding, no postCreate: the cloud route
  //    did none of that for these sheets (hook census above).
  for (const sheet of (pkg.characterSheets ?? []) as unknown[]) {
    const s = sheet as DirectorCharacterSheet | undefined;
    const name = typeof s?.name === "string" ? s.name : "";
    if (!name || charMap[name.toLowerCase()]) continue;
    const created = await deps.characterRepo.create(input.projectId, {
      name,
      role: s?.role ?? "",
      appearance: s?.soulIdPrompt ?? "",
      speechPattern: s?.voiceNotes ?? "",
    });
    if (created) charMap[name.toLowerCase()] = created.id;
  }

  // 3. Same gap for locations, verbatim mapping including the moodKeywords
  //    join (the route's `(sheet.moodKeywords ?? []).join(", ")`).
  const locMap: Record<string, string> = {};
  for (const row of await deps.locationRepo.findScoped(input.projectId, {})) {
    if (typeof row.name === "string") locMap[row.name.toLowerCase()] = row.id;
  }
  for (const sheet of (pkg.locationSheets ?? []) as unknown[]) {
    const s = sheet as DirectorLocationSheet | undefined;
    const name = typeof s?.name === "string" ? s.name : "";
    if (!name || locMap[name.toLowerCase()]) continue;
    // The route's `(sheet.moodKeywords ?? []).join(", ")`, carried to the
    // guard: null/undefined join to "" exactly as the route produced, and a
    // non-array (which would have thrown the route into a mid-write generic
    // 500) also joins to "" (recorded carry-on).
    const moodKeywords = s?.moodKeywords;
    const created = await deps.locationRepo.create(input.projectId, {
      name,
      description: s?.visualDescription ?? "",
      atmosphere: Array.isArray(moodKeywords) ? moodKeywords.join(", ") : "",
    });
    if (created) locMap[name.toLowerCase()] = created.id;
  }

  // 4. Resolve chapter titles to IDs (lowercase keys; asc-sortOrder order is
  //    the seam's contract, so duplicate titles keep the route's last-wins).
  const chapterMap: Record<string, string> = {};
  for (const chapter of await deps.listChapters(input.projectId)) {
    if (typeof chapter.title === "string") chapterMap[chapter.title.toLowerCase()] = chapter.id;
  }

  // 5. The fresh slate — the wipe runs BEFORE any insert and is UNCONDITIONAL
  //    (the route's `db.delete(productionShots).where(projectId)`).
  await deps.shotWrites.deleteAllShots(input.projectId);

  // 6. sceneNumber → multiShotScript, the route's `!= null` check exactly
  //    (sceneNumber 0 still registers; key coercion mirrors JS indexing).
  const sceneScriptMap: Record<string, string> = {};
  for (const scene of (pkg.scenes ?? []) as unknown[]) {
    const s = scene as DirectorScene | undefined;
    if (s?.sceneNumber != null) {
      sceneScriptMap[String(s.sceneNumber)] = (s.multiShotScript ?? "") as string;
    }
  }

  // 7. The seeded bulk insert, each row's field defaults verbatim from the
  //    route's map. `sortOrder` is the package array's own index. Non-object
  //    entries are skipped (recorded carry-on — the route's any-typed access
  //    would have thrown mid-write); the surviving rows keep their ORIGINAL
  //    array index so `sortOrder` stays faithful to the package's positions.
  const inserted = await deps.shotWrites.createAllShots(
    input.projectId,
    (pkg.shots as unknown[])
      .map((raw, i): DirectorShotInsert | null => {
        if (typeof raw !== "object" || raw === null) return null;
        const shot = raw as DirectorShot;
      const charName = typeof shot?.primaryCharacterName === "string" ? shot.primaryCharacterName : "";
      return {
        projectId: input.projectId,
        // chapterTitle→id: a non-string title (or an unknown one) resolves to
        // null — the route's `chapterMap[…?.toLowerCase()] ?? null` for every
        // well-formed input, minus the .toLowerCase() TypeError it would have
        // thrown for junk (recorded carry-on, like every other guard here).
        chapterId:
          (typeof shot?.chapterTitle === "string" && chapterMap[shot.chapterTitle.toLowerCase()]) ||
          null,
        sceneNumber: shot?.sceneNumber ?? 1,
        shotNumber: shot?.shotNumber ?? 1,
        shotType: shot?.shotType ?? "Medium shot",
        cameraMovement: shot?.cameraMovement ?? "Static",
        lightingMood: shot?.lightingMood ?? "Golden hour",
        timeOfDay: shot?.timeOfDay ?? "Afternoon",
        subject: shot?.subject ?? "",
        action: shot?.action ?? "",
        location: shot?.location ?? "",
        mood: shot?.mood ?? "",
        primaryCharacterId: charName ? (charMap[charName.toLowerCase()] ?? null) : null,
        soulPrompt: shot?.soulPrompt ?? "",
        videoPrompt: shot?.videoPrompt ?? "",
        multiShotScript: sceneScriptMap[String(shot?.sceneNumber ?? 1)] ?? "",
        dialogue: shot?.dialogue ?? "",
        speaker: shot?.speaker ?? "",
        sortOrder: i,
      } satisfies DirectorShotInsert;
      })
      // The wipe (step 5) already ran, so a package that is ALL junk entries
      // inserts zero rows — that lands on the driver's own empty-values
      // refusal, shared with pg by construction (see GeneratePackageShotWrites).
      .filter((row): row is DirectorShotInsert => row !== null),
  );

  // 8. The route's payload verbatim (see GeneratePackagePayload on the passthrough).
  return {
    ok: true,
    payload: {
      brief: pkg.brief,
      characterSheets: pkg.characterSheets,
      locationSheets: pkg.locationSheets,
      shotCount: inserted.length,
    },
  };
}
