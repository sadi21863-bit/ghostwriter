// src/lib/action/archetypes/all-action.ts
import type { ActionArchetype } from "../types";

export const CHASE: ActionArchetype = {
  name: "Chase",
  coreDescription: "A chase is a scene of closing and opening distance between a pursuer and a pursued. The fundamental tension is the gap — how far apart are they, how fast is it closing, what does closing or opening the gap cost each party. Every beat in the chase must change the gap, change the cost, or both.",
  obstacleStructure: "Three escalating obstacles, each arising causally from the previous. Obstacle one establishes the gap and the physical environment. Obstacle two appears to resolve the gap (the pursuer falls behind, or the pursued is cornered) but produces a worse situation. Obstacle three forces the decisive action or reveals the cost of all previous choices. The chase resolves at the third obstacle's peak.",
  environmentRole: "The environment is a third participant. It must have specific physical properties that create obstacles for both parties — the same property that helps the pursued hurts the pursuer differently, or vice versa. The narrow market alley slows both but the pursued is smaller. The wet roof is dangerous for both but the pursuer is heavier. The environment is not backdrop — it is the arena that shapes the chase.",
  consequenceCascade: "Physical costs accumulate: the twisted ankle in obstacle one compromises the jump in obstacle three. The choice to go through the market rather than around it was faster but cost a collision that slowed recovery. The earlier decision is always the thing that makes the later moment worse. This cascade is what separates pursuit from a series of disconnected obstacles.",
  paceRules: [
    "No sentence over 20 words when the gap is closing — the syntax accelerates the physiological response",
    "No internal monologue at pace — thought requires cognitive processing; at full chase pace, the character is running, not thinking",
    "One moment of rest (character hides, gap widens temporarily) permitted per sequence — then pace resumes immediately",
    "The gap must be stated explicitly at least twice: the reader must feel the distance closing",
    "The environment must resist — nothing comes easily; the door sticks, the footing is wrong",
  ],
  sentenceRhythm: "At opening pace: medium sentences establish space and environment. As the gap closes: sentences shorten. Obstacle impact: fragment. Recovery: three short sentences in sequence. Peak: fragments only. The rhythm is the physiology — the reader's nervous system responds to sentence length independently of content.",
  failureModes: [
    "The gap is never explicitly established — the reader cannot feel the chase without spatial information",
    "Obstacles appear randomly rather than causally from each other",
    "Internal monologue at full pace — the character narrates their own state at the moment when thought is impossible",
    "The environment is generic — 'through the city streets' is not an obstacle, it is scenery",
    "No consequence cascade — earlier choices do not affect later moments",
    "The chase resolves through the pursuer giving up rather than through the pursued's choices",
  ],
  systemDirectives: [
    "State the gap explicitly at opening, then change it at each obstacle",
    "The environment must create a specific obstacle with specific physical properties",
    "Three obstacles, each causally connected to the previous",
    "Consequence cascade: at least one earlier cost amplifies a later one",
    "Sentence length shortens as gap closes — at peak, use fragments",
    "No internal monologue at pace — only action and sensation",
  ],
  writingNotes: "The chase is the simplest action structure and the hardest to execute well. Generic chases feel like running because they are just running. Specific chases feel like those particular people in that particular environment making those particular choices under that particular pressure. The market stall that was always going to be in the way. The shorter path that cost the wrong thing. The gap that should have been safe but wasn't.",
};

