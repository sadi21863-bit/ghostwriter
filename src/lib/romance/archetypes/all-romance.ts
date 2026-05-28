// src/lib/romance/archetypes/all-romance.ts
import type { RomanceArchetype } from "../types";

export const FIRST_RECOGNITION: RomanceArchetype = {
  name: "First Recognition",
  theoreticalBasis: "Helen Fisher (2004): Stage 2 attraction begins with a specific moment of noticing — not physical attraction generally but the orienting response to one particular person. Dopamine and norepinephrine spike in response to novelty combined with perceived compatibility. The first recognition is not 'I find them attractive' — it is 'something is different about this one.'",
  coreDescription: "The first recognition scene is the moment Stage 2 attraction begins for one or both characters. It is not the first meeting — it is the first moment one character becomes specifically, involuntarily interesting to the other. The character cannot account for why. The body registers it before the mind catches up.",
  fisherStage: "attraction",
  neurochemistry: "Dopamine (novelty response + reward anticipation) + norepinephrine (hyperarousal, heightened attention, physical activation). The character is more alert in this person's presence without knowing why. Small details become significant. The person's voice, the specific way they move.",
  dopamineMechanic: "The dopamine spike requires uncertainty. The first recognition is not certainty of interest — it is the first possibility of interest. The character does not know yet if this matters. That not-knowing is the dopamine mechanism. The possibility activates the system more than certainty would.",
  structuralRequirement: "The recognition must be involuntary — the character notices before they decide to notice. At least one physical signal must appear before any cognitive processing. The character must almost dismiss it, then find themselves unable to.",
  physicalSignals: [
    "Orienting response: the character's attention orients toward the person before they consciously decide to look",
    "Heightened sensory acuity: specific details register with unusual clarity — the timbre of the voice, the way they hold a glass",
    "Disrupted automatic behavior: something the character was doing on autopilot becomes conscious",
    "The held moment: a beat too long looking, recovered with a social cover",
  ],
  forbiddenMoves: [
    "The character immediately knows they are attracted — the recognition must be ambiguous to them",
    "The physical description is a catalogue — inventory is not recognition",
    "The character decides to be interested — it must be involuntary",
    "The scene ends with certainty — the first recognition must leave the character unsettled, not resolved",
  ],
  failureModes: [
    "The character narrates their own attraction directly: 'I was attracted to them'",
    "The recognition is mutual and simultaneous and comfortable — real first recognitions are asymmetric and disorienting",
    "Physical description precedes the recognition — the recognition must be the moment, not the inventory",
    "The scene immediately establishes romantic narrative — the recognition is pre-conscious and the character should not yet know what it means",
  ],
  systemDirectives: [
    "The orienting response before the conscious decision — the character looks before they decide to",
    "One specific, non-generic detail that registers with unusual clarity",
    "Disrupted automatic behavior — something the character was doing without thinking becomes conscious",
    "The character almost dismisses it — and then doesn't",
    "End in unsettled ambiguity, not certainty",
  ],
  writingNotes: "The first recognition is most powerful when the character does not yet know what it is. They are aware that something shifted. They cannot account for why this person's specific laugh registered differently from everyone else's. The reader knows before the character does. That gap — the reader ahead of the character — is Stage 2 attraction beginning.",
};

