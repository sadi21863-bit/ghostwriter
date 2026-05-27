// src/lib/emotional/emotions/grief-rage-fear.ts
import type { EmotionArchetype } from "../types";

export const GRIEF: EmotionArchetype = {
  name: "Grief",
  polyvagalState: "dorsal_vagal",
  coreDescription: "Grief is not sadness. It is the body's response to the removal of an attachment — something the nervous system was organized around is now absent. The body keeps reaching for what is gone. The reaching, and the absence that meets it, is grief.",

  facs: {
    primaryAUs: [
      "AU1 (inner brow raise — the single most reliable grief marker; rare to fake)",
      "AU15 (lip corner depressor — draws the mouth corners down)",
      "AU17 (chin raiser — creates the characteristic chin dimpling of suppressed crying)",
    ],
    secondaryAUs: [
      "AU4 (brow lowerer — adds weight to the expression)",
      "AU6+AU12 (Duchenne smile components — present in bittersweet grief, memories of the lost)",
    ],
    suppressedDisplay: "When concealing grief: the person performs neutral or slightly upbeat expression, holds the jaw rigid to prevent the chin raiser (AU17), flattens the lips against the natural depressor pull. The suppression creates a strained stillness around the mouth.",
  },

  somatic: {
    heartRate: "Initially elevated during acute loss, then slows in sustained grief. In the dorsal vagal collapse state, heart rate drops below baseline — the body conserving rather than mobilizing.",
    breathing: "Shallow and irregular. The characteristic 'grief breath' is a sudden involuntary deep inhale followed by a held exhalation — the body attempting to fill a physical emptiness. Sighing is frequent and involuntary.",
    muscleState: "Heavy. Limbs feel weighted. Sustained grief produces genuine muscular fatigue as the nervous system maintains a low-grade stress response for extended periods. The shoulders drop and the chest compresses inward.",
    skinResponse: "Pallor in acute loss. The eyes redden and swell from crying. A characteristic chilling of the extremities occurs as blood flow concentrates centrally.",
    digestive: "The 'hollow chest' sensation is consistent across cultures — a physical emptiness at the sternum. Nausea in acute grief. Appetite suppression or, in some, compulsive eating as a regulation strategy.",
    motorControl: "Slowed, deliberate movement. Tasks that were automatic become conscious efforts. Grief disrupts procedural memory — a grieving person fumbles keys, forgets the middle step of familiar sequences.",
  },

  onset: "Grief does not arrive all at once. The first response to significant loss is often numbness — the dorsal vagal system protecting the nervous system from the full signal. Then it arrives in waves: periods of apparent stability interrupted by sudden acute flooding.",

  peak: "At peak, the body loses voluntary control: the jaw trembles, the throat closes, the chest compresses. Breathing becomes the entire body's occupation. There is no thinking at this moment — only the body processing what the mind cannot yet hold.",

  recession: "Grief does not end — it recedes. After an acute wave, the body feels evacuated: light, hollow, slightly confused. Then a return to surface function. The waves become less frequent but not less intense. Some griefs never fully stop waving.",

  externalReads: [
    "The inner brow raise (AU1) is the most visible and most honest signal — it appears when the person is not performing grief, only experiencing it.",
    "The held jaw — the rigid stillness of someone actively preventing AU17 — reads as barely-contained feeling.",
    "Slowed movement and the heaviness of limbs is visible. A grieving person moves like they are carrying something.",
    "The eyes lose focus and track inward, even in the middle of conversation — the person is somewhere else.",
    "Sudden stillness: the body can go completely motionless when a grief wave is about to break.",
  ],

  showDontNameRules: [
    "Never write 'she felt sad' or 'grief washed over him' — name the body, not the feeling.",
    "The hollow chest is physical: describe the specific sensation of the sternum, not the emotion it represents.",
    "The inner brow raise (AU1) is the grief tell — a character noticing this in another character is a more powerful line than 'he looked sad.'",
    "Show the interruption of automatic behavior: the keys dropped, the familiar street suddenly unrecognized.",
    "The involuntary grief breath — the sudden inhale that arrives unbidden — is more honest than any description of feeling.",
    "Grief has a smell: acute grief produces cortisol and this is detectable by others. Something in the room has changed.",
  ],

  failureModes: [
    "The character cries immediately and fluidly — real grief is often dry-eyed at first.",
    "Grief is uniform — continuous sadness rather than waves interrupted by apparent normality.",
    "The character articulates their grief clearly — grief disrupts language; grieving people often cannot say the thing directly.",
    "Physical grief is described generically: 'he felt a weight on his chest' — use the specific, researched symptoms.",
    "Grief resolves within the scene — real grief does not have a single cathartic moment that ends it.",
  ],

  systemDirectives: [
    "Describe the body, not the feeling. Every emotional signal must have a physical location.",
    "Use the wave pattern: apparent normality → sudden flooding → recession → hollow aftermath.",
    "At least one involuntary physical response must appear: the grief breath, the AU17 chin tremor, the fumbled object.",
    "The character should attempt to conceal the grief — and the concealment should be partially visible.",
    "End the scene in the recession, not the peak — the hollow aftermath is where the real writing lives.",
  ],

  writingNotes: "The most powerful grief writing is not about sadness — it is about the body's failure to accept the absence. A character reaching for a phone to call someone who is dead. Making two cups of coffee automatically. The body has not been updated. That gap — between the body that still knows the pattern and the world that has changed — is where grief lives in fiction.",
};