export const ESCAPE: ActionArchetype = {
  name: "Escape",
  coreDescription: "An escape is a scene of breaking out of containment. The fundamental tension is the perimeter — the boundary that must be crossed. Everything inside the perimeter is known, controlled, hostile. The outside is unknown but free. The escape is the character's attempt to make the crossing against the perimeter's active resistance.",
  obstacleStructure: "Three obstacles corresponding to three layers of the perimeter. The outer perimeter (the first physical boundary — the door, the fence, the guard station) provides the first obstacle. The inner perimeter (the alarm, the patrol, the locked gate) provides the second, usually harder because the character is now between two hostile layers. The exit point (the final crossing into freedom) provides the third, always hardest because the character is most exposed.",
  environmentRole: "The escape environment is defined by what it contains that the character cannot use and what it contains that the character can. The guard's blind spot. The structural weakness. The timing of the patrol. The environment resists through surveillance, barriers, and timing. The character must read the environment and work with its patterns, not against them. An escape that ignores the environment's patterns is not an escape — it is luck.",
  consequenceCascade: "Every noise the character makes narrows their window. Every guard alerted tightens the perimeter. The choice to take the faster route through the lit corridor creates the problem at the inner perimeter. The escape's consequence cascade is tighter than the chase's because the character cannot run — they must be silent and precise. An early mistake compounds differently from a chase mistake: it removes options rather than closing distance.",
  paceRules: [
    "Silence is the pace regulator: fast movement is permitted only in the gaps between surveillance — when the character moves, sentences shorten; when they wait, sentences lengthen into held breath",
    "The waiting is as tense as the moving — the held position while the guard passes is not a rest",
    "The character's sensory focus narrows: sound dominates, then sight, then touch — the other senses shut down under stress",
    "Every sound the character makes must be acknowledged — not dramatized, but registered",
    "The body's involuntary responses must appear: the held breath, the heartbeat that seems too loud",
  ],
  sentenceRhythm: "Alternating rhythm: long sentences in the still moments (waiting, observing, planning) and short sentences in the moving moments. This mirrors the physiological experience of the escape — the body is differently activated in stillness and movement. The still-sentence shows the hyper-alert stillness; the action-sentence shows the committed move.",
  failureModes: [
    "The perimeter is not physically specific — 'there were guards' is not a perimeter",
    "The character moves continuously without the wait-and-watch pattern of real stealth",
    "Earlier sounds or choices don't compound — mistakes reset rather than accumulate",
    "The character knows where all the guards are without having observed them — omniscient escape",
    "The environment has no specific properties the character must work with",
    "The final crossing is easy — the exit point must be the hardest obstacle",
  ],
  systemDirectives: [
    "Three perimeter layers: outer, inner, exit point — each harder than the previous",
    "The still-moments and moving-moments rhythm: long sentences when still, short when moving",
    "Every sound the character makes must be registered, not dramatized",
    "The environment must have specific observable patterns the character uses",
    "Consequence cascade: earlier choices narrow the options at the exit point",
    "The body's involuntary responses: held breath, heartbeat, temperature change",
  ],
  writingNotes: "The escape scene's specific dread is the narrowing: each choice eliminates options. The character who took the fast route and made a sound has fewer exits. The guard who heard something has changed the patrol pattern. By the time the character reaches the exit point, they should be down to the last viable option and it should require more than they have remaining. That's when the choice that costs something must be made.",
};

