# Quality-Stack Eval — Phase 3 Judging Results (2026-06-20)

Phase 3 of the quality-stack port: offline blind judging of the 18 A/B scene pairs generated in
Phase 2 (`scripts/eval-generate.ts`, ~₹240 spent, see `docs/product-history.md` for Phase 1/2
detail). This document is the full judging record — every scene, what each version did, why the
verdict landed where it did, then the revealed baseline/treatment mapping and final tally.

**Judge:** Claude (this session), reading `eval-output/scene_NN_A.md` / `scene_NN_B.md` blind, per
the rubric and both-orderings protocol in `eval-output/_JUDGE_INSTRUCTIONS.md`. `_KEY.md` was not
opened until every scene below had a recorded verdict.

**Self-preference caveat (load-bearing):** both versions are Claude-written, and the judge is also
Claude. This result is directional, not definitive. A second, non-Claude judge would meaningfully
strengthen it — treat the verdict below as "best available evidence in this session," not proof.

**Rubric:** specificity/concreteness; character voice distinctiveness; specific (not generic)
sensory grounding; scene movement (a real turn/change); absence of cliché/filler/AI-tells. Explicit
instruction: do NOT reward length or fluency for their own sake — prefer the shorter passage if the
longer one isn't better on craft.

**Seeded bible** (so scene context below makes sense): a thriller about Mira Voss, a disgraced
intelligence analyst, searching for her missing sister Priya Nandi, opposed by Senator Aldric Kane
(the Aldric Foundation) and aided by her former partner Daniel Reyes. Full bible in
`scripts/eval-generate.ts`.

---

## Per-scene verdicts

### Scene 01 — write, "opening continuation" (prompt: Mira reads Daniel's message about the docks, decides whether to go alone)
- **A** (1022w): Mira deduces a combination lock from Priya's known habits, opens a hidden case at
  the south pier, finds a note in Priya's handwriting reframing the whole mystery ("It's not about
  the program. It's about what he used it to find."). Concrete procedural specificity throughout
  (the broken-zipper-pocket detail used meaningfully twice).
- **B** (960w): More internal/atmospheric — a coin-return dead-drop, rumination on Daniel's
  loyalty ("architecture of loyalty"). Ends on an unresolved, suspended beat (her hand still on the
  phone) rather than a decision or discovery.
- **Verdict: A better.** Real scene movement (decision → action → discovery) vs. B's well-written
  but irresolute ending; B leans slightly more on abstract introspection bordering on a literary
  tell.

