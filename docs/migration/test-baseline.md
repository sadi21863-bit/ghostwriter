# Test baseline (v4 §6)

Recorded before Sprint 0's later changes, on a clean `main` tree with the three
security fixes for the audio routes already applied. This is the guardrail
against making a refactor green by deleting or weakening tests.

## Counts

| Metric | Value |
|---|---|
| Baseline total collected | 1,071 |
| Baseline passing (full-suite, contended) | 1,068 |
| **Current total collected** | **2,261** |
| **Current passing** | **2,261** |
| Test files (baseline → current) | 151 → 230 |

> The audit cited "1,074 tests". Measured is **1,071**. Treat 1,071 as the
> authoritative baseline, not the audit figure.
>
> Current state after Preflight 0 + Sprint 0 + Phase -1A + Phase 0 (ContextPolicy,
> metering order, GrowthBook flag decisions) and Phase 1 (library-handler
> registry, generic CapabilityGate, scene handlers, GenerationService) and Phase 2 (RequestContext, auth decorators, updateChapter handler, repository ports, Core ownership, getStoryBible, applyStoryTransaction, generation gating consolidation, the `generateChapter` Core handler with `/api/ai/generate` rewritten as a thin adapter, the loopback local host) and Phase 5A (slice 1: the real `contentRevision` column + `pgPostCommitHooks`; §13.1 slice 1: the persisted `story_transactions`/`story_changes` tables + `pgStoryTransactionRepository` + the story-transactions route adapter; §13.1 slice 2: the audit + revert endpoints (GET list/one, POST revert) over the persisted story_transactions/story_changes tables, the StoryHistoryRepository port + pg adapter (informed pre-check → 409 conflicts, all-or-nothing inverse batch), and the local host's first optional-deps 501 guard): **1,549 passing, 183 files, 0 failed,
> 0 skipped**, `tsc --noEmit`
> exit 0. Then the 2026-10-20 wave extracted the Story Bible Core handlers
> (characters/locations, thread-reference, world-entity-violation,
> relationship-map, projects-core) with their route coverage — 11 new route test
> files under `api/projects/` (`projects`, `[projectId]`, `locations/[locationId]`,
> `plot-threads`, `reference-works` ×2, `relationship-map`, `world-entities/[entityId]`,
> `intentional-violation`, `story-transactions`, `story-transactions/[transactionId]/revert`)
> plus additions to 5 existing route test files (`characters`, `characters/[characterId]`,
> `locations`, `plot-threads/[threadId]`, `world-entities`), typed-error updates to the
> story-history/apply/pg tests, `local-host.test.ts` wave-2 additions, and a
> `useEntitySync.test.ts` rewrite: **1,733 passing, 198 files, 0 failed, 0 skipped,
> ~411s**, `tsc --noEmit` exit 0 (net +184 tests, +15 files over the 1,549/183
> record). Then a third same-day wave added the comic-crud handler+route tests,
> production-shot-crud, story-os-crud handlers + routes, local-host wave-3
> additions, and a characters/locations route-test redo with projectId-regression
> pins: **1,889 passing, 206 files, 0 failed, 0 skipped, ~429s**, `tsc --noEmit`
> exit 0 (net +156 tests, +8 files over the 1,733/198 record). Then the
> 2026-10-22 hardening wave added the `CanonicalMutationKind` observed-kinds
> pin, the DIFF_FIELDS/ENTITY_TABLES allowlist tests (per-entity set-equality
> mirror + decode tests), the loopback shape-parity pin updates, and the new
> `edit-transaction.test.ts` (19 pins) for the §13.1 UI form-save migration:
> **1,946 passing, 209 files, 0 failed, 0 skipped, ~400s**, `tsc --noEmit`
> exit 0 (net +57 tests, +3 files over the 1,889/206 record). Then the
> 2026-10-22 **Phase 3 wave** added the local `/ai/generate` mount's handler
> suite (`local-generate.test.ts`, 19 tests over a real listening host — 501
> by default, mock-bundle happy path, stop mappings, no-meter/no-gates
> assertions, the cast-smuggled-ports drop pin) and the SQLite tracer's
> parity suite (13 tests over `node:sqlite` + drizzle sqlite-proxy): **1,978
> passing, 211 files, 0 failed, 0 skipped, ~265s**, `tsc --noEmit` exit 0
> (net +32 tests, +2 files over the 1,946/209 record). Then the 2026-10-22
> **Phase 3 wave 2** added the SQLite thread-reference parity pair
> (`sqlite-thread-reference-repos.ts` — plot-threads full CRUD +
> reference-works create/delete with the untyped `attributes` jsonb→TEXT
> round-trip; 14 tests, which also pinned **two corrections of prior
> reports**: plot-threads is full CRUD, not create-delete-only, and
> `linkedReferenceIds` does not exist anywhere — the pair's real json
> carrier is `reference_works.attributes`) and the stage-(b) record-only
> meter (`LocalGenerationMeter` port + the mount's fire-and-forget
> post-success record call-site; 12 tests incl. no-latency-coupling and
> no-refusal-path pins): **2,004 passing, 212 files, 0 failed, 0 skipped,
> ~327s**, `tsc --noEmit` exit 0 (net +26 tests, +1 file over the 1,978/211
> record). Then the 2026-10-28 **wave 3** added the SQLite world-entity and
> relationship parity pairs (`sqlite-world-entity-repos.ts` — world-entity
> CRUD + the intentional-violation acknowledgement port over the
> `projects.intentionalViolations` json column, with the sanctioned
> embedding degradation mirrored; `sqlite-relationship-repos.ts` — the graph
> read re-expressed as sibling findManys because the sqlite baseline ships
> no `relations()` blocks, + the lexicographically normalized pair upsert;
> 19 + 14 tests, all four failures found in the first targeted run being
> test-side staleness from an interrupted agent, zero adapter bugs):
> **2,037 passing, 214 files, 0 failed, 0 skipped, ~838s under CPU
> contention from a concurrent tsc**, `tsc --noEmit` exit 0 (net +33 tests,
> +2 files over the 2,004/212 record). Then the 2026-10-31 **wave 4** added
> the SQLite projects-core parity adapter (`sqlite-project-crud.ts`, the
> full 7-verb port with the handler-side tier cap driven through it; 22
> tests) and the comic pages+panels adapter (`sqlite-comic-repos.ts`, 9
> generic verbs — the promote/keep-as-candidate/lettering mechanics proven
> being handler-owned over the generic ports, not adapter semantics; 21
> tests): the full run recorded **2,079/2,080 across 216 files (~1,467s
> under heavy contention) with the single failure being the documented
> below-known-flake `auth.test.ts:28` timeout, which re-ran 5/5 green in
> isolation** — effective state **2,080**, `tsc --noEmit` exit 0 (net +43
> tests, +2 files over the 2,037/214 record). Then the 2026-10-31 **wave 5**
> added the SQLite production-shot and story-OS parity pairs — built INLINE
> after three consecutive subagent-dispatch kill streaks at launch (the
> established fallback; wave 4's clean parallels ran just before):
> `sqlite-production-shot-repos.ts` (4 generic verbs; the §4.1 "promote
> inside" pinned as handler truth, not adapter truth) and
> `sqlite-story-os-repos.ts` (five factories over the Promise-Tracker trio +
> memories/graph/checkpoints/plans, three documented relational
> re-expressions, promise-embedding honesty): parity batch **123/123 across
> ALL 8 SQLite test files**, full run **2,100 passing, 218 files, 0 failed,
> 0 skipped, ~1,558s**, `tsc --noEmit` exit 0 (net +20 tests, +2 files over
> the 2,080/216 record). Then the 2026-10-31 **wave 6 (the FINALE)** built
> `sqlite-repositories.ts` (the last pg adapter file, 738 lines → twin) —
> chapter repo, the `ProjectRepository.findOwned`/`ChildResourceRepository`
> pairing not already answered by the projects-core adapter, the aggregated
> Story Bible read, the real `COALESCE(contentRevision, 0) + 1` post-commit
> hooks, and the complete §13.1 machinery (record/apply/revert + the
> change-wire codec COPY, pinned field-set-equal to `DIFF_FIELDS`): parity
> batch **137/137 across ALL 9 SQLite test files**, full run **2,114
> passing, 219 files, 0 failed, 0 skipped, ~1,009s**, `tsc --noEmit` exit 0
> (net +14 tests, +1 file over the 2,100/218 record). Then the same-day
> **§4.3 fixture** (CLAUDE.md item 79) added the full-surface round-trip
> over all 43 tables — **2,127 passing, 220 files, 0 failed, 0 skipped,
> ~593s**, `tsc --noEmit` exit 0 (net +13 tests, +1 file over the 2,114/219
> record; targeted batch 150/150 across fixture + nine parity files). **The
> §4 SQLite adapter-parity line is COMPLETE — every pg adapter surface has
> a SQLite twin AND a full-surface canonical-data round-trip fixture.** Then
> the 2026-11-01 **stage (c)** (option (b) per the settled §5.2 decision)
> shipped the loopback admin side-registry — `lib/core/local-admin-registry.ts`
> (const `_kind: "local-admin"` marker + GET|POST-only methods;
> `requireBearer(ADMIN_SECRET)` gate BEFORE routing; the two observability
> routes twin'd over the sqlite baseline) + the shared
> `lib/admin/cost-model.ts` the cloud route now imports too: **2,135
> passing, 221 files, 0 failed, 0 skipped**, `tsc --noEmit` exit 0 (net +8
> tests, +1 file over the 2,127/220 record), with the eleven-file purity
> suite hardened by the established timeout-bump precedent after its purity
> `it` hit the known full-suite contention class for the first time under
> today's load (a 20,000ms second argument on the same test in the nine
> sqlite parity files + the fixture). Then the 2026-11-01 **stage (d)**:
> part 1 — the run-plan preflight mount (`POST /projects/:projectId/graph/run-plan`
> + the `runPlan` bundle via the settled `localOwnerId` convention, 7
> tests) and part 2 — the `generate-package` write-half extraction
> (`handlers/generate-package.ts` + the fused port surface + the local
> adapter factory; 8 tests), fixing two latent part-1 typecheck errors along
> the way (a `CapabilityContext` import mispointed at `graph-program`, and
> the now-typed `tier` + `localOwnerId` narrowing): targeted 46/46 across
> the stage-(d) trio of test files, **2,150 passing, 223 files, 0 failed,
> 0 skipped**, `tsc --noEmit` exit 0 (net +15 tests, +2 files over the
> 2,135/221 record). Then the 2026-11-01 **stage (e)** — the production
> composition root (`scripts/spawn-local-host.mts` + `npm run local:host`,
> the first non-test spawn of the loopback host ever; every sqlite twin
> factory wired; the §5.6 owner-user provisioning + `localOwnerId` flowing
> through `localContext.actorOwnerId` so FK-linked writes use production
> semantics; verified LIVE over the wire: create/read/run-plan 200,
> `/ai/generate` 501, `/admin/*` fail-closed-500) and the admin-arm server
> wiring (`LocalHostOptions.adminRegistry` + the transport-level credential
> disjointness pins in `local-host-admin.test.ts`, 4 tests): **2,154
> passing, 224 files, 0 failed, 0 skipped**, `tsc --noEmit` exit 0 (net +4
> tests, +1 file over the 2,150/223 record). Then the 2026-11-01
> **§10/§10.1 snapshot wave** — Phase 3's LAST unshipped piece, the
> canonical portable project snapshot (`handlers/portability.ts`: versioned
> envelope + SHA-256 checksum + the FK-ordered 20-kind list + fail-closed
> 400/403/404/409 validation; `sqlite-project-snapshot.ts`: owner-bound
> reads, generic dataType-driven date revival, re-owning single-transaction
> write with ONE §11.1 revision bump; the `portability?` dep slot + two
> 501-by-default mounts + the spawn-root plant; 16 tests green on first
> execution incl. cross-DB checksum determinism and a full
> `dispatchLoopback` export→wire→import round trip, plus live two-host
> verification — export all 20 kinds, import the exact bytes → revision +1,
> re-owned to the destination's own owner id, re-import exactly 409):
> **2,170 passing, 225 files, 0 failed, 0 skipped, ~541s**, `tsc --noEmit`
> exit 0 (net +16 tests, +1 file over the 2,154/224 record). Then the
> 2026-11-02 **Phase 4 slice 4a** — the §12/§12.1 local provider seam
> (`lib/core/local-provider-adapter.ts`: the ONE OpenAI-compatible adapter
> over a `LocalOpenAIEndpoint`, cloud-engine byte-parity prompt assembly,
> the mount's reason→status vocabulary with marker-based context tagging;
> plus §12's injectable localhost detection over the documented probe
> list — the default surface UNCHANGED, no bundle auto-plants against the
> §5.6 spend posture): 15 tests over in-process node:http fixtures, green
> after one real adapter fix (the error path must ALWAYS read the body —
> a provider's own error words ARE the translation's input): **2,185
> passing, 226 files, 0 failed, 0 skipped, ~575s**, `tsc --noEmit` exit 0
> (net +15 tests, +1 file over the 2,170/225 record). The baseline count
> has only ever gone up.

> Then the 2026-11-02 **Phase 4 slices 4b+4c** (parallel subagent dispatches,
> each verified on its own tree, then merged and re-verified on the UNION
> tree): 4b — the DEDICATED Anthropic adapter (`lib/core/local-anthropic-adapter.ts`;
> the cache seam IS the feature — `cache_control: ephemeral` ON the static
> system block with the dynamic block deliberately uncached, the SDK imported
> only dynamically inside the default client factory, the key required BY
> TYPE on the Anthropic path, the shared `composeInstructionalHead` factored
> out of 4a's module so both adapters keep ONE assembly; 18 injection-only
> tests, zero network) and 4c — profile BYOK routing + the §12 visibility
> read (`lib/core/local-provider-routing.ts`: `makeProfileChooseProvider`
> composes NOTHING when unset, `GET /providers` = the routing shoebox
> verbatim + key-PRESENCE booleans via the profile's own env names +
> detection passthrough, presence-only double-pinned at unit AND wire
> levels; 22 tests) + a live spawn pass (401-before-routing, the honest
> unset body, `anthropic=true` with no `sk-*` shape anywhere in the response
> body, `detected: 0` on a server-less box): **2,225 collected, 2,225
> passing, 228 files** — the contended run itself was 2,222 passed with THREE
> contention timeouts (the known `auth.test.ts:28` 30s flake PLUS two
> first-sightings: a 5s local-host checkpoint timeout and a 15s
> generate-video polling timeout), all flat `Test timed out` with zero
> assertion failures, and the targeted re-run of exactly those three files
> came back **100/100 green**; run wall ~855s, `tsc --noEmit` exit 0 on the
> merged tree (net +40 tests, +2 files over the 2,185/226 record). The
> baseline count has only ever gone up.

> Then the 2026-11-02 **Phase 4 slice 4d** (two parallel subagent
> dispatches + an orchestrated wire pass; the arc's close-out): the
> §2.7 LOCAL CONTEXT HALF (`lib/core/local-generation-context.ts` — the
> cloud series/universe/series-bible builders + promise ledger translated
> to the SQLite twins, every read scoped to the ONE `localOwnerId` row,
> flat selects over the deliberately relation-less schema, byte-exact
> assemblies reusing the cloud's pure exports; 19 tests), the mount's two
> additive edits (`GenerateChapterInput.additionalContext` + the planted
> builder's mode-directive application — the mount still owns
> `effectivePrompt`), the `GW_LOCAL_GENERATION` composition
> (`lib/core/local-generation-composition.ts`: `auto` = localhost
> detection with the SECRET-EGRESS PIN — a cloud key in env never attaches
> to a detected target; `generic`/`anthropic` = explicit operator plants;
> unset = OFF/501; 15 tests), the spawn-root plant, and the FIRST
> end-to-end generation wire pass over a real localhost OpenAI-compatible
> fixture (boot-A 501; boot-B detection + 401-before-spend; the prose
> call's captured system message carrying the artifact head → static →
> series chain (keyEvents + fact) → series bible → dynamic +
> additionalContext + ledger with the resolved promise dropped; the
> brainstorm call's full directive suffix with the ledger gated off; the
> `sk-*` sentinel never egressed; both `generations` rows persisted with
> raw prompts): **2,261 passing, 230 files, 0 failed, 0 skipped, ~542s**,
> `tsc --noEmit` exit 0 (net +36 tests, +2 files over the 2,225/228
> record — binder 19 + composition 15 + mount additions 2). The baseline
> count has only ever gone up.

## Known-flaky under full-suite load

These pass in isolation but fail when the whole suite runs concurrently. Confirmed
pre-existing and **unrelated to Sprint 0** — verified by running both files with
and without the Sprint 0 changes applied (8/8 passing in isolation either way).

| Test | File |
|---|---|
| `authOptions - GoogleProvider registration (item 72) > registers a google provider when both env vars are set` | `src/lib/__tests__/auth.test.ts` |
| `checkpoint routes (§7 wave 3) > creates a checkpoint - defaulted name, the healthScore snapshot, §11 hook wired` — a 5s timeout under full-suite load, first sighting 2026-11-02 in the slices-4b+4c run; the targeted batch re-ran it green | `src/lib/core/__tests__/local-host.test.ts` |
| `POST .../generate-video?multiShot=1 (item 68 Task 3, opt-in) > polls to completion when the submission returns a job instead of an immediate mediaUrl` — a 15s timeout under load, first sighting 2026-11-02 in the same run; re-ran green | `src/app/api/projects/[projectId]/production/scenes/[sceneNumber]/generate-video/__tests__/route.test.ts` |

Re-observed immediately during Phase 5A §13.1 slice 1's full-suite run (2026-10-18):
the SAME GoogleProvider case was the only failure in an otherwise green
1,506-test, 178-file run — a plain 30s timeout while the whole suite contended
(file wall 33.2s; the file passes in isolation, and the slice's first full-suite
run measured it at 37.4s). Suite durability evidence: clean-run wall 354s vs
contended 593–649s.
| `compositeLettering > draws a dark caption box across the top when caption is present` | `src/lib/comic-lettering/__tests__/composite-panel.test.ts` |
| `compositeLettering > draws a white speech bubble fill in the bottom zone when dialogue is present` | `src/lib/comic-lettering/__tests__/composite-panel.test.ts` |
| `preview-all > clamps the batch to what the $5 budget cap affords` (20,166ms vs its 20s limit) | `src/app/api/projects/[projectId]/production/preview-all/__tests__/route.test.ts` |
| `preview-all > rejects the whole batch when one item exceeds the cap` (6,967ms vs the 5s default it lacked; now 20s like its sibling) | `src/app/api/projects/[projectId]/production/preview-all/__tests__/route.test.ts` |

`composite-panel` is the documented `sharp` cold-start case (CLAUDE.md items 34/37
already bumped its timeout to 20s). It is still not reliably green under load.

The three additions came from the Phase 5A verification run (2026-10-17): one
contended full-suite pass ran at 593s versus 354s uncontended (1.7x), and exactly
the tests that normally sit close to their limits tripped — preview-all (its own
comment documents a 7-8s routine runtime on 5s/20s limits) and the Google OAuth
registration test (37.4s vs 30s; green in isolation both times, and the whole
suite passed clean at 354s). The reject-over-cap test had NO timeout argument and
was miscalibrated on arrival (5s default on a slow-module-import file); it now
carries the same 20_000 as its sibling. No timeout was raised above what its own
sibling already used — the 20s/30s targets themselves were not moved.

2026-10-20 wave full-suite run: the same test (still line 28,
`registers a google provider when both env vars are set`) passed, with margin —
none of the flaky set tripped.

## Non-regression rule (v4 §6.1)

- No phase may reduce the **1,068 passing** count without a written exception
  committed beside the change.
- An exception must name the removed/replaced tests, explain why they are
  obsolete, and link to replacement coverage.
- Skip/xfail counts may not increase silently.
- **Timeout increases alone are not accepted as a flaky-test fix.** Fix the
  real cost first — see the `library-handlers` note below.
- Test renames/splits can change the raw count, so this record also tracks the
  seven critical contracts below, not only a number.

## Critical contracts — may never be deleted or skipped

1. Two-tenant child-resource ownership matrix
2. ContextPolicy production-path shadow/switch tests
3. Meter/gate charge-order tests for legacy paid routes
4. Guide/funnel single-derivation tests
5. Exporter/importer round-trip contracts
6. `contentRevision` invalidation/staleness tests
7. Loopback no-egress and auth-decorator tests

## Audit note — a real instance of the failure this rule prevents

While adding two-tenant tests for the audio routes, the existing
`src/app/api/audio/{generate,lipsync}/__tests__/route.test.ts` files were
**overwritten** rather than appended to, destroying 14 pre-existing tests
(including the `requestId|pollingUrl` storage contract and the shared
`pollAndUpdateLipsync` delegation contract from CLAUDE.md item 50). This was
caught only because `git status` showed the files as `M` (modified) rather than
`??` (untracked).

Restored via `git checkout --` and re-added the new coverage as appended
`describe` blocks. Both files now run their original tests plus the new ones
(lipsync 5→9, generate 9→13).

**Lesson:** before writing a test file, check whether it already exists. This is
precisely the "refactor deletes tests" scenario §6.1 exists to prevent, and the
only reason it surfaced at all was that git status was read before committing.

It happened **three times** in one session (audio/lipsync, audio/generate, and
chapters PATCH). After the first, `git status --short <path>` was checked before
every subsequent test-file write, and `git show HEAD:<path>` was used to read the
original before appending. That check is now a habit worth keeping.

## Audit note — a `beforeAll` timeout reports tests as SKIPPED, not failed

`lib/ai/__tests__/library-handlers.test.ts` loaded 19 context builders through
each registry handler's dynamic `loadContext()` inside a `beforeAll`. Under
full-suite contention that hook exceeded its timeout, and vitest **aborted all 40
tests in the block and reported them as `skipped`** — not as failures.

The run summary read:

```
Test Files  2 failed | 159 passed (161)
Tests       1 failed | 1212 passed | 40 skipped (1253)
```

which looks like a single flaky failure. In reality 40 assertions never executed.
The green-ish tally reported success while testing nothing — the same failure
class as the stale-`run.log` incident.

**Two lessons:**

1. **Always read the skipped count.** It is part of the summary for a reason, and
   a newly non-zero skip count is a regression until proven otherwise. The 40
   were exactly `1 + 19 + 19 + 1` — the `library handler registry` block.
2. **A hook timeout is silent.** It never surfaces as a failing assertion, so no
   amount of reading failure output would have found it.

Fixed at the source rather than by raising the timeout: the builders are now
**statically imported** in the test file, transformed once as part of its own
module graph instead of 19 separate dynamic-import round-trips. Test time fell
from ~2.6s to **45ms** — the assertion is unchanged and now costs nothing.

## Audit note — `git checkout -- <dir>` destroyed uncommitted Sprint 0 work

While iterating on the Phase 0 metering reorder, a broad
`git checkout -- src/app/api/ai/ src/app/api/projects/` was used to undo a
bad codemod. **That silently reverted two unrelated, uncommitted Sprint 0 fixes**:

- `projects/[projectId]/chapters/[chapterId]/route.ts` lost its mass-assignment
  allowlist (`.set({ ...b })` again spread the raw request body, so `projectId`,
  `id`, and `embedding` were client-writable). Its 4 regression tests were reverted
  with it.
- `ai/generate/route.ts` lost the `isGenerationMode` request-boundary guard,
  leaving `isGenerationMode` with zero production callers — a boundary guard that
  guarded nothing.

It was caught only because the test count fell from 1,131 to 1,123 with no
explanation. Both were restored, and the mode guard now also has behavioural
route-level coverage (`mode-boundary.test.ts`), which is what caught the fact that
without the guard a bad mode returns **500**, not 400.

**Lessons:**

1. `git checkout -- <dir>` is only safe when every change under `<dir>` is
   disposable. Scope it to specific files, or `git stash push -- <paths>` first.
2. **A drop in the test count is a bug report, not noise.** Check the direction of
   the delta before assuming a change was additive.
3. A pure helper with only a unit test can still be dead code. Grep for production
   callers, not just for the symbol.
4. Prefer a file-level codemod that is idempotent and re-runnable over repeated
   blanket reverts.

## Audit note — a mock that always returned `true` hid the paywall

`api/ai/generate/__tests__/mode-boundary.test.ts` mocked `canAccessFeature` as
`() => true`, unconditionally. That made the route's registry-derived gate a
**silent no-op across the whole suite**: the real paywall check never ran, and
the only thing refusing free-tier library modes was the hardcoded `LIBRARY_MODES`
set that this pass deleted.

The mock was not merely lazy — it was load-bearing for the old tests. After the
deletion, new free-tier tests failed with `200` instead of `403`, which is what
surfaced it. Fixing the mock to mirror `FEATURE_ACCESS` made the real gate do the
blocking, exactly as it does in production.

**Lesson:** a mock that returns a constant `true` for an authorization helper
does not weaken a test — it deletes the behaviour under test. Authorization
mocks must derive from the real table, not from a literal.

A second bug in the same file: the new `describe` block had no `beforeEach`, so
its tests inherited call history from the block above and `generate` appeared to
have run for a mode it never saw. `vi.clearAllMocks()` is per-describe.

## Running the full suite on this machine

- `npx vitest run --reporter=dot --maxWorkers=4` takes ~5 min.
- **Always cap workers.** An uncapped run spawned ~10 concurrent node processes
  and stalled completely (no output for 20+ minutes, every worker parked at ~2s
  CPU) — orphaned workers left by an interrupted tool call, not a slow machine.
- Recovery from a stall: `Get-Process -Name node | Stop-Process -Force`, then
  re-run. An uncapped run also took 1,188s once stalled versus 289s capped, so
  capping is both faster and more reliable here.
- If the log stops growing, check `Get-Process -Name node` CPU time before
  assuming the run is merely slow.

## Additions since the baseline

| Phase | New tests | Where |
|---|---|---|
| Sprint 0 — cross-tenant | 8 | `audio/lipsync`, `audio/generate` |
| Sprint 0 — mass assignment | 7 | `chapters/[chapterId]` |
| Sprint 0 — upload validation | 8 | `scenes/[n]/upload-audio` |
| Sprint 0 — secret comparison | 10 | `lib/__tests__/auth-secret.test.ts` |
| Sprint 0 — mode guard | 10 | `lib/modes/__tests__/generation-mode-guard.test.ts` |
| Sprint 0 — mode guard, behavioural | 7 | `ai/generate/__tests__/mode-boundary.test.ts` |
| Phase 0 — ContextPolicy shadow | 14 | `lib/ai/__tests__/context-shadow.test.ts` |
| Phase 0 — policy regression guard | 1 | `lib/ai/__tests__/context-builder.test.ts` |
| Phase 0 — metering charge order | 12 | `lib/metering/__tests__/charge-order.test.ts` |
| Phase 0 — parse-failure refunds | 4 | `lib/metering/__tests__/parse-failure-refund.test.ts` |
| Phase 0 — GrowthBook flag decisions | 10 | `lib/__tests__/growthbook-flag-decisions.test.ts` |
| Phase 1 — library-handler registry | 79 | `lib/ai/__tests__/library-handlers.test.ts` |
| Phase 1 — generic CapabilityGate | 14 | `lib/capabilities/__tests__/gate-genericity.test.ts` |
| Phase 1 — cloud gate adapter | 7 | `lib/capabilities/__tests__/cloud-gate-adapter.test.ts` |
| Phase 1 — scene handlers | 18 | `lib/ai/__tests__/scene-handlers.test.ts` |
| Phase 1 — GenerationService | 22 | `lib/ai/__tests__/generation-service.test.ts` |
| Phase 2 — RequestContext + auth decorators | 27 | `lib/core/__tests__/request-context.test.ts` |
| Phase 2 — updateChapter handler + repo ports | 26 | `lib/core/__tests__/update-chapter.test.ts` |
| Phase 2 — Core ownership | 10 | `lib/core/__tests__/ownership.test.ts` |
| Phase 2 — pg child-resource adapter | 5 | `lib/core/__tests__/pg-child-resources.test.ts` |
| Phase 2 — getStoryBible handler | 15 | `lib/core/__tests__/get-story-bible.test.ts` |
| Phase 2 — applyStoryTransaction handler | 22 | `lib/core/__tests__/apply-story-transaction.test.ts` |
| Phase 2 — generation gating single source | 5 | `api/ai/generate/__tests__/gating-single-source.test.ts` |
| Phase 2 — free-tier paywall behaviour | 8 | `api/ai/generate/__tests__/mode-boundary.test.ts` |
| Phase 2 — GenerationService pipeline ports | +5 | `lib/ai/__tests__/generation-service.test.ts` |
| Phase 2 — generation violations policy | 8 | `lib/core/policy/__tests__/generation-violations.test.ts` |
| Phase 2 — host context assembly | 10 | `lib/ai/__tests__/generation-context.test.ts` |
| Phase 2 — generateChapter Core handler | 12 | `lib/core/__tests__/generate-chapter.test.ts` |
| Phase 2 — violation-gate (zero-charge pre-reserve) | 4 | `api/ai/generate/__tests__/violation-gate.test.ts` |
| Phase 2 — charge-order port-metered invariant | +1 | `lib/metering/__tests__/charge-order.test.ts` |
| Phase 2 — loopback host (real-socket) | 26 | `lib/core/__tests__/local-host.test.ts` |
| Phase 2 — loopback token value comparison | +2 | `lib/core/__tests__/request-context.test.ts` |
| Phase 5A — contentRevision column + post-commit hook | 8 | `lib/core/__tests__/pg-content-revision.test.ts` |
| Phase 5A — deleteChapter post-commit hook (§11) | +2 | `lib/core/__tests__/update-chapter.test.ts` |
| Phase 5A — StoryTransaction/StoryChange tables + pg adapter (§13.1 slice 1) | 10 | `lib/core/__tests__/pg-story-transaction.test.ts` |
| Phase 5A — story-transactions route adapter (§13.1 slice 1) | 10 | `api/projects/[projectId]/story-transactions/__tests__/route.test.ts` |
| 2026-10-20 wave — Story Bible handlers, routes + hooks | +184 (net) | 5 handler files in `lib/core/__tests__/` (character-location-crud, thread-reference-crud, world-entity-violation-crud, relationship-map, projects-core); 11 new route test files under `api/projects/` (see the counts block for the list); additions to 5 existing route test files; typed-error updates to story-history/apply/pg tests; `local-host.test.ts` wave 2; `useEntitySync` rewrite |
| 2026-10-20 wave three — comic/production/story-OS handlers + routes, local-host mounting | +156 (net) | comic-crud handler+route tests (71/71, incl. 38 handler tests across `comics/[pageId]` PATCH/regenerate/letter); production-shot-crud (18 handler tests + route extensions); story-os-crud (26 + route tests across story-state/story-memories/story-graph/checkpoints/story-plans); local-host wave-3 additions (79/79 in that file); characters/locations route-test redo (+3 pins for the projectId regression) |

Two pre-existing tests were **retargeted, not deleted**, because the base-policy
correction removed the configuration they used as their subject (see
`docs/migration/context-policy-evaluation.md`). Both still assert the gate
mechanism; they now drive it through a direct policy override.