export const INFILTRATION: ActionArchetype = {
  name: "Infiltration",
  coreDescription: "An infiltration is the entry into a defended space without detection. Unlike the escape, the character has chosen to enter — they want to be inside. The fundamental tension is the performance: the character must be, or appear to be, something they are not. Every interaction is a test. Detection at any point is catastrophic.",
  obstacleStructure: "Three tests of the cover, each escalating. The first test is routine — the guard asks a question the character prepared for. The second test is unexpected — something about the cover is questioned that the character did not anticipate. The third test is personal — someone inside the perimeter knows or suspects something is wrong, and the character must manage this on the fly with no preparation and high stakes.",
  environmentRole: "The infiltration environment is defined by what the character knows about it (from preparation) and what they discover that was not in the preparation. The guard rotation that changed. The colleague who was supposed to be absent. The new security measure. Every element of the prepared plan that encounters reality is a potential fracture point.",
  consequenceCascade: "Each successful deception is an investment in the cover — but each test also creates a witness. By the third test, the character has been seen and remembered by multiple people. Even successful infiltration leaves a trail that may collapse retroactively. The cascade is not immediate — it is the accumulating weight of people who can place the character in the space.",
  paceRules: [
    "Infiltration pace is social, not physical — the tension is in the conversation, not the movement",
    "The performance of normalcy is described through what the character suppresses, not what they show",
    "Internal monologue is permitted during tests — the character is calculating in real time",
    "Physical tells of stress must appear but be managed: the character must not show them, but the reader sees them happening",
    "The pacing slows during conversations, not accelerates — the weight is in the exchange",
  ],
  sentenceRhythm: "Longer than other action archetypes — infiltration operates at social pace, not physical pace. The rhythm speeds only during the moments of physical movement between tests, then slows again for the next interaction. The weight is in the pauses and the chosen words, not in shortening sentences.",
  failureModes: [
    "The cover is tested only superficially — the character should be genuinely at risk in each test",
    "The character shows no physical stress responses — the suppression of tells must be visible",
    "The unexpected test is resolved too easily — it must cost the character something in the performance",
    "Internal monologue is absent — the infiltrator is calculating throughout, and the reader should be inside this",
    "The infiltration succeeds without any close calls — the character must be genuinely close to exposure",
  ],
  systemDirectives: [
    "Three escalating tests: routine, unexpected, personal",
    "Physical stress responses that the character suppresses — the reader sees both",
    "Internal monologue during tests: the real-time calculation is part of the scene",
    "The unexpected element that was not in the preparation — something is always different",
    "The conversation pace, not physical pace — longer sentences under pressure",
    "Consequence cascade: the witnesses accumulate even in successful infiltration",
  ],
  writingNotes: "Infiltration scenes are scenes of performance — and performance has an internal and an external layer simultaneously. The external layer: what the character does and says. The internal layer: the suppressed responses, the real-time calculation, the thing they almost said. The reader should be in both layers at once. The best infiltration scenes feel like watching someone hold two contradictory states simultaneously: the relaxed performance and the controlled panic beneath it.",
};

export const RACE: ActionArchetype = {
  name: "Race",
  coreDescription: "A race is a scene of parallel progress toward a shared destination or objective. Two or more parties are attempting to get somewhere or achieve something first. The fundamental tension is relative progress — not just is the character moving but are they moving faster than the competition. The race makes the competitor's progress as important as the character's own.",
  obstacleStructure: "Three moments of relative lead change. The character leads initially (or falls behind initially — the starting position determines the structural arc). A setback closes the lead or reverses it. A recovery restores the lead. The final obstacle determines the outcome — and must cost the winner something real to win.",
  environmentRole: "The race environment must have specific properties that affect different competitors differently. The narrow section advantages one competitor. The technical section advantages a different skillset. The final stretch favors endurance over speed. The environment is not neutral — it advantages and disadvantages in specific ways that the competitor must read and work with.",
  consequenceCascade: "Physical and resource costs accumulate differently for each competitor. The earlier choice to push harder cost energy that isn't available at the final obstacle. The shortcut that gained ground also damaged something. The cascade in a race is comparative — what it cost the character relative to what it cost the competitor.",
  paceRules: [
    "The competitor's position must be stated or indicated regularly — the reader must always know the relative gap",
    "Both the character's and the competitor's states must be present — the race is about relative position",
    "At peak intensity, alternate between the character and the competitor within the same scene",
    "Physical costs are real and accumulating for both parties — neither competitor is inexhaustible",
    "The final obstacle must be genuinely uncertain until it resolves",
  ],
  sentenceRhythm: "Race rhythm alternates between the character's perspective and the competitor's position — the sentences tracking the character's state are internal; the sentences tracking the competitor are external observation. This alternation is the race's specific prose rhythm.",
  failureModes: [
    "The competitor's progress is absent — a race with only one visible party is just a sprint",
    "The lead changes are not earned through specific decisions or costs",
    "The environment is neutral — it does not advantage either party differently",
    "The final outcome is predetermined from the scene's opening — the uncertainty must be genuine",
    "Physical costs do not accumulate — both competitors run on infinite reserves",
  ],
  systemDirectives: [
    "State relative position regularly — the reader must always know the gap",
    "Both competitors' states must be present in the scene",
    "The environment must affect competitors differently — specific advantages and disadvantages",
    "Physical costs accumulate for both parties — neither is inexhaustible",
    "Three lead changes: initial position, reversal, recovery, final outcome",
    "The winner must pay something real to win",
  ],
  writingNotes: "The race is the action archetype most dependent on the competitor. A race without a credible competitor is not a race — it is a character running. The competitor must be a genuine threat, with their own specific strengths and costs and decisions. The reader should be uncertain about the outcome. The best race scenes make the reader want the competitor to succeed even while rooting for the character.",
};

