# Phase 4 prep — provider portability (§12/§12.1 + §18's "Provider portability" row)

Master plan v4, §18 phase table: **"Phase 4 | Provider portability | Local
detection, OpenAI-compatible + Anthropic adapters, BYOK routing."** Phase 3
(SQLite + importer/exporter + round-trip contracts) closed 2026-11-01 (see
`phase3-prep.md` §6 and CLAUDE.md item 83), so this doc opens the next slice.

## 1. What §12 actually demands (captured verbatim from the plan)

- The strongest v3 product decision stands: **local-first means data
  ownership, not a mandatory local-model setup step**.
- Project creation/editing/Bible/planning/export require **no account and no
  model** — the loopback host already satisfies this (every §7 mount + the
  §10/§10.1 export/import pair work with zero provider config; §3-provisioned
  owner only).
- **On first AI action, auto-detect supported localhost providers; offer
  one-click use when compatible** — the local host has no shell yet, so the
  "offer" surface is exactly a detection capability + a composed bundle; the
  click-through UI is Phase 5B shell work.
- **If no local provider exists, cloud/BYOK is an equally direct option
  rather than a hidden fallback** — the composition-root decision, not a UI
  apology.
- Provider choice **visible and reversible per task/global setting** — needs
  a provider-list/read mount before anything else mounts.
- **No bundled local model is required for launch** (§17's product gate even
  states no mandatory Ollama installation gate).

## 12.1 Model routing (verbatim): ONE configurable OpenAI-compatible adapter
covers local servers and compatible cloud endpoints; Anthropic retains a
DEDICATED adapter where provider-specific prompt caching/features justify it.
Embeddings stay optional (the §4.2 noEmbedText posture already ships).

## 2. The consumption surface this must fill (already built)

`DefaultRouteDeps.generation?: LocalGenerationDeps` (the `/ai/generate`
mount + `generatePackage` mount, both 501 until composed). The bundle type:

```ts
LocalGenerationDeps = Pick<GenerateChapterPorts,
  "buildContext" | "chooseProvider" | "loadViolations" | "persist">
  & { generate: NonNullable<GenerateChapterPorts["generate"]>;
      meter?: LocalGenerationMeter /* stage (b), record-only */ }
```

Five arcs exist:

1. `generate` — the MODEL call. Phase 4's real work (the adapters).
2. `chooseProvider` — model/tier routing per §12.1. The `LocalGenerationProfile`
   already reads `provider` + per-slot `models` from `GW_LOCAL_*` env
   (strict, presence-only discipline) but is **consumed by nothing yet**.
