# 2026-07-05: Novel/Screenplay real-content format test — findings

Real-content run against the disposable `ghostwriter-test-runner@example.com` account (all_access tier): same premise (a forensic accountant discovers her future brother-in-law's shell-company fraud, three days before the wedding), generated as both a Novel and a Screenplay project — outline, 3 chapters each, Director tools (villain-pov, tension-curve), and an Editor refine pass. Driver: `scripts/novel-screenplay-test.mjs`. Raw output for every call is saved under `outputtestresults/novel-screenplay-test/` (gitignored — real-content test artifacts stay local only, per this repo's convention).

**Important caveat on methodology**: this test called `/api/ai/generate` directly with `context: ""` and only the previous chapter's raw text tail as continuation context — it did **not** replicate the real `context-builder.ts` pipeline (character sheets, story memories, established facts) that the actual WritingRoom UI always assembles before every generate call. Some findings below are about underlying model behavior *when context is weak*, not confirmed defects in the shipped product used normally. This is called out per-finding.

## 1. Format-following: excellent, no caveats

Both formats correctly followed their structural rules across all 3 chapters, with zero drift on this axis:
- **Novel**: proper prose paragraphs, close third-person, no screenplay markup anywhere. Genuinely well-written — specific sensory detail, show-don't-tell, no AI-slop clichés.
- **Screenplay**: `FADE IN:`, `INT./EXT. — DAY/NIGHT` scene headings, centered ALL-CAPS character cues, parentheticals, `CUT TO:`/`INTERCUT WITH:` transitions — all correctly and consistently produced. This directly validates the DOCX-export format-awareness work from an earlier session (`engine.ts`'s `STORY_FORMAT_RULES`).

## 2. Confirmed, reproducible bug: `refine` (Editor critic pass) truncates to a near-verbatim fragment

**This is the most concrete finding, confirmed 2/2 (both formats).** `refinePassage()`'s system prompt requires "Keep length within ~10% of the original" and "Return ONLY the revised prose." Actual behavior:

| | Original | Refine output | Ratio |
|---|---|---|---|
| Novel ch.1 | 6,952 chars | 3,083 chars | 44% |
| Screenplay ch.1 | 4,854 chars | 810 chars | **17%** |

Both outputs are near-verbatim copies of the *opening* of the original (trivial word-level edits like "rise like fortifications on" → "wall in"), then **stop mid-sentence** partway through — the Screenplay one cuts off mid-dialogue at `ARJUN\nRounding`. Neither is a coherent "revised, tightened passage"; both read as an aborted copy.

**A specific numeric anomaly worth flagging for engineering, not just prompt-tuning**: `tokensUsed` (input+output combined, per `refinePassage`'s own return value) was 7,037 for the Novel call and 6,746 for the Screenplay call. Given the ~1,000–1,200 input tokens for a 5–7k character passage plus a few hundred tokens of system prompt, that implies **~5,000+ output tokens were actually generated** — yet only 810–3,083 *characters* (~150–600 tokens) came back as text. That's roughly a 10x gap between tokens billed and text received. This doesn't look like ordinary prompt-non-adherence; it looks like either (a) the model generated substantially more than what `refinePassage` returned and something is being dropped in extraction, or (b) a genuine stop/truncation happening earlier than the visible text suggests. **Recommend an engineer check the raw Anthropic API response (`stop_reason`, full `content` array) on a fresh `refine` call before assuming this is purely a prompt problem** — the token/character mismatch suggests there may be more going on than the model just "not following the length instruction."

## 3. Character-identity drift on continuation (Novel only, likely a test-harness artifact, not a confirmed product bug)

Novel chapter 1 establishes the protagonist as **Priya**. Chapter 2 — generated from a prompt containing only the raw tail of chapter 1's text, no explicit character sheet — opens with an entirely different protagonist named **Neha**, and even introduces a minor character named "Priya Andrade" (reusing the original protagonist's first name for someone else). Chapter 3 continues consistently as Neha; the drift never self-corrected.

**The Screenplay track, using the identical harness and prompting strategy, showed zero drift across all 3 chapters** — same protagonist (Priya), same supporting cast (Vikram, Anjali), tightly escalating plot. One minor, much smaller inconsistency: a document in chapter 3 is addressed to "P. Mehta," not matching "Priya Nair" from chapter 1 — a small continuity slip, not a full identity swap.

Given the identical (weak) harness produced good continuity in one format and a full identity swap in the other, this is either genuine model stochasticity (one bad sample, would need more runs to confirm as systematic) or a real sensitivity to how much anchoring text survives in the passed-in tail. **Cannot be called a confirmed production bug** — real usage always runs `buildStaticContext`/`buildDynamicContext` first, which explicitly lists character names and established facts (exactly the "STORY MEMORY" system this app already has, whose `charactersPresent` extraction exists specifically to catch this class of drift downstream). What this *does* validate: character-identity continuity is genuinely fragile without that context assembly — not a reason for alarm about the shipped product, but a concrete illustration of why `context-builder.ts`'s character-list inclusion is load-bearing, not decorative.

## 4. Director tools: working correctly

- **`villain-pov`**: genuinely strong output — internally coherent antagonist logic (councilman believes his shell companies funded real public infrastructure, doesn't see himself as corrupt), no mustache-twirling, matches the system prompt's rules precisely. Cut off mid-sentence at the 2,000 max-token limit — not a bug, just the existing token budget for that route.
- **`tension-curve`**: correctly scored all 3 chapters per format. Notably, for the Novel track it accurately reported "Neha" in its notes for chapters 2–3 — i.e., the tool faithfully reflected what was actually on the page, which is the *correct* behavior; it isn't tension-curve's job to notice the identity drift (that's a continuity-check concern, closer to `graph-health.ts`'s territory).

## Summary

| Item | Verdict |
|---|---|
| Novel prose quality | Strong |
| Screenplay format correctness | Strong, fully consistent |
| villain-pov | Strong |
| tension-curve | Correct |
| refine (Editor) | **Confirmed bug** — truncates to ~17–44% of original, near-verbatim, cuts off mid-sentence; token/character mismatch needs an engineer to check the raw API response |
| Character continuity across chapters | Fragile without full context (expected, given the deliberately minimal test harness) — not a confirmed product bug, but illustrates why context-builder.ts's character data matters |

## Suggested follow-up

The `refine` truncation bug is the one item here worth a dedicated fix pass: inspect the raw Anthropic response on a fresh call (`stop_reason`, full `content` array) before changing anything in `refinePassage()` or its system prompt, since the token/character mismatch suggests the root cause may not be prompt-adherence at all.
