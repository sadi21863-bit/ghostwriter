// src/lib/scitech/archetypes/all-scitech.ts
import type { ScitechArchetype } from "../types";

export const NORMAL_SCIENCE: ScitechArchetype = {
  name: "Normal Science",
  theoreticalBasis: "Thomas Kuhn's The Structure of Scientific Revolutions (1962): normal science is puzzle-solving within an accepted paradigm — a framework so deeply embedded it is invisible. The paradigm tells scientists what counts as a valid question, what counts as an acceptable answer, and what data is relevant. Data that doesn't fit is set aside as measurement error, not as evidence against the paradigm. The community's investment in the paradigm is social and psychological, not merely intellectual.",
  coreDescription: "The scientist working at the limits of the known, solving puzzles within a framework they trust completely and cannot see the edges of. This is not ignorance — it is the specific form of knowledge that normal science produces: deep, precise, and bounded by its own assumptions.",
  paradigmPosition: "Deep inside the paradigm — the framework is invisible, its assumptions are the air the character breathes",
  epistemicState: "The scientist knows the paradigm's answers, trusts the paradigm's methods, treats paradigm-inconsistent data as error rather than evidence",
  dramaticEngine: "The tension between the scientist's certainty and the reader's awareness (if any) that the paradigm has limits. Also: the cost of this certainty — what the scientist cannot see because the paradigm makes it unthinkable.",
  writingDirectives: [
    "The scientist does not doubt the paradigm — they apply it with rigorous confidence",
    "The paradigm's boundaries should be felt by the reader even when invisible to the character",
    "Normal science has genuine intellectual beauty — the puzzle elegantly solved within established rules",
    "The social dimension of normal science must be present: colleagues, reputation, institutional constraints",
    "What the character is not asking is as important as what they are asking",
  ],
  failureModes: [
    "The scientist is naively unaware of complexity — normal science is not naive, it is specifically bounded",
    "The paradigm's constraints are commented upon by the scientist rather than simply lived",
    "The intellectual rigor and genuine beauty of normal science is absent",
    "The character is simply 'a scientist' without a specific paradigm governing their specific work",
  ],
  systemDirectives: [
    "Define this scientist's specific paradigm: what framework governs their work and makes certain questions visible/invisible?",
    "The paradigm should be invisible to the character but present in their language, priorities, and method",
    "At least one moment where the paradigm's specific constraints shape what the scientist can and cannot see",
    "The intellectual pleasure of puzzle-solving within the paradigm should be genuine — not a criticism of the character",
  ],
  writingNotes: "Normal science produces some of the best scientific characters because the character's certainty is genuine and deserved. They are very good at what they do. The dramatic potential is in the paradigm's invisible edges — the reader who knows what the character doesn't is watching someone apply perfect rigor to a framework that will eventually fail at its limits."
};

export const ANOMALY_ACCUMULATION: ScitechArchetype = {
  name: "Anomaly Accumulation",
  theoreticalBasis: "Kuhn's second phase: over time, puzzles accumulate that the paradigm cannot resolve. These are not immediately treated as threats — they are treated as problems to be solved eventually. The paradigm is remarkably resistant to falsification. Scientists who point to anomalies are regarded as incompetent or as nuisances. The community's investment in the paradigm is social and psychological — challenging the paradigm challenges the community's collective expertise. Anomalies accumulate for decades before they become the crisis that forces a paradigm shift.",
  coreDescription: "The scene where data that doesn't fit is encountered, dismissed, filed, noted, or noted and then dismissed again. The anomaly is real. The scientist's inability to see it as anomaly — their insistence on treating it as measurement error — is equally real and equally human.",
  paradigmPosition: "Inside the paradigm but at its trouble-edge — the data that doesn't fit is present but not yet threatening",
  epistemicState: "The scientist encounters data that contradicts the paradigm. They have three available responses: reject the data (measurement error), accommodate the data (ad hoc explanation), or note it for later. The fourth response — treat it as evidence against the paradigm — is only available to someone already partially outside the paradigm's grip.",
  dramaticEngine: "The reader's awareness that the anomaly is real, combined with the character's genuine inability to see it as such. The tragedy of specifically correct incomprehension.",
  writingDirectives: [
    "The anomalous data must be genuinely anomalous — the reader should be able to see why it matters even if the character cannot",
    "The scientist's dismissal of the anomaly must be intelligent, not stupid — they have good reasons within the paradigm",
    "The social cost of taking the anomaly seriously must be present: colleagues, career, credibility",
    "The accumulation is gradual — this should not be the first anomaly, just the one that is most visible",
    "Feynman's first principle: the scientist is most easily fooled by their own desires — the desire for the anomaly to be error",
  ],
  failureModes: [
    "The scientist is foolish for not seeing the anomaly — they are not foolish, they are inside a framework",
    "The anomaly is obvious — real paradigm-threatening data is usually subtle and genuinely ambiguous",
    "The social dimension of anomaly-suppression is absent — this is a community behavior, not just individual",
    "The scientist leaps to questioning the paradigm — this is only possible from outside the paradigm's full grip",
  ],
  systemDirectives: [
    "The anomaly must be genuinely ambiguous — it should be possible to read it as measurement error",
    "The scientist's intelligence is demonstrated by how well they dismiss the anomaly within the paradigm",
    "The social cost of taking the anomaly seriously must shape the character's response",
    "The reader should feel the gap between what the data shows and what the character sees",
  ],
  writingNotes: "The anomaly accumulation scene is one of the most psychologically honest available to the science writer. The character is not wrong to dismiss the anomaly — within the paradigm, dismissal is correct. Feynman: 'You must not fool yourself — and you are the easiest person to fool.'"
};

