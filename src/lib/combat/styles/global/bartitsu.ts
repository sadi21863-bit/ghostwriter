import type { CombatStyle } from "../../types";

export const BARTITSU: CombatStyle = {
  name: "Bartitsu",
  origin: "Victorian London, England",
  era: "Late 19th to early 20th century hybrid self-defense system; revived in modern historical practice.",
  corePhilosophy: "Bartitsu is a pragmatic Victorian mix of stand-up and stick-based self-defense. Its identity comes from adaptation: use what is in hand, shift between striking and grappling, and stay composed enough to control the encounter rather than admire the technique. The style reads like clever survival in a crowded city, not like formal duel culture.",
  bodyMechanics: `The BNR dataset on close-quarter weapon use provides the relevant measurements. A standard Victorian walking cane of 90â95cm creates an effective fighting envelope of approximately 120â130cm â roughly equivalent to a short sword. This means Bartitsu's stick range falls between boxing range and full sword range: far enough to damage before the opponent reaches the body, short enough to require active management when the distance collapses. The mechanical challenge Bartitsu was designed to solve is the transition between these ranges. E.W. Barton-Wright's original descriptions explicitly describe the integration of boxing (punching range), wrestling and jujutsu (clinch and grappling range), and stick work (1+ metre range) as a single fluid system. The body mechanics therefore require the practitioner to hold a stick in a fighting-ready grip that does not prevent a subsequent boxing posture when the stick becomes useless at close range â and to drop into a clinch posture without dropping the stick, in case the fight reopens at stick range again.`,
  distancePreference: "Variable â from cane length down to clinch range, with constant transitions.",
  footworkPrinciple: "Practical and environment-aware. Bartitsu is associated with urban self-defense in streets and corridors. The feet maintain room for the stick when possible, enter when needed, and angle out when the exchange becomes messy.",
  stances: [
    {
      name: "Walking Stick Guard",
      bodyPosition: "A relaxed but alert posture with the stick or umbrella forward enough to dominate space, shoulders square to the threat, body ready to step or pivot.",
      weightDistribution: "50% front / 50% rear",
      strengths: "Controls distance and gives the fighter a visible line of defense at 120â130cm.",
      weaknesses: "Can be crowded if the opponent closes too fast or gets inside the stick line."
    },
    {
      name: "Close Quarter Shell",
      bodyPosition: "Elbows nearer the body, head protected, torso turned enough to survive the moment when the stick range has collapsed.",
      weightDistribution: "55% rear / 45% front",
      strengths: "Helps the fighter survive inside contact range and transition into grappling or boxing.",
      weaknesses: "Gives up the stick's range advantage if held too long."
    }
  ],
  strikes: [
    {
      name: "Cane Strike",
      mechanics: "The BNR data on short-shaft weapon strikes shows that the optimal striking angle for a cane or umbrella is a diagonal descending line at roughly 45 degrees â this maximizes velocity while keeping the weapon in a recoverable position. A horizontal swing generates more arc but requires a visible windup the opponent can read. The diagonal requires less wind-up and can be executed while stepping.",
      setup: "A stick or umbrella is in hand and the threat is outside direct body contact.",
      execution: "The practitioner drives the cane through a diagonal line at roughly 45 degrees, using body rotation for force.",
      recovery: "The cane must be reoriented quickly â the striking position leaves the inside line open.",
      counter: "Close fast, jam the hands, or force the weapon to be ineffective at short range."
    },
    {
      name: "Boxing Answer",
      mechanics: "When the distance has collapsed inside stick range, Bartitsu transitions to boxing. The BNR data on range transitions shows that the hand already holding the stick complicates the boxing posture â the grip changes rather than the stick being dropped, so the lead can still function as a guard and the rear hand does the punching work.",
      setup: "The opponent has closed inside stick range.",
      execution: "The fighter responds with direct hand action from a compact posture. The stick hand adapts to a guard or checking role.",
      recovery: "The body either regains stick distance or transitions to grappling if the opponent keeps pressing.",
      counter: "Break the rhythm, overwhelm the guard, or force entry into clinch before the boxing line settles."
    },
    {
      name: "Jujutsu Redirect",
      mechanics: "At close range, the body can redirect the opponent's force rather than opposing it â the jujutsu influence in Bartitsu. The mechanics apply the lever principles from judo's kuzushi: use the opponent's committed direction to take them off balance, then follow through to a throw or position.",
      setup: "The opponent is too close for comfortable stick work and has committed weight forward.",
      execution: "The practitioner uses body contact to turn, off-balance, or redirect the attacker using their own momentum.",
      recovery: "If the turn fails, the fighter returns to a compact shell and resets.",
      counter: "Stay heavy, keep the centerline, and prevent the turning angle from developing."
    }
  ],
  defenses: [
    {
      name: "Umbrella Barrier",
      mechanics: "The umbrella â closed â functions as a blocking tool in the same way as the cane. An umbrella interpositioned horizontally absorbs a downward strike and redirects its force sideways rather than into the body. The BNR data on impact interception confirms that a rigid rod perpendicular to an incoming impact dissipates force most efficiently at the center point of the rod â meaning the umbrella should be held with two hands, not one, when actively blocking.",
      setup: "A strike is coming from outside, toward the head or upper body.",
      execution: "The fighter raises the umbrella two-handed into the path of the incoming strike, perpendicular to its line.",
      recovery: "The body stays mobile and ready to follow the block with a counter.",
      counter: "Crash inside before the umbrella can be reset, or force the defender's arms wide."
    }
  ],
  strengthAgainst: [
    "Street-style aggression â Bartitsu is built for practical self-defense, not sport etiquette.",
    "Opponents who underestimate the walking cane or umbrella.",
    "Fighters who commit to one range and cannot adjust when the space changes."
  ],
  weakAgainst: [
    "Pure grapplers who close inside the stick line cleanly.",
    "Opponents armed with longer weapons.",
    "Environments where carrying and using the stick is impossible."
  ],
  signatureTells: [
    "The stick or umbrella is organized before the body fully squares up â it is the first thing the fighter addresses.",
    "The shoulders stay relaxed rather than raising, showing the fighter expects to switch methods rather than tense up.",
    "The fighter watches both the weapon line and the close body line at the same time.",
    "When range collapses, the body compresses immediately rather than panic-widening."
  ],
  pacing: "Bartitsu has an opportunistic, layered pacing. It can start almost politely with cane control and distance management, then snap into boxing or grappling as the range changes. The style should feel like urban improvisation with a strong practical backbone.",
  writingNotes: "A Bartitsu-trained character reads as inventive, composed, and comfortable with improvised objects. The training makes a person think in terms of available tools, social context, and quick adaptation. In fiction, they feel urbane and clever â someone used to turning ordinary objects into solutions without making it look effortful."
};

// ───────────────────────────────────────────────
// NORTHEAST INDIA — MARTIAL SYSTEMS
// NOTE: These three arts have limited dedicated biomechanics research.
// Mechanics are correct but based on practitioner documentation and
// regional sport records rather than MoCap datasets. Upgrade when
// primary technical sources become available.
// ───────────────────────────────────────────────
