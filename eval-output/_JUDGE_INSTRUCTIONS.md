# Judge Instructions — Quality Stack Eval (Phase 3)

You are judging BLIND A/B scene pairs. Do NOT open _KEY.md until you have recorded a verdict for
every scene below in BOTH orderings.

## Rubric (craft, NOT length)

For each pair, judge A vs B on:
- Specificity / concreteness (not generic)
- Character voice distinctiveness
- Specific (not generic) sensory grounding
- Scene movement — is there a real turn / change, not just description?
- Absence of cliché / filler / AI-tells (vague emotion-naming, throat-clearing transitions,
  repetitive sentence rhythm, purple metaphors)

**Do NOT reward length or fluency for their own sake.** If the longer passage isn't better on
craft, prefer the shorter one.

## Both-orderings protocol (kills position bias)

Judge each pair TWICE: read A then B, record a verdict; then read B then A, record a verdict
again. A version only wins if it wins OR ties in BOTH readings. A flip between orderings counts
as a tie for that scene.

Verdict per scene per reading: "A better" / "B better" / "tie".

## Recording verdicts

For each scene (01-18), record:
- Reading 1 (A then B): verdict
- Reading 2 (B then A): verdict
- Final: A / B / tie (per the both-orderings rule above)

Only after all 18 scenes have a final verdict, open _KEY.md and map A/B back to
baseline/treatment. Count how many scenes treatment won, lost, or tied, and note whether any
treatment wins correlate with treatment simply being longer (check the word counts in _KEY.md) —
a length-driven win is NOT a craft win.

## Self-preference caveat

Both versions are Claude-written and (if Claude is the judge) the judge is also Claude — this
carries a self-preference bias a human judge wouldn't have. Treat results accordingly:
- CLEAR result (treatment wins ≥13/18, both orderings, not length-driven) → trustworthy →
  consider defaulting quality_stack ON.
- CLOSE result (e.g. 10/8, or length-driven wins) → treat as a WASH. Do not default-on a costly
  pipeline (the Haiku blueprint call) on a wash — consider defaulting on only the zero-cost
  subset (promise-ledger + rhythm) and leaving the blueprint optional until it earns its cost.