export const PARADIGM_SHIFT: ScitechArchetype = {
  name: "Paradigm Shift",
  theoreticalBasis: "Kuhn's third phase: the scientific revolution. Not a gradual accumulation of corrections but a gestalt switch — the world looks different. The new paradigm is not the old paradigm plus corrections; it is a different way of constituting reality. The shift is experienced by its participants as a conversion, not as a logical proof. And it is resisted most fiercely by those most invested in the old paradigm — not because they are foolish but because they have spent their lives building knowledge within it.",
  coreDescription: "The scene of the gestalt switch: the moment when the data, the anomalies, the framework all reorganize into a new configuration. Or the scene of the resistance to that switch — the older scientist who cannot make the move, who is not wrong about the evidence that supports the old paradigm but cannot see the new configuration the younger scientists are seeing.",
  paradigmPosition: "The paradigm breaking — either the switch itself or the resistance to it",
  epistemicState: "The revolutionary scientist is partially outside the old paradigm — they can see the anomalies as anomalies. The resistant scientist is deeply inside the old paradigm — they cannot be argued into the new one because the argument is conducted in the new framework's terms, which they do not fully share.",
  dramaticEngine: "Kuhn's incommensurability: two scientists who have undergone the shift and not undergone it cannot fully communicate — they mean different things by the same words.",
  writingDirectives: [
    "The paradigm shift is not a logical proof — it is a gestalt switch. The revolutionary scientist sees the new configuration and cannot unsee it",
    "The resistant scientist has good reasons for resistance — they have decades of knowledge built on the old framework",
    "The incommensurability problem: they are using the same words but meaning different things",
    "The shift produces euphoria in those who make it and threat in those who resist it",
    "Kuhn: the new paradigm is not adopted by convincing the old scientists — it waits for them to die",
  ],
  failureModes: [
    "The resistant scientist is simply wrong and the revolutionary is simply right — the old paradigm was not wrong in its domain",
    "The shift is argued as a logical proof — Kuhn specifically says this is not how paradigm shifts work",
    "The social and generational dimension of paradigm shifts is absent",
    "The revolutionary scientist has no doubt or disorientation — the shift produces both exhilaration and vertigo",
  ],
  systemDirectives: [
    "The shift should be shown as a gestalt experience: the world reorganizing, not a logical conclusion being reached",
    "The resistant scientist's position must be shown as internally coherent within the old framework",
    "The incommensurability must be visible: they are talking past each other with the best intentions",
    "The cost of the shift for both parties — the revolutionary loses their community; the resistant loses their future",
  ],
  writingNotes: "The paradigm shift scene is genuinely dramatic because it is about the limits of rationality, the social construction of knowledge, and the human cost of intellectual revolution. Being right is not enough if you cannot be understood by the people you are trying to convince."
};

