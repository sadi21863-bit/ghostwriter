// src/lib/monologue/archetypes/all-monologue.ts
import type { MonologueArchetype } from "../types";

export const INTERIOR_MONOLOGUE: MonologueArchetype = {
  name: "Interior Monologue",
  theoreticalBasis: "The controlled, near-outer-speech form of internal thought. More organized than stream of consciousness but still compressed. The character is thinking through something with relative coherence — a problem to solve, a memory to process, a feeling to understand. Sokolov's inner speech research: even organized inner speech is 3x compressed relative to outer speech.",
  coreDescription: "The character is reasoning or processing in thought. The thought is directed — it has a subject — but it is not narrated as if to an audience. The compression produces incomplete sentences, pronouns without referents, the assumption of shared context (with the self). The reader must do some reconstruction work.",
  compressionLevel: "Moderate — 3:1 compression. Complete sentences permitted but not required. The pronoun 'I' often drops. Time markers are implicit.",
  associativePattern: "Loosely linear — thought follows a thread but strays and returns. One thought triggers another by contiguity, not formal logic. The thread is recoverable: the reader can trace how we got here.",
  syntaxRules: [
    "Sentences may be grammatically incomplete without being confusing",
    "Pronoun 'I' drops when it would be obvious: 'Should have gone earlier. Knew it was a mistake.'",
    "Time markers are implicit: 'Yesterday. That was before.'",
    "Direct address to the self is permitted: 'Don't think about that. Not now.'",
    "No quotation marks around thought — it flows as narrative",
  ],
  sensoryIntrusion: "Moderate — the environment breaks in occasionally to redirect thought. A sound from outside. The temperature of the room. These intrusions are brief and thought recovers its thread.",
  failureModes: [
    "The thought is grammatically perfect and complete — it reads as narrated prose, not thought",
    "The thought is too well-organized — it has intro, development, conclusion",
    "The thought explains itself to the reader: 'I was thinking about the incident from three years ago when...'",
    "The character's thought is more eloquent than their established speech pattern",
  ],
  systemDirectives: [
    "Drop the pronoun 'I' where it would be obvious",
    "Incomplete sentences permitted and encouraged",
    "No narrating to the reader — the thought assumes its own context",
    "Time markers implicit: 'Last week. Three times.' not 'Three times last week.'",
    "The thought may stray once and return — mark the stray and the return",
  ],
  writingNotes: "Interior monologue is the easiest form of inner speech to read and the hardest to write convincingly. The trap is writing it as narrated thought: 'He thought about how he had made a mistake.' The real form: 'A mistake. Obviously. Should have seen it.' The compression is the authenticity.",
};

export const STREAM_OF_CONSCIOUSNESS: MonologueArchetype = {
  name: "Stream of Consciousness",
  theoreticalBasis: "William James (1890): consciousness is not a chain of discrete ideas but a continuous flowing current. The stream has no beginning, no natural pause points, no hierarchy of importance. Everything registers simultaneously — the important thought and the color of the wall and the distant sound. Bower (1981) mood-congruent memory: under emotional activation, the stream pulls in associatively matched memories without logical connection.",
  coreDescription: "The fully uncontrolled flow of consciousness. Thought, sensation, memory, and perception arrive at the same level without hierarchy. One thing pulls in another by association — sound, feeling, or image, not logic. The reader follows without a guide.",
  compressionLevel: "Maximum — 10:1 compression. Words stand for thoughts. A fragment represents a full concept. The reader fills the gap.",
  associativePattern: "Fully associative. The chain: a smell → a memory → a fragment of that memory → a word from the memory that sounds like another word → a different memory attached to that word. The connection between consecutive thoughts is often untraceable by logic but traceable by feeling.",
  syntaxRules: [
    "Fragments throughout: 'The light. Wrong time of day.'",
    "Punctuation used expressively, not grammatically: em-dashes cut thought off",
    "Contradictions without resolution: 'Should go. Can't move.'",
    "Repetition of a word or image signals its emotional charge",
    "The stream breaks when sensation intrudes: a sound, a physical sensation, a smell",
    "Memory and present are the same level — no signal that we've left the present",
  ],
  sensoryIntrusion: "Dominant — the stream is constantly broken and redirected by sensory input. The outside world and the inside world have equal claim on attention. A car door outside pulls the stream in a new direction without warning.",
  failureModes: [
    "The stream is too coherent — the reader follows too easily",
    "Memory and present are signaled: 'He remembered...' — the stream does not announce its shifts",
    "The stream has a point — stream of consciousness does not know where it's going",
    "Associations are logical rather than emotional or sonic",
    "The prose is beautiful — stream of consciousness is often ugly and stumbling",
  ],
  systemDirectives: [
    "No hierarchy — sensation, memory, thought, emotion at the same level",
    "No signal for memory shifts — past and present arrive without announcement",
    "Associations by sound, smell, or feeling — not logic",
    "Repetition is significance — if a word or image recurs, it matters",
    "Break the stream with sensory input: a sound, a smell, a physical sensation",
    "The stream does not know where it is going — do not let it organize itself",
  ],
  writingNotes: "Stream of consciousness is not difficult prose. It is consciousness writing itself. The writer's job is to get out of the way. The voice is the character's, not the author's. The beauty of a well-written stream is that it sounds like someone's actual mind — which is not beautiful at all, but is completely true.",
};

