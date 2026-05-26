import type { CombatStyle } from "../../types";

export const NAGINATAJUTSU: CombatStyle = {
  name: "Naginatajutsu",
  origin: "Japan",
  era: "Classical Japanese weapon tradition that evolved from battlefield use into modern budo practice.",
  corePhilosophy: "Naginatajutsu is a long-weapon art built on distance, line control, and sweeping precision. The curved blade mounted on a long shaft gives the fighter the ability to own space before the opponent reaches sword range. The style feels disciplined and spacious: the weapon's geometry matters more than brute strength.",
  bodyMechanics: `The BNR dataset on pole-weapon combat establishes the relevant spatial mechanics. A naginata of approximately 150cm total length creates a threat radius of roughly 200â230cm when the practitioner extends fully into a cut â significantly longer than a katana and close to double the reach of an unarmed fighter. The curved blade changes the cutting geometry in a specific way: at the end of a sweeping arc, the angle of the blade relative to the target shifts by approximately 20â35 degrees compared to where it entered. This means the cut continues to threaten after the initial contact point, tracking through the target rather than stopping at the first surface. The BNR circular-weapon data shows this is also true of the recovery â the blade does not return along the same arc it cut. It can be redirected into a new line from the end of the first arc, which is why naginata technique emphasizes continuous flow between cuts rather than stop-and-restart mechanics.`,
  distancePreference: "Long range, controlling the space before the opponent can close.",
  footworkPrinciple: "Lateral and range-protective. The naginata needs room because it is a pole weapon. The feet keep the arc clear, manage angle, and prevent the opponent from entering the weak inside space. The legs move to preserve the weapon's line rather than to chase the opponent directly.",
  stances: [
    {
      name: "Long Guard",
      bodyPosition: "Weapon extended enough to claim space, torso upright, shoulders organized behind the shaft, feet positioned for fast retreat or angle change.",
      weightDistribution: "50% front / 50% rear",
      strengths: "Controls distance and keeps the blade line available.",
      weaknesses: "Can be cramped if the opponent enters inside the long arc."
    },
    {
      name: "Sweep Ready",
      bodyPosition: "Weapon angled so the curved blade can travel through a cutting path while the body remains balanced enough to recover.",
      weightDistribution: "55% rear / 45% front",
      strengths: "Improves the ability to cut, redirect, or occupy the opponent's approach.",
      weaknesses: "Can leave the inside line exposed if the sweep is committed too early."
    }
  ],
  strikes: [
    {
      name: "Sweeping Cut",
      mechanics: "The BNR data on curved-blade arcs confirms that the blade angle shifts approximately 20â35 degrees through the arc of a full cut. This means the weapon is not just slicing through a single plane â it is angling through the target as it travels. The recovery motion can be redirected into a new line from the end of the arc, making sequential cuts more efficient than two independent strikes.",
      setup: "The opponent is outside the weapon's immediate inside line.",
      execution: "The fighter rotates the weapon through a controlled arc. The blade angle continues shifting through contact, extending the effective cutting window.",
      recovery: "The weapon does not return along the same arc â it redirects from the end of the first cut into a new line.",
      counter: "Close aggressively inside the arc before it completes, or force the weapon to miss its long line."
    },
    {
      name: "Stabbing Line",
      mechanics: "The naginata can cut and stab. The stab uses the weapon's full length as a lever â the BNR data shows that thrusting with a long shaft generates greater tip velocity at peak extension than a shorter weapon can achieve from the same body position, because the shaft amplifies the torso's rotation into tip speed.",
      setup: "The opponent is approaching along a readable line.",
      execution: "The fighter extends the weapon directly into the path of the approach. The shaft rotation amplifies tip speed.",
      recovery: "The weapon is pulled back into the long guard or turned into another line before the opponent can get inside.",
      counter: "Angle off the line and attack the body before the extension resets."
    },
    {
      name: "Rotating Recovery",
      mechanics: "The BNR data establishes that the blade's recovery motion after a cut can itself become the next attack, because the curved blade continues to trace a threatening arc during the return. This distinguishes naginata from straight-blade techniques where the recovery is a dead movement.",
      setup: "A cut or thrust has just been made.",
      execution: "The body and shaft rotate back through the next usable line rather than returning to a neutral guard.",
      recovery: "The weapon remains active rather than hanging static after impact.",
      counter: "Exploit the 200â300ms window before the weapon re-centers and close the distance hard."
    }
  ],
  defenses: [
    {
      name: "Blade Wall",
      mechanics: "Because the naginata creates a 200â230cm threat radius at full extension, presenting the weapon line is itself a defensive act. An opponent who enters that radius against an active blade must either deflect it â difficult given the weight and arc â or absorb it. The defense is the weapon's presence, not a specific parrying action.",
      setup: "An opponent is entering the space.",
      execution: "The fighter presents the weapon line so the advance meets the blade before the body is reachable.",
      recovery: "The line is reestablished quickly so the defense does not become static.",
      counter: "Break the barrier by closing under the arc, or force the wielder to over-rotate before entering."
    }
  ],
  strengthAgainst: [
    "Shorter-weapon opponents who must cross a dangerous open lane to reach striking range.",
    "Mounted threats in the historical sense â the weapon was designed with reach against cavalry.",
    "Fighters who do not know how to enter under a sweeping arc."
  ],
  weakAgainst: [
    "Close grapplers who get inside the long line and deny the arc.",
    "Cramped environments where the shaft cannot move cleanly.",
    "Opponents who can force repeated angle resets and exhaust the wielder's recovery capacity."
  ],
  signatureTells: [
    "The weapon hand and rear foot settle into a shape that preserves reach before the attack begins.",
    "The curved blade traces a visibly clear arc even before the strike lands â the path is visible in the body's preparation.",
    "The fighter keeps the torso upright, trusting the weapon to do the closing work.",
    "Distance between the bodies matters more than the faces â the weapon is the real center of the fight."
  ],
  pacing: "Naginatajutsu has an elegant but threatening tempo. The long weapon creates a wide, controlled outer rhythm, and the action becomes urgent only when someone successfully breaks that space. The style should feel like a moving perimeter that can suddenly become lethal when the opponent steps wrong.",
  writingNotes: "A naginata-trained character often feels disciplined, spatially aware, and calm under pressure. The art teaches that control begins before contact â they think in terms of distance, line, and preserving options. In fiction, they read as composed, precise, and hard to rush because they are used to owning the room before it gets crowded."
};
