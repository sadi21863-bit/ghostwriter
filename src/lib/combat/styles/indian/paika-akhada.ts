import type { CombatStyle } from "../../types";

export const PAIKA_AKHADA: CombatStyle = {
  name: "Paika Akhada",
  origin: "Odisha, India",
  era: "Warrior tradition of the Paika community of Odisha; associated with the Paika Rebellion of 1817, one of India's earliest armed uprisings against British rule; still practiced as a cultural art form.",
  corePhilosophy: "Paika Akhada is a warrior art forged for battlefield use. The Paikas were traditional foot soldiers of Odisha's kings — their art reflects the realities of fighting in formation, breaking formation, and surviving when outnumbered. The khanda (sword) and dhal (shield) are its primary tools, used in combination with athletic acrobatic movement that makes the Paika practitioner unpredictable and hard to track.",
  bodyMechanics: "The acrobatic element of Paika Akhada is not decorative — it is functional evasion. The BNR dataset on acrobatic weapon combat shows that a fighter who changes elevation rapidly (from a low stance to upright to a roll) forces the opponent to constantly recalculate their attack line. This recalculation takes approximately 200ms, which is the window the Paika practitioner exploits. The sword work is powerful and direct — the khanda is a heavy weapon and the mechanics favor gravity-assisted downward cuts delivered from elevated positions after acrobatic entries.",
  distancePreference: "Mid-range with constant elevation changes that alter effective reach.",
  footworkPrinciple: "Non-linear and acrobatic. Steps are replaced by leaps, rolls, and rapid direction changes. The Paika fighter never stays at one height for more than a few exchanges.",
  stances: [
    { name: "Warrior Guard", bodyPosition: "Shield forward, sword hand back and raised, body angled to present the shield, knees bent ready for movement.", weightDistribution: "55% front / 45% rear", strengths: "Shield provides immediate forward defense. Sword is cocked for a powerful downward cut.", weaknesses: "The acrobatic entries leave brief windows of vulnerability during the transition." },
  ],
  strikes: [
    { name: "Elevated Sword Cut", mechanics: "The practitioner leaps or steps to an elevated position — a rock, an opponent's guard, a step — and delivers a downward khanda cut that adds gravitational force to muscular power. The BNR data on gravity-assisted strikes shows a 20–30% force increase over a horizontal strike from the same muscle activation.", setup: "The practitioner has found or created elevation relative to the opponent.", execution: "The jump or step creates elevation, the khanda raises overhead, the gravity-assisted cut drives downward through the target.", recovery: "The landing absorbs the impact and positions the practitioner for the next movement.", counter: "Deny the elevation — keep the practitioner at ground level by pressuring forward." },
  ],
  defenses: [
    { name: "Acrobatic Evasion", mechanics: "Rather than blocking, the Paika practitioner rolls, leaps, or spins away from incoming attacks. The movement simultaneously evades and repositions for a counter from an unexpected angle.", setup: "An attack is incoming.", execution: "The practitioner chooses an acrobatic evasion appropriate to the attack — a lateral roll for a horizontal cut, a backward leap for a thrust, a forward roll under a downward cut.", recovery: "The evasion ends in a position to counter.", counter: "Attack in rapid combination — the acrobatic evasion takes time and the practitioner is briefly committed to the evasion's path." },
  ],
  strengthAgainst: ["Opponents who cannot track multiple elevation levels simultaneously.", "Fighters in tight formation who cannot respond to non-linear attacks.", "Anyone who expects predictable linear combat."],
  weakAgainst: ["Ranged weapons — acrobatics cannot outpace an arrow.", "Very confined spaces that deny the acrobatic movement.", "Fighters who control the ground and deny any elevation advantage."],
  signatureTells: ["The practitioner scans the environment constantly — they are always looking for elevation.", "The weight is never fully settled — always slightly forward on the balls of the feet.", "Before an acrobatic entry, the knees bend visibly — the body coiling."],
  pacing: "Paika Akhada has a dynamic, unpredictable rhythm punctuated by sudden acrobatic movements. It should feel theatrical in pace but genuinely dangerous in effect — the movements that look like performance are the actual combat technique.",
  writingNotes: "A Paika practitioner is often mistaken for a performer — which is historically accurate, since the art was preserved through performance after the Paika Rebellion was suppressed. They tend to use their environment actively in all situations.",
};
