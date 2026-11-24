# Phase 2 — Local host seams (v4 §7)

Phase 2 exit: *"Context/graph/repositories/providers move out of renderer;
no-egress/auth tests pass."*

## Status: started — the §7 auth/handler seam is in place, and the §12 in-scope child-resource CRUD routes now move through it

### What exists now

| Piece | Where | Purpose |
|---|---|---|
| `RequestContext` | `src/lib/core/request-context.ts` | The single input every business handler takes. Carries `actor`, `projectScope`, `environment`, `permissions`, `services`. |
| Auth decorators | `src/lib/core/auth-decorators.ts` | Adapters that turn an authentication *fact* into a `RequestContext`. The only new module aware of both transports. |
| Repository ports | `src/lib/core/repositories.ts` | `ChapterRepository` / `ChildResourceRepository` / `ProjectRepository` / `PostCommitHooks`. No `@/db` import. |
| Core ownership | `src/lib/core/ownership.ts` | `ownsChildResource` — enforces context scope, names the resource instead of the ORM table. |
| Postgres adapter | `src/lib/core/pg-repositories.ts` | The **only** new module importing `db`/Drizzle. Phase 3 swaps this for SQLite. |
| `updateChapter` handler | `src/lib/core/handlers/update-chapter.ts` | First shared business handler. No NextAuth, no `next/server`, no `@/db`. |
| `getStoryBible` handler | `src/lib/core/handlers/get-story-bible.ts` | Second shared handler. Aggregates the seven World Bible collections in one project-scoped read, and carries the real `contentRevision` column value (§11 Phase 5A — see item 5 below). |
| `applyStoryTransaction` handler | `src/lib/core/handlers/apply-story-transaction.ts` | Third shared handler. §13.1's "no AI call mutates canonical state directly" made explicit: field allowlist, all-or-nothing apply, recorded provenance, and a revision hook. |
| `generateChapter` handler | `src/lib/core/handlers/generate-chapter.ts` | Fourth and heaviest shared handler — and the first production call site of `runGenerationPipeline`. Core owns the 400 contract (`validateGenerateRequest`), the violation gate (`violationGate`, armed by a host-supplied `loadViolations` port), and forwards every other port untouched. |
| Violations policy | `src/lib/core/policy/generation-violations.ts` | The three `VIOLATION_PATTERNS`, `detectGenerationViolation`, and `violationConfirmation` — content policy without any transport or DB knowledge, so a local host can keep or replace it. |
| Host context assembly | `src/lib/ai/generation-context.ts` | The verbatim bible builders (`buildSeriesUniverseContext`/`buildSeriesBibleContext`) plus pure helpers (`applyModePromptDirective`, `appendSeriesContext`, `composeDynamicContext`, `isResearchMode`, `shouldRunProseAugmentation`) a local host can reuse without the Neon schema. |
| First CapabilityGate wiring | `api/ai/generate` route | The route supplies `gates` (registry-derived `GATED_MODES`), `gateFacts: {tier}`, and `gateResolver: cloudGateResolver()` — the generic gate finally has a production interpreter. |
| Rewritten route | `api/ai/generate/route.ts` | Thin adapter: session → `cloudContext` → `generateChapter` + ports (violations, gates, context incl. Gemini research + prose augmentation, meter, engine/stream, persist, refunds) → the documented stop contract (validate/buildContext → 400, authorize → 200 control, resolveGate → 403 paywall body, reserve → the meter's own response passed verbatim). |
| Loopback host | `src/lib/core/local-host.ts` | The §7 binding itself: binds `127.0.0.1` ONLY, mints a per-launch 64-hex token, authorizes via the decorators with the token VALUE actually compared (constant-time), then dispatches to Core handlers and maps their `{ ok }` unions onto real HTTP statuses. Default surface: `PATCH/DELETE /projects/:id/chapters/:id`, `GET /projects/:id/story-bible`, `POST /projects/:id/story-transactions` (generation stays off until a local provider stack exists). |
| Migrated routes | `chapters/[chapterId]` (PATCH/DELETE), comic panel `letter` + `regenerate` | Thin adapters: session → `fromSession` → handler/ownership → response. |
| New route | `api/projects/[projectId]/story-bible` | Additive; nothing calls it yet. The UI still receives bible data inline with the project read. |
| Tests | `lib/core/__tests__/*.test.ts` | 161 tests (10 files). `local-host.test.ts` (26) drives a genuinely listening server over real sockets — and is exactly what caught the host accepting ANY 32+ char token. |

All four of v4 §7's named handlers now exist — `generateChapter` was the last,
and with it `runGenerationPipeline` has its first production call site.

### The architectural claim, and how it is enforced

v4: *"Business handlers never call NextAuth or parse loopback tokens themselves."*

Today every route opens with `getRequiredSession()` and threads
`session.user.id` through helpers by hand, so "who is acting" and "which
environment" cannot be stated in one place. A local-first host would otherwise
have to fork every handler.

`request-context.ts` therefore has **zero imports** and **zero mentions of
NextAuth or sessions**. That is asserted by reading its source in the test, not
by trusting a comment — the same technique used for `capabilities/gate.ts`.

### Properties the local host enforces

- **Fail closed.** An unset, empty, or short token is refused. An unset token must
  never mean "authenticated", or a local host started by mistake is remotely
  writable.
- **High-entropy token.** Minimum 32 characters, compared in constant time.
  `safeEqual` burns a comparison on the length-mismatch path so the failure costs
  the same either way.
- **Loopback-only binding.** `isLoopbackOrigin` accepts `localhost`, `127.0.0.1`,
  `[::1]`; it rejects `localhost.evil.com` and `127.0.0.1.evil.com`, which a
  naive substring check would wave through.
- **Deny-by-default origin.** A request with no `Origin` is allowed (non-browser
  clients legitimately omit it); any `Origin` that is not loopback is refused
  unless explicitly allow-listed. This is the no-egress half of §7.

Both security controls were verified by negative control — disabling the
fail-closed check fails 2 tests, disabling the origin guard fails 1 — and now a
third: **the token comparison itself**. The original decorator validated a
presented token's ENTROPY but never compared its VALUE to the host's token, so
any 32+ character string opened the host. That gap was invisible to the original
shape-based tests because no expected token existed in their contract; it was
caught by the first real-socket tests (`local-host.test.ts`) refusing a wrong
token and getting a 200. `fromLoopbackRequest` now takes `expected` and compares
constant-time; the loopback host always passes it and fails closed when the host
itself forgot its token.

### What is NOT done yet

Phase 2 is not complete. The following remain:

1. **The §12 in-scope child-resource CRUD routes are migrated; the rest are not.**
   The chapter PATCH/DELETE route goes through `RequestContext` →
   `updateChapter` → repository port, and — since today's §12 wave — so does
   every in-scope child-resource CRUD route and the projects core (the wave is
   recorded at the end of this file). Since the wave-three record (also at the
   end of this file), the comic page/panel CRUD, the production-shot list/PATCH,
   and the story-OS read/CRUD routes have joined them. Still outside: the
   AI-generation routes (`api/ai/*` beyond `/generate`, the audio generation
   routes, the metered story-plans POST, the graph run-plan preflight) and the
   admin domain — they still call `getRequiredSession()` and their own inline
   `db` queries.
2. **All four named handlers now exist.** v4 §7 lists `generateChapter`,
   `updateChapter`, `getStoryBible`, `applyStoryTransaction` — `generateChapter`
   shipped last and completed the set, giving `runGenerationPipeline` its first
   production call site. En route, the free-tier gate cleanup completed:
   `/api/ai/generate` carried **two** independent free-tier gates — the
   registry-derived `GATED_MODES` check, and a hardcoded 22-entry
   `LIBRARY_MODES` set. They disagreed (the set omitted `dialogue`, which the
   registry gates) and the second could never execute, because no
   `FEATURE_ACCESS` entry grants the free tier. It is now deleted and the
   registry check is the only policy. `gating-single-source.test.ts` pins the
   properties that make it safe to keep deleted.

   The route itself is now a thin adapter: session → `cloudContext` →
   `generateChapter` + host ports, with streaming built inside the `generate`
   port rather than as a route branch. Deviations from the old inline handler —
   each deliberate and response-invisible:

   - the tier is pre-fetched before the pipeline runs (read-only, but an invalid
     request now fires the tier query where the old route validated first);
   - metering runs **after** context assembly (`buildContext`), not before it;
   - the oversized-request check is a `buildContext` stop, not an inline 400 —
     same status, different layer;
   - the project row is read once where the old route read it twice;
   - the `[gen]` error log no longer carries the dropped response's HTTP status.

   Coverage held: the 5 original test files (37 tests) plus 4 new
   `violation-gate.test.ts` cases (the zero-charge confirmation pre-reserve)
   all pass, and `charge-order.test.ts`'s metaprogram now recognizes the
   `reserve:` port as a legitimate meter home with its own once-per-request
   invariant.
3. **`verifyChildOwnership` has been removed.** It took a Drizzle table and a
   caller-supplied `projectId`, binding authorization to the ORM with nothing to
   cross-check the project against. It is replaced by `ownsChildResource(ctx,
   { resource, childId, projectId }, repo)` in `lib/core/ownership.ts`, which
   enforces context scope first and names the resource instead of the table. Both
   production call sites (comic panel `letter` and `regenerate`) are migrated, and
   `auth-helpers.ts` now contains only the session helpers.
4. **The loopback server now exists** (`src/lib/core/local-host.ts`): loopback-only bind, per-launch token with a real value comparison, real-socket tests. Its default surface currently carries only the non-AI handlers — `generateChapter` mounts once a local provider/model stack supplies its ports (the route registry is generic, so that is a composition-root addition, not a redesign).
5. **`contentRevision` is implemented.** Phase 5A slice 1 (§11) is in place —
   the column exists and the handlers wire it, not just the contract. The
   semantics: `projects.contentRevision` is a nullable
   `integer("content_revision")`, NO default — NULL means "never canonically
   mutated since 5A shipped" (unknown), N means mutated N times, so unknown
   stays distinguishable from zero. `pg-repositories.ts` exports the real
   implementation of the `PostCommitHooks.onCanonicalMutation` port: ONE atomic
   `db.update(projects).set({ contentRevision: COALESCE(content_revision, 0) + 1 })`
   where id = projectId. No client-side read-modify-write — a read-then-update
   silently loses increments under concurrency — and COALESCE so the first
   mutation writes 1, never null-arithmetic. The call is awaited, not
   fire-and-forget, so a bible read immediately after a save can never stamp a
   revision OLDER than the data it contains.
   `pgStoryBibleRepository.readContentRevision` reads the real column now
   (`row?.contentRevision ?? null`; a missing row also returns null), and the
   story-bible route header comment no longer describes the field as
   "currently always null".

   `updateChapter` already fired the post-write hook ("chapter.update");
   `deleteChapter` now matches it — an optional `hooks` param (default `{}`, so
   existing callers are unchanged) fires
   `hooks.onCanonicalMutation?.(projectId, "chapter.delete")` ONLY after the
   scoped delete actually ran, because deleting a chapter is as canonical as
   editing one. The chapters route passes
   `onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation` through both
   PATCH (alongside the existing embedding hook) and DELETE. Tests: 8 in
   `pg-content-revision.test.ts` (single-atomic-statement via the
   SQL-expression payload, no client-side read-modify-write, failure surfaces
   via rejection, `readContentRevision` returning number / null-column /
   missing-row → null, queries against the real `projects` table) plus 2 more
   in `update-chapter.test.ts` ("deleteChapter — post-commit revision hook
   (§11)": the bump fires post-success with kind "chapter.delete"; no bump on
    the 404/403 refusal paths). Core suite: 181 passed / 12 files (was 161/10; the §13.1 slice adds `pg-story-transaction.test.ts` (10) + the story-transactions route test (10)).

   One migration lesson worth keeping: the schema of record here has been
   push-only — the live DB had no `__drizzle_migrations` journal — so the
   generated `drizzle/0019_amused_husk.sql` carries the intended
   `ALTER TABLE "projects" ADD COLUMN "content_revision" integer;` PLUS the
   team's earlier changes that went live without a generated migration
   (chapters/characters/comic_panels/locations/production_shots/
   story_promises/world_entities embedding columns, the showcases CREATE
   TABLE, `audio_exports.mode`, `users.tts_provider_id`). 0018 is a
   single-statement diff, so 0019 is the committed backfill. `npx drizzle-kit
   push` applied ONLY the additive column (rev=0 before, rev=1 after;
   chapters.embedding and showcases were already present — those
   carried-forward statements were already live).

§13.1 slice 1 (the persisted `StoryTransaction` / `StoryChange` tables) shipped:
both tables exist in `src/db/schema.ts` and were pushed to Neon via migration
`drizzle/0020_last_komodo.sql` (2 CREATE TABLE + 3 FK constraints —
additive-only). A drizzle-neon-http lesson worth keeping, discovered by reading
node_modules: `db.transaction` **throws** on the neon-http driver — `db.batch()`
is the vehicle Neon executes server-side as a single atomic transaction.
`pgStoryTransactionRepository` leans on that: `record` writes the transaction
row plus its ordered change rows (`seq`-numbered, denormalized `projectId` for
audit scoping) in ONE `db.batch`, so a recorded audit entry can never be missing
the writes it lists; `applyChanges` pre-checks every referenced entity against
this project (a missing list aborts before any write), then applies grouped
one-scoped-UPDATE-per-entity-row writes in ONE batch with `.returning()`
row-match verification — an entity that vanishes between pre-check and write
aborts the transaction. The cloud route
(`POST /api/projects/[projectId]/story-transactions`) is the same thin auth
adapter as its story-bible sibling: source/changed-requirement/invalid-JSON
bodies rejected at 400, the handler's union statuses passed through verbatim,
projectScope intentionally not set (sibling parity). The local host needed NO
change — its default surface already routed
`/projects/:projectId/story-transactions` to `applyStoryTransaction`; only the
repository port behind it had no implementation until now. From the same §13.1
item, the revert/audit endpoints dropped off the outstanding list when slice 2
shipped (next paragraph); still outstanding after slice 2 were: entity-not-found
typed errors, migrating browser `useEntitySync` onto the endpoint (it still
PATCHes entity endpoints directly, so nothing reads the tables yet), and the
local SQLite adapter parity in Phase 3 — the first two drop off with today's
§12 wave (the paragraphs at the end of this file); SQLite parity remains
Phase 3.

§13.1 slice 2 (audit + revert over that trail) shipped: the
`StoryHistoryRepository` port is declared in the handler itself
(`src/lib/core/handlers/story-history.ts` — the handler-owns-its-port idiom, same
as `get-story-bible`; `ownsProject`/`listTransactions`/`getTransaction`/
`revertChanges`), and `pgStoryHistoryRepository` is appended in
`src/lib/core/pg-repositories.ts`: the audit reads walk `storyTransactions` with
their `story_changes` children (latest 50, newest-first, changes re-sorted by
`seq`), while `revertChanges` runs an informed pre-check (one full-row read per
involved table, scoped to the project → a conflict list, nothing written) then
ONE all-or-nothing `db.batch` of grouped inverse writes — each matching field set
back to its `oldValue`, `.returning()` row-match verified, an entity that
vanishes between pre-check and write throws, mirroring `applyChanges`. The
revert semantics carry a deliberate CONFIDENTIALITY choice documented in the
handler: a field whose live value has moved past the transaction's `newValue`
refuses the WHOLE revert (HTTP 409 with `conflicts` in the body) — audit
semantics beat blind overwrites. `onCanonicalMutation(projectId,
"storyTransaction.revert")` fires only when something actually changed; an
empty-transaction revert is a no-op that bumps nothing. The local host gained 3
new loopback routes (GET `/projects/:projectId/story-transactions`, GET
`…/:transactionId`, POST `…/:transactionId/revert`) guarded by an optional
`deps.storyHistoryRepo` that answers an honest 501 "Story history is not
configured for this host." when absent — the first optional-deps guard in the
route registry. The Next side is additive the same way: the GET list hangs off
the existing `/api/projects/[projectId]/story-transactions` route with no query
params BY DESIGN (the loopback host cannot see query strings, so local routes
mirror this), and GET one + POST revert live under `[transactionId]/`. Still open from slice 2
at that point: entity-not-found on revert surfaced as a thrown error (500-class,
the same audit-first tradeoff `applyChanges` already accepted) and
`useEntitySync`'s browser migration onto `/story-transactions` had not begun —
both dropped off with the §12 wave at the end of this file; Phase 3's SQLite
parity is unchanged. These slice-2 routes were NEW routes, not migrations of
legacy ones.

§12 wave one (the Phase-2 route-migration wave) shipped, closing item 1 above
for the in-scope clusters: characters, locations, plot-threads,
reference-works, world-entities, the intentional-violation acknowledgements,
the relationship map, and the projects core all now run `RequestContext` →
business handler → repository port. The handler modules live in
`src/lib/core/handlers/` (`characters.ts`, `locations.ts`, `plot-threads.ts`,
`reference-works.ts`, `world-entities.ts`, `intentional-violations.ts`,
`relationship-map.ts`, `projects.ts`) — each transport-agnostic (no NextAuth,
no `@/db`, no `next/server`), taking a `RequestContext` plus its repository
port and returning the `{ok:true, …} | {ok:false, status, reason}` union, with
the scope-403 → `ownsProject`-404 ordering every handler encodes. The pg
adapters were deliberately split one file per cluster —
`pg-character-location-repos.ts`, `pg-thread-reference-repos.ts`,
`pg-world-entity-repos.ts` (which also carries the intentional-violation
port), `pg-relationship-repos.ts`, `pg-project-crud.ts` — each documented as
the one place its cluster's `@/db` imports live, so the parallel agents who
shipped the clusters never co-edited `pg-repositories.ts` (which stays
untouched). The route adapters stayed thin and kept the request-shape 400s at
the edge: the `name is required`/`title is required` bodies, the zod patch
allowlists, `WorldEntityKindSchema` + `encodeWorldEntityProperties` for
world-entities, `encodeAIRules` for projects. Where behavior had to be
preserved, the handlers carried the legacy rules verbatim: characters keep the
type-53 duplicate scan (an `embedText` DI seam computes the create embedding
fail-open to null; a `postCreate` DI seam is the character-intelligence
bootstrap — the handler owns when it starts, after the insert and the revision
bump, while the route supplies the I/O); locations duplicate-scan the same way
with no postCreate (character-only); reference-works keep NO PATCH by design
(Style DNA attributes are edited by deleting and recreating the row, so the
port is deliberately `ownsProject`/`create`/`deleteScoped`); intentional
violations keep the replace-not-append acknowledgement map verbatim (entries
keyed by `violationType`, `purpose || ""`, timestamp stamped at write) and
deliberately 404 a non-owner BEFORE its `violationType required` 400, so an
unauthorized caller never learns the endpoint's contract; and relationship-map's
co-occurrence build and pair upsert are carried verbatim by the adapter so the
GET body `{nodes, edges, isolated}` and the full PATCH row never drift. The
projects core is the wave's biggest new handler: the tier cap is in-handler
business logic (`MAX_PROJECTS[tier] ?? 3`, skipped at -1, refused with the
EXACT pre-migration `403 {error:"Project limit reached for your plan",
upgrade:true}` body, the tier resolver injected as `getTier` and supplied by
the route as `getUserTier` as always); the `||`-fallback create defaults
(`"Untitled"`/`"Novel"`/`"beginner"`/`[]`/`"linear"`/`""`) moved to the
handler; and PATCH runs the 19-field `PROJECT_PATCH_FIELDS` allowlist with
`densityLevel` coerced through `normalizeDensity`, so the `.set()` spread can
no longer write `id`/`userId`/`contentRevision`-class server-owned columns.

Two behavior changes rode the whole wave at once, both deliberate and
additive. First, §11 canonical-mutation hooks now fire on ALL of the migrated
routes — `character.*`, `location.*`, `plotThread.*`, `referenceWork.*`,
`worldEntity.*`, `violation.acknowledge`, `relationship.upsert`, `project.*` —
which the pre-migration routes never did (they never bumped
`contentRevision`); creates and deletes fire post-scoped-write only (the
post-delete ordering mirrors `deleteChapter`), and updates fire only when at
least one client-sourced field survived validation — an empty patch is still
just an `updatedAt` touch, not a canon change. Second, the typed
entity-not-found story closed: `MissingEntitiesError` (declared in
`apply-story-transaction.ts`, already thrown by both pg pre-checks — the apply
pre-check and the revert verify pass — since the earlier slices) is now caught
by the handlers and shaped into `422 {reason, missing}` with honest
audit-first reasons — apply: "Some referenced entities no longer exist; the
transaction was recorded but nothing was applied"; revert: "…nothing was
reverted." (the transaction IS on the audit trail either way — the audit-first
order was never changed) — while anything non-typed re-throws, so a genuine
mid-write race stays 500-class and never borrows the 422's meaning.

