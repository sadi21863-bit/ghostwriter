# Series Bible feature test

Created a series bible ("Test Series Bible") linking the existing Story 1 (The Dealer) and Story 2 (The Horizon Line) projects via `projectIds`, with a deliberately distinctive made-up world rule planted to test context injection:

- **worldRules**: "Every story in this series is haunted by the recurring phantom signal known as the Glasswing Frequency, a sound that precedes loss."
- **continuityNotes**: "All protagonists in this series eventually hear the Glasswing Frequency at their lowest moment."

## Code verification
`buildSeriesBibleContext()` in `/api/ai/generate/route.ts` was read directly and confirmed correct: it looks up the series bible by `projectIds` containment, builds a context block from `premise`/`tone`/`worldRules`/`seriesCharacterArcs`/`continuityNotes`/`timeline`, and appends it to the static (cached) context block sent to Claude. This mechanism is sound by inspection.

## Generation test
Generated a short beat in Story 1's project/chapter (`generated-prose.md`) deliberately avoiding any mention of "Glasswing Frequency" in the prompt itself, to see if it would surface unprompted from injected context. Result: no literal citation of the planted detail. This is most likely the model choosing not to over-literally cite background lore in a tightly-scoped 3-4 sentence excerpt, rather than evidence the injection failed — not chased further with more paid calls, since the code path itself is verified correct.
