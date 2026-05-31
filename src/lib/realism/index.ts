export type RealismDomain = 'body' | 'injury' | 'combat' | 'chase';

export const REALISM_DIRECTIVES: Record<RealismDomain, string> = {
  body: `BODY MECHANICS REALISM:
- Heavy physical exertion causes breathing changes within 30-60 seconds. Dialogue becomes impossible during a dead sprint.
- Adrenaline suppresses pain in the moment but pain returns harder afterward.
- Cold fingers lose fine motor control. Fumbling with locks, triggers, and clasps is realistic in cold.
- Fear produces genuine physical responses: dry mouth, tunnel vision, auditory exclusion (sounds muffle or disappear in high stress), time distortion (events seem slow-motion or fast-forward).
- Sleep deprivation past 36 hours causes micro-hallucinations and decision-making impairment.
- Dehydration causes cognitive degradation before physical collapse. Thinking becomes fuzzy before the body fails.
Write the body's experience, not just the action. Physical sensation grounds everything.`,

  injury: `INJURY REALISM:
WHAT INJURIES ACTUALLY PREVENT:
- Broken arm: cannot use that limb for fine motor tasks. Lifting, gripping, pushing — all impaired.
- Rib fracture: every breath hurts. Running is agony. Laughing or coughing is worst.
- Concussion: light sensitivity, nausea, difficulty concentrating, mood instability. Lasts days to weeks.
- Stab/gunshot to the leg: walking possible with adrenaline, but running causes blood loss acceleration and physical collapse is likely within minutes.
- Abdominal wound: infection risk makes this life-threatening over 6-24 hours without treatment.

RECOVERY TIMELINES (realistic minimums):
- Broken bone: 6-8 weeks for healing, months for full function
- Deep laceration requiring stitches: 2-3 weeks tender, 6+ weeks full recovery
- Concussion: 7-14 days of reduced activity minimum
- Major abdominal surgery: 6-8 weeks before normal movement

DO NOT: Have characters shrug off injuries that would impair function. Injuries compound.`,

  combat: `COMBAT REALISM:
DURATION: Real fights last 3-30 seconds. Hollywood's sustained 3-minute brawls between trained fighters do not happen. Exhaustion, injury, and shock end engagements fast.
- Untrained people striking each other: adrenaline chaos, no clean technique, first injury often ends it
- Trained vs untrained: over in seconds, almost no contest
- Trained vs trained: still fast. Prolonged technical exchanges happen in sport contexts (rules, weight classes, breaks), not in life-or-death conflict.

GROUND FIGHTING: Most real fights end on the ground. Standing exchanges transition to grappling within seconds. Ground control matters more than striking.

WEAPON REALITY:
- Drawing a knife in a close-quarters struggle: the person drawing it gets cut by their own weapon attempting to access it.
- Firearms: malfunctions are real. Trigger discipline under stress breaks. Shots miss — even trained law enforcement average 18-30% hit rate under stress.
- Bladed weapons cause no immediate incapacitation unless targeting the CNS. A stabbed person can continue fighting for 30-60 seconds.

PSYCHOLOGICAL DIMENSION: Killing is traumatic even for trained soldiers. Hesitation is human. The person who doesn't hesitate is psychologically unusual and likely damaged.`,

  chase: `CHASE AND PURSUIT REALISM:
HUMAN SPRINT CAPACITY: Elite sprinters peak at 100m. An average person sustains near-full sprint for 20-30 seconds before significant performance degradation. A 400m sprint at full pace will leave most people unable to continue sprinting.
- Pursuit advantage: pursuer typically has less adrenaline than the person running scared
- Terrain matters enormously: stairs, crowds, familiar vs unfamiliar routes
- Night pursuit: sound and peripheral vision dominate. High-beam flashlights blind both parties.

VEHICLE PURSUIT: Movies lie constantly.
- Police pursuit training emphasizes road safety termination. Ramming is heavily regulated.
- A car chasing another car on city streets is dangerous for everyone in proximity.
- Tire spike strips (stingers) are the standard non-deadly pursuit termination — not ramming or shooting.

WRITE THE EXHAUSTION: Chase scenes gain tension from physical depletion, not just speed. The character's body should be failing as the chase continues.`,
};

export function buildRealismContext(domains: RealismDomain[]): string {
  if (!domains.length) return '';
  return domains.map(d => REALISM_DIRECTIVES[d]).join('\n\n');
}

export function getRealismDomainsForMode(mode: string): RealismDomain[] {
  const modeMap: Record<string, RealismDomain[]> = {
    combat:    ['combat', 'body', 'injury'],
    action:    ['chase', 'body'],
    horror:    ['body', 'injury'],
    emotional: ['body'],
  };
  return modeMap[mode] ?? [];
}
