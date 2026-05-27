// src/lib/dialogue/archetypes/negotiation-seduction-farewell-group.ts — UPGRADED
// Full psychological layer added to all four archetypes.
import type { DialogueArchetype } from "../types";

export const NEGOTIATION: DialogueArchetype = {
  name: "Negotiation",
  description: "Two parties who both want something the other has. Neither will show their real bottom line. A controlled exchange of partial truths.",
  underlyingConflict: "Both parties have a true minimum and a stated position. The gap between these is the terrain. The winner is whoever forces the other to move further toward their true minimum.",
  powerDynamic: "Power belongs to whoever needs the deal less — or can convincingly perform needing it less.",
  sceneStructure: "Opening positions — Probing — First movement — Escalation or breakdown — Resolution.",
  subtextRules: [
    "Neither party ever states their real bottom line.",
    "Every concession is a signal — what someone gives up tells you what they're protecting.",
    "Silence after an offer is power — the party who speaks first concedes something.",
    "Appeals to fairness are tactical.",
  ],
  rhythmPattern: "Measured and deliberate. Long pauses permitted and intentional. Speeds when deal is close, slows to near-stillness before major concession.",
  openingPrinciple: "Both parties already in the room. Opening line is a position, not a greeting.",
  escalationMechanics: "Each round narrows the gap or introduces a new variable. Walking away is escalation. Introducing a third party's interest is escalation.",
  breakingPoint: "Deal made, negotiation breaks, or standoff reached.",
  failureModes: [
    "Both parties are straightforwardly reasonable.",
    "Either party states real bottom line early.",
    "Negotiation about a single term.",
    "Silence not used.",
  ],
  systemDirectives: [
    "Neither character may state their real minimum.",
    "Include at least one silence after an offer.",
    "One character must concede something revealing.",
    "Outcome determined by exchange, not moral position.",
  ],
  writingNotes: "The best negotiation scenes are uncomfortable because the reader can see both real positions. Tension comes from watching people perform confidence while uncertain.",

  psychological: {
    partyAState: "sympathetic",
    partyBState: "sympathetic",
    stateShift: "Both parties maintain controlled sympathetic activation throughout — they are in a threat environment but suppressing its expression. The party who is more desperate may tip further into sympathetic (showing tells they cannot suppress). The party who has the stronger position may occasionally access ventral vagal (a relaxation that is itself a power signal). The party who has lost a major concession may briefly drop into dorsal vagal — a flatness that signals something has been absorbed.",

    partyAVoice: {
      pitch: "Flattened and controlled — the sympathetic elevation suppressed behind professional delivery.",
      rate: "Deliberately measured — faster speech betrays urgency and therefore need.",
      volume: "Moderate and consistent — volume shifts are information.",
      prosody: "Controlled but artificial — the modulation is managed rather than natural.",
      breathSupport: "Full and controlled as performance — the body is activated but the breath is being managed.",
    },
    partyBVoice: {
      pitch: "Same controlled signature — both parties performing the same studied calm.",
      rate: "The party who is more desperate may slip into slightly faster speech around their real concerns.",
      volume: "Any volume change signals the importance of what's being said — watch for it.",
      prosody: "The person who is about to concede: a slight flatness arrives in their prosody before they move.",
      breathSupport: "A slightly longer exhale before a concession — the body releasing something.",
    },

    activeFacsSignals: [
      "Both: deliberate neutrality — the performed absence of expression is itself an expression of controlled activation",
      "The party considering a concession: micro-AU4 (brow lowerer) appearing and disappearing as they weigh it",
      "AU23 (lip tightener) when a question hits a sensitive point — the mouth wanting not to answer",
      "The party who has won a point: suppressed AU6+AU12 (Duchenne) — the genuine satisfaction they are concealing",
      "Tells under pressure: AU17 (chin raiser) appearing when the real bottom line is approached",
    ],

    somaticPresence: "Both characters: Damasio's somatic markers are firing continuously during negotiation — the gut feeling about each option, the physical sensation of approaching the true minimum. The party who is more desperate: cold hands, elevated heart rate that they are managing not to show. The somatic tell is the tell that the words cannot show.",

    informationDynamics: {
      structure: "paranoia",
      readerKnows: "Both parties' real bottom lines (or enough to see the gap between stated and real).",
      characterKnows: "Each knows their own real position but not the other's.",
      gap: "The true gap between positions — is there a deal here or not? The reader may see this before either party does.",
    },

    psychologicalDirectives: [
      "Write the somatic tell: the physical signal that arrives before the concession, before the bluff, before the reveal.",
      "The longer exhale before a concession — the body releasing something.",
      "Suppressed Duchenne smile when a point is won — the genuine satisfaction being concealed.",
      "The AU23 lip tightener when a question lands near the real minimum.",
      "Both parties' hands: what they are doing throughout is a map of their activation level.",
    ],
  },
};

