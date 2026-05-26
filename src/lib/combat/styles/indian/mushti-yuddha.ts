import type { CombatStyle } from "../../types";

export const MUSHTI_YUDDHA: CombatStyle = {
  name: "Mushti Yuddha",
  origin: "India (ancient; practiced across the subcontinent, particularly in Varanasi)",
  era: "One of the oldest documented striking arts; referenced in the Mahabharata and Ramayana; still practiced in Varanasi as a living tradition.",
  corePhilosophy: "Mushti Yuddha is bare-knuckle boxing built on three principles: strike with the whole body, never the arm alone; the chin is always protected; and endurance of pain is not optional. The art trains fighters to absorb punishment while maintaining the ability to deliver it — a philosophy forged in the akhara pits where matches ended only when one fighter could not continue.",
  bodyMechanics: "Striking mechanics align with the KYO dataset's core finding: ground-up force generation. The rear heel lifts before each power blow, initiating a chain through the calf, knee, hip, and shoulder that arrives at the fist 80–100ms later. The guard is tight and high — both fists near the face, elbows protecting the ribs. This guard is unlike many Indian arts and reflects the sport's long history of purely striking exchanges where the face is the primary target.",
  distancePreference: "Mid-range — punching distance. The practitioner manages distance to stay in their power range.",
  footworkPrinciple: "Forward-pressuring footwork with short steps. The practitioner circles to find an angle, but the general direction is always toward the opponent.",
  stances: [
    { name: "Mushti Guard", bodyPosition: "Both fists raised to chin height, elbows tight to the body, chin tucked, weight evenly distributed.", weightDistribution: "50% front / 50% rear", strengths: "Strong chin protection. Elbows block body shots naturally.", weaknesses: "Shorter reach than open-hand arts. Less mobility than boxing-derived stances." },
  ],
  strikes: [
    { name: "Straight Punch (Mushti)", mechanics: "A direct punch driven from the rear heel through the hip and shoulder. The fist rotates to horizontal at impact. The KYO data shows peak force requires the full kinetic chain — a punch initiated from the shoulder alone loses approximately 40% of potential force.", setup: "The opponent is at punching range and a centerline opening exists.", execution: "Rear heel lifts, hip rotates, shoulder drives, arm extends with fist rotating to horizontal at impact.", recovery: "The fist returns to guard immediately — an extended arm is vulnerable.", counter: "Slip outside the punch and hook to the body or head." },
    { name: "Hook (Pratimushti)", mechanics: "A short, hooking punch targeting the side of the head. The elbow rises to shoulder height before the forearm swings, concentrating force through a tight arc.", setup: "The opponent is at close range — inside the straight punch's comfortable distance.", execution: "The lead hip rotates 45 degrees, the elbow rises, the forearm swings horizontally into the target.", recovery: "The elbow returns to guard immediately.", counter: "Duck under the hook and clinch or counter with an uppercut." },
  ],
  defenses: [
    { name: "Forearm Block", mechanics: "The forearm rises to intercept incoming punches, hardened by years of conditioning against wooden posts and stone walls. The block is not passive — the arm rises to meet the strike rather than waiting for impact.", setup: "A punch is incoming to the head or body.", execution: "The appropriate forearm rises to intercept the punch on the hardened bone.", recovery: "The arm returns to guard position immediately after the block.", counter: "Target above or below the raised forearm — the block protects one line at a time." },
  ],
  strengthAgainst: ["Opponents who underestimate bare-knuckle conditioning — a forearm conditioned against stone is not the same as a gloved fist.", "Fighters who rely on the protection of equipment and have not trained to absorb bare-knuckle impact."],
  weakAgainst: ["Weapon-based arts at range — Mushti Yuddha is close-range only.", "Grapplers who neutralize the punching range.", "Multiple opponents where the art's linear focus is a disadvantage."],
  signatureTells: ["The forearms are visibly thickened and scarred from conditioning work.", "The guard is held higher and tighter than most striking arts.", "The feet shift before each punch — the heel lifting signals the power shot."],
  pacing: "Mushti Yuddha has an aggressive, pressuring pace with periods of intense close exchange. Both fighters absorb and return — neither retreats if they can help it. The rhythm is set by who lands first and harder.",
  writingNotes: "A Mushti Yuddha practitioner carries their training in their hands and forearms — visibly. They tend toward a direct, unsentimental worldview forged by competition where there was no protective equipment and no referee to stop the fight early.",
};
