// src/lib/thriller/archetypes/all-thriller.ts
import type { ThrillerArchetype } from "../types";

export const EXPANDING_THREAT: ThrillerArchetype = {
  name: "Expanding Threat",
  theoreticalBasis: "Brewer & Lichtenstein (1982) and the thriller-specific variant of suspense: the threat that grows with each revelation rather than resolving. Unlike standard suspense (fixed threat approaching), the expanding threat reveals a conspiracy that is always larger than believed. Every answer produces a larger question. The genre promise: you cannot see the full scope from where you are.",
  coreDescription: "The scene where the protagonist's discovery makes their situation worse, not better. They uncover information and realize: the problem is bigger than I knew. The perpetrators are more numerous. The corruption goes higher. What I thought was the ceiling is a floor.",
  expansionMechanic: "Each revelation must at minimum double the apparent scope. If the protagonist thinks one person is involved, the revelation shows ten. If they think ten, the revelation implies hundreds. The expansion must be specific — not vague 'it goes deeper' but a concrete new element that reframes everything known.",
  informationStrategy: "The reader may be ahead of the protagonist (suspense structure: knows more, watches the protagonist approach the revelation) or at the same level (curiosity structure: discovers with the protagonist). Expanding threat works best with the reader at the same level — the expansion lands for both simultaneously.",
  moralDimension: "Expanding threat implies systemic corruption — the threat is not an individual but a system the protagonist is embedded in. The moral question: who can be trusted, and at what point does the protagonist's effort to fight the system make them complicit in it?",
  revealStructure: "The expansion arrives mid-scene, not at the scene's end. The protagonist has time to react to the expanded scope before the scene closes. The reaction should be specific: what does this new scope mean for their next move?",
  failureModes: [
    "The expansion is vague: 'it's bigger than I thought' without specific new elements",
    "The expansion arrives at the scene's end as a cliffhanger rather than mid-scene for reaction",
    "The protagonist's reaction is predictable alarm rather than specific changed assessment",
    "The expansion is the last — there is a sense of 'now we know the full scope.' There must always be a larger possible scope.",
  ],
  systemDirectives: [
    "The expansion must be specific: name the new element, the new scope, the new level",
    "The expansion arrives with evidence — not 'I think it goes higher' but a document, a name, a fact",
    "The protagonist must update their threat model specifically: who is now an enemy, who is now untrustable",
    "The scene must close with the protagonist having more enemies than they started with",
    "The full scope must remain unknown — this is not the last expansion",
  ],
  writingNotes: "The expanding threat scene is most effective when the protagonist's hope was genuine before the expansion. They thought they had found the edge of it. The contraction of that hope into something harder and more dangerous is the scene's emotional content. The expanding threat is not about paranoia — it is about the protagonist being correct, and that being worse than being wrong.",
};

export const MACGUFFIN: ThrillerArchetype = {
  name: "MacGuffin",
  theoreticalBasis: "Hitchcock and Truffaut (1966): the MacGuffin is the object, goal, or piece of information that motivates the plot but whose specific nature is irrelevant to the theme. What matters is that everyone wants it and its pursuit drives action. The MacGuffin is not a cheat — it is a structural device that allows the real story (character under pressure, moral compromise, systemic exposure) to unfold.",
  coreDescription: "The scene centered on the MacGuffin — acquiring it, losing it, protecting it, discovering what it actually is, or discovering that what it appeared to be is not what it is. The MacGuffin scene works because the urgency is real even if the object's specific nature is irrelevant.",
  expansionMechanic: "The MacGuffin scene often contains an expansion: the MacGuffin turns out to be something different from what was believed, or acquiring the MacGuffin reveals that the real objective was always something else. The MacGuffin is a door — the thriller scene is what's on the other side.",
  informationStrategy: "The MacGuffin can be known or unknown to the reader. The most powerful variant: the reader knows what the MacGuffin is and why everyone wants it, but the protagonist doesn't know its full significance. The information asymmetry creates tension in every MacGuffin scene.",
  moralDimension: "The MacGuffin forces moral choices: who gets hurt in the pursuit, what the protagonist is willing to do to possess it or deny it, and whether possession changes them. The MacGuffin scene is where the thriller's moral question becomes concrete.",
  revealStructure: "MacGuffin scenes have two structures: acquisition (the protagonist gains the MacGuffin — focus on what it costs) and revelation (the protagonist discovers what the MacGuffin actually means — focus on the changed situation).",
  failureModes: [
    "The MacGuffin's specific nature is dwelt on as though it matters thematically — it shouldn't",
    "Acquiring the MacGuffin resolves the protagonist's situation — it should complicate it",
    "The MacGuffin scene has no moral cost — the acquisition or loss must take something from someone",
    "The MacGuffin is unique in existence — the thriller is more interesting if copies exist or if it can be destroyed",
  ],
  systemDirectives: [
    "The MacGuffin is urgent and specific but thematically arbitrary — treat it accordingly",
    "Acquiring the MacGuffin must cost something: a relationship, an action the protagonist cannot undo, a moral line",
    "The MacGuffin scene reveals something about the protagonist's limits, not about the MacGuffin itself",
    "The MacGuffin changes hands — it is a circuit element, not a destination",
  ],
  writingNotes: "The MacGuffin works when the writer knows what it is and doesn't need the reader to care about what it is. The briefcase in Pulp Fiction. The microfilm in North by Northwest. The specific contents are irrelevant; the moral choices made in pursuit are everything. If the scene is about the MacGuffin, it has failed. If it is about what the characters become in their pursuit of it, it is working.",
};

