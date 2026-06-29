# Generation-quality audit (2026-06-30)

Triggered by user feedback: "the story writer made the main character too old (40s–50s)" and "biomechanics, physics inconsistencies in the video and the panels." Audited the full text → image → video chain for quality issues.

## Fixed this pass (zero-spend, mock-tested; real-image validation pending budget)

1. **No negative prompts anywhere → anatomy/physics errors.** Image (`generateSoulImage`), Seedance video, and StoryDiffusion now send `negative_prompt = ANATOMY_NEGATIVE_PROMPT` (`src/lib/ai/image-quality.ts` — extra/fused fingers, extra limbs, bad hands, bad anatomy, impossible pose, distorted proportions, etc.). The comic panel prompt also gains a positive "anatomically correct, natural proportions, correct hands, physically plausible" directive. **This is the single biggest lever against the biomechanics/physics problem.**

2. **`enhance_prompt: true` hidden LLM rewriter (Soul image).** It silently rewrites the prompt — adding adjectives (often aging: "weathered/seasoned") and varying per call, hurting both age fidelity and cross-panel consistency. Now **off by default** on `generateSoulImage` (opt-in via `enhancePrompt`). (Seedance video keeps it for now — motion benefit; flagged below.)

3. **AI writer defaulted characters old.** `generateEntity` (engine.ts) gave the model zero age guidance, so it defaulted protagonists to middle-aged. Added an age nudge: pick an age fitting the premise/role, do NOT default to 40s–50s, put a concrete age in `age` and keep `appearance` consistent with it.

## Found but NOT fixed (need a real-image pass or more design — flagged)

4. **Face-only portrait used as the reference for full-body action panels.** The character reference (`portraitUrl`) is typically a head/face shot; full-body panels then have no body reference, so the model invents proportions → a *second* root cause of the biomechanics errors. Real fix: generate/store a full-body character reference (overlaps the "reference sheet" / Higgsfield Soul ID work) — needs Segmind/Higgsfield spend, so deferred. The negative prompt (fix 1) mitigates it meanwhile.

5. **Multi-character panels get only the first character's reference.** `getCharacterSoulReference` uses `spec.characters[0]` only, so a panel with two characters drifts/merges the second (same class of bug as the per-shot video fix from commit 71eff9e). Real fix: pass all named characters' references where the backend supports multiple refs (StoryDiffusion locks one; Soul ID per-character is the robust answer). Deferred to the reference/Soul-ID work.

6. **Seedance video still uses `enhance_prompt: true`.** Kept for now (motion quality), but it has the same drift risk as the image rewriter — worth A/B-ing with it off during the next real-money video pass.

## Cross-references
- Consistency strategies (per-panel / StoryDiffusion / Higgsfield Soul ID): `comic-consistency-strategies-2026-06-30.md`.
- Real cost finding (~$0.29/Segmind image): `outputtestresults/comic-validation/FINDINGS.md`.
- The "character reference sheet" gap maps to Higgsfield Soul-ID wiring (code exists, creds-gated).

## Note
The negative-prompt field names are standard for these models but only `generateSoulImage` (image) and the verified Seedance shape are confidently correct; whether Seedance/StoryDiffusion honor `negative_prompt` exactly as named should be confirmed in the next real-money validation pass (cheap to check).
