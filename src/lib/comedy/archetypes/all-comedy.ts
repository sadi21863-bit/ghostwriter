// src/lib/comedy/archetypes/all-comedy.ts
import type { ComedyArchetype } from "../types";

export const SITUATION_COMEDY: ComedyArchetype = {
  name: "Situation Comedy",
  theoreticalBasis: "Benign Violation Theory (McGraw & Warren, 2010): humor occurs when something is simultaneously a violation AND benign. The situation has gone wrong (violation) but the wrongness is somehow okay (benign). The three conditions must co-occur: violation alone = tragedy. Benign alone = nothing. Both together = comedy. Distance creates benignity: the event happened to someone else, happened long ago, or is framed as hypothetical. The violating thing must be real enough to register but safe enough that the reader's concern never tips into genuine worry.",
  coreDescription: "Situation comedy is about circumstances that have gone wrong in a way that is not actually dangerous but is emphatically, visibly, increasingly inconvenient. The gap between what the character intended and what is actually happening is the comedy. The situation keeps finding new ways to go wrong — each new complication is funnier than the last because the accumulation is itself absurd.",
  setupRequirement: "The character must want something specific and reasonable. The comedy comes from the gap between reasonable want and chaotic reality. Without a clear want, there is no gap.",
  benignCondition: "The stakes must be clearly non-fatal. High social stakes (embarrassment, professional humiliation) work perfectly. Low physical stakes. The reader must never genuinely worry — the moment they do, the comedy collapses.",
  timingPrinciple: "Escalation is the engine. Each complication must be worse than the previous one but still benign. The comedy compounds. Three-beat minimum: first complication, second complication (worse), third complication (the one that should have been impossible). The rule of three works because the third subverts the expectation the first two created.",
  mechanicalRules: [
    "Establish the reasonable want before the complications begin",
    "Each complication must arise from the previous one — not random but causally connected chaos",
    "The rule of three: first complication, second worse, third impossible",
    "The character's attempts to fix things must make them worse — this is the engine",
    "The benign framing must hold throughout: never let the stakes feel genuinely dangerous",
  ],
  failureModes: [
    "The stakes tip from embarrassing to genuinely dangerous — the reader stops laughing",
    "Complications are random rather than causally connected — the accumulation feels arbitrary",
    "The character gives up rather than continuing to make things worse — the engine stops",
    "The setup is not specific enough — vague want produces vague comedy",
    "The scene resolves cleanly — situation comedy ends in a state, not a resolution",
  ],
  systemDirectives: [
    "Establish the specific reasonable want before the first complication",
    "Each complication must arise causally from the previous one",
    "The character's fix attempt must make things worse — always",
    "Three escalations minimum; five is better",
    "Benign framing throughout — embarrassment, inconvenience, absurdity; not danger",
    "End in the character fully mired in the situation, not rescued from it",
  ],
  writingNotes: "Situation comedy is about incompetence meeting circumstance. The character is not bad — they are simply operating in a universe that has decided to be uncooperative. The comedy is in their continued sincere effort to manage the unmanageable. The moment they give up and accept their fate, the comedy deflates. Keep them trying.",
};

