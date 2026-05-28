// src/lib/sports/archetypes/all-sports.ts
import type { SportsArchetype } from "../types";

export const FLOW_STATE: SportsArchetype = {
  name: "Flow State",
  theoreticalBasis: "Csikszentmihalyi (1990): flow is the psychological state of complete absorption in a challenging task. Four conditions: clear goals, immediate feedback, challenge-skill balance, and perceived control. In flow: loss of self-consciousness, time distortion (it passes too fast or feels suspended), action and awareness merge, intrinsic motivation drives all behavior.",
  coreDescription: "The character in the state of perfect performance. Not trying — doing. The ball goes where the eye looks. The movement is ahead of the decision. Thought and action are the same thing. The self that normally watches and judges is absent.",
  psychologicalState: "The self-monitoring system is offline. The prefrontal cortex — which evaluates, judges, and worries — is minimally active in flow. The expert body is performing its stored expertise without interference. The character is not thinking about what they're doing — they are doing it.",
  bodyMechanics: "Flow has specific physical qualities: reduced muscle tension (the performer is not bracing against failure), peripheral vision opens (the visual field widens from focused to panoramic), breathing is natural and unmonitored. The body feels light and precise. Movement is economical.",
  performanceStructure: "The flow scene moves at the pace of the performance, not the pace of thought. Describe what the body does and perceives, not what the mind thinks about what the body does. The reader must feel the absorption — their own attention should be pulled into the pace of the action.",
  stakesRequirement: "Flow requires that the challenge level matches the skill level. The performance must be at the edge of the character's ability — not too easy (which produces boredom) and not too hard (which produces anxiety). The stakes must feel high enough to matter, low enough not to trigger panic.",
  failureModes: [
    "The character is thinking about what they're doing — flow is the absence of this",
    "The character's performance is described in technical terms rather than felt experience",
    "Self-consciousness intrudes: the character notices they are performing well and the noticing breaks the flow",
    "The time experience is absent — flow distorts time perception",
  ],
  systemDirectives: [
    "First-person sensation, not third-person observation of the self",
    "Action precedes thought — the body moves before the mind registers the decision",
    "Time distorts: either too fast or suspended",
    "The self-monitoring voice is absent — no judgment, no evaluation during the sequence",
    "The peripheral world recedes — tunnel into the task without tunnel vision",
    "The flow breaks with a specific trigger: external distraction, the thought about the performance",
  ],
  writingNotes: "The flow state scene is difficult to write because its central feature is the absence of the normal narrative voice (self-evaluation, analysis, description). The writer must inhabit the action without the narrator's distance. The best flow scenes are written from inside the movement: not 'she shot the ball and it went in' but the sensation of the release, the follow-through, the rightness of the arc before it lands.",
};

export const PRESSURE_PERFORMANCE: SportsArchetype = {
  name: "Pressure Performance",
  theoreticalBasis: "Beilock (2010) choking under pressure: the explicit monitoring hypothesis. Experts choke when they direct conscious attention to processes that have become automatic. The expert who has learned to shoot through thousands of repetitions stores that skill as procedural memory that bypasses conscious processing. Under pressure, self-monitoring activates, turning the expert's attention onto their own technique — breaking the automaticity that made them expert.",
  coreDescription: "The character's expertise failing them in the moment that matters most. Not because they lack the skill — because they are watching themselves use it. The more they try to control the performance, the more the performance degrades.",
  psychologicalState: "Prefrontal cortex overactivated — the analytical system is interfering with the procedural system. The character can describe exactly what they should be doing. That description is the problem. The 'think less' instruction cannot be followed consciously.",
  bodyMechanics: "Choking has physical markers: muscle tension (bracing against failure), narrowed visual field, restricted breathing, small hesitations in previously fluid movements. The body is fighting itself — the conscious system pulling against the automatic one.",
  performanceStructure: "The pressure performance scene has a specific arc: the character enters the high-stakes moment, the self-monitoring activates, the performance begins to degrade, the character notices the degradation (which worsens it), the spiral deepens or is interrupted.",
  stakesRequirement: "Choking requires genuine high stakes — the character must care enough for the self-monitoring to activate. A character who doesn't care cannot choke. The stakes must be the character's own definition of mattering — not the observer's.",
  failureModes: [
    "The character chokes because they lack the skill — this is failure, not choking",
    "The self-monitoring is absent — the character degrades without the internal mechanism being shown",
    "The spiral resolves cleanly through willpower — Beilock's research shows willpower-based resolution rarely works",
    "The stakes feel artificial — the character's specific definition of what matters must be established",
  ],
  systemDirectives: [
    "The self-monitoring voice must be explicit: the character watching themselves perform",
    "Degradation follows a specific sequence: first the hesitation, then the compensating over-control, then the further degradation",
    "The body's physical markers of choking: tension, restricted breathing, the small wrong timing",
    "The spiral: each noticed mistake generates more self-monitoring which generates more mistakes",
    "Resolution if any: not through thinking correctly but through the self-monitoring disengaging — a distraction, a shift in focus, exhausting the analytical system",
  ],
  writingNotes: "The choking scene is most powerful when the character has complete technical knowledge of what they should be doing and cannot do it. The gap between knowing and being able is the scene's engine. The reader who has ever performed under pressure will recognize this gap immediately. It is one of the most universal experiences in sport and in life.",
};

