import type { CombatStyle } from "../../types";

export const HEMA_LONGSWORD: CombatStyle = {
  name: "HEMA Longsword",
  origin: "Medieval and early Renaissance Europe, especially the German Liechtenauer tradition as reconstructed in modern Historical European Martial Arts.",
  era: "Historical fencing tradition preserved through modern reconstruction and training communities.",
  corePhilosophy: "HEMA Longsword is a system of covered attack and control. The fighter is expected to take initiative without becoming exposed, keep the point or edge threatening while remaining structurally safe, and treat the bind as a place where the fight continues rather than pauses. Success comes from position, timing, and leverage â not from swinging harder.",
  bodyMechanics: `The BNR dataset on weapon combat is the most directly applicable source for longsword mechanics. Its analysis of circular weapon techniques shows that maximum blade velocity in a full circular strike occurs at 135 degrees into the rotation â not at 180 degrees as intuition suggests. This matters for the Zornhau and the Zwerchhau: the cut does not continue to its geometric endpoint if that would cost structural coverage. The cutter stops at peak velocity because their own guard position is built into that stopping point. The Krumphau's off-angle entry applies similar physics to a different problem: instead of going through the opponent's guard, it goes around it by attacking from the strong-to-weak line. The weapon enters at an angle that bypasses the high-structure portion of the opponent's guard, and the body step simultaneously moves the fencer offline. The Liechtenauer sources describe this as attacking into the opponent's before â initiating before they can respond rather than answering after they have committed â and the BNR data on timing windows supports this as the primary mechanical advantage of the master cuts over simpler attacks.`,
  distancePreference: "Long sword range, with the ability to collapse into bind or half-sword range.",
  footworkPrinciple: "Line management. The fencer steps to keep the body behind the sword, use off-line angles, and preserve the ability to enter the bind without giving away the center. The feet arrange the body so the sword can threaten while the fighter remains covered.",
  stances: [
    {
      name: "Vom Tag (From the Roof)",
      bodyPosition: "Sword held high in a ready position, torso aligned for a descending action, feet placed for immediate initiative.",
      weightDistribution: "50% front / 50% rear",
      strengths: "Strong for initiation, visible threat, and rapid transition into the master cuts.",
      weaknesses: "Can be read if the fighter stays static at the high position too long."
    },
    {
      name: "Alber (The Fool)",
      bodyPosition: "Point angled lower with the body compact and the sword line hiding intent, inviting the opponent forward into an exposed attack.",
      weightDistribution: "55% rear / 45% front",
      strengths: "Discourages reckless entry and invites the opponent into a controlled line.",
      weaknesses: "Surrenders initiative if the fighter stays passive too long."
    },
    {
      name: "Pflug (The Plow)",
      bodyPosition: "Point elevated near the face or throat line, elbows and shoulders organized behind the blade to maintain a strong forward threat.",
      weightDistribution: "50% front / 50% rear",
      strengths: "Keeps the point dangerous and makes direct approach expensive.",
      weaknesses: "Can be stressed by strong angle changes and winding pressure."
    }
  ],
  strikes: [
    {
      name: "Zornhau (Wrath Cut)",
      mechanics: "The foundational descending cut in the Liechtenauer system. The BNR dataset shows maximum velocity at 135 degrees into the arc â the cut does not continue past this point because the stopping position is itself a new guard. The cut takes the line while remaining covered: defense and offense are one motion.",
      setup: "The opponent initiates along a readable line or leaves the center open.",
      execution: "The fencer drives a descending cut with body support and line control. The blade stops at 135 degrees into the arc â at peak velocity and into a covered position.",
      recovery: "If the blow binds, the sword is already positioned for winding or thrusting without repositioning.",
      counter: "Angle offline, deny the centerline, or use the bind to redirect the cut before it lands."
    },
    {
      name: "Krumphau (Crooked Cut)",
      mechanics: "The BNR data on weapon approach angles confirms the principle: an attack that arrives from the opponent's strong-to-weak line bypasses their guard's structural peak. The Krumphau enters from the side at an angle that threatens the weapon hand or the off-line of the guard, while the body step simultaneously moves the fencer offline.",
      setup: "The opponent is holding a guard that resists direct approach.",
      execution: "The sword travels across the line at an angle that threatens the weak side or the hands. The feet step off the centerline simultaneously.",
      recovery: "The blade stays active and flows into another cut or thrust.",
      counter: "Stay compact, keep the weapon on the true line, and force the attacker to overreach."
    },
    {
      name: "Zwerchhau (Thwart Cut)",
      mechanics: "A horizontal or rising cut that changes the plane of attack while keeping the sword threatening. The BNR data on plane transitions shows that a blade moving horizontally requires the opponent to redirect their guard vertically â a more complex motor response than tracking a continuing vertical blade.",
      setup: "The opponent attacks from above or exposes the upper line.",
      execution: "The fencer rotates the sword into a horizontal plane that intersects the incoming attack from the side.",
      recovery: "The point or edge is ready to continue if the first contact does not finish the exchange.",
      counter: "Change level early and avoid presenting the high line cleanly."
    },
    {
      name: "Half-Swording Entry",
      mechanics: "At close range or against armored opponents, the hands move onto the blade itself â one hand at the grip, one hand gripping the flat of the blade partway down. The BNR dataset on weapon leverage confirms the mechanical advantage: gripping the blade reduces the effective lever arm, giving greater control for thrusting into gaps in armor and for wrestling with the weapon.",
      setup: "The fighters are too close for full-length cuts to work, or the opponent is armored.",
      execution: "One hand moves onto the blade, and the weapon becomes a thrusting and wrestling tool rather than a cutting one.",
      recovery: "The hand can return to the grip if distance reopens.",
      counter: "Keep the distance long enough that half-swording range never arrives."
    }
  ],
  defenses: [
    {
      name: "The Bind and Wind",
      mechanics: "The bind is not a stop â it is where the fight continues. When two blades connect, the BNR data shows the fighter with the stronger structure and better hand position can wind (rotate the blade) to threaten the opponent while still in contact. Winding from the bind reaches targets the original cut could not without a full withdrawal.",
      setup: "Two blades have connected.",
      execution: "The fencer maintains contact and rotates the blade to find the opponent's opening from the point of contact.",
      recovery: "If the wind produces no opening, the fencer disengages and resets to distance.",
      counter: "Wind before the opponent, or disengage and reenter on a new line before the winding position settles."
    }
  ],
  strengthAgainst: [
    "Opponents who attack along predictable lines and give the master cuts a clean interception window.",
    "Fighters who do not understand the bind and treat it as a stopping point rather than a continuation.",
    "Close-range entry attempts that do not account for half-swording."
  ],
  weakAgainst: [
    "Very short weapons in close quarters where the longsword's length becomes a liability.",
    "Multiple opponents simultaneously.",
    "Opponents who exploit the recovery phase between cuts."
  ],
  signatureTells: [
    "The sword never hangs still at full extension â it always returns to a covered position, showing trained structure.",
    "The feet move offline before or during the cut rather than staying on the centerline.",
    "When blades connect, the fencer does not step back â they wind, showing the bind is being used not avoided.",
    "The point stays threatening even in the guard positions, making every stance look like an aimed weapon."
  ],
  pacing: "HEMA Longsword has a precise, controlled tempo. Much of the fight consists of guards and approach, broken by sudden explosive exchanges. The rhythm should feel measured and technical, with moments of violence that last only a few beats before one fighter reestablishes structure.",
  writingNotes: "A HEMA longsword practitioner thinks in geometry and timing. The training produces a mind that perceives fights in terms of lines, angles, and leverage rather than raw aggression. In fiction, they tend to feel precise, methodical, and unusually aware of distance â someone who respects the weapon as a system, not just as a tool."
};
