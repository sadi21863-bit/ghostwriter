# Output Test 2 — Phase 1 plan (text generation only)

Follow-up to Output Test 1 (`docs/2026-06-24-segmind-higgsfield-pipeline-test.md` + `docs/2026-07-05-novel-screenplay-format-test.md`, artifacts now under `outputtestresults/output-test-1/`). This round reuses the same two stories, runs every generation mode, exercises Director/Writer/Editor roles through the **real** `/api/ai/generate` pipeline (not the 07-05 test's synthetic weak-context harness), and produces a fight-scene script via Combat mode that phases 2/3 will turn into video. All calls in this phase are Anthropic-only (no Segmind/Higgsfield spend). Budget: **$14 Claude console credit**. Artifacts saved under `outputtestresults/output-test-2/`.

**Revised 2026-07-07** to fold in the cross-role capability expansion shipped just before this run (CLAUDE.md item 56, 6 commits `a0d2e6b`→`bdca7bd`, 968/968 tests passing): mode-technique-context sharing (Editor/Director tools can now ground in Combat's biomechanics library), mode-aware craft exemplars, multi-layer Composition detection, opt-in web research for historical/scitech, and combat-style auto-inference from World Bible character skills. These aren't a separate phase — they're new code paths inside Tracks B/C below, so this test run is also the first real validation of each one against real stories, not just unit-mocked behavior.

## Setup step (before Track C)

Add one real skill entry to one of "The Dealer"'s two characters in World Bible — e.g. a `Krav Maga` or `Muay Thai` skill on the antagonist — before running Track C. This is what lets the new `suggestCombatStyleForCharacter()` auto-inference (item 56, piece 5) actually fire against real project data instead of only the unit-test mocks it's been verified against so far. Zero cost (a World Bible edit, no AI call).

## Stories reused
- **Story 1 — "The Dealer"** (Midwest Armaments): Gothic-Americana action/noir, 2 characters, 2 locations.
- **Story 2 — "The Horizon Line"** (Project Horizon): psychological horror/sci-fi, 3 characters, 4 locations.

Both already exist as real projects with World Bible data from Output Test 1 — reused as-is, not recreated.

## Track A — Full mode sweep (all 26 modes, both stories)

One continuation call per mode per story, through the real `WritingRoom` generate path (full `context-builder.ts` static+dynamic context — characters, locations, story memory, plot threads, realism directives where the mode calls for them). Confirms every mode still produces well-formed, format-appropriate output; closes the gap the 06-24 test explicitly left open ("full sweep of all 23 [now 26] modes not performed").

- 26 modes × 2 stories = 52 calls.
- 4 default-tier modes (brainstorm/outline/write/dialogue) are cheap; 22 quality-tier modes (Opus) cost more per call but are bounded by their max-token settings.
- **Est. cost: ~$1.50.**

## Track B — Format + role rewrite, through the real pipeline

Reruns the 07-05 test's structure (outline → 3 chapters → Director tools → Editor refine) but through the real generate route this time, specifically to re-test the **character-identity-drift bug** the 07-05 test flagged as "fragile without full context, not a confirmed product bug" — this is the test that actually confirms whether `context-builder.ts`'s character-list injection prevents it in real usage.

- **Novel** — both stories: outline → 3 chapters → `villain-pov` + `tension-curve` (Director) → `refine` (Editor).
- **Screenplay** — both stories: same structure (07-05 showed zero drift here; confirm it holds on a fresh continuation run).
- **One short-form spot check per story** — single continuation call in TikTok Script or YouTube Short (whichever reads more naturally against each story's tone) through the real pipeline, since the 06-24 test's 9-format sweep used an isolated one-shot prompt, not a project with accumulated context.
- **New: villain-pov's combat-style auto-inference** — run "The Dealer"'s `villain-pov` call WITHOUT explicit `combatStyleA`/`combatStyleB`, relying entirely on the Setup step's World Bible skill entry to auto-ground the scene. Confirms the inference path fires correctly against a real character record, not just the mocked one in `character-combat-style.test.ts`.

- **Est. cost: ~$6–8** (bulk of the budget — outline/chapters are Sonnet-tier and cheap, Director/Editor calls are Opus-tier but token-capped; the new villain-pov combat-inference call is one more Opus-tier call within this same budget line, not additive).

## Track C — Combat mode fight-scene script (feeds Phase 2/3 video)

One fight scene, real matchup, generated via `/fight` (combat mode) with the real combat-library context (`buildCombatContext` — stances, strikes with setup/execution/recovery/counter, defenses, signature tells) injected for both fighters. Matchup: two of "The Dealer"'s existing characters (noir/action setting fits grounded modern styles better than the weapon/period styles) — final style pairing (e.g. boxing-street vs. krav-maga) picked at execution time to match what's already established about the two characters, not invented fresh.

This script is also the source material Phase 2/3 turns into a production package → shot images → video, so it needs to be a single coherent scene (not a montage) sized reasonably for a short video clip.

**New: Editor refine pass with technique-context grounding.** Run the generated fight scene through `/api/ai/refine` passing `mode: "combat"` + the same two style names, instead of a bare refine call. This is the first real test of item 56 piece 1 — previously `refine` had zero access to Combat's biomechanics library, so a polish pass could silently soften or genericize the fight choreography it was given no reason to preserve. Compare against a bare refine (no mode/styles) on the same passage to confirm the grounded version holds the technique detail better — this comparison IS the validation, not just "does it run."

**New: multi-layer Composition cross-check (zero cost).** Before generating, run the planned fight-scene beat text through `suggestComposition()` directly (a pure local function, no API call) to confirm it correctly detects Combat + Emotional (if the scene has a charged emotional undercurrent, which "The Dealer"'s noir tone likely gives it) — a sanity check on item 56 piece 3 against a real beat, not just the unit tests' synthetic examples. If it fires, worth a discretionary follow-up: generate the SAME scene once via Combat mode alone and once via Composition (Combat + the detected emotion) for a direct quality comparison — optional, not required for Track C to be considered complete.

- **Est. cost: ~$0.30–0.60** (bumped slightly from the original $0.20–0.50 to cover the new refine-with-technique-context comparison call; the Composition cross-check itself is free).

## Track D — Series Bible / Universe re-test

The 06-24 test confirmed the injection mechanism is wired (`buildSeriesBibleContext`) but a real generation didn't literally cite the planted lore detail ("the Glasswing Frequency"), and this was never chased further. This round asks a more direct question against the existing Series Bible/Universe (e.g. "what do characters in this scene know about the Glasswing Frequency / the Quiet Editor") to close that open item conclusively rather than leaving it inconclusive.

- **Est. cost: ~$0.10.**

## Track E — Web-research grounding (new, item 56 piece 4)

One `scitech`-mode continuation call on "The Horizon Line" (psychological horror/sci-fi — the natural fit, since neither story has a historical angle) with `groundInResearch: true`. This is the first real test of `groundInWebResearch()` against a live story: confirms the opt-in flag actually triggers a real `web_search` call, the result gets labeled "REAL-WORLD GROUNDING" and threaded into `dynamicContext`, and — run the same prompt a second time immediately after — that the second call hits the semantic cache (skips the model entirely) rather than re-searching. The cache-hit check is the more important of the two: it's the piece with no unit-test equivalent for "does a near-duplicate query actually match at the 0.92 threshold against a real embedding," since the unit tests mock `checkSemanticCache` directly.

- **Est. cost: ~$0.15–0.25** (one real web-search-tool call + one Sonnet-tier continuation; the second, cache-hit call costs nothing since it never reaches the model).

## Total estimate: ~$8.75–11.15 of the $14 budget

Leaves a ~$3–5 buffer for retries (a bad JSON parse, a refusal, a call worth rerunning) without needing top-up mid-test. (Revised up slightly from the original $8–10 to cover Track C's new refine-with-technique-context comparison and the new Track E — still comfortably inside budget.)

## Output layout

```
outputtestresults/output-test-2/
  mode-sweep/            # Track A — 52 raw outputs, one file per mode×story
  novel/                 # Track B — both stories, outline+3ch+director+editor
  screenplay/            # Track B
  short-form/            # Track B spot checks
  combat-fight-scene/    # Track C — the script that feeds Phase 2/3 + the grounded-vs-bare refine comparison
  series-universe/       # Track D
  web-research/          # Track E — the grounded call + the cache-hit rerun
  SUMMARY.md             # final findings doc, same shape as the 06-24/07-05 reports
```

## Explicitly out of scope for Phase 1

- No Segmind/Higgsfield calls — that's Phase 2 (Segmind) and Phase 3 (Higgsfield), against a separate budget.
- No full mode×format cross-product — Track A tests modes once each (format-agnostic), Track B tests formats/roles on a fixed mode sequence. Combining both fully would be 26×9 = 234 combos for no real added signal.
- No new stories or premises — reusing Story 1/2 keeps this a comparison against Output Test 1's baseline, not a fresh cold-start.
- No pre-selected Composition generation from the `suggestComposition()` detection in Track C — that's flagged as an optional discretionary follow-up, not a required Track C deliverable, since pre-seeding the exact detected layers into the Composition panel's own state is a documented follow-up to item 56 piece 3, not yet wired.