export const CHARACTER_COMEDY: ComedyArchetype = {
  name: "Character Comedy",
  theoreticalBasis: "Superiority Theory (Hobbes, 1651): we find comedy in the recognition that we are more competent, self-aware, or correct than the comic character. We laugh at their misapprehension of themselves or their situation. Benign Violation Theory also applies: the character's wrongness about themselves is a violation (they should know better) that is benign (we are not harmed by their misapprehension). The distance required by superiority theory: we must not be too close to the character (sympathy kills comedy) or too distant (cruelty kills it). The sweet spot is affectionate superiority.",
  coreDescription: "Character comedy is about someone who is wrong about themselves or the world in an observable, consistent, escalating way. The character has a fixed idea — about their importance, their competence, their attractiveness, their insight — and the world keeps refusing to confirm it. The comedy is in the gap between the character's self-assessment and observable reality.",
  setupRequirement: "The character's fixed wrong idea must be established quickly and clearly. The reader must understand what the character thinks of themselves before seeing how the world responds to them.",
  benignCondition: "The character's wrongness must not cause genuine harm to others. Social wrongness, professional wrongness, romantic wrongness — the targets of comedy characters are their own dignity, not others' welfare.",
  timingPrinciple: "The comic character's fixed idea must remain fixed despite evidence. The comedy is in the certainty, not the uncertainty. A character who begins to doubt themselves halfway through has lost the engine. The fixed idea collides with reality — and the character's interpretation of the collision is always that reality is wrong, not them.",
  mechanicalRules: [
    "The fixed wrong idea must be specific and consistent — not vague overconfidence but a precise misapprehension",
    "The world's corrections must be clear to the reader even when the character misreads them",
    "The character's interpretation of failures must always protect the fixed idea — it is never their fault",
    "Escalation: each misapprehension should be a larger scale version of the first one",
    "Affectionate distance: the reader must like the character enough to find the wrongness funny rather than sad",
  ],
  failureModes: [
    "The character becomes self-aware — this ends the comedy",
    "The fixed wrong idea causes genuine harm to someone — comedy becomes cruelty",
    "The character is too unpleasant to like — superiority tips into contempt",
    "The misapprehension changes between scenes — inconsistency kills the comedic logic",
    "The world stops responding to the character's fixed idea — no collision, no comedy",
  ],
  systemDirectives: [
    "Establish the fixed wrong idea in the first paragraph",
    "The world must refuse to confirm it — consistently, repeatedly",
    "The character's interpretation of each refusal must protect the fixed idea",
    "Maintain affectionate distance: the reader likes this person despite finding them wrong",
    "The fixed idea must remain fixed to the end — no arc, no growth, no self-awareness",
    "Escalate the scale of the misapprehension's consequences without changing the misapprehension itself",
  ],
  writingNotes: "The best comic characters are wrong in an endearing way. Don Quixote. Basil Fawlty. The office manager who is certain of their leadership. The wrongness must be specific enough to be consistent and specific enough to be funny rather than sad. 'Overconfident' is not a comic character. 'Convinced of their profound insight into human nature based on evidence that confirms this in every situation they have arranged to confirm it' — that is a comic character.",
};

export const VERBAL_WIT: ComedyArchetype = {
  name: "Verbal Wit",
  theoreticalBasis: "Incongruity Resolution Theory (Suls, 1972): a joke works when the setup creates an expectation, the punchline violates that expectation, and the violation can be resolved in retrospect — the punchline makes the setup make a new kind of sense. The pleasure is the snap of recognition. Timing requirement from structural comedy research: the punchline word must be the LAST word in the sentence. Every word after the punchline deflates it. The incongruity must be resolved — pure incongruity without resolution is confusion, not comedy.",
  coreDescription: "Verbal wit is language-based humor: wordplay, the precisely wrong word in the right context, the observation that reframes the situation, the line that means exactly what it says and something else entirely. The pleasure is cognitive — the snap of the incongruity resolving. The tool is language used with precision so sharp that the unexpected meaning arrives unavoidably.",
  setupRequirement: "The setup creates a clear expectation — of vocabulary register, of sentiment, of logical direction. The punchline violates and resolves that expectation simultaneously.",
  benignCondition: "Verbal wit must be benign to the reader — the target is language, ideas, or the speaker's self, not an absent person the reader might sympathise with.",
  timingPrinciple: "The punchline word is the last word. This is not a preference but a structural requirement. Every word after the punchline is a tax on the joke. The sentence must be constructed so the funny word falls at the end. Rewrite until it does.",
  mechanicalRules: [
    "The punchline word must be the last word in the sentence — always",
    "Setup creates clear expectation; punchline violates and resolves it simultaneously",
    "Resolution is mandatory — incongruity without resolution is confusion",
    "One joke per sentence — compound jokes undermine each other",
    "The wrong register works: formal language describing informal things, or vice versa",
  ],
  failureModes: [
    "The punchline is not the last word — there are words after the funny one",
    "The incongruity is not resolved — the reader is confused rather than amused",
    "Over-explanation: the joke is explained after it is made",
    "The wrong register is too extreme — parody rather than wit",
    "The wordplay requires too much work to find — the reader passes it before arriving",
  ],
  systemDirectives: [
    "The punchline word is the last word in its sentence — restructure until this is true",
    "Setup must create a specific expectation that the punchline violates",
    "Resolution must be immediate — the incongruity resolves in the same moment it is produced",
    "Never explain the joke",
    "One joke per unit — two jokes sharing a sentence undermine each other",
    "Wrong register is the most reliable tool: clinical language for absurd subjects, or vice versa",
  ],
  writingNotes: "The test of verbal wit: can you read the sentence aloud and feel the punchline land? The punchline should have a slight weight — a moment of unexpected fullness. If the sentence trails away after the funny word, restructure it. The architecture of the joke is as important as the content. 'He was the kind of person who brings a spreadsheet to his own funeral' works because 'funeral' is the last word. 'At his own funeral, he had brought a spreadsheet' does not, because the joke word is not last.",
};

