import type { CombatStyle } from "../../types";

export const HUYEN_LALLONG: CombatStyle = {
  // NOTE: Limited dedicated biomechanics dataset coverage for this art.
  // Mechanics derived from practitioner documentation and regional sources.
  name: "Huyen Lallong",
  origin: "Manipur, India",
  era: "Traditional Meitei martial system; historically associated with war training and still practiced in cultural form.",
  corePhilosophy: "Huyen Lallong is the broader Meitei art of safeguarding through disciplined martial knowledge. It frames armed and unarmed combat as parts of one system, so the practitioner is expected to understand range, timing, and survival as a single continuum. The style feels less like a set of tricks and more like an entire martial worldview.",
  bodyMechanics: "Huyen Lallong is the parent system from which Thang-Ta (sword and spear) and Sarit Sarak (unarmed) derive. This structural relationship is essential to understanding the body mechanics: a practitioner is not switching between two different arts but moving through different ranges of a single war-training framework. In the armed phase, the body must preserve weapon line and distance â holding the thang (sword) requires specific shoulder and wrist orientation for controlled cuts, while the ta (spear) demands two-handed shaft control with the rear hand as pivot. In the unarmed phase, the same spatial discipline governs, but the body now uses its own limbs as the weapons. The transition between these phases requires no cognitive reset because both were developed within the same training context. The most important biomechanical principle is continuity of posture: the upright, organized structure of the armed phases is preserved in the unarmed phases, which prevents the collapse into street-fighting mechanics that would break the system's coherence.",
  distancePreference: "All ranges â the system explicitly includes both armed and unarmed combat.",
  footworkPrinciple: "Footwork changes with context. In the armed branch, the feet must preserve weapon line and spacing. In the unarmed branch, they must manage entry, angle, and balance without losing the system's structural discipline. Movement is adaptable but always organized.",
  stances: [
    {
      name: "Guarded Readiness",
      bodyPosition: "Torso upright, arms prepared for either weapon handling or unarmed defense, body centered so it can shift to either mode without a visible reset.",
      weightDistribution: "50% front / 50% rear",
      strengths: "Supports transitions between armed and unarmed phases without losing structural integrity.",
      weaknesses: "Can be outpaced by a specialist who dominates a single range before the transition completes."
    },
    {
      name: "Unarmed Entry",
      bodyPosition: "Weight slightly forward, hands active near the centerline, body ready to close distance without collapsing posture.",
      weightDistribution: "55% front / 45% rear",
      strengths: "Improves the ability to bridge into close combat while maintaining the system's organized structure.",
      weaknesses: "If overcommitted, can expose the practitioner to weapon range or a sharper angle change."
    }
  ],
  strikes: [
    {
      name: "Weapon Line Transition",
      mechanics: "The practitioner moves from weapon range into unarmed range â or vice versa â without a visible pause or postural collapse. The body stays organized through the transition. The key is that the weapon is not abandoned; it becomes a close-range tool or is withdrawn cleanly so the hands can work.",
      setup: "The exchange has reached a range where the current weapon modality is no longer optimal.",
      execution: "The practitioner shifts range, maintaining posture, and continues with the appropriate tool or limb for the new distance.",
      recovery: "The body re-organizes for the next phase rather than freezing at the transition point.",
      counter: "Force the transition at a moment of structural instability â attack during the range shift."
    },
    {
      name: "Strike Entry",
      mechanics: "The unarmed component of Huyen Lallong employs strikes, kicks, and grappling. The body drives the hand or foot into the opponent's available line with the same compact, organized posture that governs the armed phases. Strikes are not thrown from loose, reactive positions â they emerge from structure.",
      setup: "The fighter is inside striking range and not committed to a weapon line.",
      execution: "The body drives the hand into the opponent's available line with compact, martial posture.",
      recovery: "The hand returns into guard or transitions into another control action.",
      counter: "Disrupt the entry before it fully forms, or force the fighter to change mode prematurely."
    },
    {
      name: "Grapple Phase",
      mechanics: "The unarmed component includes grappling, and the structural principles that govern armed combat â leverage over brute force, position before submission â apply equally here. The body uses grip and posture control to alter the opponent's alignment rather than attempting to overpower them.",
      setup: "The fighters are already in close contact.",
      execution: "The practitioner uses structure and grip to alter the opponent's posture and control the exchange.",
      recovery: "If the transition fails, the fighter returns to a guarded stance rather than remaining tangled.",
      counter: "Break the structure early and force a restart of the sequence."
    }
  ],
  defenses: [
    {
      name: "Range Management Cover",
      mechanics: "Because the system includes both armed and unarmed ranges, defense is not a single action but a range-appropriate response. The body protects itself while preserving the ability to switch branches â covering in a way that does not surrender either weapon line or grappling entry.",
      setup: "An attack is incoming at either weapon or hand range.",
      execution: "The practitioner uses compact cover and positional adjustment to survive the first line, keeping the structure intact for the next phase.",
      recovery: "The body immediately reorganizes for the next phase rather than freezing in a defensive shell.",
      counter: "Force repeated mode changes and make the defender choose between weapon space and body space."
    }
  ],
  strengthAgainst: [
    "Opponents who know only one range â Huyen Lallong can switch between armed and unarmed modes.",
    "Specialists who depend on a fixed rhythm â the system is built around adaptable war training.",
    "Fighters who cannot handle transitions between armed and unarmed combat."
  ],
  weakAgainst: [
    "Pure specialists who dominate a single range before the fighter can transition.",
    "Opponents who force cramped, messy conditions denying room to reconfigure.",
    "Rivals who exploit the gap between armed and unarmed modes during a transition."
  ],
  signatureTells: [
    "The posture stays unusually organized even when the range changes â a system-trained practitioner, not a single-technique specialist.",
    "The hands and hips look ready to shift from weapon handling to empty-hand work without a full reset.",
    "The eyes track both distance and available transitions â a war-trained mind reading the whole board.",
    "The body rarely overcommits, because the system values the ability to change branches cleanly."
  ],
  pacing: "Huyen Lallong has the broadest pacing of the northeastern styles because it includes both armed and unarmed branches. The rhythm can be patient or explosive depending on whether the fighter is staying in weapon range or collapsing into grappling. The common thread is structured adaptability.",
  writingNotes: "A character trained in Huyen Lallong should feel adaptable, calm under shifting conditions, and hard to classify. This is training that produces someone who sees conflict as a chain of phases rather than a single moment â mentally flexible, tactically patient, and comfortable wearing multiple modes of engagement. Outside combat, that reads as a person who is comfortable changing roles cleanly and staying composed when the situation changes fast."
};
