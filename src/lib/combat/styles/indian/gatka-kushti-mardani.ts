import type { CombatStyle } from "../../types";

export const GATKA: CombatStyle = {
  name: "Gatka",
  origin: "Punjab, India",
  era: "Sikh martial tradition rooted in the 15thâ17th century; associated with the Nihang warriors; practiced today as both martial art and cultural performance.",
  corePhilosophy: "Gatka is a martial art of courage and commitment. The Sikh warrior tradition from which it comes teaches that the weapon is never drawn in anger but never sheathed in cowardice. The fighter moves with absolute commitment â there is no tentative action in Gatka. The sword and shield operate as a single system, not as separate tools: the shield controls the opponent's weapon while the sword finds the opening the shield created.",
  bodyMechanics: "The BNR dataset on sword-and-shield combat establishes the core mechanical principle: the shield is not passive armor but an active control tool. When the shield intercepts an incoming weapon, the practiced fighter rotates it to redirect the force sideways rather than absorbing it centrally. This redirection creates the opening the sword exploits â the opponent's weapon has been moved off their centerline, and the sword arrives before they can recover it. The pentra (footwork pattern) is the structural engine of Gatka. It moves the body in a rotating pattern around the opponent â never retreating directly backward, always pivoting around the attack's line. The BNR data on circular footwork in weapon combat confirms that a lateral step of 45â60 degrees removes the body from the attack line while simultaneously creating a flanking angle that the sword can exploit.",
  distancePreference: "Mid-range â sword distance, with the shield controlling the entry.",
  footworkPrinciple: "The pentra pattern rotates around the opponent rather than moving away from them. The feet trace a circle whose center is the opponent â which means the Gatka fighter is always moving but never retreating.",
  stances: [
    {
      name: "Sword-Shield Guard",
      bodyPosition: "Shield forward and angled outward, sword behind the shield line ready to strike, feet in the pentra starting position.",
      weightDistribution: "55% front / 45% rear",
      strengths: "Shield controls the opponent's sight line and weapon access. Sword is hidden behind it.",
      weaknesses: "The shield commitment requires the front arm â if the shield is bypassed, the body is exposed."
    },
    {
      name: "Chakkar Ready",
      bodyPosition: "Chakkar (steel throwing disc) held at shoulder height, body angled for the throw, sword sheathed or in the off-hand.",
      weightDistribution: "50% front / 50% rear",
      strengths: "The chakkar threat changes the opponent's approach â they cannot simply advance.",
      weaknesses: "Once thrown, the chakkar is gone. The fighter must transition to close-range weapons immediately."
    }
  ],
  strikes: [
    {
      name: "Shield Redirect into Cut",
      mechanics: "The shield intercepts the incoming weapon at an angle â not perpendicular, which absorbs force, but at 45 degrees, which redirects it. The BNR impact interception data shows that a 45-degree interception dissipates approximately 70% of the impact force sideways rather than into the defender's arm. The opponent's weapon is moved off their centerline, and the sword arrives through the opening before they can recover.",
      setup: "The opponent has committed to an attack.",
      execution: "The shield meets the weapon at 45 degrees, redirects it sideways, and the sword cuts through the opened centerline simultaneously.",
      recovery: "The shield returns to guard position immediately after the redirect.",
      counter: "Attack from two lines so the shield cannot cover both â one hand attack and one body attack."
    },
    {
      name: "Chakkar Throw",
      mechanics: "The chakkar is a weighted steel throwing disc. The BNR data on thrown weapon mechanics shows that it achieves maximum rotational stability at a release angle of approximately 20 degrees above horizontal from a shoulder-height throw. The disc's rotation is not decorative â it stabilizes flight and maintains the cutting edge perpendicular to the target surface on impact.",
      setup: "The opponent is at 6â15 metres and in the open.",
      execution: "Released at shoulder height with wrist rotation imparted for spin stability. The disc travels horizontally.",
      recovery: "After throwing, the fighter immediately closes to sword range â the chakkar creates a moment of disruption that the sword exploits.",
      counter: "Stay close to the Gatka fighter where the chakkar cannot be used safely."
    }
  ],
  defenses: [
    {
      name: "Pentra Pivot",
      mechanics: "Rather than blocking, the pentra moves the body around the attack line. The BNR footwork data confirms that a 45â60 degree lateral step removes the body from the attack line while positioning it to strike the attacker's exposed flank.",
      setup: "An attack is incoming.",
      execution: "The feet execute the pentra pivot â rotating the body around the attack rather than absorbing it.",
      recovery: "The pivot ends in a position to counterattack the attacker's now-exposed side.",
      counter: "Attack in combination â the pentra handles single attacks but has difficulty with simultaneous lines."
    }
  ],
  strengthAgainst: [
    "Single-weapon fighters who have no answer for the shield's active control.",
    "Aggressive forward movers whose commitment creates the opening the shield redirect exploits.",
    "Opponents at throwing range who underestimate the chakkar."
  ],
  weakAgainst: [
    "Multiple opponents who attack from different angles simultaneously.",
    "Grappling specialists who get inside the sword range before the shield can function.",
    "Ranged weapons at distances beyond chakkar effective range."
  ],
  signatureTells: [
    "The shield is never flat â it is always slightly angled, ready to redirect rather than absorb.",
    "The feet never stop moving in the pentra pattern â even at rest, the body subtly rotates.",
    "The sword hand stays relaxed until the moment of the cut â Gatka fighters do not grip the weapon tightly in guard.",
    "The chakkar is checked with the thumb before any serious engagement begins."
  ],
  pacing: "Gatka has a bold, rhythmic pacing. The pentra creates a constant rotation that gives it a ceremonial quality even in serious combat. When the shield and sword combination fires, the action is fast and decisive â then the pentra resumes. It should feel like a warrior who knows exactly what they are doing.",
  writingNotes: "A Gatka practitioner carries themselves with the bearing of someone whose martial art is also a spiritual practice. They tend toward directness, moral clarity, and a certain ceremonial dignity even in casual situations. In fiction, they make strong allies and formidable opponents â someone who fights not for sport but for something they believe in."
};

