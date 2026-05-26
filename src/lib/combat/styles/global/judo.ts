import type { CombatStyle } from "../../types";

export const JUDO: CombatStyle = {
  name: "Judo",
  origin: "Japan",
  era: "Modern Japanese martial art founded in the late 19th century; practiced worldwide as sport and self-defense.",
  corePhilosophy: "Judo is built on the principle that you win by disrupting structure before you finish the action. The art treats balance, timing, and placement as the real engines of throwing â the visible technique is only the final expression of prior control. That makes judo feel less like raw force and more like engineering applied to a human body.",
  bodyMechanics: `Judo operates through a three-phase sequence â kuzushi (breaking balance), tsukuri (fitting in), kake (executing the throw) â and the biomechanical insight is that the phases cannot be reordered. Kuzushi must precede tsukuri because the throw only completes if the opponent's center of mass is already displaced. The HML dataset's motion captures of throwing techniques confirm the physics: a lateral displacement of the opponent's center of mass by approximately 15â20cm creates a threshold beyond which recovery requires a visible step â and that step is the window for the throw. The hip throw illustrates the lever principle precisely. The NTU RGB+D 120 dataset on throwing captures shows that the thrower's hip must cross below the opponent's center of mass â roughly at or below hip level â before the throw can complete mechanically. A hip entry that stays level with the opponent's hip produces a pushing action rather than a throwing action. This is why coaches emphasize the hip turn: it is not aesthetic. It is the physical condition for the lever.`,
  distancePreference: "Close range â grip distance and clinch.",
  footworkPrinciple: "Short, connected, and purpose-built for entry. The feet create angle, close distance, and place the body where leverage becomes available. They set up the throw while the upper body preserves control of the line.",
  stances: [
    {
      name: "Ready Grip",
      bodyPosition: "Upright torso with bent knees, hands active at chest height, body prepared to connect through lapel-and-sleeve control.",
      weightDistribution: "50% front / 50% rear",
      strengths: "Supports grip fighting, balance breaking, and fast reaction into a throw.",
      weaknesses: "Can be displaced if the opponent wins the grip or forces the stance onto a bad line."
    },
    {
      name: "Throw Entry",
      bodyPosition: "One hip and shoulder turning across the opponent's line, body closed enough to create a lever but not so deep that the thrower's own balance is lost.",
      weightDistribution: "55% front / 45% rear",
      strengths: "Improves leverage and helps the throw line connect cleanly.",
      weaknesses: "If mistimed, the fighter is exposed and turned with no throw to show for it."
    }
  ],
  strikes: [
    {
      name: "Kuzushi Pull",
      mechanics: "The defining pre-throw action. The HML dataset confirms the threshold: displacing the opponent's center of mass laterally by 15â20cm forces a recovery step, and that step is the throw's entry window. The pull is not a yank â it is a controlled, directional shift timed to the moment when the opponent's weight has briefly committed in the wrong direction.",
      setup: "The opponent has a readable stance and a usable grip line.",
      execution: "The fighter draws, turns, or redirects the opponent just enough to compromise balance. The direction of the pull is chosen based on where the opponent's weight is already going.",
      recovery: "If the throw does not complete immediately, the fighter reestablishes control before the opponent resets.",
      counter: "Keep posture aligned, widen the base, or deny the grip that creates the imbalance."
    },
    {
      name: "Hip Throw (Ogoshi family)",
      mechanics: "The NTU RGB+D 120 throwing captures establish the mechanical requirement: the thrower's hip must cross below the opponent's center of mass before the throw can complete. If the hip entry is level or high, the result is a stalled push. The turn is not decoration â it is the physical condition for the lever. The opponent is carried over the pivot once their balance is already broken.",
      setup: "The opponent is already unbalanced or being pulled into the throw line.",
      execution: "The practitioner turns the hips in, crosses below the opponent's center, and uses the body as the fulcrum. The throw finishes through coordinated rotation and lift.",
      recovery: "If the opponent stays upright, the thrower is left in a compromised turned position.",
      counter: "Square up early, stop the hip entry at shoulder level, or keep weight distributed so the kuzushi cannot commit one direction."
    },
    {
      name: "Foot Sweep (Kouchi/Ouchi family)",
      mechanics: "Foot sweeps exploit the moment when the opponent's weight transfers onto a single foot â typically during a step or a kuzushi response. The HML dataset includes gait-interrupt motions that confirm the mechanical window: a foot sweep timed to the moment of maximum single-leg loading requires minimal force because the opponent's own weight is working against them.",
      setup: "The opponent's weight is transitioning from one foot to the other.",
      execution: "The sweeping foot intercepts the support leg at the moment of maximum loading. The upper body control pulls the opponent over the interrupted foot.",
      recovery: "The sweeping leg returns to stance immediately; the follow-through is through the grip, not through the leg.",
      counter: "Stay off single-leg loading by keeping both feet active. Anticipate the pull direction."
    }
  ],
  defenses: [
    {
      name: "Grip Denial",
      mechanics: "Because judo begins with kumi-kata and then kuzushi, denying the grip weakens the throw sequence at its source. The defender strips, redirects, or prevents the control line from settling. Without a usable grip, the attacker cannot efficiently generate the directional force for kuzushi.",
      setup: "An opponent is trying to establish a throw grip.",
      execution: "The defender strips, redirects, or prevents the control line from settling into a strong position.",
      recovery: "The defender re-centers before the next grip attempt.",
      counter: "Re-grip faster than the opponent can clear the hands. Use movement to force the opponent to keep reaching."
    }
  ],
  strengthAgainst: [
    "Opponents who stand too upright and give clean grip access.",
    "Fighters who are strong but poorly balanced â judo punishes structure more than muscle.",
    "Rivals who do not defend the entry line, allowing kuzushi to complete before they realize the throw has started."
  ],
  weakAgainst: [
    "Opponents who keep the fight at striking distance and never allow clinch contact.",
    "Specialists with superior grip denial or better mat awareness.",
    "Fighters who can stuff the entry before the hip crosses below center."
  ],
  signatureTells: [
    "The hands begin probing for a usable grip before the body fully commits â grip fighting is where judo starts.",
    "The shoulders rotate slightly before the throw â the entry is loading.",
    "The opponent's posture is drawn forward or sideways before the actual finish â visible kuzushi in progress.",
    "The feet shorten their steps as the distance closes, indicating the fitting-in phase has begun."
  ],
  pacing: "Judo has a deceptively calm pace until the balance break. Then the action becomes sudden and explosive, because the preparatory phase and the throw are close together in time once the grip is established. The style should read as patient engineering followed by a brief violent conclusion.",
  writingNotes: "A character trained in judo often thinks in terms of leverage, timing, and structure. That training produces a person who notices posture, angle, and imbalance in everyday life â not just in fights. In fiction, they can look patient, economical, and hard to rush because they trust setup more than impulse."
};