export const SLOW_BURN: RomanceArchetype = {
  name: "Slow Burn",
  theoreticalBasis: "Dopamine uncertainty principle (Schultz et al., 1997): the dopamine system releases more strongly in response to uncertain reward than certain reward. Anticipation of possible reward activates the reward system more than certainty of reward. Applied to romance: the prolonged delay before resolution produces more neurochemical activation in the reader than early satisfaction. The slow burn is not a structural convention — it is a neurochemical strategy.",
  coreDescription: "The slow burn is the extended maintenance of Stage 2 attraction (dopamine/norepinephrine activation) through sustained uncertainty. Both characters are in the possibility space. Neither has named it. The reader is ahead of both of them and the gap produces the specific pleasure of slow burn — knowing what they don't yet know, watching the gap close.",
  fisherStage: "attraction",
  neurochemistry: "Sustained dopamine/norepinephrine activation. The key is that Stage 2 cannot sustain indefinitely — the body habituates. The slow burn manages this by introducing periodic setbacks (apparent resolution fails, new obstacles emerge) that reset the uncertainty and re-spike the dopamine system. The will-they-won't-they is not a narrative device — it is a neurochemical reset mechanism.",
  dopamineMechanic: "Each scene in a slow burn should contain: one moment where resolution seemed possible (approach) and one moment where it failed to resolve (retreat). The reader's dopamine system is activated by the approach and re-activated by the frustrated retreat. Too many retreats = reader gives up. Too many approaches without retreat = tension dissipates. The ratio is 2:1 approach to retreat.",
  structuralRequirement: "The slow burn requires that both characters have reasons not to act that the reader finds compelling. The obstacle must be internal (they believe they shouldn't want this) or situational (they genuinely cannot, not that they choose not to). An obstacle the reader doesn't believe in kills the slow burn.",
  physicalSignals: [
    "Hyperawareness of proximity: the character is acutely aware of how close the other person is without looking directly at them",
    "The held breath: a moment where the character is aware of waiting for something they cannot name",
    "The almost-touch: a physical near-miss that is not accidental but not acknowledged",
    "Involuntary attention check: the character's gaze returns to the other person without a decision being made",
  ],
  forbiddenMoves: [
    "Either character acknowledging the attraction directly before the scene requires it",
    "The obstacle resolving easily — it must cost something to move past it",
    "Scenes where nothing happens and neither character is activated — the tension must be present in every scene",
    "The reader losing faith that resolution is possible — the possibility must remain credible throughout",
  ],
  failureModes: [
    "Too many consecutive retreat scenes — the reader stops believing in the possibility",
    "The obstacle is unconvincing — the reader knows it could be resolved in one sentence",
    "Neither character has an involuntary physical response in the scene",
    "The scene establishes the attraction and then abandons it for plot — the tension must be continuous",
    "The approach is too overt — slow burn requires ambiguity in the signals",
  ],
  systemDirectives: [
    "One approach movement and one frustrated retreat per scene — the ratio maintains the tension",
    "At least one involuntary physical signal: the hyperawareness, the almost-touch, the involuntary look",
    "The obstacle must be genuinely compelling — it must be a reason the reader believes",
    "Never let either character name what is happening — not even to themselves with certainty",
    "The reader must be ahead of both characters at all times",
  ],
  writingNotes: "The slow burn's specific pleasure is the reader's position of knowing. They can see both characters' signals. They can see the approach and the retreat. They are frustrated that the characters cannot say it — but they cannot look away because the possibility is still there. The moment either character achieves certainty, the pleasure shifts into a different register. Protect the uncertainty as long as the story can sustain it.",
};

export const DARK_MOMENT: RomanceArchetype = {
  name: "Dark Moment",
  theoreticalBasis: "Romance structural contract: the dark moment is the all-is-lost point where the relationship appears permanently broken. Neurochemically, Stage 2 attraction (dopamine system) can be disrupted by a specific kind of threat — not physical danger but social/relational threat. The pain of social rejection activates the same neural pathways as physical pain (Eisenberger et al., 2003). The dark moment produces real pain, not symbolic pain. This is why it must be earned — the reader has to have invested enough in the Stage 2 attachment for the loss to register as loss.",
  coreDescription: "The dark moment is the scene where the relationship is broken in a way that appears unrecoverable. One character has done something — not had something happen to them — that makes the other unable to continue. The dark moment must be specific, must be the offending character's own action or choice, and must be devastating enough that reconciliation requires genuine change.",
  fisherStage: "transition",
  neurochemistry: "The pain of relational loss activates dorsal anterior cingulate cortex and anterior insula — the same regions activated by physical pain (Eisenberger, 2003). The dark moment produces physiological grief. The somatic experience is real: the hollow chest, the cold hands, the disrupted automatic behavior. Write it as a physical event, not an emotional one.",
  dopamineMechanic: "The dark moment collapses the Stage 2 dopamine activation. The possibility that was sustaining the reader's neurochemical investment is removed. This produces the physical sensation of loss — and the reader's desire for the Stage 3 resolution (attachment, safety, reconciliation) intensifies precisely because it is now absent.",
  structuralRequirement: "The grovel requirement: the resolution must involve the offending character actively demonstrating change — not apologizing, not explaining, not the other character forgiving generously. Change and proof of change. The offending character must do something that costs them something to prove they have become different. A resolution without the grovel violates the romance contract.",
  physicalSignals: [
    "The withdrawal of proximity: the character steps back, turns, creates physical distance",
    "The loss of the Stage 2 hyperawareness: the other person is suddenly just a person, the acute attention gone",
    "Damasio's somatic markers of loss: the hollow chest, the cold, the specific gravity of limbs",
    "The failed automatic behavior: reaching for the phone before remembering, making two cups of coffee",
  ],
  forbiddenMoves: [
    "The dark moment is caused by external circumstance rather than the offending character's own action",
    "The other character forgives without the grovel — passive resolution",
    "The dark moment is resolved in the same scene — it must stand for at least one chapter",
    "The dark moment is disproportionate to what was invested — the reader must feel the loss",
  ],
  failureModes: [
    "The offending action is not the character's own choice — it happened to them, not because of them",
    "The injured character forgives without evidence of change",
    "The dark moment resolves through explanation ('let me explain') rather than demonstrated change",
    "The reader does not believe the dark moment is real — too easily fixed",
    "The somatic experience of loss is absent — this must register physically",
  ],
  systemDirectives: [
    "The dark moment must be caused by the offending character's own choice or action — not circumstance",
    "Write the loss as a body event: hollow chest, withdrawal of the Stage 2 hyperawareness",
    "The scene must end without resolution — it must stand",
    "The injured character's pain must be specific and physical, not narrated as emotion",
    "The grovel requirement: the path to reconciliation must require demonstrated change, not explanation",
  ],
  writingNotes: "The dark moment works when the reader believes it cannot be fixed. Not because they want the relationship to fail — because the offending character has done something that makes them worthy of losing it. The reader's emotional response is not sympathy for the injured character only — it is the recognition that the offending character has lost something they should not have been careless with. The subsequent grovel must earn back not just the relationship but the reader's belief that this person has changed enough to deserve it.",
};

