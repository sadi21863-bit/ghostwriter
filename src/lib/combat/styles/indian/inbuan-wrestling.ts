import type { CombatStyle } from "../../types";

export const INBUAN_WRESTLING: CombatStyle = {
  // NOTE: Limited dedicated biomechanics dataset coverage for this art.
  // Mechanics derived from Mizo sport records and practitioner documentation.
  name: "Inbuan Wrestling",
  origin: "Mizoram, India",
  era: "Traditional Mizo practice, documented as a regional sport from the 18th century and still practiced today.",
  corePhilosophy: "Inbuan is built around control under constraint. The match rewards discipline, balance, and grip integrity more than spectacle. The wrestler who stays composed inside strict rules usually owns the pace. Containment is the weapon: if the structure breaks, the bout is lost.",
  bodyMechanics: "Inbuan's rules create a specific biomechanical environment that has no close equivalent in modern wrestling systems. The prohibition on bending the knees eliminates the low-level penetration shots and sprawl mechanics that define most grappling sports. Without these, all force generation must come from the trunk, the arms, and short hip movements while the legs maintain an upright base. The belt â mandatory and tight throughout the bout â functions as both grip anchor and control tool. Because the belt cannot be surrendered, the distance between the wrestlers is constrained to a narrow band: close enough to maintain the mandatory belt contact, far enough that neither fighter is fully inside the other's base. Balance disruption must be generated through short-axis rotations, lateral hip drives, and directional pulls that shift the opponent's center of mass without requiring the attacker to lower their own. The win condition â lifting the opponent off the ground â requires this upward force to come from trunk and arm drive rather than from a hip-drop and lift sequence, which makes Inbuan lifts fundamentally different from judo-style throws.",
  distancePreference: "Very close range with constant belt and upper-body contact.",
  footworkPrinciple: "Compact, upright, and boundary-aware. The wrestler must stay inside a 15â16 foot circle and cannot bend the knees significantly, so movement is small adjustments, angle preservation, and base maintenance under pressure.",
  stances: [
    {
      name: "Upright Belt Guard",
      bodyPosition: "Torso tall with a slight forward inclination, hips stacked under the shoulders, knees straight per the rules, both hands securing belt or upper-body contact.",
      weightDistribution: "50% front / 50% rear",
      strengths: "Supports balance, rule compliance, and quick grip exchanges while keeping the body hard to off-balance.",
      weaknesses: "Can be pressured by superior grip strength or sudden balance shifts."
    },
    {
      name: "Pressure Step",
      bodyPosition: "One foot slightly advanced, hips square, chest ready to meet the opponent, weight centered for lateral pressure.",
      weightDistribution: "55% front / 45% rear",
      strengths: "Improves forward pressure and pins the opponent inside the ring.",
      weaknesses: "If overcommitted, can be pulled off-line during a grip exchange."
    }
  ],
  strikes: [
    {
      name: "Belt Clamp",
      mechanics: "The belt is mandatory and central to the contest, so the practical mechanics are about maintaining tight connection, preventing slack, and using the opponent's movement against them. The trunk and arms generate lateral pressure through the belt grip â short rotational pulls that probe the opponent's base without requiring a knee bend.",
      setup: "Both wrestlers are inside the circle and belt grip is intact.",
      execution: "The wrestler closes, secures the belt, and keeps the torso aligned while denying slack. Lateral trunk rotations generate directional force.",
      recovery: "If grip slips, reestablish immediately or lose the control advantage.",
      counter: "Force a grip reset, widen the angle, or drive the action toward the boundary."
    },
    {
      name: "Balance Pull",
      mechanics: "The win condition requires lifting the opponent off the ground, so all balance disruption is oriented upward or into instability rather than downward. The wrestler creates micro-imbalances through directional belt pulls while their own base remains stable, waiting for the moment the opponent's weight is light on one foot.",
      setup: "The opponent is committed to a stance and their weight is readable through the belt connection.",
      execution: "The wrestler tightens the hold, changes direction, and uses short controlled body motion to make the opponent light on their feet.",
      recovery: "The attempt either creates a lift opening or stalls into a static clinch for repositioning.",
      counter: "Keep the base wide, stay inside the circle, and refuse the directional angle so the pull never develops into a lift."
    },
    {
      name: "Trunk-Drive Lift",
      mechanics: "The match is won when one wrestler lifts the other off the ground. Because knee-bending is prohibited, the lift cannot use the standard hip-drop-and-drive sequence from modern wrestling. Instead, it requires trunk extension â the spine drives upward while the arms maintain the belt connection. This is a pure strength-and-timing move: the opponent must already be partially destabilized for the trunk drive to complete the lift.",
      setup: "The opponent is already compromised in balance and the belt connection is strong.",
      execution: "The wrestler tightens the hold and drives upward through the trunk and arms while keeping the action inside the ring.",
      recovery: "If the lift does not complete, both wrestlers return to tight clinch.",
      counter: "Stay heavy through the hips, resist the upward pull, and force the lift into a stalled contest."
    }
  ],
  defenses: [
    {
      name: "Ring Edge Defense",
      mechanics: "Stepping outside the circle is a loss condition, so ring position is a defensive asset. By managing their own position relative to the center, a wrestler can force the opponent into the boundary â making the ring itself work against the attacker. The defense is strategic positioning as much as physical resistance.",
      setup: "The opponent is driving toward the boundary.",
      execution: "The defender uses small positional adjustments to keep the action centered while forcing the opponent toward the edge.",
      recovery: "If the boundary line is lost, recover inward immediately.",
      counter: "Force the opponent toward the edge and make the ring work against them."
    }
  ],
  strengthAgainst: [
    "Opponents who rely on low sprawling movement â the style's rules and upright structure reward balance over diving entries.",
    "Pressure fighters who overextend â a tight belt connection can turn forward momentum into instability.",
    "Wrestlers who lose ring awareness â stepping outside is a direct path to defeat."
  ],
  weakAgainst: [
    "Larger opponents with superior grip strength â the entire system depends on belt control.",
    "Athletes who can repeatedly break structure without violating the rules.",
    "Any rival who can force the action into boundary trouble consistently."
  ],
  signatureTells: [
    "The wrestler checks belt tension before committing â the belt is central to the bout.",
    "The shoulders stay unusually square and upright rather than dropping into a deep crouch.",
    "Movement compresses into small steps once contact is made â preserving structure, not chasing motion.",
    "The eyes return to the circle edge, showing ring awareness before the opponent is even moved."
  ],
  pacing: "Inbuan has a short, compressed rhythm. The action is limited by the round structure, the belt constraint, and the circle boundary, so it reads like bursts of controlled pressure rather than flowing exchange. When the match heats up, tempo spikes fast because there is little room for reset.",
  writingNotes: "A character shaped by Inbuan would think in structure, restraint, and rule fidelity. That training produces someone who respects boundaries, notices imbalance instantly, and dislikes wasteful movement because every extra motion risks giving up control. In non-combat scenes, they appear composed under pressure, preferring clean solutions over improvisation."
};
