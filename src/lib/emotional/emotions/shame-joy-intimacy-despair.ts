// src/lib/emotional/emotions/shame-joy-intimacy-despair.ts
import type { EmotionArchetype } from "../types";

export const SHAME: EmotionArchetype = {
  name: "Shame",
  polyvagalState: "dorsal_vagal",
  coreDescription: "Shame is the collapse of the self under social evaluation. Unlike guilt (which is about a specific action), shame is about the whole person — the feeling that one is fundamentally defective, not just that one did something wrong. The body's response is a withdrawal from visibility: the desire to disappear, to become small, to exit the social field entirely.",

  facs: {
    primaryAUs: [
      "AU12 (lip corner pull — a suppressed or asymmetric smile that appears involuntarily as social deflection)",
      "AU15 (lip corner depressor — present when the smile suppression fails)",
      "AU64 (eyes down — gaze aversion is the most consistent shame signal across cultures)",
    ],
    secondaryAUs: [
      "AU1+4 (oblique brow — sadness-tinged shame)",
      "AU17 (chin raiser — vulnerability showing underneath the withdrawal)",
    ],
    suppressedDisplay: "Performance of confidence to hide shame: overcorrected eye contact (staring), too-upright posture, too-loud voice. The body betrays the performance: reddened skin, slightly too-controlled breathing, a blink rate that is either too high or artificially suppressed.",
  },

  somatic: {
    heartRate: "Elevated — the social evaluation triggers a sympathetic threat response, but unlike fear or rage, there is no mobilization target. The arousal is internal, producing the hot flush of shame.",
    breathing: "Shallow and slightly held. The person tries to take up less space, including less airspace. The breath becomes very controlled as part of the performance of composure.",
    muscleState: "Collapse: shoulders draw in, chin drops, chest compresses. The body is physically trying to become smaller. In some people the opposite — a rigid overcorrection into upright posture as a performance of not-being-shamed.",
    skinResponse: "Flushing is the most reliable and the least controllable shame response — it is involuntary and happens before the person decides anything. The face, neck, and sometimes chest redden visibly. This is one of the few involuntary signals that cannot be suppressed.",
    digestive: "A hollow, nauseating quality. The stomach contracts. Shame activates the same neural pathways as physical pain — the 'hurt feelings' of shame is neurologically analogous to physical injury (Eisenberger et al., 2003).",
    motorControl: "Reduced. The person moves less, touches their face or neck (self-soothing touch), avoids movement that would draw attention. Fine motor degradation: fumbling with objects.",
  },

  onset: "Shame arrives as a wave of heat — the flush — followed by the impulse to escape. The first instinct is to cover the face, look away, move toward the exit. The person may be aware of the flush and this self-awareness intensifies it: shame about shame.",

  peak: "At peak, the person is genuinely unable to meet another's eyes — this is not a choice. The gaze drops without a decision. The body has withdrawn its social engagement even if the person is physically present.",

  recession: "Shame lingers long after the shaming event. The body holds it: the flush recedes but the memory of the flush does not. Shame memories are recalled from a third-person perspective (research finding: Libby & Eibach, 2002) — the person sees themselves from the outside, as they imagine others saw them.",

  externalReads: [
    "The involuntary flush — it appears on the face, neck, and chest and cannot be controlled.",
    "Gaze aversion — the eyes drop or move away; this happens before any decision is made.",
    "The physical attempt to become smaller: shoulders in, chin down, chest compressed.",
    "The self-soothing touch: hand to the throat, neck, or face.",
    "The too-loud or too-controlled voice of someone performing composure they do not feel.",
  ],

  showDontNameRules: [
    "The flush is physical and involuntary — write it as heat, as color, as the person noticing they cannot stop it.",
    "The gaze drop happens before the character decides it — 'she found she was looking at the floor' not 'she looked away.'",
    "Shame memories are third-person: write the character seeing themselves from outside.",
    "The body becoming smaller is specific: shoulders, chin, chest — not vague self-consciousness.",
    "The performance of not-being-shamed is often more visible than the shame itself.",
  ],

  failureModes: [
    "Shame is expressed as direct confession — shamed people often perform confidence or aggress rather than admit.",
    "The flush is absent — it is the most reliable involuntary signal and the hardest to suppress.",
    "Shame produces sadness — shame and sadness are different states; shame is hot and activating, sadness is cold and withdrawing.",
    "The character processes their shame clearly and articulately in the scene.",
    "Shame ends when the shaming event ends — shame recurs in memory, often for years.",
  ],

  systemDirectives: [
    "The flush must appear — it is involuntary and diagnostic.",
    "Include at least one moment of gaze aversion that the character did not choose.",
    "Either the collapse (physical becoming-smaller) or the overcorrection (performed composure) — both are shame responses.",
    "Include the self-soothing touch if the shame is sustained.",
    "End in the aftermath: the shame remains after the scene; consider the third-person memory quality.",
  ],

  writingNotes: "Shame is uniquely painful in fiction because it implicates the whole self, not just an action. A character who has done something shameful and knows it is different from a character who IS something shameful — the second is more interesting and more devastating. The flush that cannot be hidden is the most powerful physical signal in fiction because it announces the internal state despite every effort to conceal it.",
};

