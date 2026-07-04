# Comic Studio & production video quality: competitor/model research

Direct follow-up to `docs/2026-06-25-ai-director-editor-production-studio-gap-analysis.md` (which covers the *product/UX* gap — no review loop, no continuity checking, no assembly). This doc covers the *model/technical* layer: what specific models and techniques competitors and Segmind itself already offer that GhostWriter isn't using, researched directly rather than assumed.

**Headline finding: the single biggest fix is cheap and doesn't require new infrastructure.** GhostWriter's video generation currently sends **zero character reference** to the video model — every clip is generated blind from text alone. Comic Studio uses a generic photoreal portrait model for every panel instead of a model actually built for sequential narrative consistency. Both of the right tools already exist on Segmind, the same provider already in use.

---

## 1. Production video: Seedance 2.0 already supports what we need — we're just not using it

GhostWriter's `generateTextVideo()` (`src/lib/higgsfield/client.ts`) sends Seedance 2.0 (and the other 4 video models) a body with `prompt`, `aspect_ratio`, `duration`, `seed`, `enhance_prompt` — **no reference image of any kind.** Confirmed via Segmind's real Seedance 2.0 API schema, the model supports two directly relevant fields neither this app nor the original implementation ever sent:

| Field | Type | What it does |
|---|---|---|
| `reference_images` | `string[]` | **Up to 9 reference images for character/style consistency** |
| `prompt` | `string` | Explicitly documented to support `"Shot 1: ..., Shot 2: ..."` syntax for **multi-shot sequences in one generation call** |

This means the 6 independent, character-blind `generate-video` calls per story could become **one Seedance 2.0 call per scene**, passing the character portrait(s) already generated as `reference_images` and writing the 6 beats as `"Shot 1: ... Shot 2: ... Shot 3: ..."` in a single prompt. The model returns one continuous video with natural cuts between shots — which also means **this single change would simultaneously fix the consistency problem (Section 1 of the Director/Editor doc) and the missing-assembly problem (Phase D of that doc)**, since Segmind/Seedance does the cut-assembly server-side.

**Alternative if Seedance's reference handling underperforms for a given story**: `wan2.7-r2v` (`https://api.segmind.com/v1/wan2.7-r2v`) is a dedicated character-consistent-video-from-reference-photo model, supporting multi-subject scenes and voice-cloning integration, at $0.625/request (720p) or $0.9375 (1080p). Confirmed real endpoint and field names (`prompt`, `reference_images`, `resolution`, `duration`, `seed`) — a viable fallback or A/B candidate, not yet tested in this codebase.

---

## 2. Comic Studio: using the wrong category of model entirely

Comic Studio currently calls `generateSoulImage()` — the same generic photoreal Soul 2.0 portrait model used for character portraits and shot previews — once per panel, each call independent, each one a fresh roll against a single static reference image. This explains two separate complaints in one mechanism:

1. **Weak panel-to-panel consistency**, because each panel is generated independently with no shared context between panels.
2. **Doesn't look like a comic**, because Soul 2.0 is a cinematic photoreal model — it was never trained or tuned to produce comic-panel aesthetics (ink lines, flat color, panel-native composition). The "art style" parameter passed through is a generic `style_preset` string, not a model purpose-built for sequential comic generation.

### What's available instead, confirmed on Segmind

