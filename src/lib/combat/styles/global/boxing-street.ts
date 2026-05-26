import type { CombatStyle } from "../../types";

export const BOXING: CombatStyle = {
  name: "Boxing",
  origin: "Global â codified in England in the 18th century; roots in ancient Greek and Roman pugilism",
  era: "Modern combat sport; still the most widely practiced striking art worldwide.",
  corePhilosophy: "Boxing is the science of hitting without being hit. Every technical element â the guard, the footwork, the slipping and rolling â exists to create the conditions for a clean punch to land while denying the opponent the same opportunity. The art rewards intelligence over aggression: the boxer who wins is usually the one who saw more, planned further ahead, and made the opponent walk into the strike rather than chasing them with it.",
  bodyMechanics: `The KYO dataset provides the most precise biomechanical data for boxing mechanics. The cross (rear-hand straight punch) generates maximum force when the rear heel pivots first â driving ground reaction force through the leg, hip rotation, trunk rotation, and finally the arm. The dataset measures this sequence: heel pivot initiates approximately 80ms before the fist reaches the target, and hip rotation leads arm extension by approximately 50ms. A cross that skips the heel pivot loses approximately 35â40% of its peak force. The jab operates differently â it is primarily a timing and positioning tool, not a power strike. The KYO data shows jab force peaks when the shoulder drives forward without full hip engagement, making it faster but less powerful. The hook derives its power from a short, sharp hip rotation â the BIO literature on hook mechanics confirms that the optimal hip rotation for a hook is approximately 45 degrees, not the full 90 degrees of the cross. More rotation slows the hook without adding proportional power. The uppercut requires the body to dip slightly before rising â the dip loads the legs, and the rise transfers their force upward through the punch.`,
  distancePreference: "Mid-range (punch range) with constant management of entry/exit.",
  footworkPrinciple: "Footwork serves two purposes: positioning to land and positioning to not be hit. The boxer moves on the balls of the feet, maintains shoulder-width stance, and always moves the head off the centerline after punching. The fundamental rule: never let both feet leave the floor simultaneously.",
  stances: [
    {
      name: "Orthodox Guard",
      bodyPosition: "Left foot forward, chin down, left hand at eye level to guard and jab, right hand at cheek level to guard and cross, elbows protecting the ribs.",
      weightDistribution: "55% front / 45% rear",
      strengths: "Balanced for both offense and defense. Rear hand cross is the power punch.",
      weaknesses: "Predictable to an experienced opponent who has seen many orthodox fighters."
    },
    {
      name: "Southpaw Guard",
      bodyPosition: "Right foot forward, mirror image of orthodox. The left hand becomes the power cross.",
      weightDistribution: "55% front / 45% rear",
      strengths: "Causes alignment problems for orthodox opponents â their power hand faces the southpaw's power hand.",
      weaknesses: "Orthodox fighters who have trained against southpaws exploit the open stance."
    },
    {
      name: "Philly Shell",
      bodyPosition: "Lead shoulder raised, lead hand on the hip or low, rear hand at the chin, torso rotated to present the shoulder as the primary defense.",
      weightDistribution: "50% front / 50% rear",
      strengths: "Excellent for rolling under shots and countering. Shoulder takes punches intended for the head.",
      weaknesses: "Requires significant skill to execute. Exposed to body shots on the lead side."
    }
  ],
  strikes: [
    {
      name: "Jab",
      mechanics: "The KYO data shows jab force peaks with shoulder drive, not hip engagement â making it faster than the cross at the cost of power. The jab's real value is its range, its ability to set up the cross, and its role in controlling distance. A double-jab followed by a cross is the most statistically common knockout setup in amateur boxing.",
      setup: "The opponent is at the end of jab range.",
      execution: "The lead shoulder drives forward, the arm extends, the fist rotates to horizontal on impact. The head moves offline simultaneously.",
      recovery: "The jab hand returns along the same line â a jab that hangs extended is an arm that can be hit.",
      counter: "Slip outside the jab and return with the cross â this is the most common boxing counter."
    },
    {
      name: "Cross",
      mechanics: "The KYO dataset's most precise finding: rear heel pivots 80ms before impact, hip rotation leads arm extension by 50ms. Maximum force requires this sequence. A cross thrown without the heel pivot loses ~35-40% of peak force. This is the power punch.",
      setup: "The jab has occupied the opponent or created an opening.",
      execution: "Rear heel pivots, hip rotates, shoulder drives, arm extends. The fist rotates to horizontal at impact. The chin tucks behind the lead shoulder.",
      recovery: "The rear hand returns to guard position â it left the face unguarded.",
      counter: "Slip to the outside and hook to the body or head."
    },
    {
      name: "Hook",
      mechanics: "BIO literature confirms: optimal hip rotation for the hook is approximately 45 degrees. More rotation slows the punch. The hook is a short-arc power punch that arrives from the side, bypassing the opponent's forward guard.",
      setup: "The opponent is inside the jab's comfortable range â too close for a straight punch.",
      execution: "The lead hip rotates 45 degrees, the elbow rises to shoulder height, the forearm swings horizontally. The pivot is in the lead foot.",
      recovery: "The elbow returns to guard position â a dropped elbow telegraphs the hook and leaves the head exposed.",
      counter: "Duck under the hook and drive up into a body attack or takedown."
    },
    {
      name: "Uppercut",
      mechanics: "The body dips before rising â the dip loads the legs, the rise transfers their force upward. BIO data on uppercut biomechanics shows the dip-and-drive accounts for approximately 40% of total uppercut force.",
      setup: "The opponent is at close range with their guard forward.",
      execution: "The body dips slightly, the legs drive upward, the arm follows the body's rising force in a vertical arc, driving up through the guard.",
      recovery: "The arm returns along the vertical arc â it should not swing wide on the way back.",
      counter: "Clinch before the dip completes â the uppercut needs that drive space."
    }
  ],
  defenses: [
    {
      name: "Slip and Roll",
      mechanics: "Slipping moves the head off the attack line by rotating the torso â not by stepping. The KYO data shows a 10â15 degree torso rotation moves the head 15â20cm laterally, which is enough to make most punches miss while keeping the body in counter range. Rolling under a hook involves dropping the head below the punch's arc and rising on the other side.",
      setup: "A punch is incoming.",
      execution: "Torso rotation slips the head outside or inside the punch line. The body simultaneously loads for the counter.",
      recovery: "The head does not stay slipped â it returns to centerline before the next exchange.",
      counter: "Throw a combination so the slip from the first punch puts the head in line with the second."
    }
  ],
  strengthAgainst: [
    "Opponents who lead with their face and do not understand head movement.",
    "Unskilled strikers who telegraph punches with shoulder drops and hip rotation.",
    "Fighters who move predictably and can be timed."
  ],
  weakAgainst: [
    "Grapplers who close distance and neutralize the punching range.",
    "Leg kickers who attack the foundation the boxer stands on.",
    "Opponents who use elbows and knees at close range where boxing rules don't apply."
  ],
  signatureTells: [
    "The rear heel lifts slightly before a cross â the kinetic chain loading.",
    "The shoulder dips before a hook â the body rotating before the arm follows.",
    "The body dips before an uppercut â the legs loading.",
    "The head moves off the centerline immediately after every punch â a deeply conditioned reflex."
  ],
  pacing: "Boxing has a layered, rhythmic pace. It can look methodical for long periods â jabs, movement, distance management â then explosive when the combination lands. The rhythm is set by the jab; when the jab changes tempo, the cross is coming. A good boxer controls tempo as deliberately as they control distance.",
  writingNotes: "A boxing-trained character thinks in angles, timing, and range. They tend to be intelligent about conflict â measuring before committing, making opponents pay for mistakes. In fiction, they feel composed, patient, and dangerous in a way that is not obviously readable until the moment they decide to be."
};