export const RAGE: EmotionArchetype = {
  name: "Rage",
  polyvagalState: "sympathetic",
  coreDescription: "Rage is the sympathetic nervous system at maximum mobilization — the body fully committed to destruction of a threat. It is not the same as anger, which still has a cognitive component. Rage is what happens when the cognitive brake fails. The body is running its survival program at full output. The person is no longer fully in the room.",

  facs: {
    primaryAUs: [
      "AU4 (brow lowerer — the single most reliable anger marker; creates the V-shape between brows)",
      "AU5 (upper lid raiser — the whites of the eyes become visible above the iris)",
      "AU23 (lip tightener — the lips compress and narrow)",
      "AU24 (lip pressor — lips pressed together, jaw clenches)",
    ],
    secondaryAUs: [
      "AU17 (chin raiser — present in frustrated rage, adds vulnerability underneath)",
      "AU25+26 (lips part, jaw drop — present when rage becomes shouting)",
    ],
    suppressedDisplay: "Controlled rage: the brow lowerer (AU4) stays active but the person prevents AU5 (lid raiser) and controls AU23/24, producing an expression of intense focused pressure rather than open fury. The jaw is the tell — rigid, slightly forward.",
  },

  somatic: {
    heartRate: "Sharply elevated — adrenaline and cortisol drive heart rate to 150-180 bpm in acute rage. The heartbeat becomes physically audible to the person experiencing it: heard in the ears, felt in the throat and fingertips.",
    breathing: "Deep, fast, and slightly irregular. The chest expands. The nostrils flare to increase oxygen intake. In controlled rage: deliberately slowed breathing as a regulation attempt, visible as a series of careful, slightly too-long exhales.",
    muscleState: "Tension that has nowhere to go. Hands become fists without a decision being made. The jaw is held shut by force. The neck and shoulders are rigid. This muscle activation is real preparation for physical violence — the body is not performing.",
    skinResponse: "Flushing — blood flow increases to the face, neck, and hands. Veins in the temples and neck become visible. In some people, pallor instead of flush: a cold rage where blood flow to the skin actually decreases.",
    digestive: "Nausea is common — the body has diverted blood flow away from digestion. The stomach feels empty and acidic. Adrenaline suppresses digestion completely.",
    motorControl: "Hyperactivated but unsubtle. Fine motor control degrades: hands shake, objects are gripped too hard and break or are knocked over. The urge to move, to break, to throw is physical and specific.",
  },

  onset: "Rage has a specific onset signature: a hot wave that begins in the chest and moves upward. It arrives faster than most emotions — within 200-500ms of the trigger stimulus. The cognitive system often registers the rage signal after the body has already committed to it.",

  peak: "At peak, the visual field narrows (tunnel vision). Peripheral perception drops. The person is physiologically focused on the threat target to the exclusion of everything else. Sounds become either very loud or very quiet. Time distorts.",

  recession: "Rage drops as fast as it rose — adrenaline clears in minutes. The aftermath is physical exhaustion, slight nausea, and often shame or embarrassment. The hands stop shaking. There is sometimes genuine confusion about what happened: 'I don't know where that came from.'",

  externalReads: [
    "The brow lowerer (AU4) plus upper lid raiser (AU5): the face has a particular focused intensity — the eyes are too open, not blinking at the normal rate.",
    "The voice changes before the person is aware they are showing emotion: it drops in pitch and slows in rhythm as rage builds.",
    "The jaw: clenched, slightly forward, a muscle flickering at the hinge.",
    "The hands: not gesturing normally. Too still, or gripping something, or slightly ahead of the body as if prepared.",
    "Stillness: controlled rage is often very still. The stillness is not calm — it is the body using all its energy to hold.",
  ],

  showDontNameRules: [
    "Never write 'he was furious' — write the jaw, the hands, the narrowing of the visual field.",
    "The hot wave moving upward through the chest is specific and physical — use it.",
    "Tunnel vision at peak: describe what disappears from the character's awareness, not what they see.",
    "The voice change is often the first visible sign — it changes before the face does.",
    "After rage: the shaking hands and the nausea are as important as the rage itself.",
  ],

  failureModes: [
    "Rage is portrayed as loud — many of the most dangerous rages are quiet.",
    "The character articulates their rage in complete sentences — rage degrades language.",
    "Rage is morally clear — real rage often arrives about the wrong thing, or the wrong person.",
    "The physical symptoms are named rather than shown: 'his blood pressure rose' instead of 'the sound of his heartbeat was in his ears.'",
    "Rage resolves through expressing it — often rage recedes and leaves the person more frightened, not relieved.",
  ],

  systemDirectives: [
    "Describe the specific muscle groups — brow lowered, lid raised, jaw clenched, hands fisted — not the emotional category.",
    "Include tunnel vision if rage is at peak — what is no longer visible, no longer heard.",
    "The voice must change before the character decides to show rage: it drops and slows involuntarily.",
    "Include the hot wave onset if showing rage arriving in the scene.",
    "End with the aftermath: the shaking, the nausea, the sudden clarity that something was crossed.",
  ],

  writingNotes: "The most dangerous rage in fiction is the controlled kind — the person who has all the physical symptoms and is using every resource to contain them. The reader can see the jaw, the hands, the breathing, the stillness. The character is barely in the room. The other character in the scene doesn't know whether they are safe. That uncertainty is the scene's power.",
};