| Model | What it's for | Why it's a better fit |
|---|---|---|
| **`storydiffusion`** (`segmind.com/models/storydiffusion`) | Generates a full **sequence of images in one call** from a `character_description` + `comic_description` (all scene prompts, newline-separated) | This is the actual right tool for "generate a comic page." Built-in `comic_style` parameter (`"Four Panel"` / `"Classic Comic Style"`) and `style_name` (Disney/Anime/Cinematic/etc.) — produces genuinely comic-styled output, not photoreal images stuffed into a grid. Consistency mechanism is "Paired Attention" at 32×32/64×64 self-attention layers (the production version of the StoryDiffusion research paper's "Consistent Self-Attention," NeurIPS 2024) — shared attention **across the whole batch**, not a single static reference image re-sent per call. |
| **`consistent-character`** | Generates one character in multiple poses, consistently | Useful for building a richer reference set (more than one portrait angle) to feed into either StoryDiffusion or Seedance's `reference_images`. |
| **`pulid-base`/`pulid-lightning`** | Tuning-free identity customization for text-to-image | An alternative/complementary consistency mechanism to what's currently used for portraits — not yet evaluated against the current `reference_image_url` approach. |

**Recommendation**: switch Comic Studio's panel generation from N independent `generateSoulImage()` calls to one `storydiffusion` call per page, passing all 6 panel descriptions as `comic_description` and the character's established appearance as `character_description`. This is a more direct fix than building a custom multi-agent review layer on top of the wrong underlying model.

### 2a. Deeper dive: how comic-specific apps and open-source pipelines actually structure this

Beyond which image model to call, researched how dedicated comic-generation products and open-source repos architect the *whole pipeline* — confirms Comic Studio is missing more than just the right model:

**Commercial comic apps converge on three techniques GhostWriter has none of:**
1. **Reference-sheet architecture**: before generating any story panels, a dedicated character reference sheet is generated first (neutral poses, labeled features), and *that* reference sheet — not a single portrait — is what loads with every subsequent panel. GhostWriter generates one portrait and reuses that single image as the only reference for everything.
2. **Panel layout intelligence**: panel *size and shape* vary with narrative rhythm — action beats get dynamic diagonal panels with speed lines, emotional beats get a large panel or full-page spread, dialogue-heavy beats get smaller, evenly-spaced panels with room for speech bubbles. Comic Studio's actual layout is a fixed, uniform grid regardless of content (confirmed via the earlier code audit — `ComicStudio.tsx`'s editor view is a static 2×3 grid every time).
3. **Dedicated speech-bubble/lettering step**: professional tools run a *separate* agent specifically for placing dialogue into bubbles — text content, bubble shape, tail direction (pointing at the speaker), and reading-flow pacing across the page. Comic Studio currently generates panels with **no dialogue/text rendering mechanism at all** — confirmed: `comicPanels` schema has no caption/dialogue/bubble fields, and the generated images are pure illustration with no text overlay step anywhere in the pipeline.

**Open-source repos researched (GitHub):**

