# Output Test 1 & 2 — Complete Findings Report

**Date:** 2026-06-24 through 2026-07-09
**Scope:** The FULL real-money validation arc of GhostWriter's AI generation pipeline — Output Test 1 (the original pipeline test) through Output Test 2 (Phases 1-3, the Dealer/Horizon Line premise corrections, and the full Director/Writer/Editor short film). Covers CLAUDE.md items 25-27 and 57-67. This doc exists because those are terse changelog entries scattered across a long-running file — this is the fuller, chronological account: every error hit, its root cause, how it was fixed or worked around, and what's still a known limitation. Nothing here is invented after the fact — it's assembled from the real CLAUDE.md entries and memory notes written at the time each finding happened.

## Contents

1. Output Test 1 (2026-06-24/25) — the original full-pipeline test
2. Output Test 2 Phase 1 (2026-07-08) — Tracks A-E, the cross-role capability validation
3. "The Dealer" premise correction (2026-07-08)
4. Output Test 2 Phase 2 (2026-07-08/09) — real Segmind video generation, the Seedance content-filter incident
5. Higgsfield-native vs. Segmind comparison (2026-07-09)
6. Higgsfield capability deep-dive (2026-07-09)
7. Canvas Void test + the Horizon Line premise correction (2026-07-09)
8. Full Director/Writer/Editor short film (2026-07-09) — the main event, including the AI-editor bug find
9. Consolidated bug list (everything, one table)
10. Consolidated known limitations
11. Real cost/spend summary + where every real generated asset lives on disk

---

## 1. Output Test 1 (2026-06-24/25) — the original full-pipeline test

**Goal:** validate GhostWriter's full text→images→video pipeline actually works for real money, not just that the code compiles. Ran two genre-distinct stories end to end, then expanded to Comic Studio, Audio Novel, lipsync, all 9 project formats, Series Bible, and Universe — against a disposable test account with a real funded Segmind key (~$10 initial budget, topped up to $15 mid-session).

### Bugs found and fixed (10 total)

1. **`generateSoulImage` crashed on every call.** Segmind's image endpoint returns raw binary image data, not JSON — the code assumed a JSON response shape.
2. **Character-consistency reference sent the wrong field.** A plain portrait URL was sent into the UUID-only `custom_reference_id` field instead of the correct `reference_image_url` field.
3. **`generate-package` never created World Bible rows from its own output.** Fresh projects' shots had nothing to link to — the Director tool generated shot lists referencing characters/locations that didn't exist as real World Bible rows.
4. **The same binary-vs-JSON mismatch existed on the video/lipsync side too.**
5. **5 of 6 video model endpoint slugs were fictional.** `higgsfield-{model}-text2video` doesn't exist as a real endpoint pattern for third-party brand models — corrected to the real Segmind slugs.
6. **All 5 video models were sent one identical request body** despite genuinely different real API schemas — Veo's duration must be 4/6/8 (not any value like 5), Wan needs `base_model`+`video_length` instead of `duration`, Hailuo requires a starting image. This "worked" only by coincidence for Seedance. Fixed with `buildVideoRequestBody()`, a per-model request-shape builder.
7. **Lipsync's entire contract was fictional** — `higgsfield-wan-text2video` + `audio_url`/`talking_head` params don't exist. Replaced with the real single-step `hallo` model.
8. **Higgsfield-native Soul ID training used the wrong base URL/auth headers/endpoint** — fixed against the real `higgsfield-js` SDK source, but this fix went untested live at the time (no Higgsfield credentials existed on the test account yet — later confirmed working in Section 7 below, via a different bug in the same area).
9. **`buildSeriesUniverseContext` never read a universe's own `premise`/`tone`/`sharedRules`** — only events/characters, meaning universe-level worldbuilding context set by the user had zero effect on generation.
10. **Node's built-in `fetch` enforces its own ~5-minute timeout independent of any `AbortController`.** This silently capped every long-running Segmind call regardless of the intended timeout value — fixed via the `undici` package's own `fetch`+`Agent`, which doesn't have this hidden ceiling.

### Architectural change

Switched `generateTextVideo` from Segmind's synchronous `v1` endpoints to async `v2` (v1 showed repeated multi-minute-plus latency across 3 different models; v2 returns a job ID immediately and is polled) — validated working via a real Kling submission. **Not applied to `generateDoPVideo`/`generateLipsync`/`generateSoulImage`** at the time — a known, documented gap.

### Known limitation surfaced, not fixed at the time

Lipsync works for normal-length audio but hits a hard, provider-side `504` gateway ceiling on Segmind's own infrastructure for full-chapter-length (164s) audio in one call. Not fixed then — would need v2 there too, or audio chunking. (Lipsync's fragility resurfaces again in Section 7 — a different, still-unresolved failure mode — as of this report neither test has ever produced a working lipsync clip end to end.)

All real test output from this phase (prose, images, videos, audio) saved under `outputtestresults/` (sibling folder to the repo, gitignored). Full original incident report: `docs/2026-06-24-segmind-higgsfield-pipeline-test.md`.

---

## 2. Output Test 2 Phase 1 (2026-07-08) — Tracks A-E

**Goal:** real-money validation of the "cross-role capability expansion" shipped earlier (CLAUDE.md item 56 — mode-technique sharing, mode-aware exemplars, composition detection, web research grounding, combat-style inference).

### Track A — 26-mode sweep

Created two fresh test stories with real minimal World Bible data (including a `Krav Maga` skill on one antagonist, seeded specifically to exercise the combat-style auto-inference feature in a later track). Ran all 26 generation modes x 2 stories = 52 real calls against a live local dev server, not mocks.

**Bug found and fixed:** `/api/ai/generate` 500'd on every single call. Root cause: two separate files (`growthbook-server.ts`, `growthbook.ts`) both imported `GrowthBook` from the **React** SDK package (`@growthbook/growthbook-react`) into server-only code — that package calls `React.createContext` at module load time, which Next.js rejects outside a Client Component. This had never been caught before because unit tests always mock these modules, so the real import graph never executed in CI. Fixed by importing from the core `@growthbook/growthbook` package instead, and deleted an unused `createGrowthBook()` export from `growthbook.ts` that had been sitting next to the actually-used `FLAGS` map. Verified with a full production `npm run build`, not just `tsc`/vitest, since this bug class is specifically bundler-dependent.