export const SEDUCTION: DialogueArchetype = {
  name: "Seduction",
  description: "A scene driven by desire that cannot be stated directly. Both parties maintain plausible deniability while the distance between them closes.",
  underlyingConflict: "One or both characters want something they cannot simply ask for. The asking must be disguised.",
  powerDynamic: "The party who first names the desire explicitly loses power. The party who lets the other come to them maintains power.",
  sceneStructure: "Ordinary surface — First signal — Response — Escalation of ambiguity — Threshold — Choice.",
  subtextRules: [
    "Every compliment is a declaration. Every question is an invitation.",
    "Physical proximity and awareness of it must be present.",
    "The line that means one thing and another is the basic unit.",
    "Deflection is not rejection — it is an invitation to come at it differently.",
  ],
  rhythmPattern: "Slow and unhurried. Lines longer than necessary. Pauses charged. Accelerates as ambiguity becomes less deniable.",
  openingPrinciple: "Begin in an ordinary exchange already charged. First line innocent of obvious intent.",
  escalationMechanics: "Each exchange narrows the distance — decreasing deniability of signals, increasing physical proximity, disclosure of something personal.",
  breakingPoint: "One party speaks without the protection of ambiguity — or re-establishes deniability in a way that makes the subtext explicit by refusing it.",
  failureModes: [
    "Either party states desire directly in first half.",
    "Surface conversation obviously pretextual.",
    "Physical awareness absent.",
    "One-sided with other clearly uninterested.",
  ],
  systemDirectives: [
    "Maintain a surface conversation that provides deniability.",
    "Every third or fourth line must carry double meaning.",
    "Physical awareness must be present — distance, proximity, what each notices.",
    "Neither character may state desire directly until the threshold.",
    "Ending must be ambiguous.",
  ],
  writingNotes: "Seduction fails when explicit too quickly or stays implicit so long the charge dissipates. Calibrate the tension. Note: seduction is not just romantic — a mentor taking interest, a salesperson, a job interview.",

  psychological: {
    partyAState: "ventral_vagal",
    partyBState: "ventral_vagal",
    stateShift: "Both begin in ventral vagal — genuine social engagement is the precondition for seduction. But underneath the ventral vagal state, there is a mild sympathetic charge from the desire. The tension between the open social engagement state and the activation of the desire produces the specific quality of seduction: warmth and urgency simultaneously. As the threshold approaches, the sympathetic charge increases — the performance of ventral vagal becomes more effortful.",

    partyAVoice: {
      pitch: "Slightly lower than normal — oxytocin effect, warmth in the voice.",
      rate: "Slightly slower than conversational — the extended duration of each exchange is itself a signal.",
      volume: "Moderate to soft — intimacy is signaled partly through reduced volume.",
      prosody: "Unusually rich — the charged state produces more modulation than normal conversation, not less.",
      breathSupport: "Full and warm — the ventral vagal state supports full breathing.",
    },
    partyBVoice: {
      pitch: "Same lower register — the co-regulation of ventral vagal states tends to synchronize voice quality.",
      rate: "Synchronized with Party A's slight slowing — Porges' research shows voice synchronization in genuine social engagement.",
      volume: "Soft — both parties have moved into the lower-volume register of genuine intimacy.",
      prosody: "The warmth is in the prosody before it is in the words.",
      breathSupport: "Full, slightly more audible than in formal contexts — the body is relaxed.",
    },

    activeFacsSignals: [
      "Both: AU6 fires involuntarily — the cheek crinkle appears before the social smile is organized",
      "Reduced blink rate: sustained gaze beyond social norm — attention that cannot be divided",
      "AU12 without urgency: the slow, soft lip corner raise of genuine warmth",
      "Attempted suppression of AU6: the cheek crinkle firing repeatedly while the person tries to maintain composure",
      "The direction of gaze during a pause — where the eyes go when the words stop",
    ],

    somaticPresence: "Both characters: oxytocin warmth at the chest, slightly elevated heart rate of pleasant arousal rather than threat, the specific warmth of genuine attention received. The somatic state is the body saying 'this is safe' while simultaneously saying 'this is important.' Damasio's somatic markers are firing toward positive valence.",

    informationDynamics: {
      structure: "both",
      readerKnows: "The desire — the reader reads the double meanings before the characters acknowledge them.",
      characterKnows: "Each character knows their own desire. Each party may or may not know the other's.",
      gap: "The gap between what is said and what is meant — the same gap for both parties. The reader sees through both simultaneously.",
    },

    psychologicalDirectives: [
      "Write the involuntary AU6 cheek crinkle that escapes before the person schools their expression.",
      "The lower pitch: write it as warmth in the voice rather than naming it.",
      "Write the blink rate: the gaze that stays longer than social convention requires.",
      "The specific warmth at the sternum — the Damasio positive somatic marker of genuine attraction.",
      "Voice synchronization: both parties' speech rhythms becoming similar without a decision being made.",
    ],
  },
};

