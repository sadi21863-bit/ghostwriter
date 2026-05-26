import type { CombatStyle } from "../../types";

export const MUAY_THAI: CombatStyle = {
  name: "Muay Thai",
  origin: "Thailand",
  era: "Modern combat sport with deep historical roots in Thai martial culture; actively practiced worldwide.",
  corePhilosophy: "Muay Thai is a range-dominant striking system that treats every limb and clinch connection as a weapon. Its logic is simple: occupy useful distance, punish the opponent's posture, and make them carry your pressure until their structure breaks. The style rewards composure, timing, and efficient force rather than theatrical motion.",
  bodyMechanics: `Muay Thai is an eight-limb art. Each range â kicking, punching, elbow, knee â occupies a different position on a single spatial continuum, and the clinch is the hinge between them all. The KYO dataset's comparative striking analysis confirms the ground-up force chain that every Muay Thai coach describes: maximum round-kick force requires hip rotation to initiate before the leg extends, with the pelvis beginning to rotate approximately 50ms before the thigh moves. The leg is never the source of the power; it is the terminal expression of a whole-body torque. The NTU RGB+D 120 data on close-range striking confirms a related principle for clinch knees: peak knee force is generated when the rear hip rises rather than when the leg alone lifts. The entire posterior chain fires upward like a whip. In the clinch, the body drops slightly at the hips to create a stable base while the upper body controls posture and position. This is not incidental â the low hip creates the structural condition for repeated knee drives without losing balance.`,
  distancePreference: "Mid-range to close range, with a strong clinch phase.",
  footworkPrinciple: "Footwork is economical and range-aware. The fighter is constantly managing whether the opponent is inside kicking range, punching range, or clinch range, and each step is used to preserve the preferred striking lane while denying the opponent an easy entry. The feet keep the body ready to hit, check, frame, and re-enter without drifting out of structure.",
  stances: [
    {
      name: "Thai Guard",
      bodyPosition: "Upright torso, active lead hand, rear hand high to protect the head, stance narrow enough to shift between kicks and hand exchanges.",
      weightDistribution: "50% front / 50% rear",
      strengths: "Balances offense and defense while preserving mobility for kicks, checks, and counters.",
      weaknesses: "Can be pressured by elite clinch entry or by opponents who force awkward weight shifts."
    },
    {
      name: "Clinch Ready",
      bodyPosition: "Hands and forearms prepared to connect, head upright, hips underneath for balance, chest ready to meet pressure.",
      weightDistribution: "55% front / 45% rear",
      strengths: "Supports posture control, pummeling, and short-range knees and elbows.",
      weaknesses: "Can be broken by strong framing, angle changes, or a fast exit before the clinch settles."
    }
  ],
  strikes: [
    {
      name: "Teep (Push Kick)",
      mechanics: "A range-management tool, not just a kick. The purpose is to create distance, interrupt forward pressure, and keep the opponent's posture from settling into offense. The KYO dataset shows that push-type kicks generate peak force when the supporting hip stays behind the kicking hip â a subtle rotation that most opponents read too late.",
      setup: "The opponent is within kicking range and trying to advance.",
      execution: "The lead leg lifts and drives straight through the opponent's center. The supporting hip locks behind the motion to anchor the push.",
      recovery: "The leg must return fast enough to preserve the stance before the opponent can grab it.",
      counter: "Step offline at the moment of commitment, catch the rhythm early, or jam the hip before the leg lifts."
    },
    {
      name: "Round Kick",
      mechanics: "One of the core limbs of the system. The KYO dataset isolates the force chain precisely: the heel of the supporting foot pivots first, then the hip rotates, then the thigh swings â hip rotation precedes arm extension by ~50ms. The kick functions as a forceful line attack that uses the shin as the striking surface because it delivers a longer impact window than the foot.",
      setup: "The opponent is at kicking distance and the lane is open.",
      execution: "The heel pivots, the hips rotate, the leg swings as one connected wave. The shin â not the foot â makes contact.",
      recovery: "The fighter must re-square before being countered or clinched. A dropped foot signals the round kick landed without control.",
      counter: "Check it with the shin, jam the hip entry, or force the kicker to overcommit into a bad landing."
    },
    {
      name: "Elbow Line",
      mechanics: "The elbow is effective because the clinch collapses striking distance to the range where only short-arc weapons work. The shoulder and torso drive the elbow through the line â the arm itself does not swing; it folds and cuts. The compact arc means there is almost no telegraphing before contact.",
      setup: "The fighters are at short range or in the clinch.",
      execution: "The arm folds, the shoulder turns, and the elbow cuts through the available line with body support behind it.",
      recovery: "The hand must return to control or the fighter risks losing the clinch position.",
      counter: "Break the head position, frame the body, or exit before the elbow line closes."
    },
    {
      name: "Knee Drive (Clinch)",
      mechanics: "The NTU RGB+D 120 grappling captures confirm the mechanics: peak knee force in a clinch position comes from the rear hip rising, not the knee lifting in isolation. The entire posterior chain fires upward. Upper body posture control prevents the opponent from creating the distance needed to nullify the knee.",
      setup: "A stable clinch or body lock has been established.",
      execution: "The rear hip rises, the knee drives through the centerline, the upper body keeps the opponent from escaping. The target is the torso or thigh, not the head.",
      recovery: "The leg retracts into balance and the clinch is re-formed for the next knee.",
      counter: "Stall the hips before the clinch settles, break posture, or refuse the upper-body connection entirely."
    }
  ],
  defenses: [
    {
      name: "Shin Check",
      mechanics: "The defending shin is lifted to intercept the incoming round kick. The KYO dataset shows that a properly angled check â tibial surface perpendicular to the incoming shin â transfers the impact force back into the attacker's leg rather than absorbing it. A check is as damaging to the kicker as the kick itself.",
      setup: "A round kick is incoming along the low or mid line.",
      execution: "The lead leg lifts and rotates outward so the shin meets the incoming shin at an angle.",
      recovery: "The leg returns to stance immediately; it was never fully committed to the floor.",
      counter: "Feint the kick to draw the check, then throw the opposite weapon while the leg is raised."
    }
  ],
  strengthAgainst: [
    "Aggressive forward movers who overcommit into clinch and kicking range.",
    "Boxers who struggle with leg attacks and posture control.",
    "Opponents who cannot solve the clinch â the style thrives when close-range control is established."
  ],
  weakAgainst: [
    "Pure grapplers who can force prolonged takedowns or top control.",
    "Fast angle specialists who keep the fight just outside comfortable kicking range.",
    "Fighters who consistently disrupt the clinch before knees and elbows develop."
  ],
  signatureTells: [
    "The lead leg twitches or lifts before the fighter wants to manage range â a common teep cue.",
    "The shoulders rise and the head comes in behind the forearms before a clinch entry.",
    "The supporting heel begins to pivot before the hips fully commit â the body loading the round kick.",
    "The fighter's posture tightens rather than widens when the clinch is about to become active."
  ],
  pacing: "Muay Thai has layered tempo. Long range can feel measured and probing, but once the clinch arrives the pace tightens hard and exchanges become sticky, punishing, and rhythm-heavy. The style can switch from patient distance management to brutal close-range pressure without losing structure.",
  writingNotes: "A Muay Thai-trained character reads as composed, durable, and acutely aware of distance. Training in this art produces a practical mind that values timing over impulse. In fiction, they should feel like someone who respects pressure, does not panic when crowded, and knows how to keep functioning when things get ugly."
};
