# Universe feature test

Used "The Narrative Gaps" PDF (5 unconnected horror/sci-fi concepts) to test the Universe feature, since these are exactly the kind of standalone-but-secretly-connected anthology stories Universe is designed for (vs. Series Bible, which is for direct sequential continuations).

## Setup
- Created universe "The Narrative Gaps" with `sharedRules`: all stories are secretly the same intelligence ("the Quiet Editor") wearing different masks.
- Added canon event "The First Editing" at `timelineSort: 0`.
- Created 2 projects from the source concepts — "The Premium" (institutional supernaturalism) and "The Scent of Lavender" (olfactory horror) — both `storyType: universe-story`, linked via `universeId`, at `timelineSort: 1` and `2`.

## Real bug found and fixed
`buildSeriesUniverseContext()` in `/api/ai/generate/route.ts` never queried the `universes` table at all — it only ever read `universeEvents`/`universeCharacters`. This meant a universe's own `premise`/`tone`/`sharedRules` (the foundational world-building fields, settable via the API and shown in the UI) could **never** reach generation, regardless of setup. Separately, the whole context block was gated on `project.timelineSort != null`, so a universe's foundational rules wouldn't even apply to the very first story in it. Fixed: the premise/tone/sharedRules lookup now runs independently of `timelineSort`, mirroring the equivalent Series Bible pattern.

## Generation test
Generated prose in "The Premium" (`the-premium.md`) without mentioning the planted "Quiet Editor" detail in the prompt, to see if it would surface from injected context. Result: thematically on-target (an algorithm denial pushed by "SYSTEM" with no human author at 2:14am) but no literal citation of the planted term — same ambiguity as the Series Bible test. This is most likely the model choosing not to over-literally cite background lore in a short 2-paragraph excerpt rather than a sign the fix didn't work; confirmed the fix is correct by direct code inspection instead of chasing a more leading prompt with more paid calls.