The browser caught up too: `useEntitySync.acceptEntitySuggestion` no longer
PATCHes entity endpoints directly — it POSTs one `source: "user-edit"` story
transaction (recorded, therefore audit/revert-visible) and applies the
suggestion's `newValues` locally on success, preserving update-on-accept; a
404 or a `{missing:[…]}` body just self-heals the stale chip away. The local
host took the whole wave in one stride: every cluster is wired into
`DefaultRouteDeps` as an optional dep (`characterRepo` … `projectsCoreRepo`,
plus the `createEmbedText`/`getTier` seams), absent deps answer an honest 501
through the `noX()` guards ("Character storage is not configured for this
host." et al. — the story-history guard's pattern generalized), and the route
registry grew to 31 routes. `defaultLocalRouteDeps()` is the pg-backed
composition — each cluster's adapter, `getUserTier`, and `pgPostCommitHooks`
assembled in one place — while a hand-assembled deps object that omits a
cluster turns its routes into the 501 instead of a crash. The one known local
host gap: `createEmbedText` omitted falls back to `noEmbedText`, which writes
rows without embeddings, so World Bible duplicate detection is silently OFF on
a local host until an embedding provider exists — the same fail-open class as
the pg-side embedding failures (the row is written either way; only the
similarity warning stays silent).

Recorded deviations — each deliberate, each response-visible, all documented
in the code:

- **PATCH row-miss is a clean 404 across clusters.** A `*Scoped` write that
  matched no row used to feed `undefined` into `NextResponse.json` (the
  "Value is not JSON serializable" crash class, already fixed for chapters)
  instead of refusing; the handler unions now make it a 404.
- **The projects PATCH/DELETE ownership probe.** The pre-migration routes kept
  the ownership `eq` inside the UPDATE/DELETE WHERE clause, so DELETE answered
  `200 {ok:true}` for rows it never matched and PATCH had the crash above;
  both now probe `ownsProject` and refuse with the sibling handlers'
  `404 "Not found"` convention. Note the deliberate NON-upgrade one layer
  down: the child-cluster DELETEs still return `{ok:true}` when the row was
  already gone (a scoped DELETE matches zero rows silently — that pre-existing
  semantics is documented in the handlers and preserved, keeping the
  migration's change surface minimal).
- **Validation-before-ownership ordering is preserved where it existed.**
  reference-works' `title is required` 400 stays ahead of the handler's
  ownership 404 (400 before 404 on a non-owned project, matching the chapters
  adapter) — the contrast with intentional-violation above is itself the point:
  both orderings are deliberate, they just answer different threat models.
- **The relationship-map GET race.** A project vanishing between `ownsProject`
  and `readGraph` (physically a race; ownership was just proved) now reads as
  an empty-but-valid graph instead of a `TypeError`-driven 500. That deviation
  was forced, not chosen: `readGraph` has no failure channel in the port, so
  the alternative was throwing mid-handler.

What remains of Phase 2, stated plainly: everything §13.1 asked for is now
shipped except the deferred Phase-3 SQLite adapter parity (already on the
outstanding list above; the pg layer is exactly the swap surface that deferral
needs). The §12 route migration itself continues — what shipped today is all
of §12's in-scope child-resource CRUD plus the projects core; the comic/media
domain (beyond the two panel adapters of the earlier wave), the remaining
AI-generation routes, and the admin domain were never part of this wave. The
updated test tally is deliberately not restated here — it is recorded
separately in `docs/migration/test-baseline.md`; the handler-contract tests
that accompany the clusters live under `src/lib/core/__tests__/`
(`character-location-crud.test.ts`, `thread-reference-crud.test.ts`,
`world-entity-violation-crud.test.ts`, `projects-core.test.ts`,
`relationship-map.test.ts`).

§12 wave three shipped, taking §12 past the wave-one clusters into the
comic/media CRUD and the story-OS stack — three server-side clusters, one
honest negative result on the browser side, and a real wave-one regression
found and fixed along the way.

**Comics** (`src/lib/core/handlers/comics.ts` — two ports and seven handlers:
`listComicPages`/`createComicPage`/`deleteComicPage`/`createComicPanel`/
`updateComicPanel`/`deployPanelImage`/`letterComicPanel`, with
`pg-comic-repos.ts` as the one place this layer meets the comic tables): the
comics GET list, the POST route's CRUD half (the page insert and the
per-panel inserts), the page DELETE, the panel PATCH with the Phase-C
candidate-promotion swap in-handler, the regenerate route's DB-write half
(`deployPanelImage`), and the letter route's refusal ladder + terminal write
are all `RequestContext` → handler → port now. What stayed transport-coupled,
deliberately: the POST's Claude scene-breakdown → Segmind/Soul or
StoryDiffusion generation → Blob upload closure plus the fire-and-forget
vision-critic sweep, the regenerate route's provider call + upload, and
`comics/export` entirely (a fetch → sharp-page composition → zip → Blob
pipeline whose only response is a download URL — no CRUD verb to extract); the
letter route's sharp composite + Blob upload stay at the edge through the
handler's `compose`/`upload` DI seams, so the handler owns WHEN they run (only
after the full refusal ladder — project 404 → panel 404 → page 404 → the
dialogue/caption 400) while the route owns the I/O. Behavior notes: the panel
PATCH's no-match is now a 404 — the pre-migration route answered that edge
with the `NextResponse.json(undefined)` empty-200 class; the page NUMBER rule
moved inside the handler (`countByProject` + 1, the pre-migration rule
verbatim) and is derived at insert time, so the POST creates the page only
AFTER the breakdown succeeded (a failed breakdown must not leave an orphan
page row, as before), and each persisted panel bumps its own
`comicPanel.create` (a page whose whole batch failed bumps only
`comicPage.create`); `comicPanels` carries no `updatedAt` column, so an empty
patch behaves exactly as before — real Drizzle rejects the resulting
`.set({})`, so the degenerate case still throws the way the old route's did —
and fires no hook; and §11 hooks now fire for `comicPage.create`/
`comicPage.delete`/`comicPanel.create`/`comicPanel.update`/
`comicPanel.regenerate`/`comicPanel.letter` — the pre-migration comic routes
never bumped a revision at all.