export const RECONCILIATION: RomanceArchetype = {
  name: "Reconciliation",
  theoreticalBasis: "The grovel and Stage 3 transition: reconciliation in romance is the shift from Stage 2 attraction (dopamine/norepinephrine, urgent, obsessive, uncertain) toward Stage 3 attachment (oxytocin/vasopressin, calm, mutual, safe). The reconciliation scene is not about the Stage 2 feeling returning — it is about Stage 3 being earned. The warmth of attachment is different from the electricity of attraction. The reader must feel the difference.",
  coreDescription: "The reconciliation is the scene where the offending character demonstrates they have changed, the injured character witnesses this change, and Stage 3 attachment becomes possible. The grovel is not an apology — it is an act. The reconciliation does not mean the dark moment is forgiven and forgotten. It means the relationship is remade on a different foundation.",
  fisherStage: "attachment",
  neurochemistry: "Oxytocin (trust, safety, belonging) and vasopressin (pair bonding, sustained attachment). Stage 3 is calmer than Stage 2 — the urgency is gone, replaced by warmth and steadiness. The physical signals are different: not the hyperawareness and the disrupted behavior of attraction but the released tension, the full breath, the warmth at the sternum.",
  dopamineMechanic: "The reconciliation must not be too easy — the dopamine system requires that the reward was earned. An easy reconciliation produces relief without satisfaction. The grovel must cost the offending character something real. When it costs enough, the resolution produces genuine satisfaction rather than mere relief.",
  structuralRequirement: "The offending character must demonstrate change through action, not through explanation or apology. The injured character must witness the action. The reconciliation is the injured character's choice to believe in the action — not the action itself. The reader must believe the choice is reasonable.",
  physicalSignals: [
    "The released tension: something in the injured character's body unclenches — described physically",
    "Oxytocin warmth: the warmth at the sternum that is Stage 3 and different from Stage 2's electric hyperawareness",
    "The full breath: the character breathes fully for the first time since the dark moment",
    "Proximity chosen not needed: the character moves closer not because they cannot help it but because they want to",
  ],
  forbiddenMoves: [
    "The offending character explains what happened and the injured character forgives the explanation",
    "The reconciliation arrives without a cost to the offending character",
    "The Stage 2 electricity returns unchanged — the reconciliation should produce Stage 3 warmth, not Stage 2 urgency",
    "The reconciliation is too easy — it must feel earned",
  ],
  failureModes: [
    "The grovel is verbal rather than active — 'I've changed' is not change",
    "The injured character forgives without witnessing the evidence of change",
    "The physical signals are Stage 2 (hyperawareness, disruption) instead of Stage 3 (warmth, release)",
    "The reconciliation arrives too quickly after the dark moment — the reader doesn't believe the cost was real",
    "The offending character's change is convenient rather than costly",
  ],
  systemDirectives: [
    "The grovel is an act, not an apology — the offending character does something that costs them",
    "The injured character witnesses the act before deciding",
    "Write the Stage 3 transition physically: the released tension, the warmth, the full breath",
    "The reconciliation is the injured character's choice — active, not passive",
    "The relationship is remade, not restored — it is something different on the other side",
  ],
  writingNotes: "The reconciliation scene's emotional register is different from the dark moment's intensity. Stage 3 attachment is calmer — steadier. The reader who has been in Stage 2 (uncertain, urgent, electrically charged) arrives in Stage 3 and feels the difference as something quieter and more solid. The oxytocin warmth in the sternum is not the dopamine spike — it is better, in a different way. Write the difference.",
};

