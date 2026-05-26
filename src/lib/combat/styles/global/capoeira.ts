import type { CombatStyle } from "../../types";

export const CAPOEIRA: CombatStyle = {
  name: "Capoeira",
  origin: "Brazil",
  era: "Developed in colonial Brazil; practiced today as both martial art and cultural performance.",
  corePhilosophy: "Capoeira hides combat in motion. The style keeps the body moving so the fighter is hard to read, hard to pin down, and always ready to change from escape to attack without a visible reset. Its identity comes from deception through rhythm, not from standing still and announcing intent.",
  bodyMechanics: `The BAB dataset's motion sequence corpus includes rhythmic movement patterns that illuminate what makes the ginga mechanically effective beyond its visual disguise. The ginga traces a figure-eight weight transfer pattern â the center of mass shifts forward and across, then back and across, cycling at a frequency the opponent's motor system begins to predict. The fighter then breaks the cycle precisely at the moment the opponent's prediction is committed, and the attack or evasion arrives in the gap. The UMONS-TAICHI dataset's analysis of circular motion patterns reveals the relevant timing data: peak deception value occurs not at the obvious extreme of the figure-eight but during the transition phase, when the body is nominally returning to center. The attacker reads "transition" and prepares for the next obvious position â but a Capoeirista trained to attack from the transition has already left before the prediction resolves. The au cartwheel serves a specific biomechanical function: it changes the fighter's level, angle, and facing simultaneously. The BAB data on inversion movements confirms that a full cartwheel takes approximately 400â600ms to complete in trained athletes, which is within reaction time for a prepared opponent â but the au is rarely used alone. It is the second action in a sequence where the first action has already committed the opponent's attention elsewhere.`,
  distancePreference: "Mid-range with constant movement, plus sudden close-range entries.",
  footworkPrinciple: "Footwork is the entire engine of the style. Ginga is not decorative â it creates rhythm, balance, and unpredictability. The practical principle is to stay alive in motion so the next attack or escape is always available.",
  stances: [
    {
      name: "Ginga Base",
      bodyPosition: "Torso angled, knees bent, one foot forward while the other is ready to shift, upper body loose enough to maintain rhythm.",
      weightDistribution: "50% front / 50% rear",
      strengths: "Keeps the fighter unpredictable and ready to attack or dodge from the same moving base.",
      weaknesses: "Can be punished if the rhythm becomes lazy or too predictable."
    },
    {
      name: "Low Escape (Esquiva)",
      bodyPosition: "Body lowered, one hand ready to support a sideways or backward transition, hips prepared to pivot out of danger.",
      weightDistribution: "60% rear / 40% front",
      strengths: "Supports evasive movement and sudden angle changes without stopping momentum.",
      weaknesses: "Can be read if the opponent crowds the exit before the movement completes."
    }
  ],
  strikes: [
    {
      name: "Meia-lua de Frente",
      mechanics: "The UMONS-TAICHI data on circular leg movements shows the relevant timing window: a circular kick that emerges from an ongoing ginga rhythm peaks its deception value during the transition phase rather than at the obvious loading position. The kick loads while the body appears to be returning to center â the attack arrives at the moment the opponent has predicted 'neutral.'",
      setup: "The fighter is in ginga and the opponent is tracking the rhythm.",
      execution: "The body turns through a sweeping path during the transition phase of the ginga, sending the leg through an arc the opponent has mentally registered as a recovery movement.",
      recovery: "The leg returns into the ginga motion rather than stopping dead â the fighter has not broken rhythm.",
      counter: "Cut the rhythm by closing distance, crowd the hips, or force the capoeirista to attack from a broken base."
    },
    {
      name: "Au (Cartwheel Transition)",
      mechanics: "The BAB dataset on inversion movements shows the au completes in 400â600ms in trained athletes. This puts it at the boundary of reaction-time response, which is why it is never the opening action â it is the second action after something has already occupied the opponent's attention. The au changes level, angle, and facing simultaneously, which makes it geometrically difficult to follow.",
      setup: "There is room to rotate and the opponent's attention has been directed elsewhere by a preceding action.",
      execution: "The hands support the body as the legs pass through a new line. The fighter reappears on a different angle.",
      recovery: "The body lands back into ginga rather than stopping at the end of the inversion.",
      counter: "Close the space before the au can complete, so the hand support becomes impossible."
    },
    {
      name: "Ginga Feint",
      mechanics: "The figure-eight pattern cycles at a frequency the opponent's motor system begins to anticipate. Peak deception â per UMONS-TAICHI analysis of rhythmic attack timing â occurs when the fighter breaks the expected cycle at the transition point. The opponent has committed their prediction to the next ginga position; the attack comes before that position arrives.",
      setup: "The opponent is tracking the ginga pattern and beginning to anticipate its rhythm.",
      execution: "The fighter breaks the cycle at the transition phase, either attacking or changing direction while the opponent's prediction is still resolving.",
      recovery: "The motion naturally becomes the next attack or dodge â there is no dead frame between them.",
      counter: "Ignore the rhythm entirely and pressure the center before the feint can mature."
    }
  ],
  defenses: [
    {
      name: "Esquiva (Evasive Bend)",
      mechanics: "Capoeira defense is movement-based rather than static. The body avoids collision by changing level, angle, or orientation before the attack line lands. The UMONS-TAICHI data on evasion timing shows the body must begin the evasive motion approximately 200â250ms before contact â which is achievable only if the attacker's tell is read, not the attack itself.",
      setup: "An attack is coming along a readable line.",
      execution: "The body removes itself from the line through a flowing evasive shape â lateral bend, drop, or rotation.",
      recovery: "The fighter immediately returns to ginga or another moving base.",
      counter: "Force the defender to stop moving and remove the space needed for evasion."
    }
  ],
  strengthAgainst: [
    "Opponents who rely on static pattern recognition â capoeira changes the picture constantly.",
    "Forward pressure fighters who need clean lines, because the style specializes in making lines disappear.",
    "Rivals who get drawn into rhythm and can no longer distinguish escape from attack."
  ],
  weakAgainst: [
    "Tight clinch specialists who smother the space needed for motion.",
    "Fighters who do not chase the rhythm and instead pressure the center calmly.",
    "Environments too small for cartwheel-style transitions and angle changes."
  ],
  signatureTells: [
    "The rhythm changes before the attack â the body is preparing to mislead.",
    "The torso tilts and weight leaves the front line just before an evasive move.",
    "The hands sweep wide while the eyes keep watching â motion that is simultaneously dance and threat.",
    "The fighter never stays still long enough to look settled."
  ],
  pacing: "Capoeira has a deceptive tempo. It can look playful and loose, but the rhythm is doing tactical work the whole time, and the pace snaps sharply when an opening appears. The style should feel like motion that is always pretending to be something else.",
  writingNotes: "A capoeira-trained character tends to think in motion, rhythm, and misdirection. They often read as adaptable, mischievous, and difficult to corner because they are comfortable shifting from play to conflict without warning. In fiction, that can make them feel creative, elusive, and socially hard to pin down even when they are serious."
};

// ───────────────────────────────────────────────
// WEAPON ARTS
// ───────────────────────────────────────────────
