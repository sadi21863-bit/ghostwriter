# Phase 3 prep — AI generation + admin onto RequestContext/ports, and the SQLite parity kickoff

Status: **design brief, partially implemented as of 2026-10-22.** §2.6 stage (a) —
the local `/ai/generate` mount with a provider seam and no metering — is BUILT
(`local-host.ts`'s optional `generation` dep slot + `noGeneration()` 501 default +
`local-generation-profile.ts`; see the §2.6 note below). The §4 SQLite
parity tracer is BUILT (`node:sqlite` + `drizzle-orm/sqlite-proxy`, zero new deps;
`src/db/sqlite-schema.ts`/`sqlite-ddl.ts` 43-table baseline + the
character/location adapter pair; embeddings columns omitted — §5.3's default).
§5's open decisions remain unsettled for the larger stages; nothing below is
final until they are.

Two domains were left deliberately transport-coupled at the end of Phase 2 — the AI
generation surface and the admin domain — plus one deferred storage swap (SQLite parity).
This file sketches each, in the order a review should settle them.

## 1. Where Phase 2 stopped and why

Phase 2 moved every §12 in-scope CRUD/read cluster onto
`RequestContext → business handler → repository port` and stood up the loopback host
(`src/lib/core/local-host.ts`): loopback-only bind, per-launch token with a real
constant-time value comparison, a **50-route** registry, optional-deps `noX()` 501 guards,
`DefaultRouteDeps` + the pg-backed `defaultLocalRouteDeps()` composition. One person's
transport-coupling was paid down cluster by cluster; the wave records are in the Phase 2 doc.

What stayed coupled, and the exact reason each:

- **`api/ai/generate`** — this one **is** migrated on the cloud side (thin adapter over
  `generateChapter` + ports), but the local host has never mounted it: the host's own
  comment says generation stays off "until a local provider/model stack exists" and that
  mounting it later is "a composition-root addition, not a redesign." The un-mountain
  needs the ports of §2; what blocks is not the shape but the supply.
- **The other `api/ai/*` routes, the audio-generation routes, and the creator tools** —
  each either goes through `runMeteredCall` (which couples `meterAndGate` + the Anthropic
  client + the SDK-side streaming requirement into ONE seam, `src/lib/roles/shared.ts:29-54`)
  or runs its own provider client (OpenAI TTS, Segmind, Gemini) with **per-user decrypted
  keys** (`users.segmindApiKey` etc.). Metering, the provider client, and per-user BYO keys
  are infrastructure §12's local surface must not fake.
- **The metered story-plans POST** — all three branches share one preamble (rate limit →
  ownership probe with AI-facing relations) and two of the three are AI calls (the metered
  `runDirectorCall` beat-sheet pass and the `buildSceneBlueprint` chapter-plan pass).
  Extracting only the pure arc-preset branch would fork the POST's ordering inside one
  route — the wave-3 record declined that on purpose.
- **`graph/run-plan`** — a *pure* preflight (returns plans, never executes), but its only
  real input is `CapabilityContext` built from the per-user **decrypted Segmind/OpenAI keys**
  and the user's tier. That input is the coupling, not the logic.
- **The generation verbs of the comic/production clusters** (comics POST's Claude
  breakdown → Segmind/StoryDiffusion → Blob upload → critic sweep; shot `preview`,
  `preview-all`'s budget-capped batch, `animate`/`generate-video` + QStash polls, scene
  stitch/add-music/upload-audio, `comics/export`'s compose-zip pipeline) — external-spend
  orchestration with binary and scheduling concerns. The CRUD halves already moved; the
  generation halves are excluded by the same §12 principle.
- **The admin domain** — its auth model is the `ADMIN_SECRET` bearer header
  (`requireBearer` in `src/lib/auth-secret.ts`), not `RequestContext`'s actor. Bridging
  that is a design decision, not an adapter exercise — §3 makes it.

The stated Phase 2 rationale, verbatim in substance: *metering, the Anthropic client,
streaming, and external-spend orchestration are infrastructure the local surface must not
fake — the local host serves CRUD + reads only.*

One transport fact to keep load-bearing: **`local-host.ts` is a loopback HTTP server**
(`127.0.0.1` only, JSON request/response dispatch, `handlerStatus()` union mapping).
Everything below lands as composition-root additions or sibling modules. **No new
transport is designed in this document.** (Also note: no production composition root
spawns the loopback host yet — only `local-host.test.ts` does — so every addition below
lands somewhere that is still being defined anyway. **POSTSCRIPT — closed 2026-11-01
by stage (e):** `scripts/spawn-local-host.mts` (`npm run local:host`) is now the
production composition root; see §2.6's stage-(e) record. The only spawn still
outstanding is an operator decision away — the AI mounts, per §2.6's stage-(e)
"deliberately absent" note.)

## 2. AI generation on a local host — design sketch

### 2.1 The seam as it exists (what core already takes)

`generateChapter(input, ctx, ports)` (`src/lib/core/handlers/generate-chapter.ts`) already
changes everything a local host needs to change, because the pipeline stages are optional
ports and `runGenerationPipeline` skips absent ones:

- authorize (via `loadViolations`) — the violation gate is **armable locally today**: the
  host already serves the intentional-violation acknowledgement store through
  `violationRepo`;
- `gates`/`gateFacts`/`gateResolver` — the pipeline skips `resolveGate` entirely when
  gates + resolver are absent (`src/lib/ai/generation-service.ts:229`), so **ungated is
  already a valid pipeline configuration** with zero core change;
- `reserve`/`finalizeUsage` — paired; omitted = no metering, and the settle path simply
  never runs (nothing reserved → nothing settled).

So the honest center of this design is not "ports must be invented." It is: Core's port
shape is already transport-agnostic; the work is defining **what a local composition root
plants into each port**, and writing down the deliberate differences instead of faking
parity.

### 2.2 The `GenerationPorts` bundle a local host would supply

| Port | Cloud route supplies (today) | Local host supplies | Note |
|---|---|---|---|
| `loadViolations` | `loadProject()` over `db` | the host's existing `violationRepo` | Arms the gate identically; same store the intentional-violation route already paths |
| `gates` + `gateFacts` + `gateResolver` | registry `GATED_MODES`, tier facts, `cloudGateResolver()` | **omitted** | `GATED_MODES` is a subscription feature set; a local owner has no tier. Deliberate difference — unpaged, not faked |
| `buildContext` | verbatim bible builders + prose augmentation, the 150k oversize check, `capContextForTier` | same builders from `src/lib/ai/generation-context.ts` (furnished in Phase 2 for exactly this) | The oversize check lives in the route's `buildContext` closure today and must be carried verbatim. The project-row read moves onto a repo port instead of raw `db` |
| `chooseProvider` | never supplied → `{provider:"default"}` (the free-tier `MODELS.fast` override is applied outside the port) | profile-driven model pick | The free-tier override is a subscription concept that disappears with the tier |
| `reserve`/`finalizeUsage` | `meterAndGate` + `refundCredits` | stage (a): **omitted**; stage (b): record-only meter | See 2.3 — the cloud meter's refusal is a `NextResponse`, i.e. a transport object flowing through core's `control`; a local meter must not manufacture Responses |
| `generate` | `engine.generate(params)` (Anthropic-bound) | **the provider client seam** — a local adapter returning the same `GeneratedOutput {text, model, tokensUsed}` | `engine.ts` binds the Anthropic lazy singleton (`src/lib/ai/client.ts`); that binding is the thing to swap |
| `persist` | `generations` row + `track()` | optional local audit row | Cloud `generations` rows are what `/api/admin/cost-report` reads; a local record has no consumer yet (fine) |
| `parse` / `proposeTransactions` | unused / absent | same (unused) | The engine already returns clean text; proposals are advisory and unwired on both hosts |
| `onStage` | unused | unused locally too (until streaming, §2.4) | |

The one non-trivial *shape* left to a local adapter: mapping the `GenerationOutcome` union
onto the `{ ok:false, status }` union `handlerStatus()` (local-host.ts) expects.
`GenerateChapterInput` documentation carries the stop contract; the local mapping mirrors
the cloud route's: `validate`/`buildContext` stops → 400, `authorize` stop → 200 with the
confirmation body, `resolveGate`/`reserve` stops are unreachable locally (the stages are
skipped).

### 2.3 Metering: read-only observability, not the cloud meter (deliberate difference)

Th cloud meter gates (`meterAndGate`: calendar-aligned reset, email soft-gate, atomic
conditional increment against `MONTHLY_GENERATION_LIMITS`, and a 429/403 `NextResponse`
refused verbatim through the pipeline's `reserve` control). None of that has a local
subject: a single owner, no `users` row, no tiers, no credits to ration.

**Proposal: local metering is read-only observability.** Stage (b) supplies a meter that
records `(operation, model, tokensUsed)` into the local audit store and — structurally,
not just by convention — **cannot refuse**: no gate path exists in its shape, so the
transport-through-core problem (a `NextResponse` riding `control`) cannot arise locally.
The clouds sets-on-weights design (`OPERATION_CREDITS` weights + tier-limit increments in
`src/lib/metering/{meter,costs}.ts`) remains cloud-owned; local metering documents spend,
it does not ration it.

Consequence worth costing now: `runMeteredCall` couples metering **and** the provider
client into one seam (`roles/shared.ts`) — the 2026-07-05 consolidation that made skipping
metering structurally impossible. Until that seam is split (meter port + model port), the
Director/Editor `runXCall` tools cannot ride it locally. Stage the split: a local
meter-less call path in stage (a), the shared-seam refactor only if/when Director surfaces
locally (§5.5).

### 2.4 Streaming is NOT transport-portable — non-streaming locally until proven otherwise

`ReadableStream` is an HTTP concept. The cloud route builds the stream `Response` inside
its `generate` port (route.ts:298-333), and the stream's own lifecycle owns persist and
refund. That closure is a response-shaping construct, not a port semantics, so it does not
transfer to a non-HTTP host — and Core already treats it so (`GeneratedOutput` is just
`{text}` delivered whole.

**Local surface: non-streaming until a real local consumer names itself.** Note the
orthogonal fact so nobody conflates them: the model layer already streams internally
(`runMeteredCall` uses `messages.stream().finalMessage()` because Anthropic's SDK refuses
large-budget synchronous requests on the 10-minute ceiling) — that is not transport
streaming, and it says nothing about exposing streaming locally. If a consumer appears
(a CLI typewriter, a desktop editor), `onStage` is the coarse-grained channel that already
exists; the cheap local version is returning whole text plus stage events, not a
delta stream. The revisit trigger is a named consumer, never "nice to have."

### 2.5 Director/Editor tools and the per-user key surface

- **`generate-package`** — the write half (fresh-slate shot insert, character/location
  row creation from the model's sheets) is exactly the CRUD-half pattern comics used.
  The blocking involvements are the metered `runDirectorCall` and the fire-and-forget
  Soul ID bootstrap (real external spend, several Segmind/Higgsfield calls). Local
  version: provider port for the Director call, no Soul ID bootstrap, shot writes through
  `ProductionShotCrudRepository`.
- **`graph/run-plan`** — keep it pure; the local `CapabilityContext` pulls `hasSegmindKey`/
  `hasOpenAIKey` from the profile (no ops or "no keys" → availability still computes,
  minus those provider preflights).
- **Phase ordering:** the Writer surface (`generateChapter`) first — it is the already-
  migrated route; Director/Editor second, behind the meter/client split.

**§2.5 LANDED 2026-11-01 (stage (d), both parts):** the run-plan preflight mount
(option-§5.6 env-only profile availability through a typed `SubscriptionTier` /
presence-only provider keys, plus the project row's own `format`; the bundle carries
§5.6's `localOwnerId`) and the `generate-package` write-half as its first business
handler (`handlers/generate-package.ts` — fused port surface per the comics precedent
rather than an optional member on the shared shot port; the write-half path mirrored
verbatim; the write-half hook census literally found zero kinds in the cloud route, so
the local handler invents none and pins `contentRevision === null` behaviorally). Soul
ID bootstrap, the context half, streaming, and the meter all stay cloud-owned (§5.4/
§5.5). The `runXCall` Editor verbs stay unmounted until a named local consumer exists
(they write no canonical rows; each would be its own provider-port handler per this
stage's conventions).

### 2.6 Staged plan

1. **(a) Local provider seam + no-meter run path.** Composition root adds a
   `generation` deps entry (the §2.2 bundle, meter-less, gates-less) and mounts
   `POST /ai/generate` with the standard 501 guard message when
   the bundle is absent — same superset behavior the noX() pattern gives every other
   cluster. **DONE 2026-10-22:** the mount is in `local-host.ts` (deps slot
   `generation?` with a REQUIRED `generate` port redeclared over the Pick —
   the handler's type-optional generate would have left a bare Pick `| undefined`;
   `localGenerate` builds the pipeline ports explicitly, never spreading the
   bundle, so cast-smuggled `reserve`/`gates` keys cannot reach the pipeline —
   test-pinned), `defaultLocalRouteDeps()` plants nothing so the default
   surface answers 501, `local-generation-profile.ts` is the pure env-shaped
   profile (consumed by nothing yet), status mapping mirrors the cloud
   route's union (authorize stop → 200 confirmation, validate/buildContext →
   400, stream → explicit 400 "not supported on the local host", out-of-scope
   project → 403 via `mayAccessProject`), and 19 handler tests plus a 501 pin
   in the default composition cover it. Two shape notes the implementation
   surfaced beyond the brief: the oversize ceiling counts
   `context.length + prompt.length` and rides ahead of the builders, and
   `generateChapter` destructures+spreads its ports argument — the mount's
   explicit-assembly choice is load-bearing for the "no meter arrives through
   a spread" guarantee.
2. **(b) Meter-observability.** Record-only meter (2.3), surfaced wherever local
   diagnostics/observability wants spend numbers. **DONE 2026-10-22 (wave 2):**
   the optional `LocalGenerationMeter` port (`record(entry)`, no refusal path in
   the type) + the mount's fire-and-forget post-success call-site; storage stays
   the composition root's decision.
3. **(c) Streaming.** Off. Revisit only when §2.4's trigger occurs. **Settled
   2026-10-31 (§5.4)** — deferral stands until a named local consumer exists.
4. **Stage (d)** — §2.5's two mounts. **DONE 2026-11-01:** run-plan preflight +
   the `generate-package` write-half (details in §2.5's landed record).
5. **§3's admin surface** — the option (b) transport-domain registry (no `ActorKind`
   fork). **DONE 2026-11-01 (stage (c)):** `lib/core/local-admin-registry.ts` —
   exactly the two observability routes mounted; moderation/infra stay cloud-only.
6. **(e) The production composition root.** **DONE 2026-11-01:** every stage above
   existed only behind `local-host.test.ts` — no process ever SPAWNED the host
   outside a test. `scripts/spawn-local-host.mts` (`npm run local:host`) is the
   first: the file db (`GW_LOCAL_DB`, default `data/local-ghostwriter.sqlite`),
   ONE provisioned `owner@local` users row as the §5.6 `localOwnerId`, all
   §7 adapter factories wired into one `DefaultRouteDeps` bundle (nine clusters
   + the trio), `makeSqlitePostCommitHooks` (contentRevision bumps land in the
   same file db), the profile-driven tier + run-plan bundle, the admin registry
   planted, and — deliberately — NO `generation`/`generatePackage` deps: the
   two mounts that can spend real provider money answer 501 on the default
   surface and stay that way until an operator brings their ports. Zero Neon
   imports anywhere in the process. **A live-wire finding forced a transport
   addition:** the loopback ctx's actor id was the `"local"` placeholder, so
   the real boot 500'd on `FOREIGN KEY constraint failed` the moment a
   users-FK'd row was written (projects create carries `ctx.actor.id`).
   Fix: the §5.6 convention now runs the WHOLE way through —
   `LocalHostOptions.localOwnerId?` → `DispatchOptions.actorOwnerId?` →
   `localContext({ actorOwnerId })` (unset = byte-identical placeholder
   behavior; set = every ctx's actor IS the one real users row, making
   `ownsProject`/`findOwned` predicates production-true). The admin arm also
   served on the same socket for the first time (`LocalHostOptions.
   adminRegistry?` → `/admin/*` dispatches behind `dispatchLocalAdmin` BEFORE
   the owner gate — two credential domains, disjoint by construction and
   pinned over the wire in `local-host-admin.test.ts`). Verified: live boot
   + wire exercise (create/read/run-plan 200, `/ai/generate` 501, `/admin/*`
   fail-closed-500 with no secret), then the full suite **2,154/2,154 across
   224 files, `tsc --noEmit` exit 0**.

### 2.7 The provider/model profile the loopback host would read

One profile object read by the composition root at boot — shape, not format, is the
decision: `{ provider; providerConfig/key refs; models: { default, fast, quality };
contextCap; embeddings?: {...}; augmentation toggles; adminSecret? }`. Whether it is env
vars or a gitignored `ghostwriter.local.json` beside the host mount is an open decision
(§5.6); note the contrast with the loopback token, which is minted per-launch by design —
profile model keys are the one credential that necessarily persists.

### 2.8 The transport fact, restated

The plan is still **composition-root additions** — a new optional deps entry, new route
entries in the existing registry, the union-status mapping above. No new transport, no
daemon redesign, no second server framework. The loopback host remains what Phase 2 shipped.

## 3. Admin design sketch

### 3.1 What the admin routes actually are (code reading first)

Six routes (`cost-report`, `analytics`, `cache-stats`, `seed-work-packets`, `setup-db`,
`flagged-showcases`), and every one opens with the identical gate:
`requireBearer(req.headers.authorization, "ADMIN_SECRET")` — a constant-time bearer
compare, 500 fail-closed if the secret is unset, 401 else. **No session, no user id, and
no per-user ownership check ever enters an admin handler.** What they do:
cross-user aggregates (cost-report joins `generations → projects` to attribute spend per
user; analytics/cache-stats aggregate platform-wide), moderation actions that mutate **any
user's** showcase row by slug (`flagged-showcases` POST — cross-user by design), and infra
ops. That settles the one contingency this brief was asked to check: **the admin routes
already do per-user ownership logic the ports would need — they don't**, every meaningful
operation is cross-user by definition or infrastructural. There is nothing for
`RequestContext`'s user-scoped ownership vocabulary to own here.

### 3.2 Option (a) — bridge `ADMIN_SECRET` into a synthetic RequestContext

Mechanism would be: a new `ActorKind` (today the type holds only `"user" | "local-owner"`,
`request-context.ts:22`) plus a decorator minting a context with blanket permissions.

Costs: `RequestContext`'s ownership vocabulary is user-scoped end to end —
`ownsProject`/`ownsChildResource` predicate `actor.id === row.userId`, and
`projectScope`/`mayAccessProject` describe one workspace. An admin actor either (i) gets
exception clauses bolted onto every ownership predicate, or (ii) uses wildcard
permissions that mean "may act on any project" — which then leaks into the handler layer
the whole Phase 2 architecture worked to keep scope-checked and fail-closed. It also edits
a zero-import core module whose purity is asserted by reading its source in tests. The
bridge buys one registry in exchange for weakening the guarantee that every
`RequestContext` handler is user-scoped.

### 3.3 Option (b) — a parallel admin registry (recommendation)

Keep admin a **separate transport-domain registry**, not a RequestContext fork:

- A sibling module (beside, not inside, `local-host.ts`) with its own contract —
  `LocalAdminRoute { method, path, handle({ params, body }) }` — authorized by reusing
  `src/lib/auth-secret.ts` directly (it imports only `node:crypto`; it is transport-free
  and loopback-usable as-is).
- The admin **handlers keep their existing bodies** — direct operator-queries over the
  same tables. They are not RequestContext handlers and should not be forced to become
  them; their Phase 3 story is only the storage swap (§4), never a context refactor.
- Credentials stay disjoint: the loopback owner token and the admin secret are separate
  values, so one credential can never reach the other's surface. An admin path can never
  be mistaken for a user path.
- **Honest scope note:** on a single-owner local host most of the admin domain loses its
  raison d'être — cross-user aggregates have one user, moderation only touches showcases
  one owner wrote. The recommendation is to build the (cheap, additive) side-registry
  contract and mount only what a local operator actually wants (cost/cache observability
  are the plausible candidates) and leave the rest cloud-only. Do not build "admin
  parity" as a goal in itself.

### 3.4 If the bridge is ever revived, it must first settle

- the admin actor's ownership predicate semantics per handler family (aggregates read
  everything; moderation mutates across projects) without wildcard permissions escaping
  into user handlers;
- whether `projectScope` can even describe cross-user reads (it cannot widen per
  `withProjectScope`'s refusal to do so);
- whether one credential asserting operator power through the same dispatch as the
  owner token violates the fail-closed story the loopback host pins by test.

## 4. Phase-3 SQLite parity kickoff (inventory-level)

**Tracer landed 2026-10-22.** Driver: **`node:sqlite` (Node 24's built-in
`DatabaseSync`, SQLite 3.53.1) + `drizzle-orm/sqlite-proxy` — zero new
dependencies.** The load-bearing discovery: SQLite's object result mode
merges duplicate column names in joins (silent data loss on a 4-wide result),
fixed by `stmt.setReturnArrays(true)` on every prepared statement so drizzle's
positional contract holds by construction. A drizzle quirk to remember:
constraint violations surface as `DrizzleError: Failed query:` with the real
message inside `.cause` — consumers must unwrap it. Baseline:
`src/db/sqlite-schema.ts` (43 drizzle sqliteTable definitions, jsonb → TEXT,
uuid generation moved into adapters, dates → TEXT ISO-8601, vector columns
omitted per §5.3's default, semantic_cache carries the correct composite
unique the Neon DB is missing) + `src/db/sqlite-ddl.ts` (vendored DDL) +
`src/db/sqlite.ts` (`createSqliteDb`, `foreign_keys=ON`, WAL for files, DDL on
empty DBs only). First adapter pair: `sqlite-character-location-repos.ts`,
line-for-line with the pg adapter except the embedding degradation
(create/update strip the column; `findScoped` short-circuits `onlyWithEmbedding`
→ `findSimilarEntities` honestly finds nothing). 13 parity tests pin the
per-adapter contract. Adapter pair 2 — `sqlite-thread-reference-repos.ts`
(plot-threads full CRUD incl. `lastMentionedChapterId` as a plain non-FK text
column, + reference-works create/delete with the untyped
`attributes` jsonb→`mode:"json"` TEXT round-trip) — landed 2026-10-22: 14 more
parity tests, and the pair pinned two **corrections of this document's own
prose** below. Adapter pair 3 — `sqlite-world-entity-repos.ts` (world-entities
full CRUD + the intentional-violation acknowledgement port over the
`projects.intentionalViolations` json column) and pair 4 —
`sqlite-relationship-repos.ts` (the relationship-map read + pair upsert) —
landed 2026-10-28, and pinned three more **prose corrections keyed to the code**
(below). Adapter pair 5 — `sqlite-project-crud.ts` (the full 7-verb
projects-core port with the handler-side tier cap driven through it) and
pair 6 — `sqlite-comic-repos.ts` (pages + panels, 9 generic verbs over the
two tables) — landed 2026-10-31 and pinned five more **corrections keyed to
the code** (below). Adapter pair 7 — `sqlite-production-shot-repos.ts`
(shots: `owner`/`list` with the `primaryCharacter` sibling attach/`findById`/
`updateScoped` — the port has no create; the promote-branch and
prompt-rebuild rules are handler-owned over it) and pair 8 —
`sqlite-story-os-repos.ts` (five factories over the Promise-Tracker
story-state, memories, the graph read, checkpoints, plans) — landed
2026-10-31, pinned more **corrections keyed to the code** (below). Adapter pair 9 — `sqlite-repositories.ts` (the FINALE: chapter repo
+ the findOwned/child-resource pairing not already answered by pair 5 + the
aggregated Story Bible read + the real `COALESCE(contentRevision, 0) + 1`
post-commit hooks + the FULL §13.1 record/apply/revert machinery and its
wire codec) — landed 2026-10-31. **The §4 adapter-parity line is COMPLETE:
all nine pg adapter files now have SQLite twins.** Remaining: only the §4.3
round-trip fixture over the story-domain surface (including the 17 empty
tables) and stage (c)'s decisions.

Wave-6 corrections keyed to the code:
- **`pg-repositories.ts` is 738 lines, 8 exports**, not "one adapter" in any
  uniform sense: 4 pure-CRUD/repo objects (chapter, findOwned project,
  child-resource, story-bible), the post-commit singleton, three §13.1
  transaction-machinery exports (story-transaction + story-history repos +
  the codec/`ENTITY_TABLES`), and — the find — **pair 5's projects-core
  adapter ALREADY answers `own/list/count/create/read/update/delete`; what
  `pgProjectRepository` carries is the OTHER interface,
  `ProjectRepository.findOwned` (full-row ownership proof)**, which the
  sqlite twin re-implements next to a re-used factory shape rather than
  duplicating CRUD.
- **The change-wire codec is engine-agnostic BY CONSTRUCTION** (it reads
  drizzle's runtime `column.dataType`, identical contract on both engines),
  but it is COPIED into the sqlite file rather than imported — because
  `pg-repositories.ts` imports `@/db`, a forbidden downward import for the
  sqlite layer. Drift between the copies is mechanically impossible to
  ship: the sqlite parity test pins `ENTITY_TABLES` field-set-equal to
  `DIFF_FIELDS` (the same cross-check shape `pg-entity-tables-mirror.test.ts`
  gates the pg side).
- **neon-http ↔ sqlite-proxy are mirror opposites in their atomic-batch
  primitive**: Neon has only `db.batch` (it refuses `db.transaction`), the
  sqlite driver has only native `db.transaction` (no `db.batch`). Every
  `db.batch([...])` call became one `db.transaction(async (trx) => …)`
  wrapping the same statements — same all-or-nothing server-side
  atomicity, same vanish-check-after contract. (A genuine trap class was
  caught live: shadowing the `StoryTransaction` parameter as the
  transaction callback variable blanked every insert column — the error
  fired as `NOT NULL constraint failed`-style nulls, not a null-ref, and
  was caught by parity tests before any consumer saw it.)
- **The driver's honest blank-wall surprises, pinned**: drizzle sqlite
  refuses `.set({})` (`No values to set` — pg's neon-http accepts an empty
  set; every caller passes non-empty patches by contract, so the twins
  keep pg's tolerant pass-through and the TEST avoids the empty call, a
  documented divergence); json-mode text booleans/arrays/objects decode
  per-kind at the write block (the codec) exactly as pg's jsonb does.

Wave-5 corrections keyed to the code:
- **"promote inside" (§4.1's production-shot row) is handler truth, not
  adapter truth.** `pg-production-shot-repos.ts` is 4 generic verbs
  (`ownsProject`/`list`/`findById`/`updateScoped`); the Phase-C promote
  branch (candidate → primary with the old primary appended, exact-400
  `"Not a known candidate for this shot."`), the auto prompt-rebuild
  (`SHOT_PROMPT_PARAM_FIELDS` → soulPrompt with the subject, videoPrompt
  WITHOUT it — subject never belongs in the video template), and the
  empty-patch-touches rule all live in `handlers/production-shots.ts` — the
  same handler-owned pattern the comics cluster proved. The word "promote"
  in the inventory meant "promote is in this slice's scope", not "inside the
  adapter file".
- **`list`'s `primaryCharacter` attach is by-id, never by-project.** pg's
  relational read resolves the FK alone; the sqlite twin fetches referenced
  characters via a guarded `inArray` (empty set → no query) and attaches
  under pg's relation field name (null FK → null attach). A dangling id
  cannot exist locally — the FK is `onDelete: set null` and
  `foreign_keys=ON` makes it fire.
- **The story-OS cluster's real verb surface**: story-state =
  owns/findThreads/createThread/createPromise/updateThreadScoped/
  updatePromiseScoped; memories = owns/findScoped/create/deleteScoped;
  graph = owns/readGraphData; checkpoints =
  owns/readSnapshotInputs/findScoped/create/deleteScoped; plans =
  owns/findScoped/updateScoped/deleteScoped (the POST stays route-side).
  `snapshot`/`beats`/`structuredData` ride `mode:"json"`; promise rows are
  always un-embedded locally (the sanctioned divergence — a stray
  `embedding` key is stripped at the insert, forbidden columns exist
  nowhere on disk).
- **The five-name §4.1 row is five PORTS over six tables** (threads,
  promises, memories, checkpoints, plans, plus the relational
  character-relationship reuse in the graph read) — no "story-memories"/
  "story-graph"/"story-plans" tables exist; the names were port names, not
  table names.

Wave-3 corrections keyed to the code (each found by reading the real pg
adapter/ports, not the standing prose):
- **"Intentional violations … correlation to a world entity, resolution
  lifecycle" — false.** `IntentionalViolationRepository` is an
  acknowledgement map on the `projects` row
  (`intentionalViolations` jsonb → `$type<Record<violationType,
  {confirmed,purpose,timestamp}>>()`): `ownsProject`/`readAcknowledgements`/
  `recordAcknowledgement` is the whole verb surface — read/merge/write,
  overwriting a repeat acknowledgement being the dedupe semantics; no resolve
  or delete verb exists upstream of the adapter either.
- **`readGraph`'s one-relational-query shape does not exist on the sqlite
  baseline.** `sqlite-schema.ts` deliberately ships no `relations()` blocks,
  so the graph read is re-expressed as sibling scoped `findMany`s with the
  same predicates the relations encode (documented in the adapter header;
  a `with` call would throw, and a manual characters×chapters JOIN would
  cartesian-multiply). The vanished-project empty-graph contract — and the
  join-safety pin that keeps future rewrites honest — are both test-pinned.
- **Relationship pair canonicalization is lexicographic string-`<`
  (`c-quill` < `c-sole`), not insertion order** — the upsert stores
  `(min(lex), max(lex))` exactly like pg; and `upsertRelationships` always
  stamps `updatedAt` even on a key-packed call (the pg conditional-set
  behavior verbatim; the smuggled-keys test excludes only that column).

Wave-4 corrections keyed to the code:
- **The tier cap is handler-side; `getTier` is a positional handler
  parameter, never a repo concern.** The adapter's only cap-facing verb is
  the light `countForUser`; cap logic (`MAX_PROJECTS[tier] ?? 3`, `-1`
  skipping the count, the exact `403 "Project limit reached for your plan"`
  body, hooks silent on refusal) lives in `createProject` and drives the
  real adapter in tests. "projects core (tier cap injected via `getTier`)"
  stays accurate only in that narrow injectability sense.
- **Comic candidate mechanics are handler-owned over the generic ports —
  the adapter implements none of them.** `promoteCandidateUrl`
  (exact-400 `"Not a known candidate for this panel."`), append-vs-overwrite
  (`keepAsCandidate`), and the lettered write all live in
  `handlers/comics.ts`; `pg-comic-repos.ts` is 9 generic verbs
  (page: owns/count/`listWithPanels`/create/delete; panel:
  owns/`findScoped`/create/update). Mirroring the adapter IS mirroring it
  mechanically.
- **`candidatePreviewUrls` exists on `production_shots` only; comic panels
  carry `candidateImageUrls` alone** — and panel grid placement is
  `panelIndex` (notNull int), there is no `sortOrder` on `comic_panels`
  (the two-column phrasing in earlier summaries was wrong).
- **Panel ownership is direct at this layer.** `comic_panels` carries its
  own `project_id` FK; every pg panel verb scopes `eq(projectId)` with no
  page→project join. The page indirection exists only route-side (the
  lettering route's separate `ChildResourceRepository` proof).
- **The date-column convention's winner is `integer(mode:"timestamp_ms")`
  (epoch-ms, Date-in/Date-out)** — the §4.2 "TEXT or integer epoch" hedge
  resolves in favor of the schema file's own header on the sqlite side; pg
  keeps `timestamp` columns.

### 4.1 The surface to re-express

Per §13.1's own closing statement, **SQLite adapter parity was the only outstanding
item left when the §13.1 work and the §12 wave were done** — the pg layer is exactly the
swap surface. That surface, as built in Phase 2, is one adapter file per cluster:

| pg adapter | Carries |
|---|---|
| `pg-repositories.ts` | chapter repo + story-bible + story-transaction + story-history repos, and `pgPostCommitHooks` (the real `contentRevision` COALESCE bump + embedding hook) |
| `pg-character-location-repos.ts` | character + location CRUD |
| `pg-thread-reference-repos.ts` | plot-threads (FULL CRUD — the create/delete-only phrasing originally written here was wrong: the port is full CRUD and `updatePlotThread` is consumed by the PATCH routes and the local host; only reference-works is genuinely create/delete-only, per its own header) + reference-works |
| `pg-world-entity-repos.ts` | world-entities + intentional violations |
| `pg-relationship-repos.ts` | relationship-map read + pair upsert |
| `pg-project-crud.ts` | projects core (tier cap injected via `getTier`) |
| `pg-comic-repos.ts` | comic pages + panels |
| `pg-production-shot-repos.ts` | production shots (4 generic verbs: list with the `primaryCharacter` relation + scoped find/update; "promote" means the slice's scope, the branch itself is handler-owned) |
| `pg-story-os-repos.ts` | five ports over story-threads/promises/memories/checkpoints/plans (story-state, story-memories, story-graph, checkpoints, story-plans — port names, not table names) |

This is an inventory, not a design: the per-adapter port shapes AND their handler-contract
tests are already the specification; the SQLite adapters answer to the same unions, the
same 404/403 orderings, and the same tests re-driven against SQLite.

### 4.2 Quirk notes for the SQLite pass

- **pgvector is pg-only — the hard one.** `vectorColumn` (`vector(1536)`, schema.ts:6)
  sits on characters, locations, chapters, world_entities, story_promises, showcases
  (plus work_packets and semantic_cache). There is no SQLite equivalent. Degrade: the
  embedding columns go to NULL/no-op and the `createEmbedText` seam stays at its
  established local-host default `noEmbedText` (local-host.ts) — the same fail-open class
  Phase 2 already documented for the local host. What silently turns OFF: World Bible
  duplicate detection (0.87 bar), voice-exemplar and author-voice retrieval, showcase
  `?q` semantic search, promise cross-reference hints. Degradation strategy choice in
  §5.3.
- **jsonb → TEXT with a decoder.** The biggest mechanical class (~20 columns): world
  entity `properties`, projects' `intentionalViolations`/`aiRules`/`dismissedGuideIds`,
  reference-works `attributes`, chapters' `tags`/`alternateDrafts`/`scenes`,
  memories' `structuredData`, panels'/shots' `candidate*Urls`, story_change
  `previousState`/`updatedTraits`, story-plans `beats`, series `worldRules`/`timeline`,
  semantic cache `cachedOutput`. Discipline: the zod decoders/stays in
  `src/lib/types/story.ts` and the decode live in the adapter; core keeps typed objects,
  never a TEXT column.
- **`.returning()` and batch semantics.** SQLite ≥3.35 supports RETURNING, so the
  create-read shapes can carry over. The properties that must survive: the
  row-match verification inside `applyChanges`/`revertChanges` (an entity vanishing
  between the pre-check and the write aborts the whole transaction) and the
  single all-or-nothing write block per transaction (`db.batch()` is the neon-http
  vehicle; the SQLite driver runs real, simpler transactions — but do NOT restructure
  the pre-check → write ordering while porting it).
- **Date/timestamptz columns** → TEXT (ISO-8601) or integer epoch — one convention for
  the whole baseline. Two pg-idiom call sites to port: the meter's
  `::timestamptz`-cast conditional + `GREATEST` refund (users-table bound — N/A locally,
  there is no local meter against users), and the `contentRevision`
  `COALESCE(..., 0) + 1` single-statement atomic bump (COALESCE is portable; the
  single-atomic-statement test must still pass on the SQLite adapter).
- **uuid PKs:** no `defaultRandom()` in SQLite — id generation moves into the adapters
  (`crypto.randomUUID()` at insert); handlers never see the difference and `.returning()`
  still serves reads of generated ids.
- **Include the 17 empty tables** in the baseline regardless of payload — schema
  completeness is required (`legacy-db-status.md:53-57`), and several are what the
  round-trip fixture (4.3) exercises precisely because they are empty.
- **An accidental opportunity:** the neon production DB's `semantic_cache` has **no**
  unique constraint on `(cache_type, input_key)` (verified defect, legacy-db-status.md:64),
  so `onConflictDoNothing()` cannot dedupe there. The SQLite baseline can simply create
  the missing unique constraint correctly.

### 4.3 The established test requirement (quoted)

> v4 §24's "SQLite round-trip preserves canonical story data" must be validated against
> a purpose-built fixture that exercises every story-domain table, including the 17 empty
> ones — otherwise a bug that only affects `world_entities` or `story_promises` will
> ship undetected. (`docs/migration/legacy-db-status.md`)

And the standing non-regression rule applies unchanged
(`docs/migration/test-baseline.md`): no phase may reduce the passing count without a
written exception; skip/xfail may not increase silently; timeout bumps are not accepted
as flaky fixes. The per-adapter parity tests are **new coverage on top of** the pg suite —
the pg adapters stay, Neon remains the deployed database.

**§4.3 LANDED 2026-10-31** — `src/lib/core/__tests__/sqlite-round-trip-fixture.test.ts`
(13 tests; targeted batch with the nine parity files 150/150 green, re-run green after a
one-off contention flake in the first batch, `tsc --noEmit` exit 0). The inventory is
RUNTIME-DRIVEN, not hand-kept (tables enumerated via drizzle's `drizzle:Name` runtime
tag with a final set-equal pin, so the fixture grows mechanically with the schema), and
writes ONE fully-typed row per table over all **43 tables**, pinning every tracer
bug-class per column: `mode:"json"` decoders (typed arrays/objects and untyped
`{}`/`[]` defaults), `$defaultFn` uuids, `timestamp_ms` exact-instant Date round-trips,
booleans as `true/false` never 0/1, reals keeping decimals, notNull + DDL string
defaults decoding, and nullable-null ≠ default. `story_transactions`/`story_changes`
ride the REAL `record()` adapter; `semantic_cache` gets its only full-row shape
exercise (pair 1 pins only its composite unique). Cascade reachability covers the
tables the other nine files skipped (users→periphery, projects→editor_notes/
generations/audio_exports/reader rows/creator_bible/evolution_log/
project_character_states, chapters→…) INCLUDING the honest set-null survivors
(`platform_events`, `universe_events`) AND the two honestly-FK-LESS dangling-string
columns the baseline mirrors verbatim from pg (`audio_exports.chapterId`,
`story_threads.openedAtChapterId`) — pinned as strings, not mis-pinned with FKs.

The "17 empty tables" verdict (code truth vs the legacy prose): the legacy probe's
JSON was internally consistent when taken (17 zero-row tables among 41 probed,
2026-10-01) but is stale as a coverage spec — the DDL grew 41→43 with §13.1's
`story_transactions`/`story_changes` (absent from its rowCounts), and 6 of its 17
(world_entities, story_threads, story_promises, story_plans, story_checkpoints,
reference_works) now carry full adapter parity coverage. Code disposition: **24+
adapter-exercised, 18 never-adapter-read (this file is their only shape exercise),
1 seed-only (users)** — the fixture writes all 43 regardless.

## 5. Open decisions — SETTLED 2026-10-31/11-01 (implementation for #2 shipped same day; the rest are recorded judgments)

1. **Metering semantics (§2.3) — SETTLED as shipped in stage (b).** Local
   metering is read-only observability, structurally unable to refuse (the
   `LocalGenerationMeter` port carries no refusal path; response latency
   never coupled), the cloud weights/limit machinery stays cloud-owned, and
   where records LAND remains a composition-root decision (the mount only
   calls a record seam). Verified live via the wave-2 12-test suite.
2. **Admin bridge vs side registry (§3) — SETTLED: option (b), SHIPPED** as
   `lib/core/local-admin-registry.ts`: a sibling transport-domain registry
   (`_kind: "local-admin"`, `method` restricted to GET|POST so a
   user-path PATCH can never enter at compile time, static paths irrelevant
   beyond the two), authorized ONLY via `requireBearer(…, "ADMIN_SECRET")`
   (`@/lib/auth-secret` — node:crypto only, loopback-usable as-is), bearer
   gate BEFORE routing (unset secret → 500 fail-closed even for bogus
   paths), owner token NEVER able to authorize an admin path (a hex
   64-char token presented as a bearer is 401 — pinned), handlers are NOT
   RequestContext-ified (they take `{params, body}`), and MOUNTED ONLY the
   two observability reads a local operator actually wants
   (`cost-report`, `cache-stats` over the sqlite baseline; moderation and
   infra ops stay cloud-only). The blended cost table moved to the shared
   `lib/admin/cost-model.ts` so both surfaces import ONE source (the cloud
   route now imports it too — behavior identical; no cloud route test
   depended on the inline copy). 8 new tests.
3. **Embedding degradation (§4.2) — SETTLED: omit vector columns entirely;
   features honestly off; `noEmbedText` stays the seam default.** Storing
   TEXT-frozen vectors now would build similarity machinery for a consumer
   that doesn't exist locally; a later local similarity path can re-add a
   column + adapter as its own slice. Already implemented across all six
   waves (strip/short-circuit/empty pins).
4. **Streaming deferral (§2.4) — SETTLED: non-streaming-only local surface
   (already enforced: the stage-(a) mount answers `stream: true` with an
   explicit 400); revisit trigger = a NAMED local consumer needing deltas,
   not speculative symmetry with the cloud route.**
5. **`runMeteredCall` split (§2.3/§2.5) — SETTLED: never-for-a-single-owner
   host for now.** Director/Editor verbs mount locally meter-less first
   (any such stage-d/e mount composes gate-less ports per stage (a)'s
   shape); the shared seam refactor into meter port + model port happens
   only if a named consumer needs per-call local metering — otherwise it's
   churn for one owner.
6. **Provider/model profile (§2.7) — SETTLED: env vars only** (the stage-(a)
   `local-generation-profile.ts` `GW_LOCAL_*` shape), no gitignored profile
   file (pull-model env is how every other local surface reads config, and
   a file invites secret sprawl). Series/universe context builders keyed by
   userId get a convention when a local composition needs them: the
   composition root supplies ONE `localOwnerId` (a real users-row id the
   host already knows), NOT empty — empty would silently drop context that
   exists; the id makes the builders behave identically to their cloud
   behavior. Not implemented yet — it travels with the next stage-(e)
   slice that actually binds those builders locally.
   **UPDATE 2026-11-01 (stage (e) shipped):** the convention is now live at
   the TRANSPORT level too — `localContext({ actorOwnerId })` (see §2.6's
   stage-(e) record). One deliberate refinement of this section's original
   letter ("the loopback ctx actor is the host, never a users row"): when a
   composition root SUPPLIES `localOwnerId`, every ctx's actor id IS that
   users row — production-FK semantics for handlers writing users-FK'd
   rows (proven: the first real boot 500'd on `FOREIGN KEY constraint
   failed` under the placeholder id, and create/read after the threading
   went 200). The placeholder behavior remains the default when the
   composition supplies nothing, so every pre-stage-(e) test contract is
   byte-identical. `run-plan`/`generate-package` deps bundles already
   carry `localOwnerId` per this section; the run-plan slice that binds
   context builders is still the unshipped part.

## 6. Master-plan §10/§10.1 — the canonical portable project snapshot (2026-11-01 SHIP)

The last unshipped Phase-3 piece per the master plan's own phase order (§18
puts the SQLite line + importer/exporter ahead of Phase 4's provider
portability, and §6.2 lists the exporter/importer pair among the critical
contracts). Preflight 0 proved the legacy DB REACHABLE AND POPULATED
(see `legacy-db-status.md`), so this importer/exporter is a REAL forward
migration surface, not a fixture exercise. Landed as three files + wiring:

- **`lib/core/handlers/portability.ts`** — the envelope contract (pure, no
  db import at all): `SNAPSHOT_FORMAT`/`SNAPSHOT_VERSION`, the FK-ordered
  `SNAPSHOT_COLLECTIONS` kind list, `ProjectSnapshotEnvelope` (versioned,
  `meta.checksum` = SHA-256 hex of `JSON.stringify(collections)`), the
  `SnapshotPort` interface, `exportProjectSnapshot` (403 via
  `mayAccessProject` BEFORE the port; owner-bound read → 404 for a stranger
  or foreign-owner id — stage (d)'s adversarial pin, now for reads too) and
  `importProjectSnapshot` (scope-pinned ctx → 403; structural validation in
  deliberate order — shape → checksum → kind-set completeness → port; the
  port thrown `SnapshotConflictError` maps to 409).
- **`lib/core/sqlite-project-snapshot.ts`** — `makeSqliteProjectSnapshotPort
  (db, ownerId)`: the factory binds ONE owner row (§5.6's `localOwnerId`,
  exactly stage (d)'s `findOwned` shape). Reads are owner-bound and
  id-ordered; writes are one native transaction that walks the HANDLER's
  own FK order via a kind→rows Map — received collection order is NEVER
  trusted, so a shuffled client cannot create a child before its parent.
  Date revival is GENERIC per `getTableColumns(...).dataType === "date"`
  (tsx-probed: epochMs → "date", json-mode → "json", text → "string") —
  there is NO hand-kept per-table reviver to drift. The import recomputes
  the checksum, refuses truncated/altered copies (400), pre-checks
  project-id existence before seeding (409 never depends on transaction
  order), re-owns the project row to the destination owner (§5.6 — the
  cloud userId never touches the envelope's cargo), and applies ONE
  `contentRevision = carried + 1` per §11.1's bulk-import rule.
- **`local-host.ts`** — the `portability?` dep slot + two mounts
  (`GET /projects/:projectId/export`, `POST /projects/import` — the
  envelope IS the body, no wrapper), 501-by-default like every optional
  cluster; **`scripts/spawn-local-host.mts`** plants the real bundle over
  the host db + `localOwnerId`.

### The include-list (FK-closed, 20 collections)

INCLUDED (project row + 19 project-scoped story surfaces, in FK order):
`project, chapters, characters, locations, plotThreads, storyThreads,
storyPromises, editorNotes, worldEntities, referenceWorks,
characterRelationships, storyMemories, characterEvolutionLog,
storyCheckpoints, storyPlans, comicPages, comicPanels, productionShots,
storyTransactions, storyChanges`.

EXCLUDED, each for a documented reason (the full list rides the handler's
header comment):

| Surface | Reason |
| --- | --- |
| users, accounts, sessions, subscriptions, referrals, password/email tokens, platform_events | identity/billing infra — import re-owns everything to the host's ONE owner row, so a foreign userId must not even enter the envelope |
| generations | the cloud meter's log — a local host composes its own `LocalGenerationMeter`; `storyTransactions.sourceGenerationId` dangles BY DESIGN (a plain FK-less column) |
| semantic_cache | derived cache, not canon |
| showcases, reader_sessions, reader_reactions | §15 cloud/module-only surface |
| audio_exports, video_analysis_jobs | optional-module media artifacts |
| creator_bibles | §15 disabled module |
| work_packets/work_patterns, series_bibles | user-level craft data, series-scoped not project-scoped |
| universes, universe_characters, universe_events, project_character_states | a PMC row FKs a universe character: importing without universes violates the FK, and universes are user-level series data — a later series-level slice composes that closure |

### Verification

- **`__tests__/sqlite-project-snapshot.test.ts` — 16 tests, green on the
  first execution** (after compile-only fixes; `tsc --noEmit` clean).
  Three layers over REAL sqlite dbs: the envelope contract (versioned
  shape, kinds in FK order, self-consistent checksum, every excluded
  surface seeded in the SOURCE and proven to ride nowhere); the full
  round-trip (export of a seeded canon across all 20 collections → import
  into a fresh db → per-collection deep set-equality with ids preserved
  verbatim, Dates revived, json shapes back as objects, re-owned project,
  revision 5→6, all excluded surfaces at zero rows, the dangling
  `sourceGenerationId` soft-ref preserved); cross-DB checksum
  determinism (the re-export's 19-child canon is byte-identical; the
  project row differs ONLY where re-owning permits it — userId re-owned +
  the §11.1 revision — which is why a naive "whole-envelope checksums
  equal" claim would be WRONG and is not what the suite pins);
  validation/transport (the 400 family — bad format/version/missing/dup'd
  kind/non-object row/not-exactly-one project row/tampered
  checksum/missing meta — each with a fail-closed zero-rows destination;
  501/401 via `dispatchLoopback`; a full export→wire→import round trip).
  The suite carries its OWN mirrored source-purity block (never touching
  the shared parity FILES array) over the two new files. The all-empty
  import doubles as the port's kind→table-map completeness pin.
- **Live wire pass (spawned hosts, temp dbs)**: host A built a real canon
  (project + plot thread + a `user-edit` story transaction through the
  §13.1 write path), `GET /projects/:id/export` returned the versioned
  envelope (all 20 kinds; note projects legitimately seed ONE starter
  chapter, so `chapters=1`, and the hook chain ran the revision to 3);
  host B `POST /projects/import`'d the byte-exact body → 200, revision
  3→4 (ONE bump), row re-owned to B's own `localOwnerId` (A's id never
  carried — `matchesB=True differsFromA=True`); re-importing the same
  bytes → exactly 409. Pinned driver + logs in `$env:TEMP\gw-verify`.
