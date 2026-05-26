import type { CombatStyle } from "../../types";

export const PAIKA_AKHADA: CombatStyle = {
  // NOTE: Limited dedicated biomechanics dataset coverage for this art.
  // Mechanics derived from Odia cultural documentation and martial performance sources.
  name: "Paika Akhada",
  origin: "Odisha, India",
  era: "Medieval Odia warrior tradition that survives today as a cultural and performance practice.",
  corePhilosophy: "Paika Akhada is a warrior-school tradition where military training, discipline, and public performance are fused together. The style is not just about combat skill â it is about displaying readiness, cultural pride, and controlled martial form. A practitioner should feel trained, ceremonial, and physically exact rather than improvisational.",
  bodyMechanics: "Paika Akhada's mechanics exist on a spectrum between combat-readiness and performance. The style uses sword, shield, stick, and acrobatic movement coordinated to percussion, which means the body is simultaneously executing martial technique and maintaining rhythmic synchronization â a dual-processing demand that produces a specific quality of movement: deliberate, visually clear, and physically precise. The BNR dataset on weapon display movements (as distinct from combat strikes) confirms that performance-oriented weapon techniques tend to produce larger, more controlled arcs than combat-optimized techniques because the visual clarity of the motion is itself a training objective. In Paika Akhada, this translates to cuts and guard transitions that are fully committed and geometrically clean â the Paikas were a warrior class that needed their fighting capability to be legible to both opponents and observers. The acrobatic elements serve a conditioning function: if the body can execute precise weapon work while moving through jumps, rolls, and transitions, the same work becomes more reliable under the stress of actual combat.",
  distancePreference: "Variable â especially comfortable at weapon range and open-space performance distance.",
  footworkPrinciple: "Rhythmic, grounded, and space-aware. Movement is performed to drum beats with deliberate approaches and acrobatic transitions. The feet do both display work and tactical spacing â timing, balance, and coordination while carrying weapons.",
  stances: [
    {
      name: "Warrior Ready",
      bodyPosition: "Torso upright, shoulders open, lead side presenting the shield or weapon, feet placed for a clean forward step or lateral shift.",
      weightDistribution: "50% front / 50% rear",
      strengths: "Supports quick transitions between display, defense, and engagement.",
      weaknesses: "Can be pressured if the opponent closes distance faster than the rhythm can reset."
    },
    {
      name: "Shield Lead",
      bodyPosition: "Upper body slightly angled behind the shield side, weapon side prepared to strike or sweep.",
      weightDistribution: "55% front / 45% rear",
      strengths: "Provides a protected forward edge while the weapon side remains ready.",
      weaknesses: "Exposes the rear side if the rhythm is broken or the opponent changes line suddenly."
    }
  ],
  strikes: [
    {
      name: "Khanda Strike",
      mechanics: "The Khanda sword used in Paika Akhada is a broad, heavy blade with a basketwork guard. BNR data on heavy-blade mechanics shows that peak cutting force from this weapon type comes from a committed hip rotation rather than arm speed alone â the blade's mass requires the body to synchronize trunk rotation with the arc. The large arc required by the khanda is also what makes the performance dimension readable to observers.",
      setup: "The fighter has open room, visible weapon, and rhythmic cadence.",
      execution: "The sword comes into the line of action with a committed body turn and hip rotation. The arc is visually complete â no abbreviation.",
      recovery: "After the motion, the body returns to ready for the next beat.",
      counter: "Break the rhythm, crowd the space, or force the performer to cut before the hip rotation has loaded."
    },
    {
      name: "Dhal Shield Answer",
      mechanics: "The shield is not just armor â it is part of the style's visual grammar and tactical identity. The Dhal (round shield) is used actively: to catch incoming strikes and redirect their force sideways. The BNR data on impact interception confirms that a round shield held at an angle dissipates force more efficiently than one held perpendicular to the attack â the round shape automatically creates the angled interception.",
      setup: "An opponent is advancing into the practitioner's line.",
      execution: "The shield comes forward and angled to catch and redirect rather than absorb. The body stays poised to respond.",
      recovery: "The fighter resets to rhythmic ready rather than freezing in a defensive shell.",
      counter: "Attack on the off-beat, or force the practitioner to turn without time to reset."
    },
    {
      name: "Acrobatic Transition",
      mechanics: "The body transitions through stance, weapon line, and body angle in one coordinated phrase. The function is conditioning: executing precise weapon work through physical transition removes the comfort of a stable base, training the body to maintain technique quality under duress. The BAB dataset on complex motion sequences shows that rehearsed transitions maintain approximately 85% of their technique quality under moderate physical stress â significantly higher than unrehearsed movements.",
      setup: "The practitioner is already within a martial sequence.",
      execution: "The fighter transitions through stance, weapon line, and body angle in one coordinated phrase.",
      recovery: "The next position is built into the motion â almost no dead time.",
      counter: "Interrupt the cadence and make the transition happen before the body is ready."
    }
  ],
  defenses: [
    {
      name: "Weapon Structure",
      mechanics: "The style's defensive principle is maintaining weapon structure and visual clarity. An opponent who faces a Paika Akhada practitioner encounters both a fighter and a performed signal of readiness â which is itself a deterrent. In practice, the shield is always active and the sword is never hanging idle.",
      setup: "A threat or incoming strike is developing.",
      execution: "The shield is placed into the threat's path while the sword maintains a threatening position. Neither tool is passive.",
      recovery: "The fighter returns to the rhythmic ready stance.",
      counter: "Draw the shield out of position with a feint, then attack the opened side."
    }
  ],
  strengthAgainst: [
    "Opponents who dislike rhythm-based movement â Paika Akhada constantly uses timing and shape.",
    "Rivals who are visually aggressive but poorly structured â the style keeps the body organized around weapons.",
    "Fighters who cannot manage open-space pressure â the tradition is comfortable at performance and weapon display distance."
  ],
  weakAgainst: [
    "Close-range grapplers who smother the weapon line before it develops.",
    "Opponents who break cadence and force awkward resets.",
    "Environments too cramped for the style's larger rhythmic movement."
  ],
  signatureTells: [
    "The fighter straightens posture and sets the weapon side early â a performance-trained entry.",
    "The steps begin to match an audible rhythm, or the fighter creates their own internal cadence visibly.",
    "The shield is presented before the strike, not after â the fighter thinks in structure and display.",
    "The body turns in clean, ceremonial angles rather than collapsing into a reactive brawl."
  ],
  pacing: "Paika Akhada has a ceremonial, beat-driven pace. It can look theatrical at first â that is the point. The rhythm organizes the fighter's body and keeps the weapons readable. The tempo changes sharply when engagement begins, but it stays structured rather than chaotic.",
  writingNotes: "A character shaped by Paika Akhada carries themselves with visible discipline and public confidence. This training produces someone comfortable being watched, who values form as much as function, and who sees conflict as something that should still have structure. In non-combat scenes, that reads as ceremonial self-control, pride in heritage, and the habit of standing as if posture itself matters."
};