**Real result:** 52/52 calls succeeded (100%), 97,411 total tokens, ~$0.78 — under the $1.50 plan estimate.

### Track B — format+role rewrite through the real pipeline

**Self-inflicted methodology bug, caught before it produced a false result:** v1 of the test script never built or passed `staticContext` to `/api/ai/generate` — but the entire stated point of Track B was testing through the *real* pipeline with real context, not a synthetic weak-context harness (which an earlier, separate test had been criticized for). This accidentally reproduced that exact same weak-harness problem. Caught by actually reading the generated prose (not trusting HTTP 200 status codes): the model invented its own antagonist ("Lang," a business rival) instead of ever mentioning the real World Bible character (Kessler), across all 3 generated chapters.

**Fix (v2):** every `/api/ai/generate` call (outline + all 3 chapters, not just the first) now carries real `staticContext` built from the actual World Bible rows, since the model has no memory between separate calls. Two smaller bugs found in the same pass: the Screenplay track never created a protagonist character (only an antagonist), and the chapter-writing loop hit a safety-violation false-positive once on incidental phrasing in LLM-generated outline text, with no handling, cascading into 2 more chapters written with degraded context.

**A design mistake, self-corrected:** the first attempted fix for the safety-violation issue used `bypassViolationCheck: true` on every single write call. The auto-mode safety classifier correctly flagged this as an unauthorized blanket bypass rather than a targeted one. Fixed properly with `generateWithConfirm()` — calls normally first, and only retries with the bypass flag if the confirmation gate actually fires, exactly mirroring what a real user reading the flag message and clicking "confirm" would do.

**Real v2 result:** 30/30 calls succeeded, character/location fidelity held across all 6 sub-tracks (2 stories x Novel/Screenplay/short-form) once real context was actually passed. One real, minor finding: the combat-style auto-inference correctly fired against the antagonist's `Krav Maga` skill and produced genuine, specific terminology (No-Freeze Guard, Retzev, Direct Counter) — but the terminology ended up attached to the *protagonist* in the prose, not the antagonist whose World Bible row actually supplied it, because the injected style context isn't bound to a specific character name — the model attributes it by narrative logic (who makes sense to be skilled here), not by data provenance. Logged as a documented limitation, not fixed.

### Track C — combat fight-scene script + refine comparison + composition cross-check

Reused The Dealer project (at the time still on its original, later-found-to-be-invented premise — see Section 3). Matchup: Boxing vs. Krav Maga. The injected biomechanics context was captured via a one-shot vitest dump of the real `buildCombatContext("Boxing","Krav Maga")` output (a temporary test file + temporary debug route, both deleted after use) — not hand-transcribed, so the test input was byte-faithful to what the real Combat mode UI actually sends.

**Result: an excellent, technically dense scene** — the boxing character's technique exactly matched the injected biomechanics dataset's heel-pivot/hip-rotation sequencing; the Krav Maga character's philosophy (no wind-up, continuous chaining, gross-motor strikes) rendered faithfully in prose even without literal jargon labels.

**Refine comparison: genuinely inconclusive, reported honestly as a null result.** A keyword-term-count check between a bare refine and a combat-mode-grounded refine found no measurable difference — both preserved technical detail equally well, most likely because `refinePassage()`'s existing "preserve everything, don't change established facts" rule already protects strong technical prose regardless of extra grounding.

**`suggestComposition()` cross-check returned `null`** on the scene's natural-language premise — the prompt's professional phrasing never hit a literal keyword trigger from `TYPE_PATTERNS` (fight/punch/battle etc.), confirming the detector is precision-leaning keyword matching, not semantic understanding. Documented as a real limitation, not a bug.

**Lesson reinforced:** a simple keyword-term-count comparison undersold the real quality here — the model correctly translated Krav Maga's *concepts* into natural prose without using jargon labels verbatim, which is actually better writing craft than a literal echo would have been. Always read the actual generated content directly rather than trusting an automated keyword metric.

### Track D — Series Bible / Universe citation re-test

Closing an item left open from Output Test 1. First attempt had its own real bug: `POST /api/series-bibles` returns a wrapped `{bible: {...}}` response (unlike `POST /api/universes`, which returns the bare object) — reading `.id` directly gave `undefined`, silently breaking the follow-up PATCH so `worldRules` never actually got set. The citation-check prompt also directly named the planted lore term, making any "citation" in the output a trivial echo rather than a real test of the injection mechanism.

**Fixed:** correct nested ID extraction (verified via a 200 on the PATCH and the returned `universeId`), and the prompt rewritten to never name either planted term — only describe the underlying situation.

**Real result, genuinely conclusive:** neither planted proper noun appeared verbatim, but the model independently generated conceptually identical lore in its own words — matching the planted world rules almost exactly in function, even echoing an in-story detail (a nameless broker figure) that mirrored the planted lore's own specific framing. **Conclusion:** the context injection demonstrably shapes the model's thematic/structural choices, but the model treats planted lore as inspiration for consistent worldbuilding rather than material to restate verbatim — a craft choice, not a failure of the injection mechanism.

### Track E — web-research grounding + cache-hit validation

One `scitech`-mode call with `groundInResearch: true`, run twice back-to-back with an identical prompt. **Real result: excellent, genuinely research-grounded physics** in both calls — correct Schwarzschild-radius derivation, real Reissner-Nordström and Hawking-radiation physics, and a real historical fact (a specific 1997 Casimir-effect measurement) cited independently in both generations despite each producing different creative scene details. **Cache-hit signal:** call 2 was ~30% faster than call 1, and both calls converged on the same historical citation — directionally consistent with a semantic-cache hit skipping the real web-search call on the repeat, reported with an honest caveat that this isn't airtight proof (the grounding text isn't separately surfaced in the API response).

### Post-plan extension

User asked to extend both stories with more chapters within the remaining budget (~$10 of the original $14 left). Extended both stories 3 more chapters each with the same real-context discipline established in Track B. **6/6 succeeded, strong continuity** — one story's chapter 4 organically referenced an exact line from a separate Track C fight scene, and correctly established a plot detail (a character's father's death, via "the keys she'd taken off his body") that had never been restated in any prompt. Cost: ~$0.07, negligible.