export const JOY: EmotionArchetype = {
  name: "Joy / Elation",
  polyvagalState: "ventral_vagal",
  coreDescription: "Joy is the body in its most open state — the ventral vagal system fully engaged, social connection available, threat absent. The body expands rather than contracts. The critical distinction for fiction is between Duchenne joy (AU6+AU12 together, genuine) and social smiling (AU12 alone, performed). Readers perceive this difference instinctively even without being able to name it.",

  facs: {
    primaryAUs: [
      "AU6 (orbicularis oculi — the cheek raiser; crinkles the corners of the eyes; CANNOT be voluntarily produced; the diagnostic marker of genuine joy)",
      "AU12 (zygomatic major — raises the lip corners; CAN be voluntarily produced; present in social smiling)",
      "AU6+AU12 together = Duchenne smile (genuine joy; named for Guillaume Duchenne who identified it in 1862)",
    ],
    secondaryAUs: [
      "AU25 (lips part — present in laugh or full elation)",
      "AU26 (jaw drop — open-mouth joy in high intensity)",
    ],
    suppressedDisplay: "Suppressed joy: the AU12 (lip corners) is controllable but AU6 (cheek raiser) repeatedly fires involuntarily. The person trying not to smile shows the cheek crinkle repeatedly escaping before they suppress the lip corners. This involuntary micro-expression of joy is one of the most endearing things a face can do.",
  },

  somatic: {
    heartRate: "Moderately elevated — pleasant arousal, not threat arousal. Heart rate in genuine joy is elevated but steady, not arrhythmic.",
    breathing: "Deep and full — the diaphragm is engaged, the chest expands. The breath is easy. In high elation, breathing becomes vocal: laughter is modified breathing.",
    muscleState: "Released and open. The shoulders drop and open outward. The arms may lift or extend. The body takes up more space rather than less. The posture rises.",
    skinResponse: "Warmth and rosiness — oxytocin and dopamine produce warmth in the chest and face. The skin is not cold.",
    digestive: "The 'warm chest' sensation — genuine positive feeling produces warmth at the sternum, the opposite of the hollow-chest of grief.",
    motorControl: "Released and slightly uncoordinated in high elation — people trip, spill things, gesture too widely, laugh at unexpected moments. The control-systems relax.",
  },

  onset: "Joy can arrive suddenly (a good surprise) or build slowly (sustained pleasurable experience). It is one of the few states where the body and mind often arrive at the same moment.",

  peak: "At peak, the body is fully open: the Duchenne smile fires involuntarily, the arms may lift, laughter can become uncontrollable. Thought becomes associative rather than linear.",

  recession: "Joy recedes without the crash of fear or rage — it drains gently. The aftermath is a sustained warmth and a baseline elevation of mood.",

  externalReads: [
    "AU6 (cheek raiser): the corner crinkling around the eyes — this cannot be faked and a reader will recognize genuine vs performed joy immediately.",
    "The body taking up more space: arms wider, posture taller, movement larger.",
    "The warm chest — a visible softness in the expression.",
    "Uncontrolled motor behavior: the involuntary gesture, the spilled drink, the laugh at the wrong moment.",
    "The involuntary AU6 escape: someone trying not to show their joy and the cheek crinkle firing repeatedly.",
  ],

  showDontNameRules: [
    "Distinguish Duchenne from performed: 'the corners of her eyes crinkled' (genuine) vs 'she smiled' (performed or ambiguous).",
    "The body taking more space is specific — describe the shoulder release, the expanded posture.",
    "The warm chest is physical: warmth at the sternum, not an abstraction.",
    "In high elation: the coordination failures — joy makes people clumsy in a specific endearing way.",
    "The attempted suppression of joy: the AU6 firing repeatedly while the person tries to compose their face.",
  ],

  failureModes: [
    "Joy is written as giddy or performative — genuine joy is often quieter and more internal.",
    "Every smile is written the same way — the Duchenne/non-Duchenne distinction is erased.",
    "Joy is described as lightness or floating — write the body: warmth, expanded posture, the specific crinkle.",
    "High elation produces perfect coordination and clear thought — it actually produces the opposite.",
  ],

  systemDirectives: [
    "Specify genuine (AU6+AU12, cheek crinkle) vs social (AU12 only, lips only) joy.",
    "Include the body taking up more space.",
    "If joy is being suppressed, show the AU6 firing involuntarily.",
    "Include the warm chest for sustained genuine joy.",
    "For high elation: include at least one coordination failure or involuntary motor behavior.",
  ],

  writingNotes: "The most honest signal of joy in fiction is the thing the character tries not to show. The AU6 crinkle that escapes before the person schools their expression. The laugh that arrives before the social permission for it. The warmth that spreads despite every reason to stay cool. Performed joy is everywhere. Genuine joy that the character cannot prevent is rare and worth more.",
};

