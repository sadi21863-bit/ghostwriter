# GrowthBook flag decisions (Phase 0 / v4 item 8)

v4 item 8: *"Three flags are live enough to matter and cannot remain indefinite
limbo during the refactor."* Each gets **promote + test**, **quarantine**, or
**delete**. Plus: *"Remove the other seven unread GrowthBook keys already
identified by the audit"*, and *"After migration work starts, no new product
architecture is hidden behind GrowthBook. Use explicit capability/module
availability instead."*

## Audit (measured, not assumed)

Counted `FLAGS.<name>` references across `src/`, excluding the definition file
and `__tests__`:

| Flag | Production readers |
|---|---|
| `craft_library` | 0 |
| `constellation_view` | 0 |
| `draft_branching` | 0 |
| `reader_mode` | 0 |
| `command_palette` | 0 |
| `adaptive_onboarding` | 0 |
| `new_design_tokens` | 0 |
| `home_redesign` | 1 — `src/app/dashboard/page.tsx` |
| `scene_blueprint` | 1 — `src/app/api/ai/generate/route.ts` |
| `streaming` | 1 — `src/components/WritingRoom.tsx` |

This matched the v4 audit exactly: 7 unread keys, 3 live.

## Decisions

### Deleted — the seven unread keys

`craft_library`, `constellation_view`, `draft_branching`, `reader_mode`,
`command_palette`, `adaptive_onboarding`, `new_design_tokens`.

Zero production readers and zero test readers. A flag nothing reads is a dormant
branch every future reader must reason about, and every one of these was a place
where "is this on?" looked like a live question. Removed from `FLAGS`.

### Deleted — `home_redesign`

v4: *"Do not enable an obsolete pre-Story-OS shell."*

Its only read site was `if (homeRedesign) return <Home />;` in
`src/app/dashboard/page.tsx`. The flag is **OFF in production**, so the branch
never ran and `<Home />` was already unreachable in practice.

Removed the flag, the branch, and the now-unused `Home`,
`useFeatureIsOn` and `FLAGS` imports from `page.tsx`.

`src/components/Home.tsx` is **retained but now unreachable** — it was imported
from exactly one place and that place is gone. v4 asks for valuable components
to be reused during the new shell phase and the file deleted only "once
reachability proves nothing depends on it". That reuse decision belongs to the
shell phase, not here, so the file stays on disk with no live reference.

> Follow-up for the shell phase: either mine `Home.tsx` for reusable pieces or
> delete it. It is dead weight until then.

### Quarantined — `scene_blueprint`

v4: *"Keep the capability only if its Haiku/provider call is covered by contract
tests and budget/gate metadata. It does not ship as a silent disabled production
path."*

Condition check:

- Contract test — **present**: `src/lib/ai/__tests__/scene-blueprint.test.ts`
  (3 cases: success shape, fails open on throw, fails open on too-short output).
- Budget/gate metadata — **was absent**, added as
  `src/lib/ai/experimental-capabilities.ts`:
  `SCENE_BLUEPRINT_CAPABILITY` records provider `anthropic`, model
  `claude-haiku-4-5-20251001`, `maxTokens: 350`, `estimatedUsdPerCall: 0.006`
  with its derivation, the contract-test path, the gate, and
  `status: "experimental"`.

It is a single internal Haiku pre-pass, so it is deliberately **not** added to
`CAPABILITY_UNIT_USD` in `src/lib/capabilities/cost.ts` — that table is for paid
external capabilities billed per item, and putting an internal call there would
imply user-metered spend it does not incur.

A test asserts the metadata still matches the implementation (model and
`max_tokens` are read out of `scene-blueprint.ts` and compared), so the record
cannot drift.

### Promote and test, then remove — `streaming`

v4: *"Streaming becomes the primary interactive generation path after shared
engine/system-block code is extracted. Non-stream remains a provider fallback,
not a parallel untested product branch."*

The flag stays in Phase 0. The plan's own phase table puts the removal in
**Phase 1**: *"Streaming path is production-tested and no longer a dormant
GrowthBook fork."* Phase 0's scope for item 8 is the **decision**, and removing a
flag whose replacement is not yet the default would be promoting a path that is
still untested in production.

Existing coverage (3 files): `ai/generate/__tests__/streaming.test.ts`,
`hooks/__tests__/ai-shared-stream.test.ts`,
`lib/ai/__tests__/generate-stream.test.ts`.

Phase 1 must additionally verify stream and non-stream **share** prompt
construction, provider routing, output parsing, metering/usage, and Story
Transaction proposal logic — a shared code path, not two branches that happen to
agree.

## Enforcement

`src/lib/__tests__/growthbook-flag-decisions.test.ts` makes these decisions
executable rather than documentary:

- `FLAGS` contains exactly `sceneBlueprint` and `streaming`.
- Every flag has at least one production reader.
- The eight deleted keys are gone.
- The experimental capability is complete, non-zero costed, marked
  `experimental`, and its token budget still matches the real provider call.

Verified by negative control: re-adding a flag with no reader fails the suite.