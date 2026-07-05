# 2026-07-05: Novel/Screenplay real-content format test — findings

Real-content run against the disposable `ghostwriter-test-runner@example.com` account (all_access tier): same premise (a forensic accountant discovers her future brother-in-law's shell-company fraud, three days before the wedding), generated as both a Novel and a Screenplay project — outline, 3 chapters each, Director tools (villain-pov, tension-curve), and an Editor refine pass. Driver: `scripts/novel-screenplay-test.mjs`. Raw output for every call is saved under `outputtestresults/novel-screenplay-test/` (gitignored — real-content test artifacts stay local only, per this repo's convention).

**Important caveat on methodology**: this test called `/api/ai/generate` directly with `context: ""` and only the previous chapter's raw text tail as continuation context — it did **not** replicate the real `context-builder.ts` pipeline (character sheets, story memories, established facts) that the actual WritingRoom UI always assembles before every generate call. Some findings below are about underlying model behavior *when context is weak*, not confirmed defects in the shipped product used normally. This is called out per-finding.

## 1. Format-following: excellent, no caveats

Both formats correctly followed their structural rules across all 3 chapters, with zero drift on this axis:
- **Novel**: proper prose paragraphs, close third-person, no screenplay markup anywhere. Genuinely well-written — specific sensory detail, show-don't-tell, no AI-slop clichés.
- **Screenplay**: `FADE IN:`, `INT./EXT. — DAY/NIGHT` scene headings, centered ALL-CAPS character cues, parentheticals, `CUT TO:`/`INTERCUT WITH:` transitions — all correctly and consistently produced. This directly validates the DOCX-export format-awareness work from an earlier session (`engine.ts`'s `STORY_FORMAT_RULES`).

## 2. `refine` (Editor critic pass) truncated to a near-verbatim fragment — root cause found and fixed same day

**Confirmed 2/2 (both formats) at the time this was written.** `refinePassage()`'s system prompt requires "Keep length within ~10% of the original" and "Return ONLY the revised prose." Actual behavior at the time:

| | Original | Refine output | Ratio |
|---|---|---|---|
| Novel ch.1 | 6,952 chars | 3,083 chars | 44% |
| Screenplay ch.1 | 4,854 chars | 810 chars | **17%** |

Both outputs were near-verbatim copies of the *opening* of the original, then stopped mid-sentence — the Screenplay one cut off mid-dialogue at `ARJUN\nRounding`.

**Root cause, confirmed via a raw-response diagnostic (`msg.stop_reason`, full `content` array) rather than guessing**: Claude Sonnet 5 runs extended thinking by default, and thinking tokens count against the same `max_tokens` budget as the visible text (confirmed directly in the Anthropic SDK's own type definitions: *"counts towards your `max_tokens` limit"*). `refinePassage()` set `max_tokens: 4000` with no thinking configuration. With the real route's extra context (`extraContext`: a "BINDING VOICE CONSTRAINTS" numerical style block + a promise ledger) appended to the system prompt, the harder-to-reason-about task pushed thinking to consume the entire 4000-token budget on some calls, leaving **zero tokens for the actual text** — one live call returned `{"text":"","tokensUsed":6746}` outright. Bare system prompt with no extra context reliably produced full-length output in 3/3 direct SDK tests, isolating the trigger precisely to the extra-context path.

(One debugging wrinkle along the way, noted for the record: identical `tokensUsed` values kept appearing across supposedly-independent test runs, including after the fix was deployed — turned out to be a stale `next start` process from hours earlier still listening on port 3000, silently serving every request, because `pkill -f "next start"` doesn't reliably match on this Windows/git-bash setup. `taskkill //PID <pid> //F` was needed to actually kill it. Worth remembering for any future live-server verification on this machine.)

**Fix** (`src/lib/ai/engine.ts`, `refinePassage()`): set `thinking: { type: 'disabled' }` explicitly — this is a constrained, deterministic rewrite task (preserve everything, fix a fixed list of defects), not one that benefits from open-ended reasoning — and raised `max_tokens` from 4000 to 6000 as a safety margin. **Verified fixed**: 4/4 fresh live calls (2 Novel, 2 Screenplay) through the real `/api/ai/refine` route returned 100% of original length, with genuinely varying token counts per call (no more suspicious identical values). Full test suite (634/634) and `tsc` stayed green.

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
| refine (Editor) | **Bug found and fixed same day** — extended-thinking token budget exhaustion, root-caused via raw API response inspection; `thinking: disabled` + higher `max_tokens` fixed it, verified 4/4 |
| Character continuity across chapters | Fragile without full context (expected, given the deliberately minimal test harness) — not a confirmed product bug, but illustrates why context-builder.ts's character data matters |
