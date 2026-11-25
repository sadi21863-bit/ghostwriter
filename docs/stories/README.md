# Generated stories

All stories in this folder were written through the Ghostwriter local host
(OpenCode Go / `deepseek-v4.1-flash`) by the plan → write → revise → Story Doctor
loop, one chapter at a time, with continuity notes posted per chapter.

| Story | Words | Chapters | Structure | Genres | Doctor at generation |
|---|---|---|---|---|---|
| [The Salt Orchard](./the-salt-orchard.md) | 8,052 | 8 | linear | literary fantasy | 2× unresolved-promise |
| [The Cartographer of Small Hours](./the-cartographer-of-small-hours.md) | 8,446 | 8 | linear | urban quiet fantasy, mystery | 2× unresolved-promise |
| [The Signal Year](./the-signal-year.md) | 26,073 | 30 | linear | sci-fi mystery | clean |
| [The Three Tides](./the-three-tides.md) | 12,780 | 12 | NON-LINEAR (three interleaved timelines) | literary mystery + slow-burn romance + folk horror | clean |
| [The Blue Hour](./the-blue-hour.md) | 4,520 | 5 | linear | hardboiled noir + slow-burn romance | clean |
| [The Late Show](./the-late-show.md) | 4,562 | 5 | linear | horror + comedy | clean |
| [Signal Debt](./signal-debt.md) | 4,760 | 5 | linear | science fiction + mystery | clean |

## What each story tested

- **The Salt Orchard** — linear novel, the first end-to-end long-form run; exercised the
  series-bible-capable binder, chapter continuity, and the Doctor's knowledge-conflict and
  promise checks (one planted timeline contradiction in chapter 2, caught once the memory
  chapter placement was fixed).
- **The Cartographer of Small Hours** — linear novel, second run; confirmed repeatability.
- **The Signal Year** — 30-chapter novel through the scalable loop; proved the loop survives
  transient provider failures, short planning responses, and empty completions (all now
  retried), and that the craft contract (varied openings, dialogue floor, turn endings)
  holds across a long book.
- **The Three Tides** — NON-LINEAR novel: three interleaved timelines; tested timeline
  anchoring, genre mixing (literary mystery + slow-burn romance + folk horror), and the
  deterministic artifact scrub (chapter labels, separators).
- **The Blue Hour** — noir × romance; tested register holding (noir narration, warmer Ines
  scenes) and exposed plan-format title leakage + an em-dash separator variant, both now
  repaired deterministically.
- **The Late Show** — horror × comedy; tested joke-before-horror chapter construction and
  came through clean on the first pass.
- **Signal Debt** — science fiction × mystery; tested fair-play clue planting and a mundane,
  used-future texture; needed the same title repair as The Blue Hour (plan formats vary by
  run; the repair script handles it).

## Known weaknesses found by this matrix (and the fixes)

| Weakness | Fix in the loop/app |
|---|---|
| Transient provider failures aborted runs | retry on thrown errors and empty completions (4×, backoff) |
| Outline returned fewer beats than requested | chunked planning (10 at a time, appended) |
| Plan prefixes leaked into chapter titles | `cleanBeat()` + quoted-title extraction |
| Chapter labels / separators inside prose | deterministic `scrubArtifacts()` covering all dash variants |
| Silent host death at setup | per-run host logs + readiness gate |
| Every knowledge shift landed at chapter 0 | memory `chapterIndex`/`chapterId` passthrough fixed (app) |
| Unresolved promises reported as defects | reworded as a review decision (deliberate open thread vs. overlooked setup) |

Doctor reports for the runs that recorded them are under `reports/`.