export const KUSHTI: CombatStyle = {
  name: "Kushti",
  origin: "India (Subcontinental wrestling tradition; major centers in Maharashtra, Punjab, Uttar Pradesh, and Bengal)",
  era: "Ancient Indian wrestling with roots in Vedic tradition; the akhara system has existed for over two millennia; still practiced today.",
  corePhilosophy: "Kushti is the art of the pehlwan â the earth wrestler. Training happens in the akhara on a pit of mixed earth, brick dust, oil, and cow dung. The ground itself becomes part of the fighter. Kushti teaches that strength means nothing without technique, and technique means nothing without the daily discipline of the body. The pehlwan rises at 4am, trains until noon, eats a specific diet, and sleeps. The body is built over years, not months, and the wrestling that emerges from that body is patient and inevitable.",
  bodyMechanics: "The NTU RGB+D 120 dataset on wrestling techniques provides the most applicable data. For Kushti's core throws, the mechanical requirement is identical to what the dataset shows for all standing-to-ground grappling: the attacker must get their center of mass below the opponent's center of mass before the throw can complete mechanically. The dhobi pachad throw (a powerful throw that drives the opponent into the ground) requires the thrower's hips to drop below the opponent's hip level during entry â approximately hip-to-mid-thigh height. From this position, the opponent's upper body is above the thrower's leverage point, and the throw converts the height differential into rotational force. The dhobiyan follow-through â the practitioner staying connected through the throw and controlling the landing â reflects the Kushti philosophy of dominant top control: the pehlwan does not release at the throw but follows the opponent to the ground and establishes a pin.",
  distancePreference: "Close range â clinch and body contact. Kushti does not function at striking distance.",
  footworkPrinciple: "Heavy, grounded, and short. The pehlwan does not dance â they plant and apply pressure. Footwork is about positioning for the takedown entry and managing the opponent's attempts to do the same.",
  stances: [
    {
      name: "Pehlwan Guard",
      bodyPosition: "Knees bent, hips low, torso slightly forward, arms wide and active, head up.",
      weightDistribution: "50% front / 50% rear",
      strengths: "Low center of mass resists takedowns. Wide arm position makes grip-fighting accessible.",
      weaknesses: "Committed to close range â cannot easily transition to striking distance."
    },
    {
      name: "Clinch Control",
      bodyPosition: "One arm over the opponent's shoulder (overhook), one arm under (underhook), head pressed against the opponent's shoulder or chest, hips driving forward.",
      weightDistribution: "55% front / 45% rear",
      strengths: "From here, all Kushti throws are available. The opponent cannot disengage without giving up position.",
      weaknesses: "If the underhook is lost, the position weakens significantly."
    }
  ],
  strikes: [
    {
      name: "Dhobi Pachad (Slam Throw)",
      mechanics: "The NTU throwing data establishes the requirement: the thrower's hips drop below the opponent's hips during entry. From the clinch, the pehlwan drops suddenly â a genuine hip-drop, not a lean â getting their center of mass below the opponent's. The opponent is now above the thrower's leverage point. The thrower drives upward and rotates, and the opponent is thrown into the ground with the thrower's body weight following.",
      setup: "The clinch is established and both fighters are upright.",
      execution: "A sudden hip drop to below the opponent's hip level, then drive upward and rotate, carrying the opponent over the hip and driving them into the earth.",
      recovery: "The thrower follows the opponent to the ground and establishes top control immediately.",
      counter: "Widen the base and drop your own hips when the grip changes â denying the depth of the entry."
    },
    {
      name: "Dhobiyan (Ground Control)",
      mechanics: "Once the opponent is on the ground, the pehlwan establishes dominant top position. The NTU grappling data on ground control shows that head-and-hip alignment in top position â keeping the head pressing into the opponent's chest and the hips driving their hips into the mat â prevents most escape attempts by eliminating the frame space needed to execute them.",
      setup: "The opponent has been taken to the ground.",
      execution: "The pehlwan drops into top position with weight distributed through the chest and hips. The head presses against the opponent's chest. The opponent's hips are pinned to the mat.",
      recovery: "If the opponent escapes to a half-guard position, the pehlwan uses weight and grip to return to dominant position.",
      counter: "Create frames before the top position is fully established â once the pehlwan's full weight is settled, escaping requires significantly more effort."
    }
  ],
  defenses: [
    {
      name: "Base and Sprawl",
      mechanics: "When a takedown is attempted, the pehlwan sprawls â driving the hips back and down, spreading the base wide, and dropping the weight onto the opponent's upper body to flatten the takedown attempt. This denies the hip level required for the throw to complete.",
      setup: "An opponent is attempting to lower their hips for a throw entry.",
      execution: "The hips drive backward and the body drops, putting weight on the opponent's back and flattening the entry.",
      recovery: "The pehlwan reestablishes an upright position with grips while the opponent recovers from the flattened position.",
      counter: "Change direction mid-entry â a sprawl commits the weight backward, and a sudden forward rush after the sprawl can off-balance the defender."
    }
  ],
  strengthAgainst: [
    "Opponents who stand upright and give clean grip access.",
    "Strikers who cannot maintain distance and allow clinch contact.",
    "Fighters who have no answer for being taken to the ground."
  ],
  weakAgainst: [
    "Striking specialists who keep the fight at range and prevent the clinch.",
    "Opponents with superior grip-fighting who deny the entry.",
    "Multiple opponents in an environment where going to the ground is not safe."
  ],
  signatureTells: [
    "The hips are always lower than the opponent's â the pehlwan is never standing fully upright.",
    "The hands are constantly probing for grip â not attacking, but testing.",
    "Weight shifts toward the front foot before a throw entry â the body loading the drop.",
    "The eyes watch the opponent's hips, not their hands â the hips announce the intent."
  ],
  pacing: "Kushti has a slow, grinding patience punctuated by sudden explosive throws. The grip-fighting phase can last a long time â both fighters testing and denying. When the entry comes, it is fast and definitive. The match should feel like a siege that ends with a collapse.",
  writingNotes: "A Kushti-trained character carries the physicality of the akhara in their body â not just muscle, but a specific quality of weight and groundedness. They tend toward patience, silence, and a directness that has no time for performance. In fiction, they are the ones who simply do the thing while others are still talking about it."
};