export const DISSOCIATION: MonologueArchetype = {
  name: "Dissociation",
  theoreticalBasis: "Dissociation: the disconnection between the self's relationship to its own thoughts, feelings, memories, or identity. Under extreme stress or trauma, the self observes itself from a distance. The clinical markers: depersonalization (the self feels unreal or detached), derealization (the environment feels unreal or dream-like), and the narrowing of attention to a single focal point while the periphery becomes noise.",
  coreDescription: "The character experiences themselves from the outside. They are watching themselves act rather than acting. The environment has become strange or thin. A single detail may be extraordinarily vivid while everything else recedes. Thought is slow, distant, detached from emotional response.",
  compressionLevel: "Low compression — thought is slow and may be surprisingly grammatical because the urgency that normally compresses thought is absent. But the content is wrong: detached, observational, inappropriately calm.",
  associativePattern: "Distorted — the normal associations have severed. The character may think about something entirely irrelevant with great calm while the urgent thing recedes. The emotional charge that normally organizes thought is absent or inverted.",
  syntaxRules: [
    "Third-person observation of the self: 'She was walking. Her feet were on the floor.'",
    "Or second-person: 'You should say something. You are not saying anything.'",
    "Inappropriately calm and grammatically complete sentences about extreme content",
    "Single vivid detail amid vagueness: everything is fog except one object, one sound",
    "Temporal displacement: things happen before the character registers them",
  ],
  sensoryIntrusion: "Selective and distorted — one sense may be amplified (a sound that fills the whole space) while others are absent. The sensory map is wrong.",
  failureModes: [
    "The character processes the extreme content emotionally in real time — dissociation prevents this",
    "The perspective is consistently first-person present — dissociation shifts and distances perspective",
    "The thought is compressed and associative — dissociation produces distance and slowness",
    "The character understands what is happening to them — dissociation impairs this understanding",
  ],
  systemDirectives: [
    "Shift to third-person or second-person observation of the self",
    "Inappropriately calm tone for extreme content",
    "Single vivid sensory detail while the rest becomes thin or absent",
    "Events register after they occur: 'She was on the floor. She had fallen.'",
    "No emotional response to the content — thought is observational only",
    "Temporal disconnect: cause and effect arrive separately",
  ],
  writingNotes: "Dissociative prose is uncanny to read because its calmness is wrong. The character describes terrible things in the voice of someone describing ordinary things. The reader's discomfort comes from the mismatch between content and tone. 'There was blood on the wall. It was a particular shade of red. She had not known it would be that color.' The specific wrong detail. The absence of the expected response.",
};

