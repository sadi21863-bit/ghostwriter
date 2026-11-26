# The story loop

`scripts/story-loop.mts` writes a book one unit (chapter, scene, or episode) at
a time through the real local host, and checks each unit before moving on:

1. **Plan** — outline calls in chunks of 10, appended to an outline file.
2. **Write** — one `/ai/generate` call per unit, with the previous unit's tail
   as dynamic context.
3. **Revise** — one revision pass (disable with `GW_LOOP_REVISE=0`).
4. **Guard** — reject truncated completions; compress verbatim self-repeats.
5. **Extract + Doctor** — one continuity call per unit records knowledge shifts
   and promises opened/resolved; knowledge conflicts involving the new unit
   trigger up to two targeted fix revisions.

The loop is resumable: any unit that already has text is skipped, so a long
book can be built across many sessions. State lives in the host's SQLite db.

## Run it

```powershell
$env:GW_LOOP_TITLE = "The Quiet Room"
$env:GW_LOOP_PREMISE = "..."
$env:GW_LOOP_FORMAT = "Screenplay"
$env:GW_LOOP_CHAPTERS = "5"
$env:GW_LOOP_DB = "the-quiet-room.sqlite"
$env:GW_LOOP_PORT = "4196"
npm run story:loop
```

Validate without starting anything:

```powershell
npm run story:loop -- --check
```

`--check` (or `GW_LOOP_CHECK=1`) prints the resolved configuration as JSON and
exits 0. It does not read the API key, spawn the host, or touch a database.

## Configuration fails fast

`GW_LOOP_TITLE` and `GW_LOOP_PREMISE` are **required**. The temp harness this
replaced silently fell back to a default lighthouse premise when the env was
missing; one repair run then imported a cast member from that default. Here,
missing or malformed configuration prints every problem and exits **2** before
any host is spawned:

```
[loop] invalid configuration:
  - GW_LOOP_TITLE is required (the project / story title)
  - GW_LOOP_FORMAT must be one of Novel, Screenplay, Web Series (got "Podcast")
```

`GW_LOOP_CHARS` is optional, but an empty value prints a warning so a run with
no cast contract is visible rather than silent.

| Variable | Default | Meaning |
|---|---|---|
| `GW_LOOP_TITLE` | **required** | project / story title |
| `GW_LOOP_PREMISE` | **required** | story premise |
| `GW_LOOP_CHARS` | — | cast contract (warning when empty) |
| `GW_LOOP_FORMAT` | `Novel` | `Novel`, `Screenplay`, or `Web Series` |
| `GW_LOOP_ENGINE_FORMAT` | derived | `prose`, `Screenplay`, or `Web Series` |
| `GW_LOOP_STRUCTURE` | — | structure / style constraints |
| `GW_LOOP_CHAPTERS` | `10` | number of units, 1..500 |
| `GW_LOOP_REVISE` | `1` | revision pass on/off |
| `GW_LOOP_DB` | `loop.sqlite` | db filename under `%TEMP%\gw-loop` |
| `GW_LOOP_PORT` | `4183` | host port |
| `GW_LOOP_REFRESH` | `0` | wipe the db before starting |
| `GW_LOOP_ECHO_MAX` | `12` | repetition threshold, consecutive words |
| `GW_LOOP_ECHO_ALLOW` | — | deliberate refrains, `phrase\|phrase` |
| `GW_LOOP_NOTES` | `0` | extract/replace notes + run the Doctor, no writing |

The host is composed in the `opencode` lane with `deepseek-v4.1-flash`; the key
is read from `.env.local` and never printed.

## Guards

`src/lib/story/loop-guards.ts` holds the pure, unit-tested logic:

- **Truncation** (`looksTruncated`) — an empty completion or one not ending on
  terminal punctuation is rejected. Write attempts retry; a truncated revision
  is discarded in favour of the complete draft. This exists because The Ward's
  revise pass returned mid-sentence endings that a length-only guard accepted.
- **Self-repetition** (`worstRepeat` / `longestCommonWordRun`) — after each
  unit, the longest shared word run against **every other written unit** is
  measured. At `GW_LOOP_ECHO_MAX` or above, one compression pass rewrites the
  echo into a single reference; the rewrite is accepted only if the run drops
  below the threshold and the text still ends complete. Low Tide Message's
  finale shared 54 consecutive words with the episode before it.
- **Artifacts** (`scrubArtifacts`) — deterministic removal of chapter/scene/
  episode labels, `BEAT:` prefixes, and separator lines.
- **Plan cleanup** (`cleanBeat`, `splitUnitTitle`) — plan numbering and label
  prefixes never reach a title.

Comparing against every row (not just earlier rows) matters on resume: a unit
written in a previous pass can be echoed by an earlier index in the next one.
`GW_LOOP_ECHO_ALLOW` masks deliberate refrains before measuring.

## Continuity notes and the Doctor

After a unit is written, the loop makes one extraction call and stores the
result as the unit's `structuredData`:

- `knowledgeShifts` — a short concrete fact a named character learns on the
  page (with `from`/`to` state labels),
- `openPromisesCreated` / `openPromisesResolved` — concrete setups and their
  explicit or event-level payoffs,
- `keyEvents` — 1–3 short beats.

This is what the Story Doctor reads. Before this existed the loop posted only
`keyEvents`, so the Doctor's knowledge and promise checks ran on empty arrays
and a generated book passed clean without anything being checked.

`npm run story:loop -- --notes` (or `GW_LOOP_NOTES=1`) re-extracts notes for
finished units and replaces each unit's loop-written note, then runs the Doctor
once and writes `<slug>.doctor.json`. It never rewrites prose. Use it to upgrade
an existing book after extraction changes.

The Doctor's knowledge-conflict evidence is a repeated **content bigram** (for
example "brass key"), not two isolated topic words. The loose version flagged
any earlier scene that mentioned the character plus words like "ledger" or
"line"; the bigram version keeps the planted-defect test and removes those
false positives. A paraphrased conflict is deliberately not guessed.

An unresolved promise is a **review decision**, not an automatic defect: the
finale may pay it off implicitly (forgiving a whole debt column), or it may be
the one deliberate open thread. Read the Doctor's report before revising.

## Artifacts

Everything lands under `%TEMP%\gw-loop`:

- `host-<slug>-<port>.err` / `.out` — per-run host logs (the owner token is in
  stderr; do not paste logs into a transcript)
- `<slug>.outline.md` — the plan
- `<slug>.log.md` — per-unit word counts, timings, guard interventions
- `<slug>.md` — the assembled book
- `<slug>.doctor.json` — the final Doctor report

## Known limits

- The guard is a **verbatim word-run** detector, not a paraphrase detector.
  Reuse under the threshold passes.
- A deliberate refrain longer than the threshold is compressed unless listed in
  `GW_LOOP_ECHO_ALLOW` — there is no per-unit allowlist.
- If planning returns fewer beats than requested, missing units fall back to a
  generic beat and the run prints a warning; it does not invent a premise.
- Extraction is an LLM call and is not perfectly stable: re-running `--notes`
  can produce different candidate promises. The main loop extracts once, per
  unit, right after writing. Broad payoffs (forgiving every debt at once) may
  still be recorded as open; treat the report as a review prompt.
- Temp harness copies (`chapter-loop*.mts`) may still exist in `%TEMP%`; this
  script is the canonical, versioned loop.