export const DARK_COMEDY: ComedyArchetype = {
  name: "Dark Comedy",
  theoreticalBasis: "Benign Violation Theory (McGraw & Warren, 2010): the violation in dark comedy is genuine and real, but psychological distance makes it benign. Time distance (it happened long ago), social distance (it happened to someone far from us), hypothetical framing, or absurdist exaggeration can render even genuinely terrible violations comic. The equation: as distance increases, the violation becomes more benign and therefore funnier. Get too close and it tips back into genuine tragedy. The distance management is the art of dark comedy.",
  coreDescription: "Dark comedy is tragedy with sufficient distance. The subject matter is genuinely terrible — death, failure, humiliation, cruelty — but something creates enough distance that the terrible thing becomes, improbably, funny. The comedy is often in the gap between the enormous badness of what has happened and the mundane inadequacy of the response to it.",
  setupRequirement: "The terrible thing must be established clearly. The comedy requires the reader to know how bad it is — distance makes it benign, but the reader must first feel the weight of what is being distanced.",
  benignCondition: "Distance can be created by: absurdist exaggeration (too extreme to feel real), deadpan delivery (the narrator treating the terrible as ordinary), time distance, social distance (happening to the kind of person it happens to), or irony. The distance must be established before or simultaneously with the revelation of the terrible thing.",
  timingPrinciple: "Deadpan delivery is the primary tool. The narrator acknowledges the terrible thing with precisely the same register they would use to acknowledge something trivial. The gap between the weight of the event and the lightness of the response is where dark comedy lives.",
  mechanicalRules: [
    "Establish the terrible thing clearly — the comedy requires the reader to feel its weight",
    "Create distance before or simultaneously with the terrible thing's arrival",
    "Deadpan delivery: treat the terrible as ordinary — the contrast is the comedy",
    "Never editorialize — the narrator who notices the tragedy kills it",
    "The mundane response to the non-mundane event is the signature of dark comedy",
  ],
  failureModes: [
    "The terrible thing is too trivial — there is no real weight for the distance to transform",
    "The distance is insufficient — the reader cannot find the benign framing",
    "The narrator editorializes about the badness — this collapses the distance",
    "The dark comedy tips into cruel humor about a specific real person the reader might know",
    "The scene ends in appropriate gravity — dark comedy requires the inappropriate response to persist",
  ],
  systemDirectives: [
    "The terrible thing must have real weight — the comedy requires something to work against",
    "Deadpan delivery: same register for terrible and trivial events",
    "The mundane response to the enormous event — scheduling a dental appointment, worrying about the catering",
    "Never let the narrator notice the irony — characters can, but the narrative voice must not",
    "Maintain the distance throughout — do not collapse into genuine tragedy at the end",
    "The response must be precisely as inadequate as it would be if the terrible thing were not terrible",
  ],
  writingNotes: "Dark comedy is the genre where someone's grandmother dies and the scene is about who gets the parking space. The trick is that the parking space dispute must be genuinely about the parking space — not a metaphor for grief, not a deflection — just someone caring about the parking space while also their grandmother is dead. The comedy is in the parallel existence of both concerns at equal weight. The narrator cannot rank them. The reader does that for themselves.",
};