export const FALSE_RESOLUTION: ThrillerArchetype = {
  name: "False Resolution",
  theoreticalBasis: "Brewer & Lichtenstein surprise structure applied specifically: the false resolution presents a completed narrative arc (the threat is eliminated, the case is closed, the mission is accomplished) that is then revealed to be incorrect or incomplete. The reader experiences genuine relief, and then the relief is revoked. The revocation lands harder because the relief was real.",
  coreDescription: "The scene where the protagonist believes the threat is resolved — and the reader may also believe this — before a revelation demonstrates that the resolution is false. The threat continues, or a new threat is revealed as larger, or what was believed to be the enemy was only a proxy for the real one.",
  expansionMechanic: "The false resolution is a specific application of expanding threat: the protagonist closes the loop they can see, only to have a larger loop revealed. The genre mechanism: you found the dog — but the owner is behind you.",
  informationStrategy: "The most powerful false resolutions use the reader's own narrative expectations against them. The reader expects the second-act resolution to be false — so the writer must make it feel like the real resolution before the rug pull. The false resolution must be genuinely satisfying before it is revoked.",
  moralDimension: "The false resolution often contains a moral cost: the protagonist eliminated the threat through a morally compromised action, and it turns out they compromised themselves for nothing. Or: the resolution is 'correct' but the protagonist now realizes they've become complicit in the larger system they thought they were fighting.",
  revealStructure: "The false resolution has two moments: the satisfaction (the reader feels the resolution) and the reactivation (the resolution is revoked). The gap between these two moments must be long enough for the satisfaction to be real. A false resolution that is revoked immediately was never really a resolution.",
  failureModes: [
    "The false resolution is obviously false from the moment it is presented — the reader never feels the satisfaction",
    "The reactivation is immediately adjacent — the satisfaction has no time to be felt",
    "The false resolution's falseness is explained by the protagonist too quickly",
    "The real threat is less interesting than the false one that was resolved",
  ],
  systemDirectives: [
    "The false resolution must be genuinely satisfying before it is revoked — write it to be believed",
    "The gap between satisfaction and reactivation must allow the reader to actually feel relief",
    "The reactivation must expand the threat, not merely continue it — something is worse than before",
    "The protagonist's reaction to the false resolution being false is specific: what does this cost them beyond the tactical situation",
  ],
  writingNotes: "The false resolution requires the writer to genuinely write a resolution and then genuinely undo it — not a gesture at both. The reader must feel the click of the story closing, and then feel it forced open again. The genre's most satisfying false resolutions leave the reader annoyed at themselves for believing it, and then grateful for the continuation.",
};