export const SURVIVAL: ActionArchetype = {
  name: "Survival",
  coreDescription: "Survival is a scene of attrition: the character must remain alive against an environment or situation that is actively depleting their resources — physical, cognitive, or both. Unlike a chase or escape, survival has no single destination. It is sustained pressure over time with no certain resolution. The tension is resource management: how long can the character last, and what must they sacrifice to last longer.",
  obstacleStructure: "Three resource crises, each arising from the management of the previous one. The first crisis depletes the most available resource (warmth, water, cover). The character's solution to the first crisis depletes a second resource or creates a new vulnerability. The second crisis compounds, and the third forces a choice: which resource to sacrifice permanently.",
  environmentRole: "The survival environment is an active antagonist — it depletes, exposes, and punishes. Temperature drops. Water runs out. The cover is consumed. The environment is not static — it changes in ways that eliminate options over time. The character must read the environment's direction of change and work ahead of it, not react to it.",
  consequenceCascade: "Every expenditure of a resource changes the calculus of every subsequent decision. The warmth used for shelter is warmth not available for movement. The food eaten now is food not available later. Survival's cascade is about diminishing returns — each decision is made from a smaller pool of options. The compression of options is the scene's architecture.",
  paceRules: [
    "Survival pace is slow and measured — the urgency comes from the accumulation of time, not from the speed of action",
    "The character's physical state must be tracked explicitly: temperature, hydration, injury, fatigue",
    "Cognitive degradation under physical stress must appear: the character's thinking becomes less clear as resources deplete",
    "Each decision must weigh visibly against the current resource state",
    "The passage of time must be felt — survival scenes are about duration, not speed",
  ],
  sentenceRhythm: "Survival prose has a specific rhythm: deliberate pacing that mirrors the character's deliberate conservation. As resources deplete, cognitive load increases — sentences may become more fragmented not from speed but from the mental cost of sustained stress. The character stops being able to hold complex thoughts.",
  failureModes: [
    "Resources don't deplete — the character moves through survival without visible cost",
    "The environment is passive — it does not change or compound the character's situation",
    "Cognitive state is unaffected by physical depletion — the character thinks clearly throughout",
    "The resolution arrives through an external rescue rather than the character's own sustained effort",
    "No resource trade-offs — the character doesn't sacrifice one resource to preserve another",
  ],
  systemDirectives: [
    "Track the character's physical state explicitly at each major decision point",
    "Three resource crises, each arising causally from the management of the previous",
    "The environment must change actively — it depletes, exposes, and eliminates options over time",
    "Cognitive degradation as resources deplete: the thinking becomes less clear",
    "Each decision costs something permanently — survival is about irreversible expenditures",
    "Duration must be felt — the reader must feel the time passing against the character",
  ],
  writingNotes: "Survival scenes are about the compression of options over time. The character at the beginning has choices. The character at the end has almost none. The arc of the scene is the arc of diminishing possibility. The reader should feel this compression — the narrowing of what is available, the increasing cost of each decision, the growing weight of decisions already made. The character who survives does so with almost nothing left.",
};