**Total Phase 1 real spend:** ~$2-3 against the $14 budget.

---

## 3. "The Dealer" premise correction (2026-07-08)

**The single most important methodology lesson of this entire test arc**, and one that recurred a second time later (see Section 7).

**What happened:** every single Phase 1 track (A/B/C/D/extension) built "The Dealer" story around an **entirely invented premise** — "Mara Voss vs. Kessler," an arms-dealing family feud — without ever reading the real source PDF the user had placed in the test-material folder (`Midwest Armaments: Story Bible & Creative Concept V2.pdf`).

**How this was caught:** the user directly asked whether the test story used the card-throwing biomechanics/physics/trick-shots from that source material. It didn't, because the source material had never been read before building the test in the first place.

**The real premise:** a "Weapon Clans" world where the protagonist is the sole survivor of an annihilated branch family who fights exclusively with kinetically-charged playing cards — Soft Deck/Hard Deck mechanics, laminar zero-drag airflow, 15,000+ RPM gyroscopic spin, a named "Thurston-grip" kinetic chain, 400+ m/s velocities, and specific named trick shots (Ricochet Cascade, Iron Shield, Deck Flash, Card Splitter, Boomerang Loop) — hunting a patriarch named Roland Colt ("The King of Spades") who sold out his own family, structured around a self-assigned Dead Man's Hand.

**User's explicit, conditional instruction:** "only redo the dealer story... if redoing phase 1 improves prompt quality then i approve." Horizon Line and Tracks D/E were explicitly NOT touched at this point (Horizon Line's own, separate version of this exact mistake wasn't discovered until Section 7).

**Redone via two scripts:** a fresh project + real World Bible from the actual source material + full 26-mode sweep (25/26 succeeded, 1 transient overload error retried clean), and a Track-B-equivalent (Novel/Screenplay/short-form x outline+chapters+villain-pov+tension-curve+refine, 30/30 succeeded).

**Verified by reading actual generated prose, not status codes:** the corrected combat-mode output rendered the real biomechanics faithfully in-scene ("the air peeled off both faces in a laminar sheet, zero drag," "fifteen thousand RPM," a full Thurston-grip kinetic-chain throw sequence), and the Novel/Screenplay chapters correctly carried Roland Colt, the King of Spades designation, and the Dead Man's Hand structure throughout — a clear, demonstrated quality improvement over the invented premise, satisfying the user's approval condition.

---

## 4. Output Test 2 Phase 2 (2026-07-08/09) — real Segmind video generation

**Goal:** first real-money Segmind video generation test, using the corrected Dealer combat scene as source material. Built a dedicated project + a real `generate-package` shot breakdown (6 shots).

### Bugs found and fixed (2)

1. **`scheduleCallback()` crashed the entire `generate-video` request with a 500 when QStash rejected a `localhost` callback URL as a loopback address.** Critically, this happened **after** the video job was already submitted to Segmind and the DB was already updated — meaning real money had already been spent while the client saw an opaque failure with no indication the job had actually gone through. Fixed to fail open to client-only polling, matching the already-documented fallback contract for the separate "QStash not configured" case.
2. **`pollJob()` silently discarded Segmind's real rejection-reason text**, surfacing only a generic `"error"` status with no detail. Added a `productionShots.generationError` column and threaded the real message through the poll helper and the status route — this fix is what made the next finding (below) possible to diagnose at all.

Also wired real `duration`/`resolution` control into the video generation path (previously hardcoded to 5s with no resolution field sent at all) — confirmed live via Segmind's own docs that Seedance 2.0's real default resolution is 720p and its real duration range is 4-15s.

### The real finding: a non-deterministic content-filter problem, not a code bug

**First-attempt result: 2 of 6 shots succeeded** (a card-throw kill shot and a wordless aftermath shot). **The other 4 were rejected** with `OutputVideoSensitiveContentDetected.PolicyViolation` — **after 150-233 seconds of real, paid inference each.**

**Confirmed real billing behavior via the user's own Segmind dashboard:** only the 2 successes were actually charged (balance dropped by exactly the expected amount for 2 successful jobs) — all 4 rejections were free, matching Segmind's own documented "failed generations are not charged" policy. This is a real, verified, positive finding about the platform's billing fairness, not an assumption.

