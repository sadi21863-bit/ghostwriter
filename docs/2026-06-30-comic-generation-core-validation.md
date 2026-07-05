# 2026-06-30: Comic generation-core validation — real Segmind

Capped real-money test of the zero-spend generation-core improvements (rich style presets + shared per-page seed) on the proven `generateSoulImage` path. One page of The Dealer scene, "noir" style. 5/6 panels generated (panel 5 hit a local timeout mid-gen; not retried, to conserve budget). Saved panels: `outputtestresults/comic-validation/panel-0..4-noir.png` (gitignored — real-content test artifacts stay local only).

## The headline finding: real cost is ~$0.29/panel, NOT ~$0.04

Segmind balance went **$2.95 → $1.50 after 5 panels = ~$0.29 per image** — about **7× the pre-test estimate**. The Soul/photoreal image model is far pricier than an SDXL-class assumption. Budget implications:
- A 6-panel page ≈ **$1.74**. A 5-page chapter ≈ **$8.70**.
- The deferred `storydiffusion` swap + character reference-sheet flow must be **cost-validated first** — at $0.29/image, ref sheets (3–6 imgs/char) and multi-page comics get expensive fast. (This directly motivated the follow-up `storydiffusion` real-money validation on 2026-07-04 — see `docs/2026-06-25-competitor-and-model-research-comic-video-quality.md` section 6 — which found `storydiffusion` costs ~$0.0106/page, roughly 2 orders of magnitude cheaper, but with an unresolved caption-baking problem.)
- This is exactly why real-money validation matters: the cheap-fix assumption was wrong by 7×.

## What the test validated (the zero-spend code works)

- **Rich style presets work strongly.** Every panel is distinctly noir — deep blacks, hard rim light, heavy shadow, inked/rendered noir vocabulary — not the old generic photoreal. The bare-label → concrete-modifiers change is a real, visible quality lift at zero added cost.
- **Character accuracy is high.** The Dealer (weathered late-40s, salt-and-pepper hair, brow scar, long duster, hip holster, fanned matte cards) and Kessler (massive, scar-ridged jaw/skull, wide genuine grin, work jacket, steel-toed boots) both match their World Bible descriptions closely.
- **The "blank bottom 15% for dialogue, no in-image text" rule is respected** — panels 2 and 3 leave clean white space at the bottom, ready for the separate B1 lettering stage. No garbled AI text appeared.

## The honest limitation: shared seed gives only partial consistency

Panels 0 and 2 (both The Dealer, adjacent seeds 424242/424244, same "noir" preset) render in **noticeably different sub-styles** — panel 0 is painterly/semi-3D-rendered; panels 2–3 are high-contrast inked B&W line art. So:
- The shared seed improves reproducibility but **does not lock cross-panel rendering style**. A page can still split into two visual "looks."
- This confirms the reason the heavier work was deferred: **true panel-to-panel consistency needs a sequence-aware model (`storydiffusion`) or a character reference-sheet pipeline**, not just a seed. The cheap fix raises quality and *partial* coherence; it doesn't solve consistency.

## Verdict

Ship the zero-spend improvements (done — they're a clear win). Treat the `storydiffusion`/reference-sheet overhaul as the real consistency fix, and validate its cost on 1–2 calls before committing given the ~$0.29/image reality — which is exactly what the 2026-07-04 follow-up test did.