export const FEYNMAN_INTEGRITY: ScitechArchetype = {
  name: "Feynman Integrity",
  theoreticalBasis: "Richard Feynman's principles from his 1974 Caltech commencement address (Cargo Cult Science): First principle: 'You must not fool yourself — and you are the easiest person to fool.' The scientist's primary adversary is not external resistance or insufficient funding — it is their own desire for the result to be true. Second principle: 'Science is the belief in the ignorance of experts.' What makes science different from other knowledge systems is institutionalized skepticism toward authority.",
  coreDescription: "The scene where the scientist confronts their own desire to find what they are looking for — their own susceptibility to fooling themselves. The moment where intellectual integrity requires abandoning a result, a hypothesis, or a conclusion they were invested in. The Feynman scientist is not primarily heroic in confronting external opposition; they are heroic in confronting their own motivated reasoning.",
  paradigmPosition: "Independent of paradigm phase — Feynman integrity is a personal epistemic virtue that operates at every scale",
  epistemicState: "The scientist is aware, or becomes aware, of their own motivated reasoning — their desire for a specific result is affecting their reading of the evidence.",
  dramaticEngine: "The personal cost of genuine intellectual integrity: the result that must be abandoned, the career advantage that must be refused, the collaboration that must be questioned.",
  writingDirectives: [
    "The Feynman scientist's integrity is tested by their own desires, not primarily by external opponents",
    "The self-deception is usually not conscious — it operates as the subtle shading of what data counts and how it is read",
    "The cost of integrity must be real: something is given up, some advantage refused, some relationship strained",
    "The scientist who achieves Feynman integrity in this scene has paid a genuine price for it",
    "The scientist who fails the Feynman test is not evil — they are human, doing what all humans do with their desires",
  ],
  failureModes: [
    "The Feynman scientist's integrity is tested by obvious external villains rather than by their own motivated reasoning",
    "The self-deception is conscious — Feynman integrity is specifically about the unconscious forms",
    "There is no cost — genuine integrity without cost is not integrity, it is easy virtue",
    "The failure of Feynman integrity is depicted as moral weakness rather than universal human tendency",
  ],
  systemDirectives: [
    "Identify specifically what the scientist wants the result to be — this is the source of the self-deception risk",
    "The self-deception should be subtle and initially invisible: a choice about which data to emphasize, how to frame a result",
    "The moment of recognition — 'I was fooling myself' — should come with genuine surprise",
    "The cost must be real and specific: something is given up because the integrity was maintained",
  ],
  writingNotes: "The Feynman integrity scene is the antidote to the scientist-hero narrative where integrity simply means refusing corrupt funding or external pressure. The harder integrity is internal: the data that confirms what you hoped to find, the result you built your career on."
};

export const TECHNOLOGY_AS_CHARACTER: ScitechArchetype = {
  name: "Technology as Character",
  theoreticalBasis: "Marshall McLuhan's Understanding Media (1964): 'the medium is the message' — the form of a medium embeds itself in any message it conveys. Technology is not a neutral tool — it shapes the people who use it and the social relations it mediates. Winner's 'Do Artifacts Have Politics?' (1980): technologies embody specific social relations, power structures, and values. The printing press did not neutrally transmit ideas — it reorganized the social conditions of knowledge production.",
  coreDescription: "The scene in which the technology is not a tool but an agent — shaping what is possible, what is thinkable, what relationships are available. The technology as character has its own logic, its own demands, its own way of organizing the humans around it.",
  paradigmPosition: "Technology exists within and between paradigms — often, new technology forces the paradigm question by producing data the existing framework cannot accommodate",
  epistemicState: "The character who works with a technology is partly shaped by that technology — their habits of mind, their categories of analysis, their expectations of what counts as a result have all been formed by their tool's logic",
  dramaticEngine: "The gap between what the character thinks the technology is for and what the technology is actually doing. The moment when the technology's demands exceed what the character can provide.",
  writingDirectives: [
    "The technology has specific material requirements and specific effects — write both, not just the purpose",
    "The character's relationship with their tools is a relationship — it has history, dependency, and mutual shaping",
    "The technology that fails reveals what was always present in it — its specific fragility, its specific demands",
    "What the technology makes possible also defines what it makes impossible — both must be present",
    "McLuhan: the technology is shaping the character even when they are shaping the technology",
  ],
  failureModes: [
    "The technology is a neutral tool that characters use without being shaped by",
    "The technology's failure or success is the only thing that happens — the character's relationship to the tool is absent",
    "The technology is magic — it produces results without material conditions, costs, or failures",
    "The specific logic of this technology (not technology in general) is absent",
  ],
  systemDirectives: [
    "Define the technology's specific logic: what does it require, what does it refuse, what errors does it produce and why?",
    "The character's expertise should be visible in their specific relationship to the specific tool",
    "At least one moment where the technology's demands exceed or reshape what the character intended",
    "The technology's material conditions — maintenance, failure modes, dependencies — must be present",
  ],
  writingNotes: "The most interesting technology scenes are the ones where the relationship between character and tool is genuinely reciprocal. The ship captain who thinks like a ship. The programmer who thinks like their language. The technology is not neutral — it has been shaping the character for as long as the character has been using it."
};
