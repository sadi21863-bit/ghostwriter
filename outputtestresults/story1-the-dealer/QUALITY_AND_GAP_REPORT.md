# Story 1 "The Dealer" — Quality & Gap Report

## What was generated
- 1 trailer-length prose sequence (6 beats, 411 words) — `claude-sonnet-4-6`, 1819 tokens
- 1 production package (2 characters, 2 locations, 6 shots) via Claude
- 2 character portraits (The Dealer, Kessler) — Segmind `higgsfield-text2image-soul`
- 6 shot preview images, each using the matching character's portrait as a consistency reference
- 6 video clips (one per shot) — Segmind `seedance-2.0`, image-unaware (text-to-video, not image-to-video)

## Spend ceiling compliance
- Images: 8 generated (2 portraits + 6 previews) — exactly at the ~8/story ceiling. 1 wasted portrait generation occurred before the binary-response bug was caught and fixed (Segmind charged for it; the bytes were discarded since the code crashed before saving). All subsequent images succeeded on the first attempt post-fix.
- Videos: 6 generated, 1 per shot, at the cheapest viable tier reachable (`dop-lite` was attempted first per spend-ceiling intent but blocked by a 404 endpoint-slug bug; switched to Seedance 2.0 per your explicit direction). No more than 1 failed attempt per shot once the slug fix landed.
- First image and first video were both inspected before bulk-generating the rest, per the run-guide's discipline.

## Quality observations (from visual inspection of stills; videos confirmed valid MP4 but not frame-inspected)
- **Character consistency**: strong. The Dealer's grey hair, weathered face, and dark duster carry consistently across all 6 shots once the portrait-reference bug was fixed. Kessler's bulk/scarring is consistent in his one shot.
- **Card rank precision**: the script calls for a Jack of Spades as the calling card; shot 5's generated image shows an Ace of Spades instead. Minor — AI image models are unreliable at rendering exact card text/rank, expected limitation, not a pipeline bug.
- **Shot 4 ("ACTION — card streaks through the air")**: rendered as a static glowing-card handoff rather than implied motion-blur trajectory. The "dynamic" framing from the prompt didn't fully land in a single still; the corresponding video clip may read better since it has motion, but wasn't frame-inspected to confirm.
- **Shot 2**: shows what reads as a slung rifle/SMG rather than the scripted "holstered revolver he never draws" — a deviation from the specific weapon described, likely the image model defaulting to a more generic tough-guy silhouette prop.
- **Atmosphere/location fidelity**: very strong — the "abandoned Detroit-style car factory," amber dusk lighting, and Gothic-Americana mood from the research doc came through clearly and consistently across shots.

## Real bugs found and fixed during this test (see `src/lib/higgsfield/client.ts`, `models.ts`, and 3 route files)
1. `generateSoulImage` crashed on every call — Segmind's image endpoint returns raw binary, not JSON.
2. Character-consistency reference was broken — portrait URLs were sent to a UUID-only field instead of the correct image-URL field.
3. `generate-package` never created World Bible character/location rows from its own output, so a fresh project's shots had nothing to link to for consistency.
4. `generateDoPVideo`/`generateTextVideo`/`generateLipsync` all assumed an async job response; Segmind's actual v1 endpoints return finished media synchronously as raw binary.
5. 4 of 6 video model endpoint slugs were fictional (`higgsfield-{model}-text2video` doesn't exist on Segmind) — corrected against Segmind's real docs (`kling-text2video`, `seedance-2.0`, `veo-3.1-fast`, `hailuo-02-fast`).
6. Flagged but not fixed: Higgsfield-native Soul ID training (`trainSoulId`/`pollSoulIdTraining`) uses an auth header format and endpoint shape that doesn't match current Higgsfield docs — unverified without real credentials, out of scope for this test (not used by the trailer pipeline).

## Not verified
- `dop-lite`/`dop-turbo` image-to-video path (the one that uses the actual shot preview image as a video starting frame) — confirmed it generates real video once parsing was fixed, but we switched to Seedance (text-to-video) for the bulk run per your direction, so the image-to-video path's *output quality* for this story wasn't evaluated end-to-end.
- Video clip content itself (motion quality, whether action reads correctly, audio if any) — only verified as valid, non-empty MP4 files, not frame-by-frame.
