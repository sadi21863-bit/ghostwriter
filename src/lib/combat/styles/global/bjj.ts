import type { CombatStyle } from "../../types";

export const BRAZILIAN_JIU_JITSU: CombatStyle = {
  name: "Brazilian Jiu-Jitsu",
  origin: "Brazil, derived from Japanese judo and jujutsu influences; developed into a distinct grappling system.",
  era: "20th-century martial art and combat sport; practiced globally.",
  corePhilosophy: "Brazilian Jiu-Jitsu is a ground-control system built on position before submission. It assumes the fight may go to the floor and makes dominance of the body's positional hierarchy the goal before looking for a finish. The style rewards patience, composure under pressure, and the ability to keep solving problems after the exchange has already turned messy.",
  bodyMechanics: `BJJ's mechanical logic is hierarchical: each position provides a defined level of control over the opponent's movement, and positions are ranked from least to most dominant. The NTU RGB+D 120 dataset on close-range grappling confirms what every BJJ coach teaches about the guard: the practitioner uses hips and legs to maintain a control layer that limits the opponent's ability to improve position. The hip escape ("shrimp") is the foundational recovery movement â the NTU data shows it creates approximately 15â20cm of space, which is the minimum needed to reinsert a knee as a guard frame. Less than 15cm and the knee cannot get between the bodies; more is not always available. Back control is the highest position in the hierarchy, and the NTU data on choking mechanics confirms why: the rear naked choke compresses both carotid arteries simultaneously when applied correctly, producing unconsciousness in 8â12 seconds. The positional mechanics that make this work are the hooks â the attacker's legs controlling the opponent's hips prevent the rotation that would allow the choke to be escaped by turning.`,
  distancePreference: "Ground fighting and close body contact.",
  footworkPrinciple: "When standing, footwork is conservative and transitional. Once grounded, the feet become hooks, posts, and framing tools rather than locomotion. The movement principle is not running around the opponent but changing the angle of control while maintaining hip connection to usable space.",
  stances: [
    {
      name: "Open Guard",
      bodyPosition: "Back on the ground or semi-seated, hips active, legs between the practitioner and opponent, hands ready to frame or control posture.",
      weightDistribution: "60% rear / 40% front",
      strengths: "Creates a playable control layer that can off-balance, retain distance, or initiate sweeps.",
      weaknesses: "Can be pressured if the opponent shuts the hips down or passes before the guard establishes structure."
    },
    {
      name: "Top Control (Side or Mount)",
      bodyPosition: "Chest heavy over the opponent, knees and hips organized to prevent escape, head positioned to keep pressure aligned.",
      weightDistribution: "70% front / 30% rear",
      strengths: "Strong for immobilizing the opponent and moving toward dominant pin positions.",
      weaknesses: "Can be reversed if pressure is poorly distributed or the opponent recovers frames and hips."
    },
    {
      name: "Back Control",
      bodyPosition: "Behind the opponent's shoulders, torso glued to the back line, hooks controlling the hips, head tucked to protect the choking arm.",
      weightDistribution: "Distributed through the torso rather than a simple front/rear split",
      strengths: "The highest control position in the system. Opens the path to a submission finish.",
      weaknesses: "If hand control breaks, the opponent can rotate, slide, or peel the arm off."
    }
  ],
  strikes: [
    {
      name: "Hip Escape (Shrimp)",
      mechanics: "The foundation of all guard recovery. The NTU dataset confirms the mechanical requirement: the shrimping motion must create 15â20cm of separation between the practitioner's hips and the opponent's body for a knee to re-enter as a frame. The motion is not a push â it is a hip-first lateral slide driven by the supporting foot.",
      setup: "The opponent is on top or closing a guard pass.",
      execution: "The practitioner bridges slightly, then slides the hips sideways and away while the top foot pushes into the mat. The knee inserts into the created space.",
      recovery: "The guard re-forms around the created space or transitions to another control state.",
      counter: "Collapse the space from multiple angles and deny the hips a route back in."
    },
    {
      name: "Guard Sweep",
      mechanics: "Sweeps work when the bottom player can disturb the opponent's base and convert an inferior position to a superior one. The NTU grappling data shows that a successful sweep requires the attacker's hips to create angle perpendicular to the opponent's weight commitment â sweeping in the direction the opponent is already leaning requires far less force than sweeping against their base.",
      setup: "The opponent is committed and their weight is readable.",
      execution: "The bottom player disrupts the base by angling the hips perpendicular to the weight commitment, then shifts into a top position.",
      recovery: "The exchange continues immediately from the new top angle â the bottom player does not pause to celebrate.",
      counter: "Post early with the free hand, widen the base, and refuse the tilt before the sweep line forms."
    },
    {
      name: "Rear Naked Choke",
      mechanics: "The NTU dataset on choking mechanics establishes the physical conditions: bilateral carotid compression (both arteries simultaneously) produces unconsciousness in 8â12 seconds when the pressure threshold is met. The choking arm must cross the throat, not just rest on it. The hooks prevent the rotation that would allow the opponent to face the attacker. The free arm is not decorative â it controls the opponent's arm to prevent the choke from being peeled.",
      setup: "Back control is established and the opponent cannot turn fully.",
      execution: "The choking arm crosses the throat, the hand grips the bicep of the opposite arm, and the second hand applies pressure behind the head. The hooks stay active.",
      recovery: "If the finish does not arrive, stay attached to the back and maintain control â never voluntarily abandon back position.",
      counter: "Clear the choking hand early, tuck the chin before the arm crosses, and turn into the attacker before both hooks are set."
    }
  ],
  defenses: [
    {
      name: "Frame and Recover",
      mechanics: "Frames are the core defensive idea across BJJ positions. A frame is a structural connection between the defender's limb and the opponent's body that creates space against pressure. The NTU data shows that the frame must be placed at a joint â wrist to shoulder, forearm to throat â to create maximum leverage from minimum force. A frame placed in the middle of muscle is easy to collapse.",
      setup: "The opponent is on top or closing a pass.",
      execution: "The defender places limbs into structural contact at the opponent's joint lines, preserving space long enough for the hips to recover.",
      recovery: "The body returns to a usable control state as soon as space exists.",
      counter: "Collapse the frame from multiple angles simultaneously and deny the hips a route back in."
    }
  ],
  strengthAgainst: [
    "Opponents who do not understand ground positional hierarchy and give away dominant positions.",
    "Fighters who overcommit from top position and allow reversals.",
    "Rivals who cannot defend back control â that is where BJJ finishes fights."
  ],
  weakAgainst: [
    "Fast strikers who keep the fight standing and do not enter the grappling game.",
    "Wrestlers or top-control specialists who can flatten the guard before it develops.",
    "Opponents with strong grip discipline and posture who prevent the back take."
  ],
  signatureTells: [
    "The hips shift to create angle before the opponent realizes a sweep or back take is loading.",
    "The head disappears behind the opponent's shoulder line when back control is being secured.",
    "The legs become active barriers rather than passive positions â guard work in progress.",
    "The practitioner repeatedly creates and protects the space between bodies, prioritizing position over force."
  ],
  pacing: "BJJ is methodical until it suddenly isn't. A lot of the fight looks like patient problem-solving, but once a dominant position is secured the tempo narrows fast and the opponent has very little room to breathe. It should feel like chess played with bodies on the ground.",
  writingNotes: "A BJJ-trained character often thinks in layers of control and recovery. That training produces a person who stays calm when pinned, looks for leverage before panic, and is willing to keep solving the same problem for a long time. In fiction, they come across as patient, persistent, and annoyingly hard to shake once they have a hold on a situation."
};

// ───────────────────────────────────────────────
// RHYTHM AND DECEPTION ARTS
// ───────────────────────────────────────────────