3. `buildContext` — the context half. SQLite twin repos for every storage the
   context builders read already exist (parity waves 2-6 + fixture); binding
   the builders to them is the still-open §2.7 note ("travels with the next
   slice that actually binds those builders locally").
4. `loadViolations` — the sqlite `IntentionalViolationRepository` exists.
5. `persist` — the sqlite chapter/child writes exist (hooks bump
   contentRevision in the same file db).

## 3. The §5.6 posture these slices must keep

Real provider spend is a **named, separately-reviewed step, never a boot
default** — the spawn root keeps `generation`/`generatePackage` OFF (501)
unless an operator plants a bundle. Reconciled with §12:

- **Localhost providers may be auto-composed by detection** — localhost
  servers carry no credential and no external spend (the only cost is the
  writer's own click, which cannot happen until a UI exists), so the
  501-until-composed posture is NOT violated by detection-driven composing.
  What CANNOT be auto-composed: anything that reads a cloud key (Anthropic,
  OpenAI, Segmind, BYOK) — that stays the operator's explicit env plant.
- Detection is a pure, injectable capability (probe endpoints; a poll of
  `127.0.0.1:<port>...`), testable against a fixture server — never a
  network call that decides silently at import time.
- Every key/values read stays **presence-only** in any serializable profile
  object (the LocalGenerationProfile discipline, verbatim).
- `stream: true` stays 400 (§5.4's settled non-streaming-only local surface);
  Editor `runXCall` verbs stay trigger-gated (no action without a named local
  consumer).

## 4. Proposed slice order (each independently verifiable)

- **Slice 4a — detection + the OpenAI-compatible adapter (§12.1's "one
  configurable OpenAI-compatible adapter")**: a `LocalProviderPort`-shaped
  `generate` over OpenAI-compatible `{baseUrl, apiKey?, model}` (covers
  Ollama/LM Studio/llama.cpp LocalServer/vLLM and compatible云端 endpoints
  alike), plus the localhost detection function (well-known ports as a
  documented default list, overridable by env). Adapter testable against an
  in-process HTTP fixture — no real provider on any test path.
- **Slice 4b — the Anthropic dedicated adapter**: prompt-caching-aware
  messages (the cloud engine already owns the `@anthropic-ai/sdk` shape —
  `src/lib/ai/client.ts`); the local adapter reuses the same wire contracts
  but binds its own key via the §5.6 env discipline (presence-only profile
  read + the composition root building the client itself).
- **Slice 4c — BYOK/routing over the profile**: `chooseProvider` composed
  from `LocalGenerationProfile` (slots default/fast/quality + provider id),
  giving `POST /ai/generate` its real routing; `GET /providers` (or similar)
  as the §12 "visible" read made real BEFORE any generation mounts: lists
  DETECTED localhost targets + key-PRESENCE booleans without values.
- **Slice 4d — the context half locally**: bind the generation-context
  builders to the sqlite repos (the §2.7 open item) so a composed bundle
  carries a REAL `buildContext`, plus `persist`/`loadViolations` wiring; the
  full `generation` bundle then composes in the spawn root exactly like the
  portability bundle did (§10's live-pass pattern), with a wire pass.

Boots stay honest: the spawn root's default surface is unchanged until each
slice's operator-facing decision point; every slice's verification follows
the established targeted-suite → full-suite → `tsc` → graphify cycle.

## 5. Deliberate non-goals (already settled elsewhere)

- No bundled local model; no mandatory Ollama gate (§12).
- No local vector store: embeddings stay optional (§4.2 degrade), so the
  OpenAI-compatible adapter needs no embedding/LLM hybrid.
- No streaming over the loopback (§5.4); no local `runMeteredCall` split
  (§5.5 — a single-owner host is meter-less; the stage-(b) meter stays
  record-only observability).
- No local monkey-patching of the cloud's Anthropic prompt-caching path —
  the dedicated adapter exists precisely so §12.1's feature leverage stays
  where it is earned.

## 6. slice 4a — LANDED 2026-11-02: detection + the one OpenAI-compatible adapter

`lib/core/local-provider-adapter.ts` (NEW, import-pure — no `@/db`, no Next,
no Neon; pinned by its own mirrored purity block) ships both §12/§12.1
capabilities with ZERO change to the default surface (the
`generation`/`generatePackage` mounts stay 501 until a composition root
plants a bundle):

- **`makeOpenAICompatibleGenerate(endpoint)`** — returns exactly
  `NonNullable<GenerateChapterPorts["generate"]>` (the factory's return
  type had to inherit the port's optionality — fixed after the first tsc
  flagged every `gen(...)` call site): `LocalOpenAIEndpoint = { baseUrl
  (must include the version segment; a pathless origin gains `/v1` — the
  compatible-API default, never a guess), model, optional BYOK apiKey }`.
  Options: injectable `fetchImpl`, `timeoutMs` (default 300s — a local
  model can legitimately think for minutes), `maxTokens` (default 8000 —
  the cloud engine's own default headroom), `temperature` (omitted from
  the wire unless set — a server's own default is honest).
- **Prompt assembly mirrors `src/lib/ai/engine.ts` byte-for-byte where the
  local surface can express it**: `ARTIFACT_VS_PERSONA_RULE + "\n\n" +
  MI[mode](format)` + `getFormatRules(format)` + `getCraftDirectives
  (format)` — the same parts the Anthropic call splits into cached system
  blocks — translated into ONE OpenAI system message (no `cache_control`;
  that lever is slice 4b's dedicated adapter), then
  `\n---\n`-delimited context blocks, static before dynamic. Two
  documented differences, both inherited from the mount's §2.2 floor:
  `narrativeStructure` cannot arrive (no field on the local body), and the
  cloud else-branch's legacy `body.context` fallback cannot either — a
  locally-specified staticContext always rides.
- **Model resolution**: `genCtx.model` wins unless it is the pipeline's own
  `chooseProvider`-less placeholder `"default"`, which falls to
  `endpoint.model`; the outcome echoes the RESOLVED id (the honest local
  behavior — a requested "default" would otherwise leak into the response
  body and the stage-(b) meter).
- **Error translation keeps the mount's reason→status vocabulary verbatim**
  (rate_limit/529 → 429; context_length/"too long" → 400; auth failures →
  500 with the provider's words logged, never shown) — context-length
  tagging is MARKER-BASED on real provider bodies ("maximum context
  length", "context length", "too long"), not a blanket 400 rule (a plain
  bad request stays `provider_error 400`). The first run caught a REAL
  adapter bug: the error path originally skipped reading the body, so the
  provider's own words — the exact input the translation needs — were
  dropped as "(no body)"; the body is now read ALWAYS.
- **`detectLocalProviders()`** — §12's auto-detection as a pure, injectable
  capability: probes `GET /v1/models` on `LOCAL_PROVIDER_PROBES` (:11434
  Ollama, :1234 LM Studio, :8080 Local server — the documented default
  list, env overrides belong to the composition slice), short per-probe
  timeout (1.5s wave default), never throws, never network-touches at
  import; a probe counts ONLY on HTTP 200 + `{ data: [{ id: string }] }`,
  the shape Ollama's and LM Studio's compat layers really serve. Localhost
  carries no credential and no external spend, so a composition root MAY
  compose from detection — but never from a cloud key (§5.6).

**Verification** (`__tests__/local-provider-adapter.test.ts`, 15 tests over
in-process node:http fixtures — NO test path touches a real model server;
the local-host.test.ts real-socket convention): the wire shape (resolved
model/stream:false/max_tokens/messages, byte-parity system assembly with
the artifact rule leading and static-before-dynamic ordering
asserted), the pathless-origin `/v1` normalization, routing-vs-endpoint
model precedence with the RESOLVED echo, bearer-header-follows-key,
temperature-only-when-set, total_tokens precedence, the full reason→status
translation family (`it.each` over 429/400-with-marker/400-plain/401/500),
no-choices/not-JSON/ECONNREFUSED/timeout surfaces, detection over real
fixtures (happy listing; refused + 5xx + garbage + empty + stringless ids
all skipped honestly; the slow-endpoint timeout that cannot hang a boot;
the default probe list pinned), and the mirrored purity block. Targeted
**15/15 green** (after the one adapter-fix round above); `tsc --noEmit`
exit 0.

## 7. slice 4b — LANDED 2026-11-02: the dedicated Anthropic adapter

`lib/core/local-anthropic-adapter.ts` (NEW; the module's top level never
imports `@anthropic-ai/sdk` — the default client factory does a
`await import(...)` INSIDE its call path — test-pinned by the suite's
source-purity block, which additionally asserts the absence of any
top-level `from "@anthropic-ai/sdk"`) — §12.1's second half, the adapter
that exists PRECISELY for the provider-specific lever:

- **`makeAnthropicGenerate(endpoint)`** →
  `NonNullable<GenerateChapterPorts["generate"]>`; endpoint
  `{ model, apiKey (REQUIRED by type), baseUrl? }` — a composition root
  literally cannot construct this Anthropic path without the operator's
  env-key decision (§5.6), and `baseUrl` rides into the client as
  `baseURL` for a compatible gateway.
- **The cache seam IS the feature and is pinned by test**: assembly by the
  SHARED helpers (see below) into Anthropic blocks — both contexts
  present → `[{ head+"\n---\n"+static, cache_control: ephemeral },
  { dynamic }]` (the dynamic block deliberately UNCACHED, the
  session-changed content); only static → single cached block; only
  dynamic → single cached `head+"\n---\n"`; neither → single cached
  `head+"\n---\n"` (the cloud's empty-block path). The two documented
  §2.2-floor deviations carry over verbatim (no `narrativeStructure`
  source, no legacy `body.context` fallback — a locally-specified static
  always rides).
- Model resolution byte-identical to 4a (`genCtx.model` wins unless it is
  exactly the pipeline placeholder `"default"` → endpoint default); the
  outcome echoes the RESOLVED id. `messages` = `[{ role:'user', content:
  prompt }]`; `max_tokens` default 8000; temperature omitted unless set;
  response = text-blocks joined + `usage.input_tokens + output_tokens`.
- Error translation keeps the mount's vocabulary verbatim: 429 AND 529 →
  `rate_limit:` (the Anthropic overload class), marker-based
  `context_length:` for the "prompt is too long" family, auth failures
  `provider auth failed (401|403):`, everything else
  `provider_error ${status ?? "unknown"}:`. Factory-throw/no-client
  surfaces RAW (the pipeline's settle path shapes the reason).
- Options: `{ clientCreate?, timeoutMs? = 300_000, maxTokens?,
  temperature? }` — `clientCreate` may be sync OR async (the default
  factory awaits its SDK import; sync injected stubs work unchanged),
  receiving `{ apiKey, baseUrl?, timeoutMs }`.
- `lib/core/local-provider-adapter.ts` gained TWO additive exports so the
  adapters share ONE assembly implementation:
  `composeInstructionalHead(mode, format)` (the factored head —
  `ARTIFACT_VS_PERSONA_RULE + "\n\n" + MI[mode](format)` + format rules +
  craft directives) and `composeSystemMessage` (now `export`ed, its body
  calling the helper; behavior-identical — the 4a suite re-pinned 15/15).

**Verification** (`__tests__/local-anthropic-adapter.test.ts`, 18 tests,
injection only — no SDK constructor, no network, no module mocking): wire
shape (model resolution/echo, the two-block cache seam, single/neither
placements, messages/max_tokens/temperature behavior, text-block join +
usage sum, shared-head equality), the `it.each` error family (9 cases
incl. 429, 529, "prompt is too long"-400, marker-only, plain-400-stays-
`provider_error`, 401, 403, status-less), factory-facts (cfg
`{apiKey, timeoutMs}`, gateway `baseUrl`, no key inside wire params),
factory-throw + no-usable-client raw-surface, and the mirrored
source-purity block (the standard three regexes PLUS the no-top-level-SDK
pin). Targeted **18/18 green**; `tsc --noEmit` exit 0.

## 8. slice 4c — LANDED 2026-11-02: profile routing + the §12 visibility read

`lib/core/local-provider-routing.ts` (NEW; imports slice 4a's detection,
touches nothing else shared):

- **`makeProfileChooseProvider(profile)`** — the optional `chooseProvider`
  port for a generation bundle. Resolution: the mode's cloud-engine tier
  (`MODE_REGISTRY[mode]?.modelTier`, guarded to
  fast/default/quality) selects the profile slot; unset slots resolve to
  the pipeline's own `"default"` placeholder (the ADAPTER then resolves
  the endpoint's model). STRICT composition rule: an unset profile — or a
  provider id with every model slot null — composes NOTHING (`undefined`),
  so the bundle OMITS the port and the pipeline runs its own
  `{provider:"default", model:"default"}` path; a port that could only
  emit placeholders must not pretend to route.
- **`makeLocalProvidersReadPort(profile, { detect?, detectOpts?, env? })`**
  — the `GET /providers` read port: the routing profile's shoebox VERBATIM
  (the SETTING, never a resolution), key-PRESENCE booleans via the exact
  env vars the profile module itself reads (`GW_LOCAL_API_KEY` /
  `GW_LOCAL_OPENAI_API_KEY` / `GW_LOCAL_SEGMIND_API_KEY`), and slice 4a's
  detected localhost listing. Presence-only by construction — a value
  never enters the object at any depth (double-pinned: unit deep-equality
  AND a wire-level `sk-*`-shape scan).
- **Mount** in `local-host.ts`: the `providersRead?` dep slot +
  `GET /providers` answering 501-by-default exactly like every optional
  cluster, 401-before-routing with everything else. **Composition**:
  `spawn-local-host.mts` plants
  `providersRead: makeLocalProvidersReadPort(profile)` — the visibility
  read is LIVE on every default boot, while generation stays OFF until an
  operator's explicit provider decision (the §12 posture reconciled: the
  writer can SEE what this host can drive before anything bills).
- **Live wire pass** (real spawn, temp db, a FAKE env key planted for the
  check): 401 before routing; 200 with the honest unset-routing body;
  `anthropic=true` presence with NO `sk-*` shape anywhere in the response
  body; `detected: 0` on a server-less box — §12's "no local provider =
  cloud/BYOK equally direct", made observable. Driver pinned at
  `$env:TEMP\opencode\live-providers-wire.ps1`.
- **Verification** (`__tests__/local-providers-read.test.ts`): routing
  resolution over REAL registry modes (tier → slot wins, unknown tier →
  default slot, null slot → placeholder, the strict compose-nothing rule),
  the presence-only pins, the transport family (501 by default / 401 /
  200 body shape / the default-composed read against zero live servers
  answering `detected: []` capped fast), and the mirrored purity block.
  Targeted **22/22 green**; in the merged-tree union batch **150/150 across
  the 5 provider/context suites** (4a 15 + 4b 18 + 4c 22 + local-host +
  snapshot); `tsc --noEmit` exit 0 on the merged tree; full suite 2,225
  collected / 2,225 passing across 228 files (the contended run's three
  timeout failures re-verified 100/100 — see test-baseline's slice record).
  Graphify refresh exit 0 — **5,693 nodes / 14,694 edges / 322 communities**
  (from 4a's 5,655/14,587/324).

## 9. slice 4d — the local context half (DESIGN SKETCH, not yet landed)

The cloud route's `buildContext` is a THIN server-side assembly — the
World Bible content itself rides in from the client (the editor collects
it). What the server adds, in order: the size ceiling →
`capContextForTier` (local: no tier — the floor already skips this) →
`applyModePromptDirective` (the local floor ALREADY applies it) → the
server-derived notes: the AIisms instruction (tier/db-gated, omitted per
the §2.2 floor), the series/universe context (the §2.7 open item),
`buildSeriesBibleContext` (user-level, series Bibles are OUTSIDE a per-
project snapshot by §10's own design), domain research (GEMINI-keyed,
optional), then `composeDynamicContext([...])`, then the prose
augmentation pre-passes (promise-ledger DB-only, voice-exemplars
embedding-based, scene-blueprint Haiku — tier/db-gated).

The 4d slice therefore binds the pieces a SINGLE-OWNER local host can
honor, EXACTLY where the settled conventions already drew the seams:

1. **The §2.7 series/universe builders get their local composition**: the
   composition root supplies `localOwnerId` (a REAL users-row id), and
   `buildSeriesUniverseContext` / `buildSeriesBibleContext` bind over the
   sqlite twins — the same zero-arg-$type discipline the exports use,
   with the empty-setteachers behaving identically to their cloud
   behavior (that is why empty must never become "").
2. **The promise-ledger pre-pass binds over the sqlite repos** (DB-only,
   no LLM — the cheap suppress-hallucination grounding), fail-open exactly
   as the cloud runs it.
3. **Voice-exemplars and scene-blueprint stay OUT** (4.2 degrade for the
   embedding call; the Haiku pre-pass is tier-gated cash) — the local
   buildContext records the omission in its header so the §12 feature
   map stays honest.
4. **AIisms/research and the tier cap stay out** (the settled §2.2 floor;
   the mount's LOCAL_GENERATE_CONTEXT_CEILING is the local budget).
5. The composed bundle then carries a REAL `buildContext` +
   `chooseProvider` (4c) + `generate` (4a/4b) + `persist`/`loadViolations`
   (sqlite) — the first live, spended, end-to-end generation wire pass
   over a localhost OpenAI-compatible fixture server, with the meter
   recording per stage (b): the mount's own no-latency/no-refusal pins
   already exist; the wire pass proves the whole chain.

Every piece rides the established verification cycle: targeted fixtures →
`tsc` → full suite → graphify; the boot default stays OFF (an operator
plants the bundle; detection may compose LOCALHOST only, per §5.6).

## 10. slice 4d — LANDED 2026-11-02: the local context half + the composed
bundle + the first end-to-end generation wire pass

The arc's last slice, in three parts (two parallel subagent dispatches +
an orchestrated wire pass), with the §9 sketch's every item resolved:

**1. The context binder** — `lib/core/local-generation-context.ts`
(replacing the frozen-signature stub; the composition half was coded
against that stub in parallel). The cloud `buildSeriesUniverseContext` /
`buildSeriesBibleContext` / `buildPromiseLedger` translated to the SQLite
twins, every read scoped to the ONE `localOwnerId` users row (§5.6/§2.7 —
this is the `localOwnerId` convention's first real consumer):

- **Series**: the `seriesParentId` walk (depth-10 guard, per-book 5-latest
  memories `desc(createdAt)` — the keyEvents-else-fact rendering
  byte-exact); a foreign-owned parent breaks the walk silently.
- **Universe**: premise/tone/sharedRules (the universes read is
  DELIBERATELY owner-tightened — the cloud reads by id alone; the local
  one is the §5.6 discipline), canon events (`isCanon` +
  `timelineSort <= proj.timelineSort - 1`, asc, limit 15), characters
  with prior-book states (the local `project_character_states` twin of
  the cloud `states` relation; newest-state-wins, DECEASED line
  byte-exact; states from non-prior books never leak).
- **Series bible**: the owner's `seriesBibles` row whose `projectIds`
  contains the project; the full lines block byte-exact.
- The sqlite schema's deliberate NO-relations posture (header lines
  26–29) is honored: flat selects + in-memory joins, zero `with:`.
- **Ledger**: the promise-ledger.ts translation (chapterIndex-ordered
  memories, fuzzy create/resolve matching, dedupe + `slice(-8)`, the
  generate-mode header, try/catch → "" fail-open) behind the cloud's own
  `shouldRunProseAugmentation(mode, projectId, tier)` gate.
- **Assembly** reuses the cloud's pure exports (`appendSeriesContext` /
  `composeDynamicContext` / `shouldRunProseAugmentation`) and returns the
  CLOUD shape `{static: effectiveStatic, dynamic: finalDynamic}` —
  static = client static + "\n\n---\n" + series/bible (never truncated),
  dynamic = client dynamic + `additionalContext` + ledger.
- **`loadViolations`** mirrors the cloud route's binding (the PROJECTS
  row's `intentionalViolations`, id+owner-scoped; the actor arg is
  redundant under §5.6) and **`persist`** inserts the `generations` row
  (raw `req.prompt` = recordPrompt parity — no cap exists locally; model/
  tokens ride DDL defaults when the adapter omitted them).
- The MOUNT keeps its own assembly: the ceiling, the mode prompt
  directive and `effectivePrompt` are `local-host.ts`'s (the builder
  returns only static/dynamic — the pipeline port stops there).

**2. The mount's two additive edits** — `GenerateChapterInput` gained
`additionalContext?` (the body-level field previously only the floor saw;
the cloud route unchanged) and the mount carries it into the input;
the planted-builder branch now applies `applyModePromptDirective` to
`effectivePrompt` itself (the mount owns it, the bundle cannot mutate
it) — the cloud's cap→suffix order minus the cap. The floor branch is
untouched.

**3. The composition decision** — `lib/core/local-generation-composition.ts`:
`makeLocalGenerationDeps({db, localOwnerId, profile, tier, env?, detect?,
makeOpenAIAdapter?, makeAnthropicAdapter?, buildContextBuilder?})` returns
the full `LocalGenerationDeps` bundle or `null`. `GW_LOCAL_GENERATION`
decides: unset → OFF (501, no log noise); `auto` → localhost detection
(`timeoutMs: 750`, the FIRST detected target composes the 4a adapter) with
**no key of any kind attached — the secret-egress pin** (a profile
carrying `hasOpenAIKey` and an env carrying the key VALUE must never
reach a detected localhost endpoint); `generic` → `GW_LOCAL_ENDPOINT_URL`
required (+ optional `GW_LOCAL_API_KEY` value); `anthropic` → the 4b
adapter, key + model (env or profile default slot) BOTH required;
unrecognized values refuse LOUDLY. The bundle: adapter generate + binder
ports + `makeProfileChooseProvider(profile)` spread only when it composes
(the 4c strict rule). The meter stays out (no local sink exists — header
documents it).

**4. The spawn-root plant** — `spawn-local-host.mts` builds
`generationDeps` before `defaultLocalRoutes` and spreads
`...(generationDeps ? { generation: generationDeps } : {})`; the boot
default (unset) is byte-identical to the pre-4d surface (501).

**5. The live wire pass** (`$TEMP\opencode\wire-4d.mts`; a real spawn, a
real in-process OpenAI-compatible fixture on :11434 — a detection probe
slot — and a raw `node:sqlite` seed of the booted schema): boot A (unset)
→ `POST /ai/generate` 501 with the no-bundle reason; boot B
(`GW_LOCAL_GENERATION=auto` + the `sk-*` sentinel planted in
`GW_LOCAL_OPENAI_API_KEY`) → `/providers` 200 detecting the fixture
(model listing intact) with NO sentinel anywhere in the body; an
unauthenticated generate → 401 BEFORE any spend; the prose `write` call →
200 `{text, model: wire-fixture-model, tokensUsed: 54}` with the captured
system message leading with the artifact rule, carrying the client
static, the `\n\n---\n` series append, the SERIES CONTEXT header with the
parent book's keyEvents AND a fact-only memory, the SERIES BIBLE block,
and the dynamic trio (client dynamic + additionalContext + the ledger
with the fuzzily-resolved promise dropped); the `brainstorm` call → the
FULL directive suffix on the prompt while the ledger is GATED OFF
(planning mode) and the series still rides; the sentinel NEVER reached
the fixture (auto attaches no key); and BOTH calls persisted their
`generations` rows (raw prompts, fixture model/tokens).

**Verification** — targeted: the binder suite **19/19** (byte-pinned
static/dynamic assemblies, the cap/depth/owner-leak/adversarial
guardrails incl. the foreign-universe tightening, the ledger fuzz/
dedupe/slice/gate/fail-open family, the extractions and defaults,
purity); the composition suite **15** (the mode decision family, the
secret-egress deep-serialize pin, the identity wiring, the loud-refusal
branches, the default-detect fast-refusal path, purity); the mount fixes
**33/33** (`local-generate`); the union batches **190/190 across 7
files** and **34/34 across 2**; one merged-tree tsc round caught the
only merge defect (a zero-arg mock arity in a new mount test — fixed);
union `tsc --noEmit` exit 0; **full suite 2,261/2,261 across 230 files
(~542s)**; graphify refresh exit 0 — **5,742 nodes / 14,870 edges / 313
communities** (from 4b+4c's 5,693/14,694/322).


