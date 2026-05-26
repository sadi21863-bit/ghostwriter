import type { CombatStyle } from "../../types";

export const KRAV_MAGA: CombatStyle = {
  name: "Krav Maga",
  origin: "Israel",
  era: "20th-century self-defense system developed for practical civilian and military use; widely practiced today.",
  corePhilosophy: "Krav Maga is built on urgency, simplicity, and survival. It assumes the situation is already bad and tries to solve the immediate threat with the least possible delay. The style rejects theatricality and favors direct action, rapid recovery, and immediate escape when possible.",
  bodyMechanics: `Krav Maga's mechanics are organized around a single priority: reducing the time between threat recognition and a meaningful physical response. Research on stress inoculation training (BIO) shows that pre-loaded defensive postures â hands already raised, weight distributed, knees slightly bent â reduce reaction time by approximately 150â200ms compared to a neutral starting position. This is not a trivial margin. In a surprise attack scenario, 200ms is the difference between a response that lands during the attacker's committed motion versus a response that arrives after the damage is done. The system trains simple, repeatable movements precisely because biomechanical complexity degrades under adrenaline. A gross motor strike â palm heel, forearm shove, knee to groin â retains most of its effectiveness when the practitioner is in a stress response. A technically complex technique loses accuracy and timing under the same conditions.`,
  distancePreference: "Any range, with strong emphasis on immediate close-range resolution and escape.",
  footworkPrinciple: "Footwork is functional and exit-oriented. The fighter moves to create space, maintain balance, and reach the safest exit rather than to win a prolonged exchange. The feet exist to keep the person alive and moving toward the quickest resolution.",
  stances: [
    {
      name: "No-Freeze Guard",
      bodyPosition: "A practical non-ceremonial posture with hands ready to protect the head, knees soft enough to move, torso prepared to explode into immediate action.",
      weightDistribution: "50% front / 50% rear",
      strengths: "Supports immediate reaction and rapid direction change. Already loaded for the first response.",
      weaknesses: "Can look unstable compared with sport stances, and may be unsustainable in a prolonged exchange."
    },
    {
      name: "Exit Ready",
      bodyPosition: "Body angled toward the nearest exit, one side slightly open to allow rapid movement away from the threat.",
      weightDistribution: "55% rear / 45% front",
      strengths: "Makes disengagement faster after the first response lands.",
      weaknesses: "Concedes ground if the opponent keeps pressure on the outside line."
    }
  ],
  strikes: [
    {
      name: "Direct Counter",
      mechanics: "The system's core principle: answer an attack with an immediate, simple counter rather than exchange long combinations. Gross motor movements â palm heel, hammer fist, elbow â retain accuracy under adrenaline where fine-motor-dependent techniques degrade. The body answers along the most direct line available from its current position.",
      setup: "The threat is immediate and there is no time for elaborate setup.",
      execution: "The practitioner responds with a fast, direct action from the safest available position. No wind-up. No announcement.",
      recovery: "The body does not linger â it either continues to protect or moves to exit.",
      counter: "Stay outside the initial line, keep the defender reacting, and deny them the moment of clean contact."
    },
    {
      name: "Retzev Pressure (Continuous Motion)",
      mechanics: "Once the first action lands, Krav Maga does not stop to assess. The body chains simple action into the next without a visible pause. The logic is that an attacker who is absorbing continuous pressure cannot organize a counterattack. The sequence ends only when the threat is reduced enough to disengage.",
      setup: "The defender has already entered the response phase.",
      execution: "The body chains one simple action into the next. No reset. No pause for evaluation.",
      recovery: "The sequence ends when danger is reduced enough to create an exit.",
      counter: "Break the rhythm early or force the defender into a bad angle before the pressure line settles."
    },
    {
      name: "Improvised Tool Use",
      mechanics: "The system explicitly frames available objects as legitimate defensive tools, which changes the body's orientation from sport exchange to practical problem-solving. A bag, a book, a bottle in hand becomes an extension of the first response. The mechanics are not about weapon forms â they are about integrating whatever is available with minimal cognitive load.",
      setup: "A usable object is within reach.",
      execution: "The practitioner integrates the object into the response without delay or technique ceremony.",
      recovery: "The body stays mobile and ready to disengage whether or not the tool remains in hand.",
      counter: "Deny access to the tool, collapse the space, or force the defender to drop it."
    }
  ],
  defenses: [
    {
      name: "Cover and Move",
      mechanics: "Defense must lead to safety, not to a prolonged contest. Cover protects the body long enough to create an exit line. Unlike a formal block, the cover does not try to redirect the attack â it absorbs or deflects it while the feet are already moving to a better position.",
      setup: "A sudden attack is already in motion.",
      execution: "The practitioner protects the vulnerable line and moves simultaneously. Cover and exit are one action.",
      recovery: "The priority is escape or continued protection, not style.",
      counter: "Trap the movement path so the defender cannot convert cover into exit."
    }
  ],
  strengthAgainst: [
    "Surprise attacks and chaotic situations â the system is built for immediate response under stress.",
    "Opponents who hesitate after committing â Krav Maga rewards instant action into that gap.",
    "People who expect a sporting exchange â the style does not follow sport rules or etiquette."
  ],
  weakAgainst: [
    "Controlled sport specialists who can force prolonged exchanges and remove the ability to exit.",
    "Opponents who stay calm, manage distance, and do not give the reactive cue the system wants.",
    "Environments where the defender cannot move freely after the initial cover."
  ],
  signatureTells: [
    "The body compresses instantly when danger appears rather than settling into a long stance.",
    "The hands rise into a practical shield rather than a formal guard position.",
    "The eyes and torso are already scanning for the exit even while the hands are responding.",
    "There is almost no wasted motion â the whole body is trying to finish the problem fast and leave."
  ],
  pacing: "Krav Maga has the fastest emotional pacing because its job is not to duel but to survive. The first exchange should feel abrupt, efficient, and slightly ugly, followed by immediate movement toward escape or containment. It is crisis management, not performance.",
  writingNotes: "A character trained in Krav Maga reads as direct, alert, and allergic to nonsense. This training builds a mind that asks 'How do I get safe now?' rather than 'How do I win beautifully?' In fiction, that produces someone who is practical under pressure, decisive in emergencies, and genuinely impatient with posturing."
};
