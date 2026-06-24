# Competitor research: Novel, Screenplay, YouTube, TikTok, Instagram, Podcast, Web Series

Follow-up to the comic/video research (`docs/2026-06-25-competitor-and-model-research-comic-video-quality.md`), extended to GhostWriter's other 8 text-output formats. Same goal: find concrete, named gaps against real competitor tools, not vague impressions. GhostWriter's core text-generation engine (Claude-based, format-aware system prompts, World Bible context injection) is already a genuinely strong foundation here — the gaps found are narrower and more specific than the comic/video findings, which were structural.

---

## Novel — competitive position is strong; two specific gaps

Researched against **Sudowrite** (Muse model, fiction-tuned) and **NovelAI** (Kayra/Erato models, Lorebook).

**Where GhostWriter is already at parity or ahead:** Sudowrite's "Story Bible" and NovelAI's "Lorebook" are both essentially GhostWriter's World Bible (characters/locations/plot threads + context injection) — already built, and arguably deeper (NVC kinesics/proxemics profiles, voice fingerprinting, promise ledger, scene blueprint). Sudowrite's "Describe"/"Expand" sentence tools map directly onto GhostWriter's existing prose sub-operations (expand/tighten/show-dont-tell/subtext).

**Real gaps found:**
1. **NovelAI's client-side encryption / zero-server-visibility privacy model** ("the tool that never reads your work" — manuscripts encrypted client-side, the company genuinely cannot see them) is a named differentiator for writers handling sensitive content. GhostWriter has no equivalent privacy claim or mechanism — content is plaintext server-side like virtually every other AI writing tool, but NovelAI is explicitly winning customers on *not* being like every other tool here.
2. **NovelAI's "minimal content filters" positioning** for horror/dark fiction/explicit romance is a direct contrast to GhostWriter's violation-pattern detection (`VIOLATION_PATTERNS` in `/api/ai/generate/route.ts`) — not a bug, a deliberate different product stance, but worth being aware it's actively used as a competitive wedge by at least one real competitor.

---

## Screenplay — strong on formatting; missing a whole competitor *category*

Researched against **Final Draft**, **Arc Studio Pro**, **WriterDuet**, and the **AI script coverage** tool category (Scriptation and others).