export const FAREWELL: DialogueArchetype = {
  name: "Farewell",
  description: "A parting both characters know may be permanent. About what gets said in the last chance — and what doesn't.",
  underlyingConflict: "One or both want the separation not to happen, or to say something they haven't said. Against: the reality of the ending neither can stop.",
  powerDynamic: "The party who is leaving holds directional power. The staying party holds emotional power — they are left with the last image.",
  sceneStructure: "Frame (farewell established) — Ordinary exchange — The thing that needed saying — Response — Physical leave-taking — Final moment.",
  subtextRules: [
    "The ordinary exchange is inhabited with unusual attention — the last time.",
    "What is not said is often what the scene is about.",
    "Physical gestures at farewells carry enormous weight.",
    "False lightness — the person breaking apart performing ease — is one of the most powerful tools.",
  ],
  rhythmPattern: "Uneven — quick practical details mixed with very slow real moments. Time distorts: the final minutes stretch.",
  openingPrinciple: "Begin in the last ordinary moment before the farewell becomes undeniable.",
  escalationMechanics: "The practical details run out. The time runs out. What hasn't been said becomes impossible to avoid — or the characters part without saying it.",
  breakingPoint: "Either the thing gets said — imperfectly, incompletely, but present — or it doesn't, and the reader understands what is lost in that silence.",
  failureModes: [
    "Characters say clean, complete goodbyes.",
    "Sentiment without specificity.",
    "Feelings articulated rather than shown.",
    "Physical leave-taking skipped over.",
  ],
  systemDirectives: [
    "Begin with practical, surface exchange.",
    "Include at least one thing not said.",
    "Physical leave-taking must be written in detail.",
    "At least one line must carry the full weight in an ordinary-sounding sentence.",
    "The final image should linger.",
  ],
  writingNotes: "The most memorable farewell scenes are specific. Not 'he said goodbye' but the exact inadequate words he found.",

  psychological: {
    partyAState: "sympathetic",
    partyBState: "dorsal_vagal",
    stateShift: "Typically asymmetric: the party who is more invested in the relationship being preserved is in high sympathetic (fighting the farewell, fighting back feeling), while the party who has already begun the psychological leave is approaching dorsal vagal (the shutdown that happens before a major ending). This asymmetry is one of the most painful things the scene can contain. The dorsal vagal character is not cold — they are already partly gone, and their flatness is not indifference but prior grief.",

    partyAVoice: {
      pitch: "Elevated, controlled — the sympathetic charge being managed.",
      rate: "Variable: too fast in the practical-details phase (using speech to fill space), then suddenly slow when the real subject approaches.",
      volume: "Controlled moderate — the performance of not-breaking.",
      prosody: "The managed prosody of someone using all resources to keep the voice from cracking.",
      breathSupport: "Shallow — the chest is tight. The breath catches at certain words.",
    },
    partyBVoice: {
      pitch: "Flatter than usual — the dorsal vagal state produces reduced pitch range.",
      rate: "Slower — the dorsal vagal state slows motor output.",
      volume: "Reduced — the body taking up less space.",
      prosody: "Hollow — the breath support is absent. The words arrive without their full backing.",
      breathSupport: "The defining quality of dorsal vagal voice: the words are not fully supported. They arrive, but the body is not fully behind them.",
    },

    activeFacsSignals: [
      "Party A (sympathetic, fighting): AU17 (chin raiser) + jaw rigid = suppressing breakdown; AU1 (inner brow raise) sustained",
      "Party B (dorsal vagal, partially gone): reduced facial expression overall — the micro-expressions of engagement are already diminished",
      "The involuntary blink rate change when the real moment arrives: either freezing (too still) or increasing rapidly",
      "The final AU6 moment: the genuine Duchenne smile that appears at the last moment — grief and love simultaneously",
      "The direction of gaze at the final departure: where each person looks when they can no longer look at the other",
    ],

    somaticPresence: "Party A (sympathetic): cold hands, tight chest, the specific somatic experience of trying not to let the body show what it is doing. Elevated heart rate they are performing away. Party B (dorsal vagal): a kind of hollowness — the body has reduced its output. The warmth at the chest that characterizes ventral vagal intimacy is reduced, which the departing party may interpret as coldness but which is actually pre-grief.",

    informationDynamics: {
      structure: "suspense",
      readerKnows: "The weight of what this farewell means — often more than the characters acknowledge.",
      characterKnows: "Each character knows their own experience of the ending but not fully the other's.",
      gap: "The thing that will not be said. The reader knows it is there. The question is whether the scene will say it or let the absence be the statement.",
    },

    psychologicalDirectives: [
      "Write the voice asymmetry: the managed sympathetic voice vs the hollow dorsal vagal voice. These two voices in the same scene carry enormous emotional weight.",
      "The jaw rigid against AU17 in the sympathetic party — describe the jaw specifically.",
      "The flatness of the dorsal vagal party is not coldness — write what it actually is: prior grief.",
      "The final AU6: the involuntary genuine smile that may appear in the last moment, carrying grief and love simultaneously.",
      "Physical leave-taking in detail: who moves first, what the hands do, where the gaze goes at separation.",
    ],
  },
};

