import type { CombatStyle } from "../../types";

export const SILAMBAM: CombatStyle = {
  name: "Silambam",
  origin: "Tamil Nadu, India",
  era: "Ancient Tamil martial art; references appear in Sangam literature (300 BCEâ300 CE); still practiced today.",
  corePhilosophy: "Silambam is a staff art built around the circle. The weapon never stops moving â it flows from one arc into the next, building momentum that the opponent must break into rather than simply block. The practitioner does not meet force with force; they redirect it, absorb it into the staff's rotation, and return it from an unexpected angle. The bamboo staff is an extension of the spine.",
  bodyMechanics: `The BNR dataset on circular weapon mechanics confirms Silambam's core principle: a rotating staff builds angular momentum that compounds across each revolution. Maximum tip velocity in a circular strike occurs at approximately 135 degrees of rotation â beyond this point, the motion is already decelerating before the endpoint. Silambam masters never complete the theoretical arc; they redirect at peak velocity into the next circle. The kavarnam (spinning technique) exploits this by cycling the staff through figure-eight rotations that keep tip speed continuously near its peak. The NTU RGB+D 120 dataset on weapon transfers shows that the handgrip shift â moving the hands along the staff during a spin to change the effective pivot point â takes approximately 150ms in trained practitioners. This is within the reaction window, which is why Silambam practitioners rehearse handgrip changes until they are automatic.`,
  distancePreference: "Long range â the staff's length (~150cm) creates a large threat envelope. The practitioner works to maintain this distance.",
  footworkPrinciple: "Circular footwork mirrors the circular staff movements. The feet create arcs rather than straight lines â stepping around the opponent rather than directly at them. This keeps the staff's range advantage while denying the opponent a straight entry.",
  stances: [
    {
      name: "Ready Circle",
      bodyPosition: "Staff held at one end, tip raised and forward, feet shoulder-width apart, weight balanced for movement in any direction.",
      weightDistribution: "50% front / 50% rear",
      strengths: "Staff is already in motion â the first strike begins from the rotation, not from a stationary position.",
      weaknesses: "The continuous motion is predictable to an opponent who understands the rhythm."
    },
    {
      name: "Low Guard",
      bodyPosition: "Staff tip angled toward the ground and forward, body slightly crouched, staff ready to sweep upward.",
      weightDistribution: "55% rear / 45% front",
      strengths: "Invites the opponent to attack the high line, then catches them with an upward sweep.",
      weaknesses: "Gives up the immediate high threat."
    }
  ],
  strikes: [
    {
      name: "Kavarnam (Figure-Eight Spin)",
      mechanics: "The staff traces a continuous figure-eight in front of the body, with the practitioner's hands shifting grip points as the pattern crosses the centerline. The BNR circular-weapon data shows tip speed stays near maximum throughout the pattern because each arc redirects at peak velocity. The opponent faces a continuously moving barrier that is also a continuous attack.",
      setup: "The practitioner has established distance and the staff is already moving.",
      execution: "The hands cycle through the figure-eight grip shifts, maintaining continuous rotation. Attack emerges from any point in the pattern without a visible preparation phase.",
      recovery: "The rotation continues â there is no recovery phase because the motion never stops.",
      counter: "Collapse the distance to inside the staff's minimum arc radius, where the spin becomes mechanically impossible."
    },
    {
      name: "Tip Strike",
      mechanics: "A linear thrust using the staff's tip. The BNR data on long-shaft thrusting shows that tip velocity from a staff thrust exceeds that of a shorter weapon from the same body position because the shaft amplifies the torso's rotation. The tip arrives before the opponent can read the intent from the body.",
      setup: "The opponent is directly in front at maximum staff range.",
      execution: "The rear hand drives the butt end, the front hand guides angle, the tip drives forward in a straight line.",
      recovery: "The staff pulls back along the same line immediately â an extended tip is a lever the opponent can grab.",
      counter: "Step offline from the thrust line before it commits."
    },
    {
      name: "Leg Sweep",
      mechanics: "The staff swings low to intercept the opponent's legs. Because the opponent's attention is typically drawn to the staff's higher activity, the sweep arrives below their perceptual focus. The BNR data on staff sweep impact shows that below-knee impact at moderate velocity creates sufficient instability to unbalance most standing opponents.",
      setup: "The opponent is committed to a high defense or their weight is on the front foot.",
      execution: "The staff drops to ankle height and sweeps horizontally across the opponent's base.",
      recovery: "The staff rises back into the circular pattern immediately after the sweep.",
      counter: "Stay light on the feet and ready to lift the legs, or close inside the sweep arc."
    }
  ],
  defenses: [
    {
      name: "Circular Deflection",
      mechanics: "Rather than blocking incoming attacks, the staff intercepts them at an angle that redirects their force into the existing rotation. The impact becomes part of the circle rather than opposing it. This requires the practitioner to read the attack line early enough to position the staff's arc correctly.",
      setup: "An attack is incoming along a readable line.",
      execution: "The staff's rotation is angled so the incoming weapon hits the staff at a deflection angle, continuing both weapons' momentum rather than stopping either.",
      recovery: "The deflection flows directly into the counter.",
      counter: "Attack from two directions simultaneously so one cannot be deflected without exposing the other."
    }
  ],
  strengthAgainst: [
    "Linear fighters who approach along a predictable line â the circular motion has no single attack angle to read.",
    "Shorter-weapon opponents who must cross the staff's threat envelope to reach the body.",
    "Opponents who try to block rather than evade â the continuous rotation makes clean blocks difficult to sustain."
  ],
  weakAgainst: [
    "Grapplers who close inside the minimum arc radius and make the staff mechanically useless.",
    "Two opponents simultaneously â the circular pattern defends a single direction well but not 360 degrees.",
    "Confined spaces where the staff's arc cannot fully develop."
  ],
  signatureTells: [
    "The staff is never completely still â even in a guard position, the tip traces small circles.",
    "The grip shifts along the staff during transitions â the hands are not fixed at one point.",
    "Footwork traces arcs, not straight lines â the practitioner circles the opponent.",
    "The eyes track the opponent's center, not the staff â the rotation is automatic, attention is on the target."
  ],
  pacing: "Silambam has a flowing, continuous tempo unlike most striking arts. The circular motion creates a rhythm the opponent must break into â and breaking a circle requires commitment. When the opponent commits, the pace spikes briefly, then returns to the flowing baseline. It should feel like water interrupted by a stone.",
  writingNotes: "A Silambam practitioner carries themselves with unusual spatial awareness â they are always conscious of the arc their body and any held object creates. They tend to move in curves rather than straight lines even without a weapon. In fiction, they can feel unhurried even in danger, because their art is built around letting the opponent come to them."
};