**Production shots** (`handlers/production-shots.ts` +
`pg-production-shot-repos.ts`): the shots GET list and the shot PATCH. The
adapter's list query is byte-identical to the pre-migration GET —
`primaryCharacter` joined, ordered `(sceneNumber, shotNumber)` — with a
comment pinning that the stitch/scene-video paths order by
`(sortOrder, shotNumber)` BY DESIGN, so nobody "fixes" the list ordering into
a regression. The PATCH keeps its transport-edge ordering: the ownership 404
runs BEFORE the body is read (exactly the old route's order), and the
ALLOWED_FIELDS projection silently drops unknown fields (no 400, as before).
The handler owns the Phase-C promote business rule — run against the CURRENT
row before the prompt rebuild reads merged values, an unknown candidate keeps
the route's exact `400 "Not a known candidate for this shot."`, and an
executed promote is itself a canon change even when the allowlist patch was
empty — plus the auto prompt-rebuild (`SHOT_PROMPT_PARAM_FIELDS` →
`buildShotPromptFragment`), with `updatedAt` stamped LAST (server-owned,
mirroring `updateCharacter`). The generation verbs stayed inline by design:
`preview` (its `keepAsCandidate` append branch is inseparable from the
generated image — the promote half is in the handler), `preview-all` with its
`enforceBudgetCap` clamp, `animate` (+ status), per-shot `generate-video` (+
its QStash poll/status), the `scenes/[sceneNumber]` verbs (`generate-video` +
status stitch, `add-music`, `upload-audio`'s binary form-data path), and
`generate-package` — metering/streaming/binary/external-spend orchestration.
§11 gains its first shot-side bump, `shot.update` (the old route never bumped
one): fired only after the scoped write, only for a non-empty client patch or
an executed promote — an empty patch is still just an `updatedAt` touch. And
the vanished-row race is now honest: a row disappearing between the handler's
pre-read and the scoped write answers 404 where the old route would have
serialized an empty `{}`-shaped 200.

**Story OS** (five handlers — `story-state.ts` 277 LOC, `story-memories.ts`
122, `story-graph.ts` 102, `story-checkpoints.ts` 156, `story-plans.ts` 130 —
over one pg adapter, `pg-story-os-repos.ts` at 255): full CRUD ports for
story-state (threads + promises), story-memories, the story-graph GET, and
checkpoints; story-plans moved GET/PATCH/DELETE only. The story-graph handler
keeps the exact "read → build → health" composition (`buildStoryGraph` →
`analyzeGraphHealth` → `contextIsTrimmed`) so Studio's graph view sees an
identical payload, with no §11 hook (a read, not a mutation). The checkpoints
handler extracts the healthScore formula verbatim into
`computeCheckpointSnapshot` — one testable home, and the Promise Tracker keeps
reading the STORED score rather than recomputing — while the route keeps its
distinctive `{ success: true }` DELETE body and its parse-before-ownership
order (body read BEFORE the probe, as the old route ran it — the deliberate
contrast with the shot PATCH's 404-before-body: different orderings for
different threat models). The story-plans POST stayed at the edge ON PURPOSE:
all three of its branches share one preamble (rate limit → ownership probe
with the AI-facing relations loaded) and two are AI calls (the metered
`runDirectorCall` beat-sheet pass and the `buildSceneBlueprint` chapter-plan
pass), so extracting only the pure arc-preset branch would fork the POST's
ordering inside one route; `graph/run-plan` (pure preflight, never executes)
was untouched. Notes: the `storyPromises.embedding` write rides the handler's
`embedSetup` DI seam — the handler owns WHEN it fires (after the insert and
the revision bump), the route binds `updatePromiseEmbedding` into it, still
fire-and-forget, still fail-open, and the pg adapter deliberately does NOT
write the embedding column, so a created promise returns without one,
byte-identical to the pre-migration response. PATCH no-match is now a 404 for
both story-state and story-plans (closing the same `200 {}` silent-no-op
class as everywhere else), and story-plans' `encodeStoryBeats` `"Invalid
beats shape."` 400 moved INTO the handler so the original 404-before-400
ordering survives the ownership re-proof. The story-state PATCH has no
empty-patch exemption — it writes a branch-fixed payload (the `?? null`
normalizations are part of every update), so the hook fires whenever a row
matched; story-memories and checkpoint DELETEs keep the silent-zero-match
`{ok: true}` (mirroring `deleteCharacter`); and story-plans carries NO §11
hook at all — plans are planning artifacts, not World Bible canon (this
wave's kinds are storyThread/storyPromise/memory/checkpoint only).

**The honest negative result: the browser form-save audit migrated 0 of 6.**
Six direct-PATCH save sites were candidates for the story-transactions
endpoint — `StoryBible.tsx:310`, `WorldBiblePanel.tsx:263`/`285`/`307`,
`ConstellationView.tsx:241`, `AudioNovelPanel.tsx:29` — and every one stalled
for the same reason: each writes at least one field outside `DIFF_FIELDS`
(`entity-extraction.ts:30-46`): `name` on every save tab, `kind`/`properties`
for world entities, `voiceId` (TTS-provider metadata), and the link arrays.
Migrating them would either 422 every save that touches those fields or
silently drop them — both worse than the status quo, so the sites stay direct
PATCHes, each carrying a one-line comment that names its stall reason. The
`useEntitySync` suggestion-chip migration (an earlier wave) remains live. The
unblocker is explicit: expanding the transaction allowlist (e.g. adding
`name` to every entity's `DIFF_FIELDS`); the moment that lands, the designed
follow-up is a small pure helper, `src/hooks/edit-transaction.ts` — designed,
deliberately not written yet, so no dead code ships ahead of its enabler.
Also audited and left direct on the same grounds: `useProjectState.ts:227`'s
`toggleAlwaysInContext` PATCH (`alwaysInContext` is outside the apply
allowlist).

**A real wave-one regression found and fixed in this wave.** The characters
and locations pg adapters inserted `fields` without merging the `projectId`
the port hands them (`.values(fields)`), so an entity create would have hit
the column's NOT NULL/FK — a live 500-class risk, masked because the
mock-based handler tests never execute the pg adapter. Fixed to
`.values({ projectId, ...fields })` (the convention `pg-world-entity-repos.ts`
and `pg-thread-reference-repos.ts` already used — the comic and story-OS
adapters shipped with it stated in their headers), with regression pins in
both route tests asserting the INSERT carries the URL's projectId even though
the body never includes it (the `"regression - the INSERT carries the URL's
projectId"` cases in `characters/__tests__/route.test.ts` and
`locations/__tests__/route.test.ts`). Every other pg adapter was audited
against the same question — comics, thread-reference, story-OS,
world-entities, project, relationship — all already correct. The lesson is
the baseline doc's recurring one: mock-based tests pass while the seam they
skip is broken; assert on behaviour at the seam.

**The §12 remainder, stated as scope rather than debt.** The AI-generation
routes (`api/ai/*` beyond `/generate`, the audio generation routes, the
metered story-plans POST, the graph run-plan preflight) stay transport-coupled
because metering, the Anthropic client, streaming, and external-spend
orchestration are infrastructure §12's local surface must not fake — the
local host serves CRUD + reads only. The admin domain stays unmigrated: its
auth model is the `ADMIN_SECRET` header, not `RequestContext`'s actor, and
bridging that is a design decision, not an adapter exercise. The remaining
comic/media §12 leftovers are exactly the verb-level generation lists in the
two cluster paragraphs above. (A correction to an earlier mid-flight
statement in this paragraph: the loopback registry DID grow with this wave —
after the wave-3 wiring pass, `DefaultRouteDeps` carries 8 new optional deps
(`comicPageRepo` … `storyPlanRepo`) assembled in `defaultLocalRouteDeps()`
from the new pg adapters, and 19 new CRUD routes are mounted on the local
host via the `noX()` 501-guard pattern, bringing the registry to 50 routes.
The generation/CBZ/metered verbs listed above remain unmounted. The
local-host union shapes were later aligned to the cloud bodies (`shape-parity`
pass, 2026-10-22): story-graph now returns the cloud's flat
`{...result.graph, health, contextTrimmed}` spread and checkpoint DELETE now
returns the cloud's `{success:true}` — success bodies are free to map because
`handlerStatus` only translates `ok === false`; failure shapes pass through
unchanged (pinned in `local-host.test.ts`).)

The handler-contract tests for the three clusters live under
`src/lib/core/__tests__/` (`comic-crud.test.ts`, `production-shot-crud.test.ts`,
`story-os-crud.test.ts`), with thin-adapter route coverage for each migrated
verb (the comics GET/`[pageId]`/panel-PATCH/regenerate/letter files, the shots
list/PATCH files, and the story-state/story-memories/story-graph/
story-plans/checkpoints route files). As with the wave-one record, the
updated test tally is deliberately not restated here — it is recorded
separately in `docs/migration/test-baseline.md`.

## Post-backlog hardening wave (2026-10-22)

Five parallel work items closed after §12 emptied:

1. **Typed hook kinds.** `CanonicalMutationKind` — a 40-member union derived
   from the 38 grep-observed real call sites (not invented) — now types
   `onCanonicalMutation`'s `kind`/`detail` in `repositories.ts`. Observed
   `storyTransaction.<source>` members exist because the apply handler emits
   `` `storyTransaction.${input.source}` `` over `TransactionSource`
   (`model-proposal`/`user-edit`/`import`); `storyThread.delete`/
   `storyPromise.delete` were deliberately excluded — the story-state port has
   no delete verbs. Pin test: `OBSERVED_KINDS satisfies
   Record<CanonicalMutationKind, true>` fails on drift.
2. **Loopback/cloud shape parity** (see the corrected paragraph above).
3. **`docs/migration/phase3-prep.md` written** — where Phase 2 stopped, the
   AI-generation Ports design sketch (local metering as read-only
   observability that structurally cannot refuse; streaming non-portable; a
   provider/model profile), the admin design sketch (all six admin routes
   carry zero per-user ownership logic; recommendation: parallel admin
   registry reusing `auth-secret.ts`, not a RequestContext fork), and the
   SQLite-parity kickoff inventory (9 adapter files).
4. **Transaction allowlist completed on both sides.** `DIFF_FIELDS` expanded
   per-entity (characters 65 / locations 6 / plotThreads 5 / worldEntities 11,
   measured from the files) with a single `canonicalFieldValue()` encoder so
   chip diffs and form saves send the same wire; every DIFF_FIELDS entry now
   maps to a real column in `ENTITY_TABLES` (zero unwritable entries), with
   `decodeChangeValue`/`encodeChangeValue` decoding the string wire into
   column values (jsonb via JSON, booleans/numbers/strings typed) and a
   mirror test pinning the exact per-entity set equality.
5. **UI form-save migration (§13.1).** New client adapter
   `src/lib/story/edit-transaction.ts` (`buildEntityEditTransaction` +
   `saveEntityEdit`): diff the form draft against the entity, record
   allowlisted changes as a `user-edit` story transaction, carry non-allowlisted
   fields (e.g. `voiceId`) through a residual direct PATCH, merge locally from
   draft-typed values. Migrated save sites: `StoryBible.handleSave` (all four
   tabs), `WorldBiblePanel`'s character/location/thread edit saves, and
   `ConstellationView`'s character link-array writes. Deliberately still
   direct: create POSTs, relationship-map PATCHes (not an EntityKey domain),
   the audio-novel `voiceId` PATCH, and the chapter content PATCH. This closes
   the wave-3 "UI negative result" — the migration blocker is gone.