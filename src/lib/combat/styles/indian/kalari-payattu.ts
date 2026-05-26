import type { CombatStyle } from "../../types";

export const KALARI_PAYATTU: CombatStyle = {
  name: "Kalari Payattu",
  origin: "Kerala, India",
  era: "Ancient martial tradition of Kerala; one of the oldest documented fighting systems in the world, still practiced today.",
  corePhilosophy: "Kalari is built on the understanding that the body's power emerges from its connection to the earth. Before any weapon is taught, the body itself is made into a weapon through oil massage, extreme flexibility training, and the study of eight animal forms. Each animal teaches a different quality of movement â the horse teaches stability, the serpent teaches evasion, the lion teaches explosive power. The fighter does not choose a style; they become an animal appropriate to the moment.",
  bodyMechanics: `The KYO dataset's force chain analysis confirms what Kalari masters have always taught: maximum striking power requires the force chain to begin at the heel, travel through the ankle, knee, hip, trunk, shoulder, and arm before arriving at the point of contact â hip rotation must precede arm extension by approximately 50 milliseconds. A Kalari practitioner spends years conditioning this chain through meyyppayattu (body exercises) before ever holding a weapon. The eight animal stances (ashwa vadivu â horse, gaja vadivu â elephant, simha vadivu â lion, sarpa vadivu â serpent, marjara vadivu â cat, kukkuta vadivu â rooster, varaha vadivu â boar, mayura vadivu â peacock) each encode different weight distributions and mechanical priorities. The horse stance (ashwa vadivu) distributes weight equally and sits the hips low, creating the stable base for heavy strikes. The serpent stance (sarpa vadivu) drops the body close to the ground, making the fighter a difficult target while coiling for a fast explosive attack. Training flows through three weapon streams â kolthari (stick), angathari (sword and dagger), verumkai (empty hand) â in ascending order of danger.`,
  distancePreference: "Variable â each weapon stream has its own preferred range; empty hand prefers close range.",
  footworkPrinciple: "Footwork follows the animal stance being used. The horse stance uses small grounded steps. The cat stance uses silent, angled entries. The serpent stance moves the body low and lateral. The general principle is that the feet never cross â the rear foot always anchors while the lead foot probes.",
  stances: [
    {
      name: "Ashwa Vadivu (Horse Stance)",
      bodyPosition: "Feet wide, hips low, knees tracking over toes, torso upright, hands ready at chest height.",
      weightDistribution: "50% front / 50% rear",
      strengths: "Stable base for heavy strikes and absorbing impact. Hard to topple.",
      weaknesses: "Slow lateral movement. Can be outflanked by a faster opponent."
    },
    {
      name: "Sarpa Vadivu (Serpent Stance)",
      bodyPosition: "Body lowered significantly, weight on the rear leg, front hand low and probing, back hand coiled for the strike.",
      weightDistribution: "30% front / 70% rear",
      strengths: "Small target profile. Explosive strike from a coiled position. Hard to read the attack line.",
      weaknesses: "Vulnerable to leg sweeps. Difficult to sustain against a mobile opponent."
    },
    {
      name: "Simha Vadivu (Lion Stance)",
      bodyPosition: "Upright, dominant, weight forward, hands high, chest out â a posture of open aggression.",
      weightDistribution: "60% front / 40% rear",
      strengths: "Aggressive forward pressure. Ready for explosive entering strikes.",
      weaknesses: "Committed posture â hard to retreat quickly. Leaves the low line open."
    }
  ],
  strikes: [
    {
      name: "Meyppayattu Strike",
      mechanics: "The meyppayattu exercises train the full kinetic chain so that by the time a strike is thrown, every joint in the body has been conditioned to transmit force without loss. The KYO dataset confirms: peak force at the fist requires the heel to drive before the hip rotates, and the hip to rotate before the arm extends. A Kalari strike does not begin with the arm.",
      setup: "The practitioner has settled into a stable stance and the opponent is within range.",
      execution: "The heel drives, the hip rotates, the shoulder follows, the arm extends last. The full kinetic chain fires in sequence. The animal stance determines the entry angle.",
      recovery: "After the strike, the chain reverses â the arm retracts first, the body resets into the stance.",
      counter: "Interrupt the chain at the hip by closing distance before the rotation completes."
    },
    {
      name: "Verumkai Entry (Empty Hand)",
      mechanics: "The empty-hand system targets vital points (marma) â pressure points whose disruption causes loss of function. The mechanics are not about brute force but precise anatomical targeting. A strike to the correct marma with moderate force creates disproportionate effect.",
      setup: "The practitioner is inside grappling range and has identified an accessible vital point.",
      execution: "A precise, targeted strike to the marma using the fingertips, knuckle, or specific hand formation.",
      recovery: "The hand withdraws immediately â marma strikes are not held.",
      counter: "Keep the body mobile so marma targets are never still. Wear protective equipment in historical contexts."
    }
  ],
  defenses: [
    {
      name: "Animal Evasion",
      mechanics: "Defense in Kalari is primarily evasion, not blocking. The animal stances provide the vocabulary: the serpent drops below the strike, the cat slips to the side, the peacock lifts one leg to redirect. The body moves so the attack finds nothing.",
      setup: "An attack is incoming.",
      execution: "The practitioner shifts into the appropriate animal evasion â dropping, sidestepping, or rotating â so the attack passes through empty space.",
      recovery: "The evasion positions the body for the counter-strike.",
      counter: "Attack in combination so the evasion from the first leaves the practitioner exposed to the second."
    }
  ],
  strengthAgainst: [
    "Rigid, linear fighters who telegraph with their shoulders â the animal stances read posture and respond before the strike arrives.",
    "Opponents at weapon range who underestimate the empty-hand system.",
    "Fighters who stand tall â the low stances make Kalari practitioners a difficult target for high-line attacks."
  ],
  weakAgainst: [
    "Pure grapplers who close distance faster than the stance can adapt.",
    "Fighters who disable the footwork â once the Kalari practitioner cannot move, the stance system collapses.",
    "Modern sport fighters who do not telegraph in the ways the animal stances were designed to read."
  ],
  signatureTells: [
    "The practitioner's feet move before the hands â the stance is always being adjusted, never static.",
    "The hips drop visibly before a strike â the body loading the kinetic chain.",
    "The head follows the animal archetype: the lion looks forward and up, the serpent looks forward and down.",
    "Weight shifts to the rear leg before an explosive forward entry â the coil before the spring."
  ],
  pacing: "Kalari has a layered pace. The stance transitions give it a rhythmic, almost dance-like quality at distance â then the entry is sudden and the exchange is brief before the practitioner resets into a new stance. It should never look static.",
  writingNotes: "A Kalari-trained character carries their history in their posture. The years of oil massage and meyyppayattu produce extreme flexibility visible in everyday movement. They tend to be quiet, body-aware, and perceptive of others' physical states. In fiction, they can feel ancient â connected to something older than sport or performance."
};