export const GROUP_SCENE: DialogueArchetype = {
  name: "Group Scene",
  description: "Three or more characters where the dynamics between them are as important as what is said. Alliances form and shift. Someone gets silenced. Someone speaks through a third party.",
  underlyingConflict: "Multiple bilateral conflicts operating simultaneously plus the meta-conflict of maintaining the group vs individual desires that threaten it.",
  powerDynamic: "Group power circulates. Social power controls subject. Informational power controls stakes. Willingness to break norms confers specific power.",
  sceneStructure: "Establishment (current dynamic) — Disruption — Realignment — Escalation — New state.",
  subtextRules: [
    "Characters often speak to one person while directing the real message at another.",
    "The group has a topic it is collectively avoiding.",
    "Silence in group scenes is socially charged — who doesn't speak and when.",
    "Shared laughter at someone's expense is a power tool.",
  ],
  rhythmPattern: "Irregular — multiple simultaneous conversations. Not orderly round-robin but the natural chaos of multiple people.",
  openingPrinciple: "Begin with the group assembled but not yet in the scene's real business. Let the reader map relationships from opening exchanges.",
  escalationMechanics: "Small realignments accumulate. A joke that lands wrong. An alliance forming in front of someone excluded. A secret glanced at but not spoken.",
  breakingPoint: "The moment when the collectively-avoided subtext enters the room explicitly.",
  failureModes: [
    "Characters take polite turns — no cross-talk, interruptions, silencing.",
    "Every character has the same relationship to the central conflict.",
    "Group dynamic doesn't change.",
    "Scene's subject addressed directly from the opening.",
  ],
  systemDirectives: [
    "At least one character must be silenced or interrupted.",
    "At least one exchange must be between two characters but directed at a third.",
    "Alliances at scene's end must differ from beginning.",
    "Include at least one moment of collective behavior.",
    "Not every character needs equal time — speech distribution is a power map.",
  ],
  writingNotes: "Group scenes are hardest to write because you're tracking multiple relationships simultaneously. Know before writing what the group is collectively avoiding.",

  psychological: {
    partyAState: "ventral_vagal",
    partyBState: "sympathetic",
    stateShift: "In group scenes, different characters occupy different polyvagal states simultaneously, and these states shift throughout the scene. The dominant character is typically in ventral vagal — relaxed, taking up full social space. The threatened or marginal character shifts to sympathetic or dorsal vagal depending on threat level. After the disruption, states realign: previously dominant character may become sympathetic; previously quiet character may access social engagement.",

    partyAVoice: {
      pitch: "The dominant character: normal-to-lower pitch, full prosody — the ventral vagal social engagement state produces the most complete voice.",
      rate: "Normal, comfortable — no acceleration from threat.",
      volume: "The dominant voice sets the volume baseline for the group.",
      prosody: "Rich and complete — the dominant character can afford full emotional expression.",
      breathSupport: "Full — the ventral vagal state.",
    },
    partyBVoice: {
      pitch: "The threatened character: elevated or suddenly flattened depending on whether they are moving toward fight/flight or freeze.",
      rate: "Either accelerating (sympathetic mobilization) or decelerating (dorsal vagal withdrawal).",
      volume: "The threatened character's volume is often revealing: they either speak too loudly (sympathetic) or too quietly (dorsal).",
      prosody: "Degraded under threat — the social engagement prosody is the first thing to go.",
      breathSupport: "Shallow in sympathetic, absent in dorsal.",
    },

    activeFacsSignals: [
      "The dominant character: full social engagement — AU6+AU12 available, relaxed brow, open face",
      "The threatened character: AU4 (brow lowerer) sustained, reduced smile availability",
      "The silenced character: AU64 (gaze aversion) + reduced facial expression = dorsal withdrawal",
      "The alliance forming: two characters' AU6 firing simultaneously when they exchange a glance — the reader sees the alliance before the characters name it",
      "The disruption: someone's AU5 (upper lid raiser) going wide — the full-group surprise register",
    ],

    somaticPresence: "The group scene's somatic reality: proximity means each character is in the physiological field of the others. Porges' co-regulation concept: nervous systems regulate each other in proximity. The dominant character's ventral vagal state is literally calming to others. The threatened character's sympathetic activation is literally activating to others. The scene is a field of nervous systems affecting each other.",

    informationDynamics: {
      structure: "both",
      readerKnows: "The group's avoided subject, the existing alliances, what each character wants.",
      characterKnows: "Each character knows their own stakes and some of the others'. No character knows the full picture.",
      gap: "Multiple simultaneous information gaps — one for each bilateral relationship in the group. The reader holds all of them simultaneously.",
    },

    psychologicalDirectives: [
      "Write the polyvagal state of each character and let it determine their voice and face.",
      "The alliance-forming glance: two AU6s firing simultaneously. Do not name the alliance — show the synchronized body response.",
      "The silenced character's dorsal withdrawal: reduced face, reduced voice, reduced presence — this is legible to the reader even if the other characters miss it.",
      "The disruption moment: at least one character's full-body polyvagal shift should be written — from ventral vagal to sympathetic or back.",
      "Nervous system co-regulation: write how the dominant character's state affects the room, not just the scene's conversational content.",
    ],
  },
};