export const FEAR: EmotionArchetype = {
  name: "Fear",
  polyvagalState: "sympathetic",
  coreDescription: "Fear is the body's rapid preparation for threat response — a signal from the amygdala that precedes conscious threat evaluation by approximately 200ms. The body is already acting when the mind registers what is happening. This timing is fundamental to writing fear honestly: the body moves first.",

  facs: {
    primaryAUs: [
      "AU1+AU2 combined (inner + outer brow raise together — the brow rises as a unit, different from surprise which is AU1+2+5D)",
      "AU4 (brow lowerer — present simultaneously, creating the characteristic compressed fearful brow)",
      "AU20 (lip stretcher — corners of mouth pull back and slightly downward, exposing lower teeth)",
    ],
    secondaryAUs: [
      "AU5 (upper lid raiser — may accompany acute fear)",
      "AU26 (jaw drop — present in acute shock-fear)",
    ],
    suppressedDisplay: "When concealing fear: the person overcorrects into flat affect or performs confidence. The brow cannot fully normalize — a residual AU1+2 combination persists. The body contradicts the performance: hands that are very still, breath that doesn't quite land.",
  },

  somatic: {
    heartRate: "Sharply elevated — the amygdala signals the adrenal glands within 200ms of threat detection, before conscious awareness. Heart rate spikes to 120-160 bpm. The person feels this in the chest and throat before they identify it as fear.",
    breathing: "Shallow and high in the chest. The diaphragm contracts, breathing becomes thoracic rather than abdominal. In severe fear, breath can momentarily stop entirely — the freeze response.",
    muscleState: "Tension in the large muscle groups — legs, arms, trunk — as the body prepares to run or fight. Simultaneously, the bladder and bowel can release (evolutionary: lightening the body for flight). The small muscles of the face and hands may tremble.",
    skinResponse: "Pallor — blood flow redirects to the large muscle groups needed for fight/flight. The skin goes cold. Goosebumps appear (vestigial threat-display from our ancestors). Sweating activates — particularly on the palms, soles, and forehead.",
    digestive: "The stomach drops — the body's blood supply is redirected and the gut registers this as a physical sensation of falling or hollowing. Nausea is common.",
    motorControl: "At low-medium fear: hyperactivated, ready, jumpy. Startle response amplified. At high fear (dorsal vagal shift): the opposite — the freeze response produces motor inhibition, the inability to move or speak.",
  },

  onset: "Fear arrives before the person knows why they are afraid — the amygdala fires on incomplete pattern recognition. The somatic signal arrives first, approximately 200ms before the conscious thought 'I am afraid.' This lag is narratively important: the body knows before the character does.",

  peak: "At peak, the body has made its choice — fight, flight, or freeze — before the conscious mind has assessed the threat. The character may find themselves already moving toward the door, already rigid, already silent. They catch up to themselves.",

  recession: "Fear recedes as the threat resolves or is determined to be non-existent. The adrenaline clears over 20-60 minutes — long after the threat is gone, the body remains on alert. The aftermath is fatigue and a residual jumpiness.",

  externalReads: [
    "The brow configuration — raised and compressed simultaneously — is diagnostically fear and cannot easily be faked.",
    "The lip stretcher (AU20): the mouth corners pull back toward the ears rather than downward. Subtler than a frown.",
    "The skin is cold to the touch. The hands are clammy.",
    "The person is not blinking at the normal rate — blink rate drops during acute threat focus.",
    "The body is oriented toward the exit even if the person is pretending to be at ease.",
  ],

  showDontNameRules: [
    "The body moves before the character understands why — a step back taken without a decision, a hand reaching for the wall.",
    "Cold hands and pallor are specific and physical. 'Her hands were cold' is more powerful than 'she was afraid.'",
    "The stomach drop — describe the physical falling sensation, not the emotional one.",
    "The 200ms lag: the character is already in fear before the fearful thought arrives. Show this sequence.",
    "Goosebumps on the forearms, the back of the neck — not because of cold.",
  ],

  failureModes: [
    "Fear is described primarily as a thought: 'he realized he was in danger' — show the body that already knew.",
    "Fear produces normal speech — acute fear degrades speech: sentences fragment, volume drops to a whisper or rises involuntarily.",
    "Fear is active and purposeful — extreme fear often produces freeze, not action.",
    "The character understands their fear — real fear is often about the wrong thing, displaced, or irrational.",
    "Fear resolves when the threat resolves — the body remains afraid for 20-60 minutes after safety.",
  ],

  systemDirectives: [
    "The body must move before the character consciously decides — at least one involuntary response precedes awareness.",
    "Include the cold extremities, the stomach drop, or the goosebumps — specific and physical.",
    "If fear is high, include either the freeze (motor inhibition) or the hyper-alert jumpiness — not vague anxiety.",
    "Speech degrades under fear — include at least one moment where the character cannot access words normally.",
    "End in the aftermath: still frightened after safety, the body unconvinced.",
  ],

  writingNotes: "The 200ms gap between body and mind is the most powerful tool in fear writing. The character catches themselves already backed against the wall, already gone silent, already unable to speak — and then understands why. That sequence — body first, mind second — is what makes fear feel real. It's also what makes it frightening for the reader: the character is not in control of their own response.",
};