**Where GhostWriter is already at parity:** Industry-standard formatting (scene headings, character cues, dialogue spacing) is real and engine-driven (`getFormatRules("Screenplay")`, confirmed format-specific in `docs/gotchas.md`'s entry on the manuscript export route), not cosmetic.

**Real gap found:** **"AI script coverage" is a distinct, established competitor category GhostWriter has no equivalent for.** Script coverage tools evaluate a finished screenplay the way a professional studio reader would: logline strength, three-act structure adherence, character arc completeness, marketability/comp-title analysis, pass/consider/recommend verdict. GhostWriter's Story Health panel is prose-quality-focused (weakness detection, tension curve, theme tracking) — a different and complementary thing, but not the same as a studio-reader-style coverage report. Also noted: WriterDuet shows generated reference images/storyboards alongside the script "to react to" while writing — direct overlap with the already-documented Director/Editor gap, not a new finding, but confirms it's a real competitor pattern in the screenplay space specifically, not just video/comics.

---

## YouTube Long-form / Short, TikTok Script / Native, Instagram Reel — GhostWriter is already ahead on strategy, behind on follow-through

Researched against **TokScript**, **Memories.ai**, **PlayPlay**, **Kapwing**, **HyperWrite**, **Rephrasely**.

**Where GhostWriter is already ahead:** Most competitor tools in this category are single-purpose hook/script generators. GhostWriter already has a *more complete* creator-strategy stack than nearly all of them individually: `HookABPanel` (12-archetype hooks + A/B Gain/Avoid), `RetentionEditPanel` (4-mechanic watch-time framework), `ChannelAutopsyPanel` (analyzes an existing channel's "DNA"), `TrendAnglesPanel`/`TrendNichePanel`, `CreatorSEOPanel`, and `RepurposePanel` (7-platform atomization) — this is a genuinely broader toolkit than e.g. a single "TikTok script generator."

**Real gap found:** Several competitors (PlayPlay, Kapwing) bundle a **"built-in video builder"** — the script generator is step one of a pipeline that ends in an actual produced short-form video inside the same tool, not a text handoff to a separate editing app. This is the same Director/Editor production gap already documented for the narrative formats, just confirmed to apply to the creator/social formats too: GhostWriter writes an excellent script and stops there, with no path from "TikTok Native script" to "an actual TikTok-ready video" inside the app.

---

## Podcast Episode — script generation is solid; audio *production* is thin

Researched against **Wondercraft**, **Podcastle**, **Descript**.

**Where GhostWriter is already covered:** Format-aware script generation (`hasCohost`/`usesSegments` via `FORMAT_CONFIG`), and Audio Novel's TTS narration already works reliably (confirmed via the 2026-06-24/25 pipeline test).

**Real gaps found, specific and concrete:**
1. **Voice selection is thin.** GhostWriter's TTS uses exactly 6 stock OpenAI voices (`alloy`/`echo`/`fable`/`onyx`/`nova`/`shimmer`). Wondercraft offers 300+ voices across 30+ languages.
2. **No style/inflection cloning.** Wondercraft's "Parrot Mode" lets a user demonstrate a specific speaking inflection (even whispered) for the AI voice to imitate. GhostWriter has no equivalent — voice selection is a fixed enum, not a style-matching mechanism.
3. **No music, captions, or audio cleanup.** Competitors bundle background music, auto-captions, and AI audio enhancement as part of "podcast production." GhostWriter's Audio Novel produces narration only — a real, scoped difference between "generates a good script and reads it aloud" (what GhostWriter does well) and "produces a finished, publish-ready podcast episode" (what these competitors are positioned as doing).

---

## Web Series — a real, newer competitor niche GhostWriter doesn't specifically target

Researched against general serialized-fiction tooling and **microdrama/vertical-video-series generators** specifically (a fast-growing 2026 category — mobile-first, vertically-shot, per-episode-paywalled drama series).

**Real gap found:** At least one named competitor tool ("Microdrama Screenwriter," via Jenova AI) builds **60-100 episode seasons with explicitly "paywall-aware cliffhanger" structure and pacing tuned for mobile-first serialized drama** — i.e., the episode-ending hook isn't generic, it's structurally engineered around the specific business model (cliffhanger right before a paywall). GhostWriter's Web Series format exists (chapterLabel "Episode," platform-aware export to Wattpad/Royal Road/Substack via the episode-pack export route) but has no equivalent *structural* awareness of paywall/cliffhanger-driven pacing as a deliberate, named pattern — it currently treats a Web Series episode as a generically-labeled chapter rather than a unit with its own engineered ending mechanics. This is a narrower, more specific gap than it sounds: it's a system-prompt/format-rules addition (similar in scope to the existing per-format `FORMAT_RULES`), not new infrastructure.

---

## Summary: where GhostWriter's real competitive gap actually is

Across all 9 formats, the pattern is consistent and matches the comic/video findings: **GhostWriter's text/strategy layer is already strong-to-best-in-class** (World Bible depth, the 26-mode library, creator-tool breadth, format-aware system prompts) — **the gaps are almost all in production/finishing**, not in writing:
- No studio-reader-style coverage verdict for Screenplay
- No actual video assembly for the creator/social formats, despite excellent script-and-strategy tooling
- No audio production layer (voices/music/captions) beyond narration for Podcast/Audio Novel
- No paywall-cliffhanger structural awareness for Web Series specifically
- A privacy/content-policy positioning gap for Novel, which is a product-stance question rather than a feature gap

This reinforces the same conclusion as the Director/Editor doc from a different angle: GhostWriter is a genuinely strong **writer**; almost every researched gap across all 9 formats, not just comics/video, is downstream of having no **production/finishing** layer after the writing is done.