export const TEAM_DYNAMICS: SportsArchetype = {
  name: "Team Dynamics",
  theoreticalBasis: "Hackman (2002): team performance is not the sum of individual performances. Shared mental models (all members understanding the game the same way), communication patterns, and role clarity determine whether a group performs above or below the capability of its members. Backup behavior — members anticipating each other's needs without being asked — is the hallmark of a high-performing team.",
  coreDescription: "A scene of collective performance: multiple people functioning as a single organism, or failing to. The best team scenes are not about individual heroics but about the coordination — the moment when the shared mental model produces an action no individual could have planned.",
  psychologicalState: "Inter-subjective synchrony: multiple minds functioning as one. Each team member holds a model of the state of every other member. Communication is minimal because prediction is maximum. Conversely: team dysfunction is the failure of this prediction — the action that surprises a teammate, the communication that arrives too late.",
  bodyMechanics: "High-performing team sequences have a specific quality: actions arrive slightly before they are consciously needed. The pass to the space where the teammate will be, not where they are. This requires each member to carry a running model of the others' states.",
  performanceStructure: "The team dynamics scene has two versions: coordination (the team functioning as a unit, each member invisible within the collective) and breakdown (the failure of coordination, making visible what was previously invisible). The breakdown scene is often more narratively rich.",
  teamDimension: "Hackman's specific finding: team membership must be stable for the shared mental model to develop. A team that is always changing cannot develop backup behavior. The team that has been together long enough to predict each other is vulnerable to the member who doesn't yet know the model.",
  stakesRequirement: "Team stakes are different from individual stakes. The team member must care about the collective outcome, not just their individual performance. The team scene fails if each member is essentially playing their individual game in proximity to others.",
  failureModes: [
    "Each team member is essentially an individual — no shared mental model is visible",
    "Communication is explicit where it should be implicit — high-performing teams don't explain, they anticipate",
    "The team's success or failure depends on one member's individual heroics rather than collective coordination",
    "Backup behavior is absent — no one covers for another without being asked",
  ],
  systemDirectives: [
    "Show the shared mental model: an action that only makes sense if each member knows the others' state",
    "Communication should be minimal and efficient: the teams that talk most are the teams that are failing",
    "Backup behavior: at least one member doing something that wasn't asked and that anticipates a teammate's need",
    "The weak link: the team member whose mental model is incomplete — they show where the collective model breaks down",
  ],
  writingNotes: "The team dynamics scene is at its best when it shows something no individual could have done alone. The goal scored from a sequence of five passes, each one anticipating the next without communication. The defense that collapses on a ball-carrier without a signal. The team as organism — and the moment that organism is disrupted by one member who doesn't know the pattern.",
};

