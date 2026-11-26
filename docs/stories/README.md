# Generated stories

All stories in this folder were written through the Ghostwriter local host
(OpenCode Go / `deepseek-v4.1-flash`) by the plan → write → revise → Story Doctor
loop, one unit (chapter, scene, or episode) at a time, with continuity notes posted
per unit.

| Story | Words | Units | Structure | Genres | Doctor at generation |
|---|---|---|---|---|---|
| [The Salt Orchard](./the-salt-orchard.md) | 8,052 | 8 | linear | literary fantasy | 2× unresolved-promise |
| [The Cartographer of Small Hours](./the-cartographer-of-small-hours.md) | 8,446 | 8 | linear | urban quiet fantasy, mystery | 2× unresolved-promise |
| [The Signal Year](./the-signal-year.md) | 26,073 | 30 | linear | sci-fi mystery | clean |
| [The Three Tides](./the-three-tides.md) | 12,780 | 12 | NON-LINEAR (three interleaved timelines) | literary mystery + slow-burn romance + folk horror | clean |
| [The Blue Hour](./the-blue-hour.md) | 4,520 | 5 | linear | hardboiled noir + slow-burn romance | clean |
| [The Late Show](./the-late-show.md) | 4,562 | 5 | linear | horror + comedy | clean |
| [Signal Debt](./signal-debt.md) | 4,760 | 5 | linear | science fiction + mystery | clean |
| [The Glass Orchard](./the-glass-orchard.md) | 3,704 | 5 | linear | quiet sci-fi mystery + romance | clean |
| [Last Train to Alentejo](./last-train-to-alentejo.md) | 3,643 | 5 | linear | noir romance | clean |
| [The Ward](./the-ward.md) | 5,381 | 5 | linear | horror mystery | clean |
| [Signal Fires](./signal-fires.md) | 4,952 | 5 | linear | sci-fi thriller | clean |
| [The Quiet Room](./the-quiet-room.md) | 4,498 | 5 | linear | quiet sci-fi + horror | clean |
| [Low Tide Message](./low-tide-message.md) | 6,459 | 5 | linear | sci-fi + coming-of-age mystery | clean |

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
- **The Glass Orchard** — first Screenplay run: five scenes, quiet sci-fi mystery + romance;
  tested scene-level format adherence (a slug line opens every scene, action-only description,
  character-cued dialogue, no prose narration or interiority) and a restrained domestic
  register. 5/5 scenes opened on `INT.`/`EXT.` slug lines, 119 character cues, no chapter
  labels; Doctor clean.
- **Last Train to Alentejo** — Screenplay, noir romance; a two-hander on a night train,
  testing sustained noir register and a secret that changes hands. 6 slug lines across
  5 scenes (one scene changes location mid-scene), 121 character cues; Doctor clean.
- **The Ward** — Web Series, horror mystery; tested cold-open → act → cliffhanger episode
  construction and dread built from hospital routine and bureaucratic wrongness. 5/5 cold
  opens, 13 act labels (ACT ONE/TWO in every episode, ACT THREE in three), all five episodes
  end on a turn. Exposed a real loop defect: the revise pass returned mid-sentence
  completions on three episodes and the old 50%-length guard accepted them; the three
  endings were repaired by targeted continuation, and the loop now rejects truncated
  writes, revisions, and doctor fixes.
- **Signal Fires** — Web Series, sci-fi thriller; tested a ticking-clock ensemble,
  procedural radio detail, and escalating act breaks. 5/5 cold opens, 15 act labels (all
  three acts in every episode), every episode ends on a cliffhanger line; Doctor clean.
- **The Quiet Room** — third Screenplay, quiet sci-fi + horror; tested sound-design-led
  dread (a silence booth that records last words) and a three-hander where the client
  knows the rules. 5/5 scenes open on an `INT.`/`EXT.` slug line (8 slug lines total —
  scene 1 moves reception → control room → booth), 157 character cues, no chapter or
  scene labels, no `BEAT:` leakage; the booth's rule ("a tape is played only in the
  absence of the living it names") is planted in scene 2 and paid off in scene 5.
  Doctor clean on the first pass; the repair script changed nothing.
- **Low Tide Message** — third Web Series, sci-fi + coming-of-age mystery; tested a
  cold-open hook, a fair-play rule (every text is 31 hours ahead of the tide it
  describes), and a mother-daughter secret. 5/5 cold opens, 15 act labels (all three
  acts in every episode), every episode ends on a turn; no chapter/episode labels or
  `BEAT:` leakage, though episode 1 alone carries a literal `CLIFFHANGER` label. Two
  guard catches during the run (one truncated revision kept the complete draft, one
  truncated write retried) — the truncation guards worked. Real defect the Doctor
  missed: the finale re-runs the previous episode's slip beat almost verbatim (~120
  words) before its new ending, a continuation-anchor echo the knowledge-conflict
  check does not detect; left as generated and recorded here.

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
| A truncated revision silently replaced a complete unit (The Ward) | write / revise / doctor-fix now require terminal punctuation; the three truncated endings were repaired by targeted continuation |

Doctor reports for the runs that recorded them are under `reports/`.
