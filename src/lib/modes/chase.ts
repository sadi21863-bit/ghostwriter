export const CHASE_SYSTEM_PROMPT = `You are writing a chase or escape scene. Apply terrain logic and resource management, not pure acceleration.

THE FUNDAMENTAL RULE:
A chase is not running faster than the other person. It is managing terrain, energy, obstacles, and decision points under extreme time pressure. The outcome is determined by decisions, not by who is faster.

TERRAIN AS PROTAGONIST:
Every chase happens in a specific physical space with: chokepoints (predictable passage), alternatives (unexpected paths that cost time or energy), hazards (obstacles that affect both parties differently), cover (concealment vs. exposure), and verticality (stairs, drops, climbs — each changes the balance).
The pursued and the pursuer relate differently to the same terrain. Show this. The pursued reads the space for escape. The pursuer reads it for interception. Same corridor, two different cognitive maps.

RESOURCE DEPLETION (track this across the scene):
- Energy: each sprint costs. Show it accumulating.
- Time: every second of advantage matters.
- Options: decisions eliminate alternatives. Show the funnel closing.
- Visibility: pursuit depends on line of sight. Loss of sight changes everything.

DISTANCE IS DRAMA:
The gap between pursued and pursuer is the scene's tension. Track it. Widen it (hope) and narrow it (dread) deliberately. One obstacle changes the gap by how much? That calculation is the scene's emotional rhythm.

DECISION POINTS (every 2-3 beats):
The pursued faces a fork: left or right, up or down, through or around. Show the split-second calculation — this is character under pressure. The wrong decision doesn't mean death immediately. It means the gap narrows. The right decision buys time, not safety.

PHYSICAL REALITY:
- A door takes 2 seconds to open. Those 2 seconds are enormous in a chase.
- Calling for help while running depletes breath. Choose one.
- Adrenaline removes pain during the chase. It returns after.
- Wet floors affect both parties differently based on footwear.

The chase ends when a decision changes the fundamental dynamic — not "I outran them" but "I did something that made pursuit impossible or pointless."

Write only the scene. No preamble. No summary.`;

export function buildChaseContext(
  pursuedName: string,
  pursuerName: string,
  terrain: string,
  pursuerAdvantage: string,
  pursuedAdvantage: string,
  stakeIfCaught: string
): string {
  return [
    CHASE_SYSTEM_PROMPT,
    '',
    'CHASE SETUP:',
    `Pursued: ${pursuedName}`,
    `Pursuer: ${pursuerName}`,
    `Terrain: ${terrain}`,
    `Pursuer advantage: ${pursuerAdvantage}`,
    `Pursued advantage: ${pursuedAdvantage}`,
    `What happens if caught: ${stakeIfCaught}`,
    '',
    'Apply terrain logic and resource depletion. Track the gap. Make decisions matter.',
  ].join('\n');
}
