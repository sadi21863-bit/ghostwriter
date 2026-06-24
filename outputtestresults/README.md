# GhostWriter Pipeline Test — Output Index

Real-money test of the GhostWriter→Higgsfield/Segmind production pipeline, run 2026-06-24/25 against a disposable test account. Full incident report and bug list: `ghostwriter/docs/2026-06-24-segmind-higgsfield-pipeline-test.md`.

## Folders

| Folder | What's in it |
|---|---|
| `story1-the-dealer/` | Full trailer pipeline for "The Dealer" (Gothic-Americana action/noir): prose, 2 character portraits, 6 shot images, 6 video clips, Audio Novel narration, plus a quality/gap report and lipsync findings |
| `story2-the-horizon-line/` | Full trailer pipeline for "The Horizon Line" (psychological horror/sci-fi): same structure, 2 portraits + 6 images + 6 videos, plus a quality/gap report |
| `comic-studio-test/` | 6 comic panels generated from Story 1's chapter (noir art style) |
| `format-tests/` | Full text generated across all 9 project formats (Novel, Screenplay, Web Series, YouTube Long-form/Short, TikTok Script/Native, Instagram Reel, Podcast Episode) from the same prompt, for comparison |
| `series-bible-test/` | Series Bible (Book Series) context-injection test, linking Story 1 + Story 2 |
| `universe-test/` | Universe feature test, using "The Narrative Gaps" research material (5 unconnected horror/sci-fi concepts) — found and fixed a real bug here (universe's own world rules were never read by the context builder) |
| `test stories material/` | Source research PDFs provided for the test stories |

## Quick facts
- Both full-pipeline stories: 8/8 images, 6/6 videos, zero unresolved failures.
- Comic Studio: 6/6 panels, zero errors.
- Audio Novel TTS: works cleanly for any chapter length.
- Lipsync: correctly re-architected (single-step `hallo` model), but full-chapter-length audio (164s) hits a hard ceiling on Segmind's own infrastructure (their gateway times out) — see `story1-the-dealer/LIPSYNC_FINDINGS.md`.
- 10 real bugs found and fixed in the codebase during this test (see the incident report).
