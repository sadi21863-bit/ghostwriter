# Why GhostWriter's image/video output reads as "AI slop," and what closes the gap

A product-level gap analysis, written after the 2026-06-24/25 real-money pipeline test (`docs/2026-06-24-segmind-higgsfield-pipeline-test.md`) fixed the *plumbing* bugs (wrong endpoints, wrong params, broken consistency references). This doc is about what's left once the plumbing works: the actual generated output is still close to "AI slop" by design, not by bug. GhostWriter is already a competent AI **writer**; it has no AI **director** or AI **editor** — and the architecture audit below shows it has no infrastructure for either one to slot into yet.

**See also `docs/2026-06-25-competitor-and-model-research-comic-video-quality.md`** — the model-level follow-up to this doc, researching exactly which competitor/Segmind models close this gap concretely (Seedance 2.0's unused `reference_images`/multi-shot fields, `storydiffusion` for Comic Studio, Higgsfield Popcorn's review-then-animate workflow).

---

## 1. Why it reads as slop — grounded in both general research and GhostWriter's specific architecture

Research into "AI slop" criticism (2026) converges on one root cause more than any technical artifact: **content that looks "good enough" at a glance but carries no specific creative intent, environmental grounding, or human (or directorial) judgment.** The most-cited technical "tells" — inconsistent background physics between cuts, flat uncanny lighting, lack of shot-to-shot continuity — are symptoms of that root cause, not separate problems. Generic briefs guarantee generic results regardless of model quality.

This maps onto GhostWriter's pipeline almost exactly:

- **Every shot is generated in total isolation.** The production package writes a static text prompt per shot (`soulPrompt`/`videoPrompt`) once, and that's the only creative direction any shot ever gets. There's no mechanism that looks at shot 3 while generating shot 4 to ask "does the lighting/mood/blocking still make sense coming from the last shot?"
- **There is exactly one generation slot per shot, ever.** Confirmed via direct code audit: regenerating a shot *overwrites* the previous result in place. There is no "generate 4 candidates, pick the best" — the system commits to its first attempt every time, with no quality gate.
- **Nothing reviews the output before it's presented as final.** No vision-based critique, no consistency check, no human approve/reject step. A shot can come back compositionally broken, off-character, or visually inconsistent with its neighbors and the app has no way to know or flag it.
- **There is no assembly step.** Shots/panels are never combined into one continuous sequence — the user gets N independent clips with individual download links, never a finished cut. A film is not a folder of clips; without assembly, there is no place for pacing, transitions, or rhythm to exist at all.

In short: GhostWriter's media pipeline currently models film production as **"call an image/video API once per shot, in isolation, and keep whatever comes back."** That is structurally the slop-generating pattern the research describes, independent of which model or prompt is used underneath.

---

## 2. What the rest of the industry is doing about this (2026)

Two converging patterns, confirmed via current research and product behavior:

### Multi-agent "virtual film crew" architectures (research)
Papers like **AniMaker** (arXiv 2506.10540), **Camera Artist**, and **Mind-of-Director** all converge on the same four-role split:

| Role | Job |
|---|---|
| **Director Agent** | Writes the storyboard/shot list that governs the whole sequence — GhostWriter already has a rough version of this (`generate-package`'s Claude call) |
| **Photography Agent** | Generates *candidate* clips per shot — note: candidate**s**, plural. AniMaker's "MCTS-Gen" uses Monte Carlo Tree Search to explore multiple candidate clips per shot and prioritize the promising ones rather than generating exactly one and stopping |
| **Reviewer/Critic Agent** | Evaluates each clip **alongside its neighboring clips**, not in isolation — explicitly scoring story-level consistency, action completion, and shot-to-shot coherence (AniMaker's "AniEval" framework) |
| **Post-production Agent** | Assembles the reviewed/selected clips into one continuous piece, adds audio/voiceover |

GhostWriter has roughly one of these four roles half-built (Director, via the production package) and **zero** of the other three.

### Consumer tools are converging on the same shape
Runway (2026) added **"Studio Trim"** — stitch, reorder, and export clips into one finished video inside the same app, not a separate download-and-edit-elsewhere step — and **"Runway Characters"**, a persistent cast member that stays visually identical across a whole production (the consumer-facing version of "consistency reference," which GhostWriter already has a primitive version of via portrait-based `reference_image_url`, just without any cross-shot enforcement or review).

The common thread: **generation is no longer the hard part. Review, selection, continuity-enforcement, and assembly are now what separates a usable tool from a slop machine** — and that's precisely the layer GhostWriter doesn't have.

---

## 3. Current GhostWriter capability — verified by direct code audit, not assumption

| Capability | Status | Evidence |
|---|---|---|
| Per-shot independent regeneration | ✅ Exists | `ProductionStudio.tsx` per-`ShotCard` buttons (Preview/Animate/Generate Video/Retry) |
| Batch "preview all" | ✅ Exists | `ProductionStudio.tsx` "Preview All Shots" |
| Drag/reorder shots or panels | ❌ Missing | Zero reorder code in either Production or Comic Studio |
| Multiple candidates per shot, pick best | ❌ Missing | Exactly one media slot per shot/panel; regeneration overwrites in place |
| Filmstrip/timeline view of the whole sequence | ❌ Missing | Shot list is a vertical scroll list; comic pages are a static 2×3 grid, navigated one page at a time |
| Shot-to-shot continuity checking | ❌ Missing | No continuity logic anywhere in the codebase (confirmed by grep — the only "continuity" references are unrelated prose-level Story Health features) |
| Trim/edit a clip, add transitions | ❌ Missing | `duration` is a *pre-generation* parameter, not a post-generation edit control; zero stitch/merge/concat code anywhere |
| Approve/reject/notes per shot | ❌ Missing | `generationStatus` only tracks pipeline state, never a human review state |
| Export one assembled video | ❌ Missing | Only per-clip individual downloads; no "combine all clips" anywhere |

This is the same conclusion as section 1, now with file-level evidence: the app has a Director (half of one) and nothing else from the four-role pattern above.

---

## 4. What would actually close the gap — phased, mapped onto what exists today

Not a rewrite. Each phase slots onto existing infrastructure rather than replacing it.

### Phase A — Give the Director real continuity awareness (cheapest, highest leverage)
The production package's Claude call already writes the whole shot list in one pass — it has full visibility into all 6 shots at once. It is **not currently instructed to think about continuity** (lighting consistency, costume/prop continuity, location logic, the 180-degree rule, eyeline match). Adding explicit continuity instructions to `PRODUCTION_PACKAGE_SYSTEM_PROMPT` and asking it to cross-reference each shot against its neighbors when writing `soulPrompt`/`videoPrompt` is a pure prompt-engineering change — no new infrastructure, no new spend pattern, immediate quality lift. This is the "Director Agent" role, upgraded from "writes a shot list" to "writes a shot list *while thinking like a director*."

### Phase B — A Reviewer/Critic pass (the missing "AI Editor," part 1)
After a shot's image/video comes back, run it through a cheap vision-capable Claude call (Claude's multimodal input) that scores it against: does it match the planned `soulPrompt`? Is the character recognizable as the same character from the reference portrait? Does it visually make sense next to the previous shot? Flag (don't auto-reject) anything that fails. This is a real, working pattern — exactly AniEval's "examine each clip alongside its neighbors" check, just implemented with what GhostWriter already has access to (Claude, multimodal) rather than a bespoke model.

### Phase C — A real review/management space (the "dedicated space," the missing "AI Editor," part 2)
This is the actual product gap behind "dedicated space where outputs are managed, edited": a genuine **Production Review Studio**, replacing the current vertical-list/static-grid views:
- A horizontal filmstrip/timeline (not a scrolling list) showing every shot/panel in sequence, matching what Runway/professional NLEs already do.
- Per-shot: show the Phase B critic's flags inline, with one-click "regenerate this one" (already exists) plus an actual approve/reject/needs-rework state (doesn't exist yet) so a human can move through a sequence the way a director reviews dailies.
- Drag-and-drop reorder (doesn't exist) — sortOrder already exists in the schema, it's just never exposed to the UI for shots/panels.
- A "keep N candidates, pick one" mode for shots the user explicitly wants options on, rather than committing to the first generation every time (the schema would need a small extension — an array of candidate media URLs per shot instead of one slot — but the generation routes already produce one URL per call, so this is additive, not a rewrite).

### Phase D — A real Post-production/assembly step
Stitch the approved/selected clips into one continuous video with basic transitions (even simple hard cuts in the right order is a major upgrade over "11 separate download links"), matching Runway's "Studio Trim." This is the one phase that needs genuinely new server-side work (video concatenation — no `ffmpeg` currently available in the dev environment used for testing; would need either a server-side ffmpeg-capable runtime or a cloud video-assembly API). Flagged as the most infrastructure-heavy phase, intentionally last.

---

## 5. Where this is *not* a quick fix, and where it already partially exists

To be precise about scope, since "give it an AI Director and AI Editor" sounds simple stated as a one-liner but isn't a small feature:

- **Already exists, just disconnected from the rest of the pipeline:** the production package's single Claude call already does real directorial work (shot framing, lighting mood, camera movement per shot) — it's the seed of a real Director Agent, not a from-scratch addition.
- **Genuinely new, but cheap:** Phase A (continuity-aware prompting) and Phase B (critic pass) are prompt/route-level additions using infrastructure that already exists (Claude calls, the existing shot/panel data model).
- **Genuinely new and a real UI project:** Phase C is a new screen, not a tweak — a proper timeline/review surface is comparable in scope to the WritingRoom "One Path, Five Stages" redesign that's already in this codebase's history (see `CLAUDE.md` items 16-18), not a one-afternoon addition.
- **Genuinely new and an infrastructure project:** Phase D (assembly/export) needs a server-side video-processing capability this environment doesn't currently have.

**Recommended order if this becomes real work:** A → B → C → D, in that order, because A and B improve the *output itself* with no new UI surface, while C and D are about *managing and finishing* output that's already gotten better. Shipping C before A/B would just give users a nicer way to review slop, not less slop to review.