| Repo | Architecture | Relevance |
|---|---|---|
| [`jbilcke-hf/ai-comic-factory`](https://github.com/jbilcke-hf/ai-comic-factory) | LLM (pluggable: HF Inference, OpenAI GPT-4, Groq Mixtral, Claude 3 Opus) writes the narrative/JSON breakdown → SDXL (via VideoChain/Replicate/HF Inference Endpoints) renders panels. The most well-known free/open option. **Explicitly documents unresolved character-consistency issues** as a known limitation — confirms that consistency genuinely requires a dedicated mechanism, not just "call an LLM then an image model." Archived Oct 2025 (no longer maintained) — a useful cautionary data point, not a recommendation to adopt as-is. |
| [`albinks/stylus`](https://albinks.github.io/stylus/) | A genuine multi-agent pipeline with **explicit separate agents**: Character Creation → Story Arc Generation → **Panel Layout Planning** → Art Generation → Coloring → **Final Composition**. This is the closest open-source match to the "AI Director + AI Editor" framing from the gap-analysis doc — it treats layout planning and final composition as their own discrete steps, not implicit side effects of image generation. |
| [`Dapeng960208/AI-Comic-Generator`](https://github.com/Dapeng960208/AI-Comic-Generator) | Gemini-based, stores the entire pipeline (story outline → character settings → storyboard) as structured JSON end to end, plus an explicit "character consistency check" step and a visual editor. The "structured JSON all the way through" pattern plus an explicit consistency-check step (a real Reviewer-Agent analogue) is worth studying directly if building Phase B of the gap-analysis doc. |
| [`alsaif1431/AI-Comic-Generation`](https://github.com/alsaif1431/AI-Comic-Generation), [`elder-plinius/MythGen`](https://github.com/elder-plinius/MythGen) | Smaller proof-of-concept repos (OpenAI text + Stable Diffusion images, 6-panel breakdown). Useful as minimal reference implementations, not production-grade architecture examples. |

**Net implication**: even after switching to `storydiffusion` (section 2 above) for better underlying consistency, Comic Studio would still be missing layout intelligence and lettering/speech-bubble rendering — both real, separately-scoped gaps, not solved by a model swap alone. If "make Comic Studio actually look like a comic" becomes real work, scope it as: (1) model swap [cheap], (2) reference-sheet-first generation flow [medium], (3) panel layout variation [medium-large, needs either a layout-template system or a second Claude call that proposes panel shapes per beat], (4) speech-bubble/lettering rendering [a real new feature — likely an image-compositing step after generation, not something the generation model itself should be asked to draw, since AI-rendered in-image text is notoriously unreliable per the general "gibberish in-scene text" AI-slop tell from section 1 of the gap-analysis doc].

---

## 3. Higgsfield's own native tools — the "review, then animate" workflow already exists as a product

Researched Higgsfield's current (not GhostWriter's outdated assumption of) feature set directly:

- **Higgsfield Popcorn**: generates an 8-10 image consistent storyboard sequence using "character anchoring" (memorizes facial structure, clothing texture, posture from inputs) and explicit lighting continuity across frames. Critically: **the storyboard is editable and reviewable before being baked into video** — "you can adjust lighting, background, or composition... and the system will automatically re-render the changes while maintaining consistent characters and tone." Once approved, "the storyboard can be baked directly into video, using the approved frames as generation keyframes" — **the AI fills motion between compositions you've already approved, rather than inventing the scene from scratch.**
- **Higgsfield Shots**: described as turning one image into a full storyboard (next-gen storyboard generator).
- **Higgsfield Canvas**: a generation/editing surface — not deeply researched this pass, but its existence confirms Higgsfield itself has already built the "dedicated space" the product gap analysis calls for; GhostWriter doesn't need to invent this pattern from scratch.
- **Confirmed accessible via Segmind's PixelFlow** (Segmind's visual workflow builder): "PixelFlow connects Popcorn, identity tools, and video models into one pipeline you can reuse, share, and automate through APIs" — meaning this is reachable through the same provider relationship GhostWriter already has, not a separate platform integration.

**This is the single most directly relevant finding for the Phase C ("dedicated review space") problem in the Director/Editor doc**: Popcorn's "generate storyboard → human/AI approves or edits frames → bake approved frames into video" loop is *exactly* the missing review step, already built and shipping, not a from-scratch UI project. The actual remaining work is **API integration with Popcorn/PixelFlow specifically**, not designing a new review workflow from first principles.

---

## 4. Concrete, prioritized recommendations (supersedes Section 4 of the Director/Editor doc with model-specific specifics)

1. **Immediate, cheapest, highest-leverage**: add `reference_images` (the character portrait URLs already generated) to every Seedance 2.0 `generateTextVideo` call. This alone should measurably improve perceived character consistency in the trailer pipeline with no architecture change — just a missing field.
2. **Switch Comic Studio's generation model** from `generateSoulImage()` (called once per panel) to `storydiffusion` (called once per page, generating the whole consistent sequence together). This is a different function, not a parameter tweak — budget it as a real (if contained) change.
3. **Investigate `storydiffusion` for the production pipeline's shot images too**, not just Comic Studio — the same "generate the whole sequence together with shared attention" advantage applies to shot previews, which currently have the identical one-call-per-shot weakness.
3. **Restructure the production video step to one multi-shot Seedance call per scene** (`"Shot 1: ... Shot 2: ..."` syntax) instead of 6 independent `generate-video` calls — this is the change that would also solve the missing-assembly problem (no more 6 separate downloadable clips; one finished sequence comes back).
4. **Evaluate Higgsfield Popcorn/PixelFlow as the review-and-approve layer** described in Phase C of the Director/Editor doc, rather than building a bespoke review UI from scratch — confirm the exact API contract (not yet done; this doc found that it exists and is reachable, not its precise request/response shape) before committing engineering time to a custom alternative.
5. Each of 1-4 should be validated with a small real-money test (same discipline as the 2026-06-24/25 pipeline test) before being rolled out broadly — these are research-grounded hypotheses about model capability, not yet verified against this app's actual prompts/account.

## 5. Update 2026-07-04 — Popcorn/PixelFlow closed, storydiffusion pricing found

**Recommendation 4 (Popcorn/PixelFlow) is now closed as not viable**: `segmind.com/models/popcorn` and the Segmind docs both 404 — unlike `storydiffusion`/`soul`/`seedance`, Popcorn has no standalone documented API endpoint. It's a Higgsfield-app-side UI feature; PixelFlow is a visual builder where *you* chain Segmind's existing models together and export that chain as an API, not a pre-built contract to integrate against. Any review/approve layer (Phase C) has to be built on GhostWriter's own generation routes, not adopted from Popcorn.

**`storydiffusion`'s estimated price, found via a live Playwright fetch of `segmind.com/models/storydiffusion/pricing`** (the static page fetch that worked for the model's parameter schema didn't surface pricing — this needed a rendered-JS scrape): page shows **$0.0072/GPU-second** billing with an estimated **~118.44s** average runtime → naive math suggested ≈$0.85/call. **This estimate was wrong** — see the real validation call below; the $/GPU-second rate evidently doesn't map onto wall-clock inference time the way that arithmetic assumed.

## 6. Real validation call 2026-07-04 (`scripts/storydiffusion-validation-test.mjs`) — cost confirmed, one real quality problem found

Ran one real `/v2/storydiffusion` call: 2 panel descriptions, `comic_style: "Four Pannel"`, no ref image, against a $1.57 account balance. Inference took 106.75s (close to the page's ~118s estimate, confirming that part). The completed job's response included Segmind's own `metrics.cost` field directly — the authoritative number, not an estimate:

**Real measured cost: $0.0106 for the whole page** (about 1 cent) — not ≈$0.85. Compare to today's per-panel Soul approach: 6 × $0.29 = $1.74/page. **If this holds across real content (not just this one test), `storydiffusion` is roughly 2 orders of magnitude cheaper per page, not merely competitive.**

Two real problems surfaced from actually inspecting the output image (not just the API response):

1. **The model bakes visible caption text into every panel** — the exact prompt text appeared as an overlay caption box on both rendered panels, plus a "StoryDiffusion" watermark/logo — despite sending no `#` caption markup. `storydiffusion.ts`'s existing code comment said this was "the one thing the real validation call must confirm" — confirmed, and it's a real conflict with GhostWriter's separate lettering (B1) pipeline, which assumes clean art with no baked-in text. Needs either a suppression parameter (not yet found) or a decision to crop/mask the caption region, or to accept the model isn't a drop-in replacement as-is.
2. **`comic_description` must supply exactly as many lines as `comic_style` implies** (4 for "Four Pannel", 8 for "Classic Comic Style") — this test supplied only 2 lines for a 4-panel request, and the other 2 came back as generic "To be Continued" placeholder panels, wasted spend (though at ~$0.01/page total, "wasted" is still negligible).

Character consistency between the two real panels was solid (same face/coat/build across both). Verdict: the cost case is now extremely strong, but the caption-baking problem is a real blocker to resolve before this can replace the per-panel path, not a settled win yet.
