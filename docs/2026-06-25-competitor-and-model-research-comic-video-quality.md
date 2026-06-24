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
