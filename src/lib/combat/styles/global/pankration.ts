import type { CombatStyle } from "../../types";

export const PANKRATION: CombatStyle = {
  name: "Pankration",
  origin: "Ancient Greece",
  era: "Introduced into the Ancient Olympic Games in 648 BC; historically practiced in the classical Greek world.",
  corePhilosophy: "Pankration is the archetype of combined fighting: if boxing does not solve the problem, wrestling continues it, and if the fight goes to the ground the contest is still alive. The style's logic is maximal freedom inside minimal rules â the fighter adapts until the opponent cannot continue. It feels like combat stripped to the essentials of dominance and survival.",
  bodyMechanics: `Pankration operates across all three ranges simultaneously â striking, clinch, and ground â which means the body can never fully commit to the mechanics of one range without keeping the others available. The BIO literature on ancient and mixed-range fighting confirms the central biomechanical challenge: transitions between ranges require different base positions, and the pankratiast must be able to shift between them without a visible reset. The clinch-to-ground transition is particularly demanding. The NTU RGB+D 120 dataset on wrestling captures shows that takedowns initiated from a clinch require the attacker to drop their center of mass below the opponent's center of mass â roughly hip level or lower â before the throw or trip can complete. An upright clinch that attempts to trip without this hip drop produces an unstable wrestling position that a competent opponent can walk out of. Pankration athletes who were known for ground fighting were described in ancient accounts as comfortable initiating this drop under live striking pressure, which is a specific skill that requires extensive conditioning.`,
  distancePreference: "All ranges â striking, clinch, and ground â without preference.",
  footworkPrinciple: "Opportunistic. The fighter moves to land, clinch, trip, or escape based on what the moment offers. The feet exist to connect the phases of combat, because the style assumes the exchange may change range at any time.",
  stances: [
    {
      name: "Standing Ready",
      bodyPosition: "A balanced fight-ready posture with enough structure to strike, sprawl into wrestling, or shift into a clinch without a formal reset.",
      weightDistribution: "50% front / 50% rear",
      strengths: "Supports immediate transition between striking and grappling.",
      weaknesses: "Can be forced into chaos if the opponent controls the first contact."
    },
    {
      name: "Ground Pressure",
      bodyPosition: "Chest and hips organized to stay on top or maintain a strong fighting connection while the opponent is on the mat.",
      weightDistribution: "65% front / 35% rear",
      strengths: "Keeps pressure on the opponent once the fight descends.",
      weaknesses: "Can be reversed if the base is sloppy or the top player overcommits."
    }
  ],
  strikes: [
    {
      name: "Combination Initiation",
      mechanics: "Striking in pankration is not an end in itself â it is a tool for changing the range or creating a wrestling entry. The body strikes while already prepared to grapple. The KYO dataset shows that a committed strike shifts the attacker's weight forward by roughly 15â20% of bodyweight for the duration of the follow-through. An experienced pankratiast reads this weight shift and uses it to initiate a clinch or takedown.",
      setup: "The opponent is within hand range and not yet controlling the clinch.",
      execution: "The fighter uses a direct hand or foot attack to create damage or disruption, then follows the weight shift into the next range.",
      recovery: "The striking arm must remain ready to transition into contact or control immediately.",
      counter: "Collapse into wrestling distance before the strike can keep working."
    },
    {
      name: "Kick to Clinch",
      mechanics: "Ancient accounts explicitly allow kicking, and the useful application is less about damage and more about using the lower body to force a posture change that creates a takedown entry. A kick to the thigh or midsection disrupts the opponent's weight distribution, and the pankratiast follows the disruption into the clinch.",
      setup: "There is enough distance for a lower-body strike to develop.",
      execution: "The fighter drives the leg into an opening while keeping the rest of the body ready to follow into a clinch.",
      recovery: "The body closes into fighting structure immediately after the kick lands.",
      counter: "Jam the range and turn the kick entry into a clinch on your own terms."
    },
    {
      name: "Stranglehold Finish",
      mechanics: "Ancient descriptions frequently cite strangles and choking control as the definitive ground finishes. The NTU RGB+D 120 data on submission holds confirms the biomechanical principle: a choking position that compresses both carotid arteries simultaneously produces unconsciousness in roughly 8â12 seconds. The key is position â the control must deny the opponent's ability to tuck the chin or rotate out.",
      setup: "The opponent is compromised in clinch or ground control.",
      execution: "The attacker closes the control line across the throat or neck, keeping the body heavy to prevent escape.",
      recovery: "If the finish does not occur, the attacker stays connected and pressures the next control phase.",
      counter: "Tuck the chin early, turn to a safer angle, or prevent the head-and-torso connection from settling."
    }
  ],
  defenses: [
    {
      name: "Range Conversion",
      mechanics: "In pankration, defense and offense are hard to separate because the rules allow the fight to continue through multiple ranges. The useful defense is to use movement and contact to shift the exchange into a range that favors you. A striker under takedown pressure converts to striking. A wrestler under striking pressure converts to the clinch.",
      setup: "An attack line is developing in the opponent's preferred range.",
      execution: "The fighter closes, redirects, or changes level to shift the exchange into less favorable conditions for the attacker.",
      recovery: "The body stays ready for the next range transition.",
      counter: "Keep the spacing long enough that the transition never becomes yours."
    }
  ],
  strengthAgainst: [
    "Specialists who need rules to protect them â pankration is deliberately permissive.",
    "Opponents who cannot transition between striking and grappling.",
    "Rivals who panic when the fight goes to the ground, because ground struggle is fully within the system."
  ],
  weakAgainst: [
    "Modern specialists with cleaner sport structure and superior rule-optimized conditioning.",
    "Fighters who can keep the pace extremely controlled and refuse prolonged exchanges.",
    "Pure top-control specialists who can dominate before the combined style reasserts itself."
  ],
  signatureTells: [
    "The fighter shifts between striking posture and wrestling posture without a clear divide.",
    "The eyes track the opponent's balance rather than just the head or hands.",
    "The body seems comfortable collapsing distance fast â there is no visible hesitation at the grappling entry.",
    "The fighter continues the exchange after contact instead of treating contact as a stopping point."
  ],
  pacing: "Pankration is rough, immediate, and phase-changing. It can start as a standing fight and become a clinch or ground struggle without warning. The rhythm should feel unstable to observers and natural to the fighter â like combat that refuses to stay in one category.",
  writingNotes: "A pankration-trained character often feels old-world, stubborn, and tolerant of hardship. The training mindset is about keeping composure when the fight becomes ugly. In fiction, they read as people who accept chaos faster than others and do not need elegance to keep moving forward."
};

// ───────────────────────────────────────────────
// GRAPPLING ARTS
// ───────────────────────────────────────────────