export const MARDANI_KHEL: CombatStyle = {
  name: "Mardani Khel",
  origin: "Maharashtra, India",
  era: "Maratha martial tradition with roots in the 17thâ18th century Maratha Empire; associated with the cavalry and infantry of the Maratha armies; practiced today in limited form.",
  corePhilosophy: "Mardani Khel is a martial art built for the battlefield, not the arena. The pata (gauntlet sword) and the vita (rope dart) are weapons that change the rules of engagement â the pata cannot be disarmed because it is attached to the forearm, and the vita can attack from distances that confound conventional sword range. The system teaches the practitioner to operate with confidence in the spaces other weapons cannot defend.",
  bodyMechanics: `The pata is mechanically unique because it attaches to the forearm via a gauntlet. The BNR dataset on forearm-integrated weapon use establishes the key difference: because the weapon cannot be dropped or disarmed, the forearm and sword become a single rigid unit. This changes the wrist's role â the wrist no longer steers the weapon as in a standard grip; instead, the entire forearm rotation steers the blade. Maximum forearm rotation is approximately 180 degrees (supination to pronation), which gives the pata a wider angular attack range than a handheld sword from the same shoulder position. The vita (rope dart) operates on completely different principles. The BNR data on tethered projectile mechanics shows that the weighted tip achieves peak velocity at approximately two-thirds of the rope's length into the cast â not at full extension as intuition suggests. A vita practitioner who releases at full extension is actually attacking after the weapon's peak. Skilled vita users attack at the velocity peak, then recover the weapon for the next cast before the opponent has processed what happened.`,
  distancePreference: "Variable â the pata operates at sword range, the vita operates at rope-length range (~3â4 metres). A combined practitioner switches between these ranges.",
  footworkPrinciple: "The footwork adapts to which weapon is active. With the pata, footwork is forward-committed (the forearm attachment means retreat is less natural). With the vita, the practitioner stays at rope length and circles â preventing the opponent from closing.",
  stances: [
    {
      name: "Pata Guard",
      bodyPosition: "The gauntlet arm forward and raised, the blade extending beyond the fist, body slightly angled to present the gauntlet-arm as the lead line.",
      weightDistribution: "55% front / 45% rear",
      strengths: "The gauntlet protects the forearm from counterstrikes. The blade is always positioned to attack.",
      weaknesses: "The gauntlet's weight fatigues the arm in extended exchanges. Reach is slightly less than a standard sword hold."
    },
    {
      name: "Vita Ready",
      bodyPosition: "Rope coiled in the non-gauntlet hand, weighted tip hanging at waist height, body angled to allow a full cast rotation.",
      weightDistribution: "50% front / 50% rear",
      strengths: "The vita threat prevents opponent approach. The body is ready for the cast.",
      weaknesses: "The coiled rope requires space to deploy â useless in confined areas."
    }
  ],
  strikes: [
    {
      name: "Pata Forearm Cut",
      mechanics: "Because the blade is fixed to the forearm, the cut is driven by shoulder rotation and forearm supination/pronation rather than wrist steering. The BNR data shows the effective arc is approximately 180 degrees from full pronation to full supination. This wider arc means the blade can follow through angles a standard sword grip cannot maintain.",
      setup: "The opponent is at sword range and the pata arm is positioned.",
      execution: "The shoulder drives, the forearm rotates through supination to pronation (or reverse), and the blade cuts through the arc.",
      recovery: "The forearm reverses rotation back to guard position.",
      counter: "Attack while the forearm is at the extremes of its rotation arc â supination and pronation are both momentarily slow to reverse."
    },
    {
      name: "Vita Cast",
      mechanics: "The BNR tethered projectile data establishes the velocity peak at approximately two-thirds of the cast length. The vita practitioner casts the tip toward the target, attacks at the velocity peak (not at full extension), and recovers before the opponent can grab the rope or close distance.",
      setup: "The opponent is at rope length (3â4 metres) and in the open.",
      execution: "The rope casts from a coiled position, the tip accelerates through the arc, and the strike lands at peak velocity â approximately two-thirds extension.",
      recovery: "The rope is recovered immediately by recoiling â the vita is never left fully extended.",
      counter: "Close inside rope length so the weapon cannot develop full velocity. Or, if at range, step offline from the predictable attack line."
    }
  ],
  defenses: [
    {
      name: "Gauntlet Block",
      mechanics: "The gauntlet's thick metal forearm protection allows the pata fighter to block incoming sword strikes with the forearm rather than the blade â a unique defensive capacity. Blocking with the gauntlet preserves the blade's position for the immediate counter.",
      setup: "An incoming strike is aimed at the forearm or weapon hand.",
      execution: "The gauntlet arm raises to intercept the blow on the metal surface rather than the blade.",
      recovery: "The counter fires immediately from the block position.",
      counter: "Attack the unprotected arm or the body directly â the gauntlet only protects the gauntlet-arm forearm."
    }
  ],
  strengthAgainst: [
    "Fighters who target the weapon hand â the gauntlet protects it.",
    "Opponents at medium range who cannot deal with the vita's unpredictable cast angle.",
    "Disarming specialists â the pata literally cannot be disarmed from the hand."
  ],
  weakAgainst: [
    "Close-range grapplers who can neutralize both weapons by controlling the body.",
    "Confined spaces where the vita cannot be deployed.",
    "Opponents who close inside vita range before it can be cast."
  ],
  signatureTells: [
    "The gauntlet arm is never relaxed â the weight of the pata keeps it slightly raised even at rest.",
    "The vita-carrying hand keeps the rope coiled and slightly tensioned, ready to cast.",
    "The practitioner maintains a wider-than-normal distance from opponents â the vita's preferred range.",
    "When the gauntlet arm moves, the blade moves with it â there is no independent wrist steering."
  ],
  pacing: "Mardani Khel has two distinct tempos that shift based on which weapon is active. The vita creates a controlled, circling distance game. When the pata becomes primary, the pace increases and the exchanges are committed and decisive. The transition between modes should be a visible tactical choice.",
  writingNotes: "A Mardani Khel practitioner is at their most dangerous at the weapons' preferred ranges â a fact they are acutely aware of. They tend to manage distance deliberately in all contexts, positioning themselves where their options are best. In fiction, they feel tactically conscious, prepared, and somewhat unpredictable because they carry more than one system."
};