export const THE_COMEBACK: SportsArchetype = {
  name: "The Comeback",
  theoreticalBasis: "The comeback is sports narrative's most powerful archetype and requires three specific structural elements to earn its emotional weight: (1) a genuine all-is-lost moment — not simulated, not recoverable through ordinary means, (2) a resource the audience didn't know the character possessed — physical, psychological, or circumstantial, and (3) a cost — the comeback takes something from the character that cannot be returned. Without the cost, the comeback is entertainment. With the cost, it is tragedy and triumph simultaneously.",
  coreDescription: "The scene of reversal from certain defeat. The character is behind, time is running out, the gap seems insurmountable — and they close it. The comeback is not about winning. It is about the decision to try when trying is irrational.",
  psychologicalState: "The comeback requires a specific psychological state that is distinct from both flow and pressure performance: a kind of psychologically liberated performance that occurs when the outcome is accepted as lost. When there is nothing left to protect, the self-monitoring that causes choking dissolves. The comeback performer is often playing their best because they have stopped caring about the result.",
  bodyMechanics: "The comeback body is a depleted body performing anyway. The physical cost must be visible. The exhaustion, the injury, the accumulated damage — these must be present, not overcome. The comeback happens through and despite them, not by transcending them.",
  performanceStructure: "Comeback structure: the all-is-lost moment (established concretely, not gestured at), the decision moment (the character chooses to continue — this must be a choice), the reversal sequence (specific, each step earned), the cost (what the comeback takes that cannot be returned).",
  stakesRequirement: "The comeback's stakes are the character's own definition of meaning. Not the scoreboard — what the score represents to them. The comeback that earns emotional weight is about what losing would mean about the character's identity or relationships.",
  failureModes: [
    "The all-is-lost moment is not genuine — the reader never believed the outcome was decided",
    "The resource is convenient rather than established — the hidden reserve must be credible",
    "The comeback has no cost — it is a simple triumph rather than a complicated one",
    "The comeback is resolved in a montage rather than a specific sequence",
    "The opponent is diminished to make the comeback possible — the opponent must remain formidable",
  ],
  systemDirectives: [
    "The all-is-lost moment must be concrete and felt — the reader must accept the defeat before the comeback begins",
    "The decision to continue must be shown — the moment the character chooses to try despite everything",
    "Each step of the reversal must be earned — no sudden transformation",
    "The cost must arrive: something specific is spent, damaged, or lost in the comeback",
    "The opponent remains dangerous throughout — the comeback happens against real resistance",
  ],
  writingNotes: "The comeback scene's emotional power is directly proportional to how thoroughly the reader accepted the defeat. The best comebacks come from scenes where the reader wanted the character to stop — it would have been more dignified, less costly — and the character refused. That refusal, and its cost, is what makes the comeback mean something beyond sport.",
};

export const DEFEAT: SportsArchetype = {
  name: "Defeat",
  theoreticalBasis: "Defeat in sports narrative is underwritten because culture prefers comebacks. But defeat is the more common human experience and the more complex narrative one. Beilock (2010) on the psychology of loss: defeat that is attributable to effort failure is more psychologically damaging than defeat attributable to situational factors or opponent excellence. The athlete who believes they could have won if they had tried harder carries a different weight than the one who was outmatched.",
  coreDescription: "The scene of loss accepted. Not as a narrative failure — as the genuine conclusion. The character loses, and the story does not redeem this loss with an immediate lesson or a new opportunity. The defeat stands.",
  psychologicalState: "Defeat has a specific psychological phenomenology that is different from other negative states: a combination of disappointment (the gap between expectation and outcome) and shame (the sense that the self was tested and found wanting, if the athlete attributes the loss to internal causes) or grief (loss of what the victory would have meant, regardless of attribution).",
  bodyMechanics: "Defeat in the body: the specific quality of a body that has exhausted itself for nothing. Not just tired — specifically and pointlessly depleted. The physical sensation of having spent everything and arrived at the wrong outcome.",
  performanceStructure: "The defeat scene has three specific moments: the moment of certainty (when the outcome is mathematically or logically decided — before the official end), the continuation anyway (the character finishes the performance, honoring the form even after the outcome is decided), and the aftermath (the first moments with the result as established fact).",
  stakesRequirement: "Defeat must mean something. Not just tactically — the character must have brought something of themselves to the performance that losing means losing. The defeat that has no personal stakes is just a loss.",
  failureModes: [
    "The defeat is immediately redeemed: the character learns a lesson that makes the loss worthwhile",
    "The defeat ends the narrative — defeat can be a resting point, not a conclusion unless it's the last chapter",
    "The character's physical state after defeat is absent — the body that spent everything for nothing must be present",
    "The opponent's excellence is diminished to make the defeat more bearable — the opponent must remain genuinely better",
  ],
  systemDirectives: [
    "The moment of certainty must be placed before the official end — the character knows before the clock runs out",
    "The continuation after certainty is where the character's real nature is shown",
    "The body after defeat: specific and depleted — not the clean exhaustion of a completed effort but the specific wrongness of spent effort that didn't convert",
    "The attribution matters: did the character fail, or did the opponent win? The difference changes the emotional register",
    "Do not redeem the defeat within the scene — let it stand",
  ],
  writingNotes: "The defeat scene is the sports scene most writers avoid and most readers need. Defeat is universal; comeback is rare. The character who loses with their full effort is more interesting than the character who comes back, because loss is what most people know. The scene that earns the reader's respect: the character who continues after certainty is gone, not because it will change the outcome, but because the form requires it.",
};