export const INTIMACY: EmotionArchetype = {
  name: "Intimacy / Tenderness",
  polyvagalState: "ventral_vagal",
  coreDescription: "Intimacy is the experience of being known and allowing it — the nervous system's social engagement at its deepest level. It is distinct from joy (which can be solitary) and from desire (which contains urgency). Intimacy is slow, open, and vulnerable. The body's signal is a specific quality of stillness — relaxed, attentive, and slightly undefended.",

  facs: {
    primaryAUs: [
      "AU6 (orbicularis oculi — the genuine smile component; present in genuine warm attention)",
      "AU12 (zygomatic major — soft, not wide; the lips soften rather than pull)",
      "Brow in resting position: the absence of AU4 (brow lowerer) is diagnostic — the face has released its default defense tension",
    ],
    secondaryAUs: [
      "AU1 (inner brow raise — very subtle, present in tenderness; creates the small softness between the brows)",
      "Reduced blink rate — sustained attention on the person",
    ],
    suppressedDisplay: "Concealed intimacy: the person defends with humor, deflection, or excessive activity. The face performs engagement while the body has drawn back slightly — a micro-distance that was not there before.",
  },

  somatic: {
    heartRate: "Gently elevated — oxytocin and dopamine produce warmth and mild positive arousal, not the sharp spike of fear or rage.",
    breathing: "Deep and synchronized. Research (Feldman, 2007) shows that people in genuine intimate connection synchronize breathing rhythms unconsciously. The breath slows and deepens.",
    muscleState: "Released. This is the state Porges describes as ventral vagal — the face muscles soften, the shoulders drop, the chest opens. The body is genuinely not defended.",
    skinResponse: "Warmth — oxytocin produces a specific warmth at the chest and the face. The skin is receptive: touch at this state is experienced differently from touch in any other state.",
    digestive: "The 'full chest' sensation — the opposite of the hollow chest of grief. Warmth and fullness at the sternum.",
    motorControl: "Slow and deliberate. Gestures are smaller. Touch, when it happens, is slower and more conscious than habitual touch.",
  },

  onset: "Intimacy builds slowly — it cannot be rushed without losing the quality that makes it intimacy. The shift from social engagement to genuine intimacy is often marked by a silence that is not uncomfortable, or by the moment when one person's full attention lands on the other and stays.",

  peak: "At peak, the two people are genuinely present to each other — a relatively rare state. The room outside the conversation ceases to register.",

  recession: "Intimacy recedes when either person defends: a joke, a phone check, a deliberate change of subject. The withdrawal is often immediately obvious to both — the warmth had become reference and its absence is felt.",

  externalReads: [
    "The absence of AU4 (brow lowerer) — the face has genuinely released its default held tension.",
    "Synchronized breathing — not consciously noticed but physically present.",
    "Reduced distance: people in genuine intimacy are slightly closer than social convention requires, without being aware of it.",
    "The quality of attention: the eyes don't drift, the phone isn't checked.",
    "Touch that is slower than habitual touch.",
  ],

  showDontNameRules: [
    "The released brow is the most specific signal — 'the line between her brows had smoothed' describes genuine intimacy without naming it.",
    "Write the synchronized breathing: one person's exhale preceding the other's.",
    "The slightly-closer-than-social distance — a character noticing this in themselves is more powerful than stating the emotion.",
    "The disappearance of the surrounding room — write what the character is no longer aware of.",
    "Slow touch: the deliberateness is the signal.",
  ],

  failureModes: [
    "Intimacy is written as desire — the two states are often confused; intimacy is slower and contains less urgency.",
    "Intimacy is declared rather than shown: 'she felt truly known for the first time.'",
    "The surrounding environment continues to register — at peak intimacy, it stops.",
    "Intimacy is symmetrical and easy — real intimacy is often asymmetric and slightly frightening because it requires vulnerability.",
  ],

  systemDirectives: [
    "Release the brow: specify that AU4 (brow lowerer) is absent.",
    "Include the synchronized breathing if both characters are present.",
    "Write the slightly reduced social distance without having the characters acknowledge it.",
    "Include the disappearance of peripheral awareness.",
    "Write the vulnerability: one or both characters is slightly undefended, and one of them notices this.",
  ],

  writingNotes: "Intimacy in fiction is most powerful when it is slightly frightening — the character is aware of being genuinely seen, and this is not entirely comfortable. The released brow, the unconscious step closer, the silence that neither person fills — these are the signals. The feeling is not warm certainty but warm uncertainty: I am letting this person see something real.",
};