export const MORAL_COMPROMISE: ThrillerArchetype = {
  name: "Moral Compromise",
  theoreticalBasis: "The thriller's ethical core: to defeat the antagonist, the protagonist must become like them. The moral compromise scene is where the protagonist crosses a line they defined for themselves earlier in the narrative. The consequence of the crossing is not just tactical — it changes who the protagonist is. The thriller asks: was it worth it? And the honest thriller refuses to answer cleanly.",
  coreDescription: "The scene where the protagonist does something they have previously established they would not do — uses the antagonist's methods, sacrifices someone they should protect, lies to someone who trusted them, covers up something that should be exposed. The scene's moral weight comes from the earlier establishment of the line. Cross it and it cannot be uncrossed.",
  expansionMechanic: "The moral compromise expands the threat inward: the enemy is no longer only outside. The protagonist carries the thing they did. The expanding threat now includes themselves as a threat to what they believe.",
  informationStrategy: "The reader knows about the moral line — it was established earlier. They see the protagonist approaching it. They may want the protagonist to cross it (because the tactical situation requires it) and not want them to (because of what it means). This tension is the scene's engine.",
  moralDimension: "This IS the archetype — the moral dimension is the center of the scene. The tactical justification must be genuine. The moral cost must be genuine. The question must not be answered.",
  revealStructure: "The moral compromise has three moments: the decision point (the protagonist sees the line and the necessity), the crossing (specific, concrete, not flinched from), and the aftermath (immediate — what has changed in how the protagonist is in the world now).",
  failureModes: [
    "The moral line was not clearly established before the scene — the compromise lacks weight",
    "The tactical justification is flimsy — the reader must believe the compromise was necessary",
    "The crossing is not specific — it must be an act, not a feeling",
    "The aftermath is not immediate — the protagonist should feel it before the scene ends",
    "The genre answers the moral question cleanly: the compromise was right, or it was wrong. It should be both.",
  ],
  systemDirectives: [
    "Reference the established moral line explicitly — the character knows what they're crossing",
    "The tactical necessity must be genuine: the reader must feel that there was no other option",
    "The crossing must be a specific act, not a feeling or a decision — something is done",
    "The immediate aftermath: what does the protagonist notice about themselves in the moment after",
    "The moral question must remain open at the scene's end — do not resolve it",
  ],
  writingNotes: "The moral compromise scene is the thriller's heart. Everything before it is building the protagonist so the crossing means something. The scene's quality is directly proportional to how much the reader wanted the protagonist not to cross the line — and how much they also wanted them to. The scene fails if the compromise is clearly right or clearly wrong. It succeeds if the reader spends time afterward not knowing how to feel.",
};

export const TWIST: ThrillerArchetype = {
  name: "Twist",
  theoreticalBasis: "Brewer & Lichtenstein surprise structure: an unexpected event that restructures the reader's understanding of everything that preceded it. The thriller twist differs from the mystery reveal (which validates clues) — it inverts the frame. The antagonist was the protagonist's ally. The ally was the antagonist. The protagonist's goal was the antagonist's goal all along. The information that produced the twist must have been available — but its significance was invisible.",
  coreDescription: "The scene where a revelation fundamentally restructures the reader's understanding of the narrative. Not a new piece of information — a recontextualization of all previous information. What was understood as A was actually B, and everything must be reread in light of this.",
  expansionMechanic: "The twist is the most extreme expansion: not the threat is bigger than believed but the nature of the situation is different from believed. The twist expands not the scope but the kind of problem.",
  informationStrategy: "The twist requires that the recontextualized information was available — the reader could have seen it. After the twist, the reader should be able to trace it. But the narrative must have made the correct reading invisible through the very act of appearing transparent.",
  moralDimension: "The best thriller twists have moral content: the protagonist's moral compromise was unnecessary because the situation was different from what they believed. Or: the protagonist's commitment to their values was precisely what the antagonist exploited. The twist reveals something about the moral landscape of the story.",
  revealStructure: "The twist has three moments: the delivery (specific, concrete, without warning), the realization pause (a beat of silence — the reader and protagonist processing simultaneously), and the reframing (the protagonist, and with them the reader, re-reading the situation in light of the new information).",
  failureModes: [
    "The twist requires information that was not available to the reader — violation of the genre contract",
    "The twist inverts everything but has no thematic content — a plot trick, not a revelation",
    "The realization pause is absent — the twist lands and immediately drives action, depriving the reader of the processing moment",
    "The reframing is explicit (the protagonist explains the twist's implications) rather than shown",
    "The twist is telegraphed — a careful reader saw it coming",
  ],
  systemDirectives: [
    "The twist information must have been available — establish it before the scene that contains the twist",
    "The delivery is specific and concrete — not 'he realized the truth' but the specific truth delivered",
    "Include the realization pause: a beat, a held moment, before reaction",
    "The twist must reframe previous events — the protagonist must update their understanding of specific earlier scenes",
    "The moral content must be present: what does the twist mean for the protagonist's choices in this story",
  ],
  writingNotes: "The thriller twist that works is the one that makes the reader want to re-read from the beginning. Every previous scene will look different. The writer must have written those previous scenes knowing the twist was coming — there must be a second layer of meaning in them that becomes visible only after the twist lands. The twist is earned forward and backward simultaneously.",
};
