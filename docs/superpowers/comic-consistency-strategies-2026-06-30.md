# Comic character-consistency — the three strategies (2026-06-30)

Real-money validation of the per-panel path (see `outputtestresults/comic-validation/FINDINGS.md`) confirmed the core problem: generating each panel independently gives **weak cross-panel consistency** (panels drift between painterly and inked sub-styles even with a shared seed + style preset), at **~$0.29/Segmind image**. Research into the fix surfaced three real strategies — and GhostWriter already has code touching all three.

## The three strategies

### 1. Per-panel + portrait reference (current default)
- `generateSoulImage` once per panel, passing the panel's first character's `portraitUrl` as `reference_image_url` (strength 0.85).
- **Consistency: weak.** Each call is independent; the model re-interprets the character + style every panel.
- **Cost: ~$0.29/panel** → 6-panel page ≈ $1.74 (validated).
- Status: live. Improved this session (zero-spend) with rich style modifiers + a shared page seed — raises quality + *partial* coherence, doesn't solve consistency.

### 2. Segmind StoryDiffusion (BUILT this session, opt-in, validatable)
- One `/v2/storydiffusion` call keeps ONE character consistent across a whole multi-line `comic_description` and returns a single **composed comic-strip page image** (`comic_style`: "Four Pannel" = 4 frames, "Classic Comic Style" = 8).
- **Consistency: strong within one strip**, single primary character. Sequence-aware (cross-batch attention) — the model the research called for.
- Code: `src/lib/comic-gen/storydiffusion.ts` (pure builders — verified contract, mock-tested) + `generateStoryDiffusion()` in the higgsfield client. Opt-in; the proven per-panel path is untouched.
- **Validatable with the user's Segmind balance.** Open questions for ONE real call: exact output shape (confirmed-likely a single composed page), whether it bakes captions/text into the image (we pass no `#` captions to avoid it), and real cost per call.
- Trade-off: less per-panel control (it composes the page itself, overlapping with our own layout/lettering stages); best for single-protagonist sequences.

### 3. Higgsfield Soul ID (STRONGEST, code exists, blocked on creds)
- Train a persistent character identity (`custom_reference_id`) once from reference images; it's then **locked across every generation** regardless of style/angle/prompt (Higgsfield's 2026 best-in-class consistency product, built for storyboards).
- GhostWriter ALREADY has `trainSoulId`/`pollSoulIdTraining` (Higgsfield-native `platform.higgsfield.ai`), and `generateSoulImage` already prefers a trained `custom_reference_id` (strength 0.95) over a portrait. `getCharacterSoulReference` in the comic route already uses a soulId if the character has one.
- **The gap:** nothing in the Comic / World-Bible flow actually *trains* a Soul ID, so characters fall back to the weak portrait ref. The real "character reference-sheet flow" the research wants = **wire Soul-ID training into the World Bible → Comic bridge** (train once per character → comic auto-uses the locked identity via the existing path).
- **Blocked:** `trainSoulId` is untested live — no Higgsfield credentials on the test account, and the Segmind proxy can't train Soul IDs. Cannot be real-money-validated until Higgsfield access exists.

## Recommendation / sequencing

1. **Ship the zero-spend per-panel improvements** (done — style presets + shared seed).
2. **Validate StoryDiffusion** with ONE real Segmind call (~$0.30) when the user wants: confirm output shape + no baked-in text + cost. If it returns a clean composed page cheaply, it becomes the default for single-protagonist comic pages (strong consistency + likely cheaper than 6×$0.29).
3. **Higgsfield Soul ID is the strongest long-term consistency fix** but needs Higgsfield credentials. When those exist: surface Soul-ID training in Comic Studio / World Bible, then the existing `custom_reference_id` path gives locked-identity panels for free on every subsequent generation. Multi-character scenes are best served by Soul ID (per-character locked identity), where StoryDiffusion only locks one.

The per-panel path keeps style presets; StoryDiffusion and Soul ID are the two real consistency upgrades — Segmind-validatable vs credentials-gated, respectively.