export const DESPAIR: EmotionArchetype = {
  name: "Despair",
  polyvagalState: "dorsal_vagal",
  coreDescription: "Despair is the dorsal vagal system in extended activation — the freeze state becoming a life orientation. Where grief is about the absence of a specific thing, despair is about the impossibility of things in general. The body has concluded that mobilization is pointless. The result is a profound stillness — not peace, but shutdown.",

  facs: {
    primaryAUs: [
      "AU1 (inner brow raise — the oblique brow position of genuine sadness)",
      "AU4 (brow lowerer — adds weight and compression to the expression)",
      "AU15 (lip corner depressor — the mouth corners drawn down)",
      "Reduced AU expression overall: despair often produces a near-flat affect as the system conserves energy",
    ],
    secondaryAUs: [
      "AU46 (wink — infrequent, slow blink as the system reduces effort)",
    ],
    suppressedDisplay: "Performed normalcy: the person goes through the motions of ordinary life. Smiles that don't reach the eyes. Appropriate words delivered at the correct moments. The performance is exactly what it should be and somehow completely hollow.",
  },

  somatic: {
    heartRate: "Below baseline — the dorsal vagal state slows heart rate. The body is not preparing for anything. This is physiologically measurable: vagal tone decreases, heart rate variability drops.",
    breathing: "Shallow and slow. The breath does not fill the body. Sighing — long, slow exhales that seem to deflate the person.",
    muscleState: "Collapsed and heavy. Not the rigid tension of fear or rage but a genuine heaviness — as if gravity has increased. Getting up requires a decision that under normal circumstances is automatic.",
    skinResponse: "Flat, slightly grey. The face loses the micro-expressions of social engagement: the small flickers of reaction that signal a person is present. The skin goes still.",
    digestive: "The hollow chest of grief, but sustained and without the waves. A constant low-level nausea or complete appetite absence.",
    motorControl: "Slowed — all movement is deliberate because nothing is automatic anymore. Psychomotor retardation is the clinical term: the body's movement patterns have slowed. Speaking is effortful.",
  },

  onset: "Despair builds over time — it is not a sudden state. It accumulates through repeated unresolved grief, through sustained helplessness, through the gradual conclusion that effort is futile. By the time it is visible, it has usually been building for a long time.",

  peak: "At peak, the world has the quality of glass: the person can see through it but cannot touch it. Social interaction becomes a performance of sufficient authenticity to avoid alarming others. The person is doing this out of habit or obligation, not connection.",

  recession: "Despair is the slowest emotional state to shift. Even when circumstances improve, the body remains in the conserved state for days to weeks. Small sensory experiences can puncture it briefly — a specific smell, a piece of music — but the baseline returns.",

  externalReads: [
    "The flat affect: the face is not sad — it is still. The micro-expressions that signal presence have reduced.",
    "Slowed movement: the person takes longer to do everything, not because they are thoughtful but because momentum is absent.",
    "The hollow quality in the voice: the breath does not fully support the words.",
    "Eyes that track inward rather than outward.",
    "The performance of being fine that is precisely as functional as it needs to be and no more.",
  ],

  showDontNameRules: [
    "The stillness of the face is more frightening than grief — write the absence of micro-expression.",
    "Movement that requires a decision: 'she stood up, which took a moment' — not because she was weak but because momentum was gone.",
    "The hollow breath: the words arriving without the support of a full inhale.",
    "The glass quality of perception: write what is not registering, what is not landing.",
    "The performed-fine: exact social correctness with zero genuine engagement underneath.",
  ],

  failureModes: [
    "Despair is written as visible sadness — despair often looks like nothing at all.",
    "The despairing character engages fully with their environment — they don't; they perform engagement.",
    "Despair is resolved by a single hopeful moment — real despair cannot be punctured so cleanly.",
    "Physical heaviness is described as exhaustion — despair and exhaustion are distinct; name the specific quality.",
  ],

  systemDirectives: [
    "Reduce facial expression: the face is still, not sad.",
    "All movement requires a deliberate decision — nothing is automatic.",
    "Include the performed-normalcy: the character is going through correct motions with nothing underneath.",
    "The glass quality of perception: write what is not reaching the character.",
    "End the scene without resolving the despair — a single scene does not lift this state.",
  ],

  writingNotes: "Despair is hardest to write because its signal is an absence — the absence of the small micro-expressions, the absence of full breath, the absence of the ordinary momentum that makes movement automatic. The character does not appear broken. They appear fine. And somehow that is worse. The reader understands what the other characters in the scene cannot: this person is not here.",
};
