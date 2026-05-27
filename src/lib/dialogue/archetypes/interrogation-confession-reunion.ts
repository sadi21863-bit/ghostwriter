// src/lib/dialogue/archetypes/interrogation-confession-reunion.ts — UPGRADED
// Full psychological layer added to all three archetypes.
import type { DialogueArchetype } from "../types";

export const INTERROGATION: DialogueArchetype = {
  name: "Interrogation",
  description: "One character extracts information from another. The power asymmetry is explicit — but it shifts. The subject has information the interrogator needs, which is its own kind of power.",
  underlyingConflict: "The interrogator needs something. The subject is deciding how much it will cost them to give it — or to protect it. The real conflict is not information but will.",
  powerDynamic: "The interrogator holds institutional or physical power. The subject holds informational power. The scene transfers depending on how each leverages what they have.",
  sceneStructure: "Establishment — Testing (interrogator probes, subject deflects) — Pressure (tactics escalate) — Crack or wall — Exit (someone leaves with more).",
  subtextRules: [
    "The interrogator's questions are never just questions — they are moves positioning the subject.",
    "The subject's answers are never just answers — they are decisions about what to protect.",
    "Silence is speech in interrogation — refusal to answer reveals shape of what is hidden.",
    "The interrogator who reveals what they already know is trying to make the subject feel surrounded.",
    "A subject who asks a question of their own is trying to regain control of the frame.",
  ],
  rhythmPattern: "Call-and-response with unpredictable pauses. Interrogator controls tempo — speeds to disorient, slows to apply pressure. Silence appears at least three times.",
  openingPrinciple: "Begin with the interrogator controlling physical space, subject already seated/lower. The first line states something — it does not ask.",
  escalationMechanics: "Tactics escalate: rapport-build — pivot (introduce what you know) — leverage play — final gambit (bluff, threat, or offer).",
  breakingPoint: "Subject either breaks (confession, revelation, genuine emotion) or fortifies completely (silence, shutdown, lawyer). Either ending is valid.",
  failureModes: [
    "Direct questions answered directly — no tactics, no evasion.",
    "Subject volunteers information without being cornered.",
    "Interrogator is uniformly menacing with no variation.",
    "Power dynamic never shifts.",
  ],
  systemDirectives: [
    "Interrogator must use at least two distinct tactics.",
    "Subject must almost break at least once before they do or don't.",
    "Include one silence that lasts uncomfortably long.",
    "Subject must answer at least one question indirectly.",
    "End on ambiguity — the interrogator should be uncertain what was withheld.",
  ],
  writingNotes: "The best interrogation scenes are two people reading each other simultaneously. Write both minds active, both people performing, both genuinely uncertain of the outcome.",

  psychological: {
    partyAState: "sympathetic",
    partyBState: "sympathetic",
    stateShift: "The subject may shift to dorsal vagal (shutdown/freeze) if the pressure becomes unbearable. The interrogator's sympathetic state is suppressed behind performance — the professional mask over the activation underneath. The crack in the mask is the scene's turning point.",

    partyAVoice: {
      pitch: "Deliberately flattened — the interrogator suppresses the sympathetic pitch-rise to project control.",
      rate: "Controlled and slightly slower than conversational. Pauses are weaponized.",
      volume: "Quiet to medium — the interrogator rarely raises their voice. Quiet is more threatening than loud.",
      prosody: "Reduced modulation — the flat affect of authority.",
      breathSupport: "Full and controlled — the interrogator is in charge of their own physiology.",
    },
    partyBVoice: {
      pitch: "Elevated — fear and sympathetic activation raise the larynx, raising pitch involuntarily.",
      rate: "Either too fast (anxious, trying to fill silence) or too slow (choosing words with extreme care).",
      volume: "Often drops — the subject is trying to take up less space.",
      prosody: "Degraded modulation — under stress, speech becomes flatter or more erratic.",
      breathSupport: "Shallow — the chest is tight. Breath audibly available before difficult answers.",
    },

    activeFacsSignals: [
      "Subject: AU1+AU2+AU4 (brow raised and compressed together = fear/anxiety signature)",
      "Subject: AU20 (lip stretcher — corners pull toward ears, not down) = fear tells",
      "Subject: AU64 (gaze aversion) when approaching the information they are protecting",
      "Interrogator: AU4 alone (brow lowerer without AU1+2) = focused authority without fear",
      "Interrogator: performed neutrality — the absence of expression is itself an expression",
    ],

    somaticPresence: "Subject: cold hands (blood flow redirected), shallow breath, stomach dropped. The body knows this is a threat even if the mind is performing calm. Interrogator: controlled tension in the jaw, deliberately relaxed hands placed visibly on the table — a performance of ease that is itself a power signal.",

    informationDynamics: {
      structure: "curiosity",
      readerKnows: "Something happened. The interrogator believes the subject knows what. The reader sees the interrogation (the outcome-state) before the original event is revealed.",
      characterKnows: "The interrogator has partial information and believes the subject has the rest. The subject knows what happened and is deciding whether to say it.",
      gap: "What the subject knows and is protecting. The gap is informational, but the scene is about will — who holds out longer.",
    },

    psychologicalDirectives: [
      "Write the subject's voice physiology: elevated pitch, degraded prosody, audible breath before difficult answers.",
      "The interrogator's control is a performance — show the jaw holding the performance in place.",
      "Subject's gaze must avert when approaching the protected information — not chosen, but happening.",
      "The subject's body shows fear; their words perform confidence. Write both simultaneously.",
      "The interrogator's silences are deliberate tools — describe what they do to the subject's body.",
    ],
  },
};