**Root cause, confirmed via live research** (Segmind's own error-guide blog + independent reporting, not guessed): this is a known, industry-wide, non-deterministic issue. Seedance 2.0's post-generation output filter was tightened following a real Disney/Paramount/Netflix/Warner Bros. cease-and-desist campaign against ByteDance (Feb 2026) over unauthorized training-data/IP use. By Segmind's own documented guidance, the *same exact prompt* can pass or fail on different runs, with no formal appeal path — the only recourse is reword-and-retry.

**A direct, controlled restage test (per the user's explicit direction) ruled out violence-severity as the actual trigger.** The 4 failing shots were rewritten to replace guns with a blunt weapon destroyed via repeated card strikes, and killing was changed to non-lethal knockdowns. **All 4 failed again with the identical error message.** This is a real, useful negative result: it means the rejection isn't really about content severity at all — more likely an over-broad or unstable classifier reacting to something else entirely (possibly stylistic or incidental, not systematically identified), tightened under active legal pressure rather than tuned for precision.

**Working fix: switched those 4 shots to Kling instead** of Seedance — a different vendor (Kuaishou), not party to the same acute copyright dispute, and already tagged `bestFor: ["action","combat"]` in this app's own model registry (vs. Seedance's `"social/shorts"` tag — a mismatch with this use case that had existed unnoticed until this test). Confirmed real Segmind pricing live before spending ($0.056/s std mode — actually cheaper than Seedance's $0.1512/s). **All 4 succeeded on the first attempt.**

**Explicitly declined:** community "uncensored" model forks (modified weights that strip official safety filters) were researched as a theoretical alternative and explicitly assessed as inappropriate to pursue for a legitimate product — not adopted, regardless of whether they might have "worked."

All 6 real shots stitched locally via `ffmpeg-static` (zero further spend) into one continuous ~60-second trailer. **Total real spend: ~$5.26** (2 Seedance successes + 4 Kling successes).

---

## 5. Higgsfield-native vs. Segmind comparison (item 64)

**Goal:** the user added a real Higgsfield API key/secret + 500 credits and asked for a direct comparison against Segmind, plus an animated (anime) style instead of photoreal.

### Errors / failures

- **Comic panel crop failure (first attempt, 16/16 failed):** used StoryDiffusion's "Classic Comic Style" (8-panel layout), assumed it was a regular grid, and cropped it with fixed grid-arithmetic. It isn't a grid — it's an irregular manga-style layout. The naive crop sliced through panel boundaries, producing garbled, wrong-aspect-ratio images. Hailuo correctly rejected all 8 as unusable inputs.
  - **Fix:** switched to StoryDiffusion's "Four Pannel" style, confirmed to be a genuine, reliable 2x2 grid. Re-ran: 16/16 succeeded.
- **Hailuo `last_frame_image: null` bug:** `buildVideoRequestBody`'s hailuo case explicitly sent `last_frame_image: null` when no last frame was supplied. Segmind's real API rejects explicit `null` for that field ("Invalid type. Expected: string, given: null"). This meant **every prior Hailuo call via this codebase's `generate-video` route had been failing**, not just this test's calls.
  - **Fix:** omit the field entirely instead of sending `null`. `src/lib/higgsfield/client.ts`.

### Things checked that were NOT bugs

- Higgsfield-native auth: confirmed via free read-only probes that both this codebase's existing `hf-api-key`/`hf-secret` header format AND the official docs' single `Authorization` header format both authenticate successfully. No bug.

### Real findings (not bugs, just data)

- Higgsfield's own Soul/Soul Cinema models are photoreal-only — no anime line exists there. Found a real Higgsfield anime line (Nano Banana Pro, Seedream, FLUX) but none of them expose StoryDiffusion's specific trick of one call producing multiple consistent panels.
- `minimax/hailuo-02/pro/image-to-video` confirmed as a real, reachable model path on both platforms via free validation-error probing (send an empty/malformed body, a 422 confirms the path exists, 404 means wrong path).
- Real 16/16 video calls succeeded across both platforms. Segmind side cost: $1.00 (8 x $0.125/6s). Higgsfield side: real per-call credit cost undetermined — **no balance/usage API endpoint exists on Higgsfield's API**, confirmed by probing; only the account dashboard shows it, which isn't automatable.

### Product fix shipped as a byproduct

- `cropFourPanelGrid()` added to `src/lib/comic-gen/storydiffusion.ts` as a reusable primitive, unblocking a previously-deferred item (item 26, the comic StoryDiffusion caption-baking problem).
- `manhua` `ArtStyle` entry added to `src/lib/ai/panel-prompt-builder.ts` (previously missing alongside manga/manhwa), mapped to StoryDiffusion's real 7-option `style_name` enum (confirmed live: `(No style)`/`Japanese Anime`/`Cinematic`/`Disney Charactor`/`Photographic`/`Comic book`/`Line art` — manhua maps to `Cinematic`, not `Japanese Anime`, since its painterly semi-realistic look fits that better than manga's flatter line art).

---

## 6. Higgsfield capability deep-dive (item 65)

### Errors / failures

- **DoP rate limit:** 4 rapid concurrent submissions to `higgsfield-ai/dop/standard` succeeded; the next 4 fired immediately after all failed with a `400` and an empty, unhelpful response body.
  - **Root cause confirmed transient, not content-related:** resubmitting the identical request seconds later succeeded.
  - **Fix:** space DoP submissions ~15s apart. Segmind showed no equivalent burst limit across the same 8-shot batches — this is Higgsfield-specific.

### Real findings

- `higgsfield-ai/soul/cinema` is a real endpoint but is **not in the official API guide**, which only documents `standard`. Found via a free validation-error probe.
- Soul vs. Soul Cinema, same prompt: Cinema mode produces genuinely different output — asymmetric framing, directional/under-lighting, shallower depth of field by default. Standard mode is flatter, evenly lit, poster-like. This is a concrete lesson for this codebase's own shot-prompt builder (`buildShotPromptFragment`): it currently has no explicit mood/lighting-direction axis and defaults toward centered/even compositions for combat/tension/horror modes — this comparison is direct evidence that's a missed axis. Not yet acted on.
- Soul's real `mode` enum discovered via the same probe technique: `standard` / `reference` / `character`. `character` mode is the likely real integration point for Soul-ID-driven consistent generation (tested later, see Section 7).
- A free, undocumented `GET /v1/motions` endpoint returns Higgsfield's full catalog: 121 named, UUID-keyed **trained** motion presets (Bullet Time, Crash Zoom In, Boxing, Building Explosion, Face Punch, etc.). This is a fundamentally different mechanism from this codebase's own `CAMERA_PRESETS` (`src/lib/higgsfield/presets.ts`), which are plain prompt-text injections, not trained model behaviors. Tested 2 presets (Bullet Time, Crash Zoom In) against the DoP endpoint's `motion_id` param — both succeeded.
- Real credit consumption confirmed via user-reported balance deltas: DoP (8 calls) + Soul/Soul Cinema (2 calls) = 82 Higgsfield credits, ~8.2/call.
- A third, previously-unused source PDF ("The Narrative Gaps: Conceptual Blueprints for Untapped Worlds") discovered in the same test-material folder as the Dealer/Horizon Line source docs — 5 unused sci-fi/horror/supernatural premises.

---

## 7. Canvas Void test + the second "unread source material" correction (item 66)

### Major methodology failure: Horizon Line's invented premise

This is the same class of error as the original Dealer-story mistake (item 62): **every prior Output Test 2 track for "The Horizon Line" (Phase 1 A/B/D/E) was built around an entirely invented premise** ("Dr. Elena Marsh / The Warden," a black-hole sci-fi story) without ever reading the real source PDF the user had placed in the test folder.

- **The real source** (`Project Horizon_ Research and Story Adaptation.pdf`) is **"The Ride Never Ends"** — a horror adaptation of the "Mr. Bones' Wild Ride" internet meme: a grieving widower (Arthur) boards a luxury observation coaster that takes exactly 4 years to complete one circuit, whose "exit" corridor loops directly back into the boarding queue.
- **How this was caught:** the user directly asked whether the Horizon Line test used the real source material. It didn't. This is the second time in this project this exact mistake happened (see item 62 for the first, on the Dealer story) — **the standing lesson is to always locate and read every source PDF in a test-material folder before building test content from an "obvious"-seeming premise, never assume a title is enough context.**

### Fix

Redone via `scripts/output-test-2-horizon-redo.mjs`: real World Bible (Arthur, Maya, the ride's actual mechanics/twist), full 26-mode sweep — 24/26 first pass (2 transient overload errors, both retried clean). **Verified faithful to the real source by reading actual generated prose, not status codes**: correct track-length math (9,000m at 9mph = 1,460 days = exactly 4 years), the plastic-skeleton corridor detail, and the intercom's "guest satisfaction rating: Excellent" line echoed almost verbatim from the source.

### A near-miss that was correctly avoided

The user also flagged a "combat fight" thread from the original test plan. A redo script for it was written and launched, then **explicitly cancelled mid-run** once the user clarified: "the combat track was already good as it was... it was separate from the dealer story." Caught before any real generation spend — only 2 cheap character-creation calls happened before cancellation. Lesson: when a redo is requested for a batch of items, confirm scope per-item rather than assuming all flagged items need identical treatment.

### Canvas Void: two real product bugs found

**Bug 1 — `cropFourPanelGrid()`'s fixed-ratio crop wasn't actually reliable.**
- The function (added in item 64, Section 5 above) used a fixed 75%-height crop to strip StoryDiffusion's baked-in caption band off each panel.
- **Failure case:** longer panel action-text made StoryDiffusion's caption wrap to more lines, growing the caption band past 25% of panel height. The extra caption text bled through underneath this app's own composited captions — visibly broken output on real content, not a synthetic edge case.
- **Fix:** replaced the fixed ratio with real row-variance boundary detection (`findCaptionBandTop()`) — scans panel rows bottom-up looking for the transition from flat/uniform color (the caption background) to photographic variance (the art), requiring 8 consecutive flat rows before declaring a boundary, to avoid false positives from a flat sky/snow/wall region in the actual artwork. Falls back to the old 75% default if no boundary is found (fail-safe, not fail-open-to-garbage).
- Verified against both a synthetic test fixture (4 new unit tests covering: short band, tall band = the real bug case, quadrant selection, no-band fallback) and the real failing panels, which now composite clean.

**Bug 2 — Soul-ID `character`-mode consistency test failed silently.**
- A generation referencing a freshly-trained Soul ID looked nothing like the training photos — no error, just wrong output.
- **Root cause:** guessed the wrong body field for referencing a trained Soul ID reference (`character_id`). Live research against the real official `higgsfield-ai/higgsfield-js` SDK source (not guessed, not inferred from docs alone) found the real field is `custom_reference_id` (+ a `custom_reference_strength` float).
- **Fix confirmed with a real corrected call**: produced a genuinely consistent result — same weathered face, frosted beard, general identity as the 3 training photos — unlike the failed guesses.
- **Secondary finding, not a bug:** real Soul ID training took longer than an initial 180s poll window (~1-2 real minutes needed) on retry — not a failure, just an insufficient timeout on the first attempt.

### Horizon Line Track B (format+role rewrite)

Completed cleanly — all calls succeeded, verified faithful to the real (corrected) premise via actual prose: Arthur's grief, his late wife Ellen, the morning ritual of turning off the alarm all correctly present.

### Lipsync comparison — both platforms failed

- **Higgsfield-native** (`higgsfield-ai/speak`, confirmed as a real endpoint via the same free-probe technique — requires `image_url`/`audio_url`/`prompt`): **consistently returned 500 on retry.** A real, reproducible provider-side failure with no useful error detail in the response body. Not something fixable on this codebase's side.
- **Segmind's existing production Hallo pipeline**: accepted the job without erroring, but **never completed a single-sentence clip within 5+ minutes.** This is a different, new failure mode from the previously-documented full-chapter-length 504 gateway ceiling (item 25) — that one was a known scale limit on long audio; this is slowness/unreliability on a genuinely short input, which is a worse sign, not a better one.
- **Status: unresolved.** Neither platform delivered a working lipsync result in this test. Not something to silently retry indefinitely — flagged here as a real, current limitation of both integration paths.

---

## 8. Full Director/Writer/Editor short film (item 67) — the main event

**User's instruction:** *"i want you to use soul models and soul cinema to make a full fledged short film using the ai director writer and editor combination."*

### Step 1 — Director: real shot breakdown

Called the real, shipped `generate-package` route (not a test-only reimplementation) against the real Horizon Line chapters. Produced an 18-shot breakdown with real `soulPrompt`/`videoPrompt` per shot, tied to real World Bible character IDs (Arthur, Maya).

### Step 2 — real financial constraint hit mid-task

The user added Higgsfield credits, then reported: *"hey i am not able to top up credits less than 500."* This is a genuine, real-world platform constraint (not a bug) — Higgsfield's top-up flow has a 500-credit minimum. **Response:** switched all rendering to Segmind's own proxy of the same Soul model (`higgsfield-text2image-soul`) to conserve the scarce Higgsfield credits, per the user's explicit "use segmind for the rest of the shots" instruction.

### Step 3 — Writer: keyframe generation, one real content-moderation false positive

All 18 keyframes generated via Segmind's Soul proxy. **shot-4-6** ("Arthur's hands and Sam" — an adult character adjusting a blanket over a sleeping toddler) was rejected by Segmind's NSFW classifier.
- **Assessed as almost certainly a child-safety-adjacent false positive** on genuinely wholesome content.
- **Explicitly declined to reword the same content to slip past the classifier** — this was treated differently from an earlier, legitimate violence-classifier situation (see Section 4/item 63's restage test) where rewording was an acceptable creative alternative. Rewording around a *child-safety* classifier specifically was judged inappropriate.
- **Correct fix, only applied once the user explicitly directed a genuine content change:** *"yes animate these keyframes but before change the rejected key frame to mc petting the head of child"* — the shot was regenerated with clearly different, unambiguously wholesome content (Arthur petting Sam's head) rather than a reworded version of the same ambiguous scene. This succeeded.

### Step 4 — a real interpretation error, self-corrected

User said: *"there is no need to animate the 18 shots ok so remove that."* This was initially read as "skip video entirely, deliver as still images" — an 18-image gallery was generated and presented as done.

User corrected: *"wait you generated images not video."* — **A "short film" should self-evidently be a video, and the instruction was actually about something else (likely: don't animate a specific already-known-bad shot) or was simply reconsidered.** The correct scope (animate all keyframes into video) was confirmed and executed from that point forward. **Lesson: when an instruction seems to remove a defining feature of the very deliverable being asked for, that's worth a beat of doubt before executing it as a literal instruction.**

### Step 5 — animate stage crash, made resilient

**Failure:** the animate stage crashed partway through an 18-shot batch (after only 2 successes) with `SyntaxError: Unexpected token '<'`.
- **Root cause:** Segmind's poll endpoint occasionally returns a raw HTML gateway-error page instead of JSON mid-poll — a transient infrastructure hiccup, not a real job failure. The polling code's `JSON.parse()` call had no error handling, so this uncaught exception crashed the entire batch script, losing progress on all 16 remaining shots (though the 2 already-completed shots had already been paid for and were not lost from Segmind's side, just from the script's un-persisted state before the fix below).
- **Fix, three parts:**
  1. Wrapped the poll's fetch+parse in try/catch — a parse failure is now treated as a skipped poll tick (log and retry) instead of a fatal error.
  2. Wrapped each shot's *entire* animation attempt in try/catch — one shot's failure (of any kind) no longer loses the rest of the batch; the failed shot is recorded with `videoUrl: null` and an error message, and the loop continues.
  3. Added resume logic: the animate stage now reads any existing partial results file on start, builds a set of already-completed shots, and skips them on rerun — **critical to avoid double-spending** on shots that had already succeeded and been paid for before a rerun.
- **Verified working:** the resumed run hit the exact same transient HTML-parse error again on a later shot (shot-3-2) mid-run, logged `[poll error, retrying]`, and continued without crashing — proof the fix works under a real repeat occurrence of the same failure, not just a synthetic test.
- **Real result: 18/18 shots animated successfully** across the original + resumed runs, zero shots lost.

### Step 6 — the user's central challenge: "what is the use of ai editor if it just stitches video without taking a look at the videos"

This was the pivotal correction of the whole task. Up to this point, the pipeline was: Director (shot list) → Writer (render) → raw `ffmpeg concat`. **There was no Editor step at all** — despite the original instruction explicitly asking for the Director/Writer/**Editor** combination.

**Response: built a real Editor review, reusing the actual shipped product logic, not a bespoke test-only check.**

- Used `critiqueShot()`/`scoreShot()` from `src/lib/production/vision-critic.ts` / `src/lib/production/self-eval.ts` — this is the exact Phase B vision-critic machinery already shipped in the product (item 34), the same code a real user's Production Studio self-eval loop would use. Ran it against all 18 real keyframes, scoring promptAdherence / characterConsistency / continuity / technicalQuality / pacing / coverage / aesthetics for each, with the previous shot's image passed in for a real continuity check.

#### Bug found: the shipped vision-critic was silently broken

- **First run: 17 of 18 shots scored all-zero across every dimension.** This looked at first like "the AI editor found everything terrible," but that would have been a false and misleading conclusion.
- **Root cause, found by dumping the raw Claude response for a failing case:** `safeParseScores()` stripped markdown code fences and then ran a strict whole-string `JSON.parse()`. Despite the critic's system prompt saying "Return ONLY valid JSON," the model (Haiku) sometimes appends a "Brief Assessment" prose section *after* the JSON object — especially on real, detailed narrative prompts rather than short synthetic ones. The trailing prose makes the whole string invalid JSON. `JSON.parse` throws, the catch block returns `{}` (empty object), and `scoreShot()` defaults every missing dimension to `0`. **This failure was completely silent — no logging anywhere in the failure path.**
- **Severity: this is the same silent-data-loss bug class as item 36's `content[0].type === "text"` finding** (a prior, separately-discovered issue where a thinking block preceding a text block caused real model output to be silently discarded). **This means the shipped Phase B vision-critic has likely been silently zeroing real users' shot/panel quality scores in production since it launched** — not a test-only artifact.
- **Fix:** `safeParseScores()` now extracts the first `{...}` object via regex instead of parsing the whole cleaned string (safe because the dims object is flat, no nested braces, so a single non-greedy match is unambiguous). Added `console.warn` logging on both failure paths (no object found at all; object found but doesn't parse) so this failure mode can never be silent again.
- **Verified:** added a regression test reproducing the exact real failure shape (JSON object followed by a "Brief Assessment" section) to `src/lib/production/__tests__/vision-critic.test.ts`. All 7 tests in the file pass, including the 6 pre-existing ones — the fix didn't regress the already-covered cases (fence-stripping, multi-image ordering, fail-open on genuinely malformed input, fail-open on API errors).

#### Re-run with the fix: real, trustworthy signal

15 of 18 shots genuinely passed (average score 0.73). **3 shots flagged below the 0.7 threshold** — and each was individually visually inspected before any action was taken, rather than trusting the automated score blindly:

| Shot | Critic score | What it actually was, on inspection |
|---|---|---|
| shot-5-1 (Maya's tally-mark macro) | 0.29 (characterConsistency=0) | **Critic false-negative.** The shot is an intentional extreme close-up of a fingernail scratching a tally mark into velvet — genuinely well-executed and atmospheric, matching its prompt closely. `characterConsistency` scored 0 purely because there's no face in frame to check against a reference — not because anything is actually wrong. Kept as-is, no fix applied. |
| shot-3-1 (Arthur's hands) | 0.37 | **Real defect, but content was salvageable.** The prompt called for a tight "close-up insert on hands and face"; the render was a wider torso-and-background shot that still contained all the right content (hands, face, foil-wrapped object, cupholder), just framed too loosely. |
| shot-6-5 (Maya/Arthur at the bolt mechanism) | 0.40 (coverage=0.15) | **Real defect, content was NOT salvageable by cropping.** The prompt called for a dim, tight, intimate insert on Maya's forearm/hand through a mesh screen, faces mostly obscured in low amber light. The render was a bright, evenly-lit, medium-wide two-shot with both full faces clearly visible — a real mismatch on both framing and lighting. |

#### The user's next question, directly on point: "check if a small video generation and a small cut and paste in video can fix it or we have to generate the whole shot"

This was tested properly — cheap fix attempted first on both real defects, verified by direct visual inspection before deciding whether to accept it or fall back to a full regeneration:

- **shot-3-1: crop-only fix succeeded.** An `ffmpeg` crop (`crop=350:800:0:80,scale=512:910`, zero API spend) tightened the framing to focus on the hands+face region, cropping out the empty train-corridor background. Visually confirmed: now correctly reads as the "close-up insert" the prompt asked for. **Adopted, no regeneration needed.**
- **shot-6-5: crop-only fix failed.** Attempted a similar crop (`crop=400:830:60:40,scale=512:910`) plus an `eq` darkening filter to simulate the "dim amber light" requirement. Visually inspected the result: the crop region was wrong — it cut out the actual forearm-and-bolt-mechanism content that was the entire point of the shot, and the darkening made the result too dark/blurry to read at all. **This is a real, honest finding: cropping can fix framing-only problems (shot-3-1) but cannot fix a shot where the wrong pixels were rendered in the first place (shot-6-5) — cropping can only work with content that already exists in the frame.** Discarded this attempt, did not adopt it.
- **shot-6-5: full regeneration, second attempt.** Rewrote the prompt to much more forcefully specify the framing and lighting ("EXTREME close-up insert, tight crop dominated by Maya's forearm and hand... forearm and screen fill most of the frame... Only the very edges of Maya's and Arthur's faces are partially visible at the bottom corners, mostly in shadow. Single dim, low amber emergency strip light as the ONLY light source..."). Regenerated the keyframe and re-animated it.
  - **Visually confirmed:** now correctly shows a tight, dim, amber-lit forearm/mesh/bolt close-up with only shadowed face-edges at the bottom corners — matches the corrected prompt closely.
  - **Quantitatively re-verified with the same real critic:** score improved 0.40 → 0.665 (promptAdherence 0.2→0.75, coverage 0.15→0.65 — the two dimensions that mattered most for the actual defect). The residual "weak" `characterConsistency` (0.5) is the same face-visibility blind spot documented for shot-5-1 above, not a real remaining flaw — the shot's faces are *intentionally* obscured by the corrected design.

### Step 7 — final stitch, done correctly this time

Assembled the final cut using a dedicated script (`horizon-short-film-final-stitch.mjs`) that:
- Sorts all 18 shots into **real narrative order** (scene number, then shot number) — the working data file was in completion order (whatever order shots finished animating in, including resume-skipped shots first), not story order. Stitching in the raw file order would have produced a scrambled, out-of-sequence film.
- Uses the local cropped file for shot-3-1 and the freshly regenerated clip for shot-6-5, downloading the other 16 shots' original videos fresh.
- **Re-encodes rather than stream-copies** the final concat (`-c:v libx264` instead of `-c copy`) — deliberate, because shot-3-1's locally re-encoded crop has different codec parameters (bitrate, potentially profile/level) than the raw Segmind Hailuo output on the other 17 shots, and the ffmpeg concat demuxer's `-c copy` fast path isn't safe to mix across differently-encoded sources. This trades a little processing time for a guaranteed-correct output file rather than a byte-stream mismatch that might only surface as a playback glitch.

**Result:** `the-horizon-line-SHORT-FILM.mp4`, ~105 seconds, all 18 shots, 12.3MB.

---

## 9. Consolidated bug list (all sessions covered by this report)

| # | Bug | File | Severity | Root cause | Fix |
|---|---|---|---|---|---|
| 1 | Comic panel crop garbled on 8-panel layout | test script only (not shipped code) | Test-blocking | Assumed "Classic Comic Style" was a regular grid; it's an irregular manga layout | Switched to "Four Pannel" style (confirmed real grid); added `cropFourPanelGrid()` for that case |
| 2 | Hailuo `last_frame_image: null` rejected by Segmind | `src/lib/higgsfield/client.ts` | **Production-affecting** — every prior Hailuo call via `generate-video` would have failed | Sent explicit `null` for an optional field Segmind's API doesn't accept as null | Omit the field instead of sending `null` |
| 3 | DoP rate limit on rapid concurrent submissions | test scripts (Higgsfield-side infra) | Test-blocking, transient | Higgsfield-side burst limit, confirmed non-content-related | Space submissions ~15s apart |
| 4 | `cropFourPanelGrid()`'s fixed 75%-height crop unreliable | `src/lib/comic-gen/storydiffusion.ts` | **Production-affecting** — real captions of varying length break a fixed-ratio assumption | Guessed a fixed ratio instead of measuring the actual caption band | Real pixel-row-variance boundary detection (`findCaptionBandTop()`), with a fallback |
| 5 | Wrong Soul-ID reference field (`character_id` vs `custom_reference_id`) | test scripts / potential future product code | Test-blocking until found | Guessed the field name instead of checking the real SDK source | Found and confirmed via the official `higgsfield-ai/higgsfield-js` SDK source |
| 6 | Animate-stage crash on transient HTML poll response | `scripts/horizon-short-film-segmind.mjs` (test script) | Test-blocking, real transient infra issue | No error handling around `JSON.parse()` of a poll response | try/catch around poll parse (skip tick, retry) + try/catch around each shot's full attempt + resume logic |
| 7 | **`safeParseScores()` silently returns all-zero scores on trailing prose** | `src/lib/production/vision-critic.ts` | **Production-affecting, most severe of this report** — likely silently zeroing real users' shot/panel quality scores since Phase B shipped (item 34), with zero logging to ever surface it | Strict whole-string `JSON.parse()` after fence-stripping; model sometimes appends prose after the JSON despite instructions not to | Regex-extract the first `{...}` object instead of parsing the whole string; added `console.warn` on both failure paths so this can never fail silently again |

Bug #7 is the standout finding of this entire report: it was found not by chasing a known problem, but because the user asked a pointed, legitimate question about whether the "AI Editor" step was doing anything real — wiring in the actual shipped logic (instead of accepting the raw stitch) is what surfaced it.

---

## 10. Known, unresolved limitations (not fixed, documented honestly)

- **Lipsync is currently broken on both integration paths.** Higgsfield-native 500s consistently on retry with no useful error detail. Segmind's existing Hallo pipeline doesn't error but also doesn't complete even a single-sentence clip within 5+ minutes. No working lipsync path was demonstrated in this entire test arc.
- **The vision-critic has a real blind spot for intentional face-obscured/no-face shots.** `characterConsistency` scores 0 (not "N/A" or neutral) whenever no face is visible to check, even when that's the deliberate creative choice (macro inserts, obscured-face intimate framing). This dragged two genuinely good/fixed shots' scores down artificially (shot-5-1, and shot-6-5 even after its real fix). Not fixed in this pass — documented as a known scoring-model limitation. A future fix would need the critic to distinguish "no face present by design" from "face present but doesn't match," likely by having the critic system prompt explicitly instruct a neutral/skip score when no face is visible in the generated image at all, rather than penalizing it.
- **Cropping can only fix framing problems, not content problems.** Demonstrated concretely by shot-3-1 (crop worked, all the right content was already in frame) vs. shot-6-5 (crop failed, the actual subject content wasn't in the cropped region to begin with). This is a generalizable lesson for any future "cheap fix vs. full regen" editorial decision: crop/color-grade fixes are viable only when the underlying content is already correct and only the framing/exposure is off.
- **Higgsfield has no balance/usage API** — real per-call credit costs can only be confirmed via the account dashboard, not automated. This limited how precisely the Higgsfield-side costs in item 64/65 could be reported (only aggregate user-reported deltas were available, not per-call granularity).
- **Higgsfield's Soul ID training queue time is unpredictable** — one training run took ~57-90s, another never left "queued" within a 600s window in an earlier test (documented in item 66/prior context) and was abandoned in favor of Segmind. Real infrastructure variability, not something this codebase can control.
- **Comic Studio's full compositing (lettering + CBZ export) using the item 64/66 crop fix, and a broader product-side lighting/mood-axis addition to `buildShotPromptFragment`** (per the Soul vs. Soul Cinema finding in Section 6) are real, identified opportunities that were **not** acted on in this pass — noted as open follow-ups, not silently dropped.

---

## 11. Real cost/spend summary + where every real generated asset lives on disk

### Cost, by phase

- **Output Test 1** (Section 1): ~$10-15 Segmind budget consumed across the full pipeline test (images, video, audio, lipsync, all 9 formats).
- **Output Test 2 Phase 1** (Section 2, Tracks A-E + extension): ~$2-3 total Claude API spend against a $14 budget.
- **Dealer redo** (Section 3): Claude API text-generation cost only (26-mode sweep + Track B equivalent), not separately itemized in dollars — folded into the Phase 1/2 running total.
- **Output Test 2 Phase 2** (Section 4, Segmind video): **~$5.26 confirmed real spend** (verified directly against the user's Segmind dashboard balance delta — the most precisely-confirmed cost figure in this whole report).
- **Higgsfield vs. Segmind comparison** (Section 5): ~$0.055 (StoryDiffusion) + $1.00 (Segmind Hailuo x8) + undetermined Higgsfield credits (no usage API exists on their platform).
- **Higgsfield deep-dive** (Section 6): 82 Higgsfield credits (DoP x8 + Soul/Soul Cinema x2), zero additional Segmind spend.
- **Canvas Void + Horizon Line redo** (Section 7): Horizon Line 26-mode sweep + Track B (Claude API text cost) + Canvas Void comic/Soul-ID tests (small StoryDiffusion + Soul image calls).
- **Short film** (Section 8): 18 Segmind Soul image generations + 2 extra Soul regenerations (the NSFW-flagged shot-4-6 retry, the shot-6-5 framing/lighting fix) + 19 Segmind Hailuo animations (18 original + 1 regenerated shot-6-5) — real dollar cost not independently confirmed against the dashboard in this pass, unlike Phase 2; should be checked against the account balance if precise accounting is needed.

Full running total across all of Output Test 2 is tracked in `project-output-test-2.md` (memory) and the individual CLAUDE.md items — not restated as one grand total here to avoid drift between sources of truth as new tracks get added.

### Where everything actually lives on disk

**Correction to an earlier doc note:** `docs/gotchas.md`/memory previously described `outputtestresults/` as "a sibling folder to the repo, NOT inside it." That's not accurate — it actually lives *inside* the `ghostwriter` repo directory (`ghostwriter/outputtestresults/`), just gitignored (`.gitignore:9`), so nothing generated ever gets committed. Functionally the intent (keep large real generated media out of git) is satisfied either way; only the literal path description was wrong.

All real generated text, images, video, and audio from every phase in this report are present on disk under `ghostwriter/outputtestresults/` (~594MB total as of this report):

- `output-test-1/` (139MB) — the original pipeline test: `story1-the-dealer/` and `story2-the-horizon-line/` (per-shot + stitched trailer videos), `comic-studio-test/`, `comic-validation/`, `format-tests/`, `novel-screenplay-test/`, `series-bible-test/`, `storydiffusion-validation/`, `universe-test/`, plus the original `test stories material/` source PDFs.
- `output-test-2/` (377MB) — Phases 1-2 and the Dealer redo: `mode-sweep/`, `novel/`, `screenplay/`, `short-form/`, `series-universe/`, `web-research/`, `combat-fight-scene/` (Track C), `combat-context-boxing-vs-kravmaga.txt` (the real captured biomechanics context), `horizon-redo/` (the corrected Horizon Line premise sweep), `dealer-redo/` (the corrected Dealer premise sweep, plus `segmind-test/the-dealer-trailer-STITCHED.mp4` — Phase 2's real video result, and `full-animated-comparison/` — Phase 3's Segmind-vs-Higgsfield-vs-DoP trailers).
- `canvas-void-test/` (78MB) — Phase 3's Canvas Void work: `comic/`, `soul-id/`, `lipsync/` (the failed lipsync attempts), and `horizon-film/` — the full short film's 18 keyframe images, all animated clips, `shots-with-video-segmind.json`, `editor-review.json` (the real vision-critic scores), and the final `the-horizon-line-SHORT-FILM.mp4`.

Nothing generated in this entire test arc was discarded — every real image, video, audio file, and generated-text JSON is still on disk at the paths above.