export const DECLARATION: RomanceArchetype = {
  name: "Declaration",
  theoreticalBasis: "Stage 2 to Stage 3 transition: the declaration is the naming of the Stage 2 state — the moment one character tells the other that the attraction is real. Fisher's research shows the declaration produces an oxytocin response in both parties when it is reciprocated — the naming of the feeling begins the Stage 3 transition. The declaration that is not reciprocated produces acute social pain (Eisenberger, 2003). The stakes of declaration are neurochemically real.",
  coreDescription: "The declaration is the most formally constrained scene in romance — the reader has been anticipating it, knows exactly what must be said, and will accept nothing less than the real words. The craft is in earning the moment: the declaration after a slow burn lands differently from the declaration before it. Everything in the preceding structure is the price the declaration costs.",
  fisherStage: "transition",
  neurochemistry: "The declaration itself produces oxytocin in both parties if reciprocated. Before the declaration: norepinephrine (the specific anxiety of potential rejection) and dopamine (the anticipation of possible reward). The moment before declaration is the peak of Stage 2 neurochemical activation. After: the beginning of Stage 3 transition if reciprocated, or acute social pain if not.",
  dopamineMechanic: "The declaration is the resolution of the slow burn's sustained uncertainty. The dopamine mechanism that made the slow burn pleasurable now requires resolution — if it is delayed beyond what the reader can tolerate, frustration replaces pleasure. The declaration must arrive when the reader cannot stand another retreat. That exact moment is the structural target.",
  structuralRequirement: "The declaration must be specific — not 'I have feelings for you' but the actual feeling in the character's actual words. The specific words the character uses to name the thing they have been unable to name. The words must be that character's words, not generic romantic language. The reader must hear that person saying it.",
  physicalSignals: [
    "The norepinephrine before: the specific quality of anticipatory anxiety — different from other anxiety",
    "The decision to speak as a physical event: the breath taken before, the held moment",
    "The vulnerability of declaration: the character is exposed in a way they cannot take back",
    "The body's response to reciprocation or non-reciprocation: Stage 3 warmth or the acute cold of social rejection",
  ],
  forbiddenMoves: [
    "The declaration in indirect language that both parties understand but the reader finds insufficient",
    "The declaration interrupted before completion — once, in extremis, permitted; as a pattern, it violates the contract",
    "Generic romantic language — 'I love you' with no specificity",
    "The declaration arriving before the reader is ready — before the cost has been paid",
  ],
  failureModes: [
    "The specific words are absent — the declaration is paraphrased rather than spoken",
    "The declaration uses generic romantic language rather than that character's specific voice",
    "The reader is not ready — the declaration arrives before the slow burn has been sustained long enough",
    "The declaration is comfortable rather than vulnerable — it must cost the character something to say it",
    "The response is not specific either — a generic 'me too' after a specific declaration is unsatisfying",
  ],
  systemDirectives: [
    "Write the specific words — not paraphrase, not summary, but the actual declaration",
    "The words must be that character's words — the speech pattern established throughout the story",
    "The declaration must cost something to say: the vulnerability must be present",
    "Write the body before, during, and after: the norepinephrine before, the decision to speak, the aftermath",
    "The response must be equally specific — a declaration of this specificity requires a response of equal weight",
  ],
  writingNotes: "The declaration is the scene the reader has been reading toward. Everything before it is the price of this moment. If the price was paid — the slow burn sustained, the dark moment endured, the reconciliation earned — then the declaration lands. If the price was not paid, the declaration arrives discounted and the reader feels it. The craft of the declaration is not in the words themselves. It is in everything that made the words necessary.",
};