export const CONFESSION: DialogueArchetype = {
  name: "Confession",
  description: "One character discloses something true and significant. The confessor is not releasing a burden — they are transferring part of it.",
  underlyingConflict: "The confessor wants freedom from the secret and wants to keep the relationship. These wants are in conflict. The listener is being asked to absorb something they did not ask for.",
  powerDynamic: "Before: confessor holds power (they can choose to reveal or not). After: listener holds power (they have the knowledge). The confessor is making this transfer — and many confessions are never made because the person cannot bear to give up that power.",
  sceneStructure: "Approach (orbiting the subject) — First signal — Retreat — Return — Landing (the confession itself) — Aftermath (relationship reconfigures).",
  subtextRules: [
    "The confessor almost says it at least twice before they say it.",
    "The first version of the confession is incomplete — the full truth comes later.",
    "The listener's response shapes what the confessor says next.",
    "The language is indirect: 'there was someone else' not 'I cheated.'",
  ],
  rhythmPattern: "Long circling approaches, short retreats, then a landing quieter than everything around it. After the confession, lines slow.",
  openingPrinciple: "Begin before the confessor has decided to confess — still weighing it. Opening feels ordinary and slightly tense.",
  escalationMechanics: "Each exchange gets closer. The confessor circles the center, each orbit nearer. The listener accelerates or slows this.",
  breakingPoint: "The moment the confession lands — specific, quiet, irreversible. Not the moment of decision but the moment of utterance.",
  failureModes: [
    "Confession made immediately in the opening lines.",
    "Confessor explains and justifies in detail.",
    "Listener's reaction is uniformly supportive or condemnatory — no ambiguity.",
    "Language of confession is direct and clinical.",
    "Scene ends with relationship resolved.",
  ],
  systemDirectives: [
    "Confessor must circle subject at least twice before landing.",
    "Actual confession in indirect or incomplete language.",
    "Listener's reaction must be ambiguous.",
    "Include at least one moment where the confessor almost doesn't say it.",
    "End in the aftermath, not at the moment of confession.",
  ],
  writingNotes: "Real confessions are halting, incomplete, full of the wrong words. 'I think... there was a time when I...' not 'I confess that.' Honor the messiness.",

  psychological: {
    partyAState: "sympathetic",
    partyBState: "ventral_vagal",
    stateShift: "The confessor begins in high sympathetic activation (the approach phase is physically costly — the body knows what is coming before the mouth does) and shifts toward dorsal vagal collapse at the moment of landing (the confession drains the sympathetic charge). The listener begins in ventral vagal (open, receiving) and may shift to sympathetic as the confession lands — the body responding to threat before the mind can assess it.",

    partyAVoice: {
      pitch: "Slightly elevated at approach, dropping to near-normal at the landing — the pitch traces the arc of the emotional journey.",
      rate: "Slow and effortful during the circling. The landing itself may be delivered quickly — as if the body is trying to get it over with.",
      volume: "Drops toward the confession — the most important words are often the quietest.",
      prosody: "Degraded — the confessor cannot access normal speech modulation. The flatness is the tell.",
      breathSupport: "Audible. The involuntary deep breath before the landing is a physiological event the confessor cannot prevent.",
    },
    partyBVoice: {
      pitch: "Normal at opening, involuntary shift as the confession lands.",
      rate: "Slows as the listener processes — the body buying time.",
      volume: "May drop to match the confessor's intimacy.",
      prosody: "Normal until the confession, then degraded — the polyvagal state shifting to sympathetic under the new information.",
      breathSupport: "The listener's audible intake of breath at the landing is one of the most powerful lines in the scene — write it.",
    },

    activeFacsSignals: [
      "Confessor: AU17 (chin raiser) + AU1 (inner brow raise) = barely-suppressed grief-like expression throughout the approach",
      "Confessor: jaw rigid (AU28 lip suck/press) — holding back the words until they cannot be held",
      "Confessor: AU64 (gaze aversion) sustained — cannot meet the listener's eyes during approach",
      "Listener: AU1+AU2 (full brow raise) = genuine surprise at the landing — involuntary",
      "Listener: AU4 (brow lowerer) arriving 200–300ms after the surprise — the cognitive evaluation beginning",
    ],

    somaticPresence: "Confessor: hands that cannot find a resting position, the involuntary breath before the landing that the confessor does not choose. The somatic marker for the confession is the specific physical discomfort of carrying a secret — something between nausea and pressure at the sternum. Listener: the involuntary breath intake at the landing is a somatic event, not a decision.",

    informationDynamics: {
      structure: "suspense",
      readerKnows: "What the confession is, or approximately what it is, from the scene's setup. The reader is waiting for the landing.",
      characterKnows: "The confessor knows everything. The listener knows something is coming but not what.",
      gap: "The gap between the reader's knowledge and the listener's knowledge. Every exchange that doesn't land the confession is a widening of this gap.",
    },

    psychologicalDirectives: [
      "Write the involuntary breath before the landing — the body preparing to release what it has been carrying.",
      "Confessor's gaze aversion is not chosen — write it happening before the character decides.",
      "The AU17 chin dimple of suppressed emotion must appear during the circling phase.",
      "Listener's brow raise at the landing is involuntary — write the surprise as a body event, not a decision.",
      "The quiet at the landing: the most important words are delivered below the scene's average volume.",
    ],
  },
};