export const STREET_FIGHTING: CombatStyle = {
  name: "Street Fighting",
  origin: "Universal â no tradition, no lineage, no school",
  era: "Contemporary and historical â wherever people have fought without rules.",
  corePhilosophy: "Street fighting has no philosophy. That is the point. It is what happens when adrenaline takes over, when the body acts on instinct before the mind can intervene, when the only goal is to stop the other person and get away. Everything that makes martial arts valuable â technique, timing, composure â is exactly what street fighting destroys. The most dangerous thing about an untrained street fighter is not what they know. It is that they do not care.",
  bodyMechanics: `The BIO literature on combat under acute stress confirms the specific failures street fighting produces â and exploits. Under adrenaline: fine motor skills degrade significantly (complex joint locks become unreliable), tunnel vision narrows to approximately 70 degrees (peripheral attacks land undetected), pain tolerance increases temporarily (combatants continue fighting through injuries they would stop for in training), and time perception distorts (seconds feel like much longer). A street fighter is physiologically in a different state than a trained martial artist in competition. The trained fighter uses controlled arousal â enough adrenaline to improve reaction time and strength, not enough to destroy technique. The street fighter is fully flooded. This creates a specific vulnerability: they cannot adjust mid-exchange. A plan formed in the first moment is the plan they execute regardless of what happens. But it also creates a specific danger: the BIO data on untrained striking shows that haymakers thrown by large adults with no training can generate peak forces in the 1,500â2,500 Newton range â comparable to trained boxing crosses. The force is there. Only the structure and accuracy are missing.`,
  distancePreference: "Immediate â the street fighter closes distance fast and keeps it there. There is no range management.",
  footworkPrinciple: "There is no footwork principle. The street fighter moves forward. They use the environment (walls, furniture, other people) instinctively without tactical awareness of doing so.",
  stances: [
    {
      name: "Adrenaline Guard",
      bodyPosition: "Shoulders high, chin exposed, hands up but not in any formal guard position, weight shifted forward, jaw often jutted.",
      weightDistribution: "65% front / 35% rear",
      strengths: "The forward lean generates aggressive forward momentum. The shoulders' height protects the chin from low strikes.",
      weaknesses: "The chin is exposed. The weight-forward stance is easy to redirect or sweep. No guard for body shots."
    }
  ],
  strikes: [
    {
      name: "Haymaker",
      mechanics: "A wild roundhouse punch thrown with full arm extension and body rotation. No technique, but the BIO data on untrained striking confirms peak force can reach 1,500â2,500 Newtons in large adults. The wind-up is a major telegraph â the arm draws back visibly before the throw. But the force is real, and if it lands on an unprepared chin, it ends the fight.",
      setup: "The street fighter is angry and at punching distance.",
      execution: "The arm draws back wide, the body rotates, and the punch swings in a large arc toward the head.",
      recovery: "There is no recovery â the street fighter is already swinging the other arm, or grabbing, or running.",
      counter: "The long telegraph creates an interception window. Step inside the arc before it completes and the haymaker misses or lands with a fraction of its potential force."
    },
    {
      name: "Clinch and Slam",
      mechanics: "The street fighter grabs and drives forward â no throw technique, just aggression applied to proximity. The BIO data on untrained grappling shows that weight, momentum, and anger can generate significant impact even without technique. A 90kg person running forward with someone grabbed is a physics problem as much as a technique problem.",
      setup: "The street fighter has made contact and momentum is in their favor.",
      execution: "Grab whatever is reachable, drive forward with body weight, use a wall, floor, or other object as the impact surface.",
      recovery: "The street fighter follows to the ground or stands over the opponent.",
      counter: "Control the incoming momentum by redirecting it â a side step and arm bar turns the drive past you and into the ground."
    },
    {
      name: "Environmental Weapon",
      mechanics: "A bottle, chair, belt, bag, keys â anything in reach becomes a weapon. The street fighter does not plan this; they grab instinctively. The BIO data on improvised weapon impacts shows that even low-mass improvised weapons (bottles, keys) create significant psychological disruption because they are unexpected.",
      setup: "The street fighter's hand finds an object.",
      execution: "The object is swung, thrown, or used to strike. Technique is absent but force and unpredictability are present.",
      recovery: "The improvised weapon is either retained for another hit or abandoned when empty-handed fighting seems faster.",
      counter: "The second before the weapon is grabbed is the window to act â after it is in hand, the situation has escalated significantly."
    }
  ],
  defenses: [
    {
      name: "Cover and Absorb",
      mechanics: "The street fighter does not defend technically. They cover their head with their arms and push through. The BIO data on untrained defense shows this works against single strikes but breaks down against combinations. The street fighter absorbs the first hit and counters â their pain tolerance under adrenaline makes this more viable than it sounds.",
      setup: "Strikes are incoming.",
      execution: "Arms rise to cover the head. Eyes shut. The street fighter takes the hit and drives forward.",
      recovery: "Immediately after covering, they are already throwing or grabbing.",
      counter: "Use the cover-and-drive by timing an uppercut through the covering arms."
    }
  ],
  strengthAgainst: [
    "Technical fighters who assume technique will solve a physics problem â a charging 100kg body does not care about your guard.",
    "Opponents who hesitate or try to assess the situation â the street fighter acts before the assessment completes.",
    "Anyone who underestimates the force a non-technical but physically strong person can generate."
  ],
  weakAgainst: [
    "Calm, trained fighters who can use the telegraph (the wind-up, the charge) against them.",
    "Grapplers who redirect the forward momentum into a throw â all that running helps the throw.",
    "Anyone who controls the distance before the street fighter closes it."
  ],
  signatureTells: [
    "The jaw juts forward â aggression overriding the instinct to protect the chin.",
    "The arm draws back visibly before the haymaker â the wind-up that gives the trained fighter their window.",
    "Eyes go wide or narrow severely â the tunnel vision is visible in the face.",
    "Breathing becomes audible and fast â the adrenaline load is not concealed.",
    "The hands reach for nearby objects automatically â the instinct for improvised weapons fires without conscious thought."
  ],
  pacing: "Street fighting has no pacing. It explodes from nothing, runs at maximum intensity for 5â30 seconds, and is over â either someone is down, separated, or someone ran. There is no second round. The exchange should feel sudden, messy, and decisive.",
  writingNotes: "A street fighter is not a character archetype â it is a state anyone can enter. The interesting question is who the person is when they come back down. What did the adrenaline make them do, and how do they feel about it afterward? The fight itself is fast and ugly. The aftermath is where character lives."
};