export const PHYSICAL_COMEDY: ComedyArchetype = {
  name: "Physical Comedy",
  theoreticalBasis: "Superiority Theory (Hobbes): we laugh at physical comedy because the body has betrayed its owner's dignity. The pratfall is funny because we feel superior to the person who fell. The physical comedy that persists longest combines the Superiority observation with the Benign Violation: the fall is a violation of the body's expected dignity and decorum, rendered benign by the person's obvious unharmedness. Timing principle: physical comedy must be described in precise bodily detail for the reader to picture it. Vague physical comedy is not funny.",
  coreDescription: "Physical comedy is the body refusing to cooperate with the mind's intentions. Dignity is attempted and the body produces something else entirely. The slapstick tradition: the carefully arranged plan producing physical chaos. The character's sincerity is essential — the person who falls must have been trying very hard to walk gracefully.",
  setupRequirement: "The dignity or intention must be established before the body's non-cooperation is shown. The character must be trying to do something decorous, dignified, or competent. The comedy is in the contrast between intention and result.",
  benignCondition: "The character must be obviously unhurt. Physical comedy with genuine injury becomes distressing. The pratfall must be followed (quickly) by the character being fine. High-consequence physical comedy (real pain, real damage) is not the genre.",
  timingPrinciple: "Physical comedy in prose must be rendered in precise physical detail — the specific angle of the fall, the exact wrong timing of the door, the precise sequence of events that led to the person being covered in something. Generic physical comedy is not funny. The specific impossible sequence of events is funny.",
  mechanicalRules: [
    "Establish the dignity/intention first — what the character is trying to do",
    "The physical failure must arise from the sincere attempt — not clumsiness but bad luck meeting good intentions",
    "Precise physical detail — the exact angle, the exact sequence, the exact wrong moment",
    "The character must survive obviously unhurt",
    "The rule of three works for physical comedy: each step in the cascade is worse",
  ],
  failureModes: [
    "The character is obviously careless — the fall must happen despite care, not because of carelessness",
    "The physical description is vague — 'he fell down' is not funny; the specific sequence of how he fell is",
    "The character is genuinely hurt — physical harm ends the comedy",
    "The setup (the dignity attempt) is not established — no contrast, no comedy",
    "The cascade of events is random rather than causally connected",
  ],
  systemDirectives: [
    "Establish the sincere dignity attempt before the body refuses to comply",
    "Precise physical detail: the exact angle of the fall, the exact sequence of the cascade",
    "The character must be trying very hard — sincerity is essential to physical comedy",
    "The cascade: each physical failure causes the next, in a causally connected sequence",
    "The character survives completely unhurt — establish this quickly after the fall",
    "The more formal the setting and the more elaborate the preparation, the more contrast available",
  ],
  writingNotes: "Physical comedy in prose is harder than on screen because the reader must picture the exact sequence. The precision of description is everything. 'He slipped' is not funny. 'The tile shifted under his left heel at the exact moment his right foot had already committed to the step forward, so his body continued moving in the direction of his confidence while his feet stayed behind' — that is physical comedy. The body has its own idea about what is happening.",
};