export const INTRUSIVE_THOUGHT: MonologueArchetype = {
  name: "Intrusive Thought",
  theoreticalBasis: "Wegner (1994) ironic process theory: the mental control of thought produces the opposite of its intention. When someone tries not to think about something, they must monitor for the thought, which activates it. Suppression requires vigilance which requires the subject of vigilance to be active in the mind. The white bear experiment: trying not to think of a white bear produces intrusive thoughts of white bears at a higher rate than thinking freely.",
  coreDescription: "The thought the character is trying not to have. It returns. Repeatedly. At intervals. Despite the character's efforts to redirect. The harder they push it away, the more it returns. The ironic process is the scene's engine.",
  compressionLevel: "Variable — the intrusive thought itself may be brief and specific (a single image, a phrase, a name). The suppression attempt is more elaborate. The return of the thought is always brief.",
  associativePattern: "Non-associative — the intrusive thought breaks whatever chain the character was constructing. It doesn't connect to the current context. That's what makes it intrusive: it arrives without logical invitation.",
  suppressionBehavior: "Wegner's ironic process: the suppression attempt must be visible. The character redirects to another thought. The intrusive thought returns. They redirect again, more forcefully. The thought returns more forcefully. The scene escalates through this cycle.",
  syntaxRules: [
    "The intrusive thought in italics or em-dashes — visually distinct from the suppression attempt",
    "The suppression attempt: 'Don't think about—' and a redirect to something else",
    "The return: the thought or an image of it, arriving mid-sentence in the redirect",
    "The cycle shortens: each return arrives faster than the last",
    "At peak: the character cannot think around the thought — it is all there is",
  ],
  sensoryIntrusion: "The intrusive thought uses sensory details from the memory or anxiety it represents. These specific sensory intrusions (a smell, a sound, a texture) are what break through the suppression.",
  failureModes: [
    "The suppression succeeds — Wegner establishes it cannot under conscious effort",
    "The intrusive thought is non-specific: 'the bad thing' rather than the specific image",
    "The cycle does not escalate — the returns must come faster and more forcefully",
    "The character understands the ironic process and stops suppressing — this is a resolution, not the archetype",
    "The thought arrives only once — a single intrusion is not intrusive thought",
  ],
  systemDirectives: [
    "The cycle must escalate: each suppression attempt weaker, each return stronger",
    "The intrusive thought must be specific — a particular image, phrase, or sensory detail",
    "Show the suppression attempt: the redirect to another subject",
    "The return arrives mid-redirect, not after completion",
    "Visually distinguish the intrusive thought from the surrounding thought",
    "End at peak, not at resolution — the archetype is the intrusion, not the processing",
  ],
  writingNotes: "The intrusive thought scene is one of the most technically precise in fiction because it has a documented psychological mechanism the prose must enact. The mechanism is: try not to — try not to — can't help but. The reader should feel the trap tightening. The trap is made by the character themselves, trying to escape.",
};

export const DECISION_SPIRAL: MonologueArchetype = {
  name: "Decision Spiral",
  theoreticalBasis: "Decision-making under stress produces a specific cognitive pattern: the consideration of options loops rather than progresses. Kahneman (2011) fast-and-slow: the slow deliberate system is overwhelmed by the urgency of the decision, causing it to hand back to the fast intuitive system which has no better answer. The loop is the slow system trying to catch up while the fast system keeps saying 'I don't know.' Under time pressure, this loop accelerates.",
  coreDescription: "The character must make a decision and cannot. They cycle through the options, testing each, rejecting each, returning to the beginning. The cycle accelerates under time pressure. No option is clearly right. The cost of deciding wrong is real. The cost of not deciding is also real.",
  compressionLevel: "High compression — the thought cycles are abbreviated. The character has thought this through before and the return to the same option is a shorthand, not a fresh consideration.",
  associativePattern: "Cyclical — unlike stream of consciousness (freely associative) or interior monologue (loosely linear), the decision spiral is explicitly looping. The same options recur. The same objections recur. The circle is the structure.",
  syntaxRules: [
    "Options stated in parallel syntax: 'If A then B. If not A then C. But B means D. Back to A.'",
    "Time pressure expressed through shortening loops: 'A. No. B. No. A again—'",
    "The character interrupts their own reasoning",
    "Fragments as the loop compresses: earlier full sentences, later just option labels",
    "The physical cost of the spiral: a detail from the body appearing at each return to the loop",
  ],
  sensoryIntrusion: "Time intrudes — a sound of urgency, the passage of a moment. The environment pressures the spiral to resolve.",
  failureModes: [
    "The options are evaluated clearly and then decided — this is deliberate decision-making, not a spiral",
    "The spiral is calm — decision spirals under pressure are not calm",
    "The loop does not compress — it must accelerate under pressure",
    "The character resolves the spiral logically — spirals typically resolve through exhaustion or external interruption, not logic",
    "The body is absent — the physical cost of the spiral must be present",
  ],
  systemDirectives: [
    "The loop must be explicit: the same options recur in the same order",
    "Compression increases: full sentences early, fragments late",
    "Time pressure must be felt: the environment imposing urgency",
    "The body at each return to the loop: the specific physical cost of sustained decision pressure",
    "Resolve through interruption or exhaustion, not through logic arriving",
    "The reader should feel the trap of the loop — not sympathy for the character, but the structure itself",
  ],
  writingNotes: "The decision spiral is the prose form of being stuck. Its specific quality is circularity made visible. The reader watches the character return to the same option for the fourth time and understands something has to break — either the character will act without resolution, or something external will decide for them. The spiral's resolution is always outside the spiral itself.",
};