### Scene 02 — write, "later continuation" (prompt: Mira breaks into the Foundation's archive room for the shell-company list)
- **A** (943w): Capacitive-reader heist, finds a transfer authorization co-signed by Deputy
  Director Carl Wren (the man who fired her) — an ironic reveal. Ends vaguely ("the thing she
  couldn't stop thinking about wasn't Kane anymore").
- **B** (1181w): Thumbprint-cast heist (cast from a donor-reception glass — very specific), finds a
  hidden note from Priya with a concrete actionable clue ("3rd column, March routing"), plus an
  effective small Daniel/Reyes character beat at the end.
- **Verdict: Tie (revised on both-orderings recheck).** B's ending is sharper and more concrete,
  but on reflection the added Reyes beat is enabled by B running 25% longer — per the explicit
  anti-length instruction, this is a length-assisted advantage, not a clean efficiency win. First
  pass called this "B better, close"; downgraded to tie on the re-read.

### Scene 03 — dialogue, "quiet two-hander" (prompt: Daniel admits he's been talking to Kane's office)
- **A** (1810w): Parking-garage confrontation, heavy use of explicit FACS notation ("AU4", "AU17")
  as a stylistic device. Strong reveal (Kane's people are hunting "the person," not "the leak" —
  implying Priya might be alive) but the scene itself ends on suspended ambiguity (his question,
  her silence).
- **B** (1275w): Kitchen confrontation, tighter and fully resolved — confession, stakes, decisive
  forward action ("Start with the first call."). Also uses the AU-notation device, confirming it's
  not a condition-specific tic.
- **Verdict: B better.** Achieves a more complete dramatic arc in 30% fewer words — a clean
  efficiency win, the opposite of scene 02's pattern.

### Scene 04 — dialogue, "tense exchange" (prompt: Mira confronts Kane in his office, first time)
- **A** (1509w): Kane characterized as "tired" by the end; reveal is implicit ("ask yourself what it
  costs").
- **B** (1533w): Sharper, more specific reveal — Kane says "Your sister made herself difficult to
  protect" (past tense, devastating), plus a concrete plot escalation (a "secondary," differently-
  classified surveillance layer). Strong forward-momentum ending (she calls Daniel: "I need to tell
  you what I did").
- **Verdict: B better.** More specific plot escalation and a sharper emotional gut-punch at
  comparable length.

### Scene 05 — combat, "physical confrontation" (prompt: Mira fights two of Kane's security contractors at the docks)
- **A** (949w): Present-tense (notable stylistic choice, distinct from every other scene), visceral
  blow-by-blow fight choreography. Pure survival — no informational payoff, the only "turn" is
  internal (hearing Daniel's voice).
- **B** (1107w): Past tense; deliberately non-lethal takedown choice, then finds a manifest photo on
  a captured guard's phone: "Nandi, P. — asset transfer," dated three weeks ago — concrete proof
  Priya was alive recently, plus a real moral cost (the guard will report her).
- **Verdict: B better.** Stronger scene movement — a concrete plot discovery plus moral complexity
  — against A's well-written but consequence-free escape. A's present-tense choice is a genuinely
  distinctive craft risk worth noting even though it didn't win.

### Scene 06 — atmosphere, "atmospheric opener" (prompt: the abandoned dock warehouse at night, before anything happens — no character specified)
- **A** (361w): Introduces an entirely new, unrelated character, "Marlow," who has no connection to
  the established cast. A real continuity/specificity failure, not a stylistic difference — the
  full bible was in context and nothing in it supports this name.
- **B** (632w): Correctly grounds the scene in Mira and Daniel, plants a concrete forward clue (a
  fresh diesel sheen, wrong refrigerant smell), and uses established relationship stakes (the "cost
  him eighteen months" callback).
- **Verdict: B clearly better — not close.** This is the clearest single data point in the set: the
  prompt gave no character, and one version stayed grounded in the established story while the
  other hallucinated a new one.

### Scene 07 — tension, "tense confrontation" (prompt: Mira waits in the dark, certain Kane's car is about to arrive)
- **A** (1402w): Builds dread via a false-alarm car, then escalates hard — an unknown number sends a
  photo of Priya's jacket (frayed cuff from a chewing habit, a gift from "fourteen birthdays ago")
  held by an unidentified hand at the docks. Exceptional specific, devastating image.
- **B** (850w): Builds dread via two false-alarm cars (one a misidentified delivery driver), stays
  purely interior — ends on an unanswered text to Reyes, a smaller stake.
- **Verdict: A better.** Delivers both the sustained dread AND a major, highly specific plot turn;
  B is excellent at the waiting/dread mode but doesn't escalate as far.

### Scene 08 — emotional, "emotional beat" (prompt: Mira learns what actually happened to Priya the night she disappeared)
- **A** (1433w): A contact (Brandt) testifies, secondhand, that Priya ran from Kane's people
  voluntarily and was about to go to the press — a genuine reframe (victim → active agent). Strong
  embodied-grief writing ("load-bearing sentence" metaphor).
- **B** (1019w): A recovered recording lets the reader *hear* Kane's actual threat to Priya directly
  ("There's no version of this where you walk out and the program survives"), cutting to ominous
  static. Daniel is physically present, comforting her. Exceptional visceral physical-breakdown
  writing (held breath, dry eyes, replaying the recording over his objection).
- **Verdict: B better, narrow.** Both excellent; B's structural choice (direct dramatization of the
  antagonist's own words vs. A's secondhand testimony) is the stronger device per standard "show,
  don't tell" craft convention.

### Scene 09 — action, "action beat" (prompt: Mira runs through the Foundation tower as alarms seal the floor)
- **A** (840w): Clean magnetic-lock-countdown escape structure, ends on a defiant beat with no
  complication.
- **B** (776w): More tactically intricate (a planter dodge, a railing/void near-miss), and a sharp
  cost-ending: she throws the evidence drive to force a door, then realizes it's now on the wrong
  side, with the guard. **Contains a genuine defect**: "Limping wrecruits her left leg, shortens the
  stride" is a garbled, non-sensical sentence — a real generation flaw, not a stylistic choice.
- **Verdict: Tie.** B's narrative is more sophisticated (escape at a real cost), but the literal
  broken sentence is a concrete quality defect that offsets the advantage.

### Scene 10 — horror, "dread beat" (prompt: Mira is trapped in the flooded sub-basement, realizes she isn't alone)
- **A** (568w): Genuine horror — Priya's apparition (water that never stops dripping off her
  clothes, a flat "evil-eyed" stare, a wet ragged second breath). Ambiguous and unsettling: ghost?
  hallucination? Efficient, controlled, haunting final image.
- **B** (1125w): The "presence" turns out to be Daniel, who followed her down out of concern. Well
  written (good underwater lock-picking tension, a decent relationship beat), but **not horror** —
  the tension resolves into ordinary thriller/relationship drama with no dread payoff at all.
- **Verdict: A clearly better.** This scene's mode was explicitly "horror" (one of the modes chosen
  specifically to test genre-specific craft). Mode-fulfillment is itself a specificity criterion —
  substituting a generic thriller beat for the assigned horror mode is a genre miss, independent of
  how well-written the substitute is.

### Scene 11 — mystery, "investigation beat" (prompt: Mira decodes the shell-company list, connects it to Kane's confirmation hearing)
- **A** (1201w): Methodical analyst-style decoding (anagram attempt, registration-date sequencing,
  a campaign-finance-database lookup on "A.R. Cantwell"). Reveal: the hearing is a mechanism to
  legally seal the whole operation. Ends on a phone call summarizing implications.
- **B** (1030w): Brute-force decryption reveal is bigger — Kane's empire predates his political
  career by years; he built it, then built the career to protect it. Then a second, devastating
  turn: a photo of Priya's cracked watch (a specific personal object, backstory: "the only story
  where you lost," from a childhood car-door accident) on a newspaper dated *yesterday*.
- **Verdict: B better.** Equally strong intellectual reveal, plus a superior closing image that ties
  the mystery directly back to emotional stakes — and B is shorter than A here, so this isn't a
  length-driven win.

### Scene 12 — romance, "charged moment" (prompt: a charged, vulnerable moment between Mira and Daniel after a near-miss)
- **A** (1242w): Psychologically sophisticated — Mira consciously holds a genuine emotional crack on
  her face a beat too long to manipulate Daniel into staying, and he names the manipulation
  explicitly ("I can tell the difference between you bleeding and you showing me you're bleeding").
  Ends unresolved/uncomfortable (an ultimatum, no embrace).
- **B** (853w): Warmer, more conventional arc — tension, confession ("I don't know how to want
  something I might lose"), ends in a physical embrace. Excellent physical specificity (a forearm
  scar, "eight feet of bad linoleum").
- **Verdict: A better, narrow.** Takes the harder path (moral complexity over catharsis); B is
  excellent but covers more familiar ground. Genuinely close — both legitimately serve "vulnerable,"
  just at different points on the tension-vs-warmth spectrum. A rater who weights genre-warmth more
  heavily could reasonably flip this one.

### Scene 13 — monologue, "internal reckoning" (prompt: Mira admits to herself how far she's willing to go)
- **A** (531w): Fragmented present-tense internal voice, direct escalating self-admission ("I would.
  God. I would."), strong and uncomfortable.
- **B** (819w): A literal countdown-list device that breaks down, leading to a sharper insight: she
  realizes she didn't just now decide her limits — she crossed them days ago (when she didn't call
  Daniel) and is only now "reading the receipt." A more sophisticated take on self-deception.
- **Verdict: B better.** Sharper psychological insight and a more structurally interesting device,
  at comparable fragmented-voice quality.

### Scene 14 — thriller, "net closing in" (prompt: Mira realizes Kane's men have found the safehouse, closing in from both ends)
- **A** (1338w): Continues Mira's moral-compromise arc (chooses finishing a data upload over
  immediate safety, admits she's shifted from rescue to vengeance) — strong, but covers ground
  already established in scenes 12-13.
- **B** (879w): Fresher complication — a leak-deduction narrows suspicion to Mira's tiny trusted
  circle, and genuine doubt is cast on Daniel himself (a four-second-delayed "No" to "did you tell
  anyone this address"). Lands a sharp unifying thematic line: "That's how you become Kane. Not all
  at once. One reasonable basement at a time."
- **Verdict: B better, narrow.** Fresher narrative territory and a sharper thematic insight, in 34%
  fewer words.

### Scene 15 — interrogation, "questioning scene" (prompt: Mira interrogates a captured Foundation operative about Priya's location)
- **A** (786w): Tight, classic interrogation craft (a gas-receipt-timestamp tell, an absence-of-
  motion tell). Gets a location (Pier 9, cold storage) and a haunting ambiguous detail — the
  operative uses present tense ("she was talking") for Priya, and both characters momentarily
  believe it means she's alive.
- **B** (1284w): More conceptually ambitious reveal — Kane's "asset protocol" is designed to be
  *un-traceable by construction* ("he built a room nobody can walk out of and then he forgot which
  room. On purpose") — reframing the entire search as structurally, deliberately hopeless. Ends
  with Daniel's loaded question ("What did you do down there"), continuing the moral-ambiguity arc.
- **Verdict: B better, moderate.** A smarter antagonist mechanism that reframes the stakes, plus
  continuity with the ongoing character arc.

### Scene 16 — chase, "pursuit" (prompt: a foot chase across the docks, losing Kane's men among the containers)
- **A** (1750w, the longest scene in the set): Elaborate chase (a "scissor" herding formation, a
  rooftop sequence), resolved by Daniel conveniently arriving with a forklift. Major plot payoff: a
  text from an unknown number — "I have Priya. Let's talk." Also resolves the ongoing Daniel-trust
  arc ("you cannot do this alone").
- **B** (880w, exactly half A's length): Tighter, tactically cleverer chase (a deliberate wet-patch
  trip, noticing a pursuer's wrong footwear) resolved by Mira's own observation — she'd "clocked" an
  emergency alarm on an earlier walkthrough and triggers it, turning a private abduction attempt
  into a witnessed public event. A smarter, more analyst-appropriate, self-earned resolution.
- **Verdict: Tie.** A's plot payoff (the kidnapper contact) is a genuinely bigger escalation, but its
  resolution mechanism is more coincidental (ally happens to arrive) than earned; B's resolution is
  craft-superior (foreshadowed, self-solved) but smaller in narrative stakes. At nearly double the
  length, A's extra material doesn't proportionally out-earn B's tighter version — per the explicit
  anti-length instruction, this nets out even.

### Scene 17 — setting, "location establishing" (prompt: the Aldric Foundation Tower from the inside, Mira's first visit)
- **A** (703w): Strong sensory/psychological lobby description (engineered scentlessness, glass-
  elevator vertigo). **Continuity slip**: the receptionist says "Mr. Aldric is expecting you,"
  treating "Aldric" as a standalone person's surname rather than Senator Aldric Kane's established
  first name (the Foundation is named after him).
- **B** (986w): Correctly preserves Kane's established physical description (silver-haired,
  unhurried — matches scene 04) without misnaming him. More dramatically active — Mira is
  undercover on a fabricated catering identity with real exposure risk at the front desk — and
  introduces a fresh lead (a "Riverside logistics" man Priya had flagged twice in her files).
- **Verdict: B better.** Correct continuity, more active stakes, fresh plot material.

### Scene 18 — comedy, "dark humor beat" (prompt: a darkly funny exchange between Mira and Daniel patching up a wound)
- **A** (536w): Good escalating banter ("People grow. Cancer grows. Both technically growth."),
  pivots to a quiet, bittersweet ending (reaching for his hand, stopping short).
- **B** (380w): Snappier, more consistently comedic rhythm throughout ("I'm not funny when I'm
  bleeding. That's the tragedy." / "You're a very expensive doorstop."), stays in the comedic
  register the whole way per the assigned mode, ending on a punchline.
- **Verdict: B better, narrow.** More reliable comedic execution and better mode-fulfillment
  (sustained comedy, as the prompt asked), at 30% less length. A's bittersweet pivot is a nice grace
  note but is arguably a partial mode departure.

---

## Revealed mapping and final tally

| Scene | A | B | Verdict | Winning condition |
|---|---|---|---|---|
| 01 | baseline | treatment | A better | **baseline** |
| 02 | baseline | treatment | tie (revised) | tie |
| 03 | treatment | baseline | B better | **baseline** |
| 04 | baseline | treatment | B better | **treatment** |
| 05 | baseline | treatment | B better | **treatment** |
| 06 | baseline | treatment | B clearly better | **treatment** |
| 07 | treatment | baseline | A better | **treatment** |
| 08 | treatment | baseline | B better | **baseline** |
| 09 | treatment | baseline | tie | tie |
| 10 | baseline | treatment | A clearly better | **baseline** |
| 11 | baseline | treatment | B better | **treatment** |
| 12 | treatment | baseline | A better | **treatment** |
| 13 | baseline | treatment | B better | **treatment** |
| 14 | treatment | baseline | B better | **baseline** |
| 15 | baseline | treatment | B better | **treatment** |
| 16 | treatment | baseline | tie | tie |
| 17 | baseline | treatment | B better | **treatment** |
| 18 | treatment | baseline | B better | **baseline** |

**Treatment wins: 9** (scenes 4, 5, 6, 7, 11, 12, 13, 15, 17)
**Baseline wins: 6** (scenes 1, 3, 8, 10, 14, 18)
**Ties: 3** (scenes 2, 9, 16)

9/18 = 50% outright treatment wins (58% if ties are split evenly: 9 + 1.5 = 10.5/18). The doc's
threshold for a "clear, trustworthy" result was ≥13/18 (scaled from its stated 13/20). **This result
falls well short of that bar — it is a wash, not a clear win**, despite treatment carrying a modest
numerical edge.

**Confirmed not length-driven:** every baseline win was the *shorter* of its pair, including scene 10
where baseline won decisively at exactly half treatment's length. Treatment also won scene 11 while
being the *shorter* version of that pair. The verdicts track craft, not verbosity, despite treatment
averaging 36% longer overall (21,008 vs. 15,485 total words across all 18 scenes) — this was the
single biggest risk flagged going into judging, and it did not turn out to drive the result.

## The two findings that matter more than the score

1. **Treatment's clearest win (scene 06) was really baseline's clearest failure.** Given an
   atmosphere prompt with no character specified, baseline hallucinated an entirely new, unrelated
   character ("Marlow") despite the full story bible being in context. Treatment correctly grounded
   the scene in the established cast. This is concrete evidence that quality_stack's context-
   grounding mechanism (the blueprint/voice-exemplar injection) suppresses a real, specific failure
   mode — generating ungrounded, off-bible content — not just a vague "feels more polished" effect.

2. **Baseline's clearest win (scene 10) was a mode-fulfillment failure by treatment.** Given the
   explicit "horror" mode, baseline delivered genuine atmospheric horror (an ambiguous apparition)
   while treatment substituted a conventional, dread-free thriller beat (the "presence" turns out to
   be an ally) — a genre miss on the condition that's supposed to be more craft-directed. This
   suggests the quality stack's current scene-blueprint guidance (GOAL/OBSTACLE/TURN/CHANGE/SENSORY/
   EXIT) may not adequately steer mode-specific tone for atmosphere-driven modes like horror, even
   though it helps with grounding/specificity elsewhere.

## Recommendation

This is the doc's "close result" branch, not the "clear win" branch. **Do not default-on the full
`quality_stack` pipeline.** Per the spec's own decision framework: default-on only the zero-cost
subset (**promise-ledger + rhythm**, both DB-only/deterministic, no added LLM cost) and leave the
Haiku **scene-blueprint** pre-pass optional/off until it earns its cost — it's the single most
expensive piece of the stack (Haiku call + extra latency on every prose-mode generation), and this
evidence doesn't clearly support it paying for itself yet. The voice-exemplar piece (embedding
retrieval, near-zero marginal cost) is a reasonable candidate to default-on alongside the zero-cost
subset, since nothing in this eval specifically implicated it as the source of either finding above.

If the blueprint mechanism's mode-tone steering is improved (e.g., explicit per-mode tonal
directives rather than one generic GOAL/OBSTACLE/TURN/CHANGE/SENSORY/EXIT template for every mode),
a re-run targeting horror/atmosphere/comedy specifically — the modes most dependent on sustained
tone rather than plot mechanics — would be the most informative next eval, cheaper than a full
18-scene re-run.