export const REUNION: DialogueArchetype = {
  name: "Reunion",
  description: "Two characters with significant shared history meet after significant absence. The history is present in every word. The scene is about the collision of who they were and who they are now.",
  underlyingConflict: "Both want to return to what was — but they cannot, because both have changed. The conflict is between the desire for continuity and the reality of discontinuity.",
  powerDynamic: "The character who needs the reunion less has power. Power shifts when the less-invested character reveals they are invested after all.",
  sceneStructure: "Threshold — Surface exchange — First real moment — The question underneath — Resolution or rupture.",
  subtextRules: [
    "Every ordinary line carries the history — 'you look well' from someone who last saw the other in hospital is not simple.",
    "What they don't say about the time between is more present than what they say.",
    "Physical detail — how they stand, whether they touch, who moves toward whom — does more than dialogue.",
    "One character often performs casualness that is not casual — the performance is visible.",
  ],
  rhythmPattern: "Stilted at first — both managing their own exposure. Lines shorter than natural, safer than genuine. As history becomes unavoidable, lines lengthen and become less managed.",
  openingPrinciple: "Begin in the threshold moment — the instant before contact. The fullness of history in the gap between them before anyone speaks.",
  escalationMechanics: "Every exchange about the surface is also about the real subject. Both escalate together.",
  breakingPoint: "The moment when the real subject enters the room explicitly — or the moment one character makes clear the reunion will not resolve what the other hoped.",
  failureModes: [
    "Characters catch up normally — as if history is not present in every word.",
    "Emotional reunion happens too quickly.",
    "History explained in dialogue.",
    "Both characters have the same relationship to the reunion.",
  ],
  systemDirectives: [
    "Physical description must carry the history.",
    "Real subject must not be named until halfway through.",
    "One character must be performing casualness — visible to reader.",
    "Use each character's name at least once and mark whether it feels natural.",
    "End in new understanding, not resolution.",
  ],
  writingNotes: "Reunions are most powerful when characters are genuinely different from who they were. The discovery that both have become someone the other doesn't fully know is the sadness.",

  psychological: {
    partyAState: "sympathetic",
    partyBState: "sympathetic",
    stateShift: "Both characters begin in sympathetic (the reunion is a threat as much as a desire — the possibility of rejection, of changed feelings, of finding the other person gone). If the scene moves toward genuine contact, both may shift toward ventral vagal together — this co-regulation is the scene's emotional resolution. If the scene fails, one or both shifts to dorsal vagal.",

    partyAVoice: {
      pitch: "Slightly elevated — the sympathetic charge underneath the performed ease.",
      rate: "Slightly faster than normal — the body filling silence before the real subject arrives.",
      volume: "Moderate, carefully controlled — neither too quiet (which would signal too much) nor too loud (which would signal performance).",
      prosody: "The modulation is slightly wrong — it is the prosody of someone managing their own voice rather than simply speaking.",
      breathSupport: "Controlled but slightly shallow — the body is not fully at ease.",
    },
    partyBVoice: {
      pitch: "Same as Party A — the matching sympathetic state produces similar voice signatures.",
      rate: "May be slower if Party B has more to protect or is more invested in not showing.",
      volume: "Same moderate control.",
      prosody: "Same managed quality — both performing the same thing.",
      breathSupport: "The first full breath either character takes is the moment they stop performing — mark it.",
    },

    activeFacsSignals: [
      "Both: attempted AU6+AU12 (Duchenne smile) but AU6 may fire involuntarily and honestly before the smile is organized",
      "Both: AU4 (brow lowerer) present underneath the social expression — the tension that isn't being shown",
      "The character who is more invested: AU1 (inner brow raise) appearing involuntarily when they see the other — the body registering the significance",
      "The performed casualness: AU12 without AU6 — social smile without genuine joy",
      "The moment of real contact: AU6 fires in both simultaneously — reader sees this before the characters acknowledge it",
    ],

    somaticPresence: "Both characters' somatic state: oxytocin and cortisol simultaneously — the body wants the reunion and fears it in the same moment. Warm hands and cold hands. The specific quality of near-proximity to someone the body remembers: the body knows this person before the mind has processed them.",

    informationDynamics: {
      structure: "curiosity",
      readerKnows: "That these two have significant history. What broke them apart, or at least the shape of it.",
      characterKnows: "Each character knows their own history but not fully the other's experience of it.",
      gap: "The gap is the time between them — what happened, how each changed, whether what they had is recoverable. This gap is the scene's real subject.",
    },

    psychologicalDirectives: [
      "Write the involuntary AU6 cheek crinkle that fires before the social smile is organized — the body's genuine response preceding the performance.",
      "The managed voice prosody: the reader should hear the management, not just the words.",
      "The first full breath either character takes when they stop performing is the scene's turning point.",
      "Warm hands vs cold hands: oxytocin warmth and sympathetic peripheral vasoconstriction simultaneously.",
      "The body's recognition of the other person: describe the somatic response before the cognitive identification.",
    ],
  },
};
