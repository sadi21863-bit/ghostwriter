// src/lib/ethics/archetypes/all-ethics.ts
import type { EthicsArchetype } from "../types";

export const MORAL_DUMBFOUNDING: EthicsArchetype = {
  name: "Moral Dumbfounding",
  theoreticalBasis: "Jonathan Haidt's Social Intuitionist Model (The Righteous Mind, 2012): the rationalist model of ethics is wrong. Humans do not encounter a moral situation — reason about it — reach a conclusion. The actual process: encounter a moral situation — immediately reach a moral judgment through emotional intuition — construct post-hoc rationalizations for the judgment already made. Evidence: subjects have strong, stable moral reactions to harmless scenarios but cannot identify any rational principle to explain the reaction. When their justifications are countered, they maintain the judgment while acknowledging they cannot justify it.",
  coreDescription: "The scene where a character has a powerful moral conviction they cannot rationally justify. They know it is wrong — whatever 'it' is — with visceral certainty. And when their reasoning is challenged and dismantled, the conviction remains. This is not stupidity or dogmatism; it is the documented structure of human moral psychology.",
  foundationsInConflict: "Sanctity/Degradation primary — the violation of something sacred that cannot be quantified. Often Care/Harm in conflict: the harm seems zero but the feeling of wrongness remains.",
  intuitionMechanism: "The moral intuition arrives as a bodily response before any reasoning begins. Disgust, revulsion, a feeling of wrongness that has no locatable source. The reasoning comes after, to explain the already-established conviction.",
  remainderPotential: "High — the inability to justify the intuition creates a specific discomfort: the character knows they cannot win the argument but also cannot stop feeling what they feel.",
  writingDirectives: [
    "The moral conviction must arrive in the body first — not as a thought but as a felt response",
    "The character's inability to justify the intuition is not a failure — it is the accurate description of how moral intuition works",
    "When the character's argument is countered, the conviction should remain intact — the argument's defeat does not defeat the intuition",
    "The opponent who wins the argument is not necessarily right — Haidt specifically shows this",
    "The character's discomfort at being unable to justify what they feel must be present",
  ],
  failureModes: [
    "The character's intuition is shown as simply wrong because it cannot be rationalized",
    "The character abandons their position when their argument is refuted — this is the rationalist model Haidt overturns",
    "The moral conviction is presented as irrational without acknowledging that the intuition-first model may be more accurate",
    "The 'dumbfounding' is treated as embarrassment rather than as the actual structure of moral psychology",
  ],
  systemDirectives: [
    "The moral conviction arrives before any reasoning — write the bodily/emotional response first",
    "The character cannot fully articulate why they feel what they feel — the intuition precedes the vocabulary",
    "When the argument fails, the conviction persists — this is not irrationality, this is moral psychology",
    "The other character's victory in the argument does not resolve the scene morally",
  ],
  writingNotes: "The moral dumbfounding scene is the most honest available scene about how human moral judgment actually works. It overturns the rationalist assumption that moral positions are won by arguments. A character who cannot be argued out of their moral conviction is not being unreasonable. They are being human."
};

export const FOUNDATION_CONFLICT: EthicsArchetype = {
  name: "Foundation Conflict",
  theoreticalBasis: "Haidt and Graham's Moral Foundations Theory: six innate psychological systems compose human moral intuition — Care/Harm, Fairness/Cheating, Loyalty/Betrayal, Authority/Subversion, Sanctity/Degradation, Liberty/Oppression. Different people activate these foundations in different configurations. Key insight: this is not a statement about who is more moral — it is a finding about which moral dimensions each person weights most heavily. Characters with different foundation profiles are not in a factual dispute; they are experiencing different things as morally significant.",
  coreDescription: "Two characters in genuine moral conflict — not because one is right and one is wrong but because they are activating different moral foundations. What one character experiences as morally obvious, the other experiences as morally neutral or irrelevant. They are not debating; they are speaking from inside partially different moral worlds.",
  foundationsInConflict: "Variable — the specific foundations in conflict should be established for each scene. Common conflicts: Care vs. Loyalty (protect the individual vs. protect the group), Fairness vs. Authority (equal treatment vs. legitimate hierarchy), Liberty vs. Sanctity (individual freedom vs. the sacred and inviolable).",
  intuitionMechanism: "Each character's moral intuition is automatic and involuntary — they feel the moral significance of their foundations as obvious, and the other's foundations as either less important or actively wrong. The conversation is genuinely cross-purpose.",
  remainderPotential: "Very high — foundation conflicts are often irresolvable because they involve different fundamental values rather than different assessments of the same value.",
  writingDirectives: [
    "Each character's moral position must be shown as internally coherent and genuine — there is no straw man",
    "The conflict should be between foundations, not between a reasonable and an unreasonable position",
    "Neither character should be able to fully understand why the other sees what they see — the foundations create different moral perceptions",
    "The argument proceeds past the point where evidence could resolve it — because the disagreement is about which values matter most",
    "Haidt: the argument that lands is the one that activates a competing intuition — not the logical proof",
  ],
  failureModes: [
    "One character's foundation is clearly correct and the other's is clearly wrong",
    "The foundation conflict is resolved through logical argument — this misrepresents how foundation conflicts work",
    "Both characters share the same foundation profile but appear to disagree — the conflict is not genuine",
    "The foundations in conflict are not identified — the disagreement seems arbitrary rather than structurally motivated",
  ],
  systemDirectives: [
    "Establish both characters' foundation profiles before writing — which foundations does each weight most?",
    "Each character's argument must be internally coherent from their own foundation profile",
    "The gap between their foundation profiles must create a genuine impossibility of full mutual understanding",
    "The scene must end without the conflict being resolved — foundation conflicts are not resolved by argument",
  ],
  writingNotes: "The foundation conflict is the antidote to the debate scene where one character is right and wins. Haidt's framework reveals why the most persistent moral conflicts in both real life and fiction are not about facts — they are about which moral dimensions are weightiest."
};

export const MORAL_REMAINDER: EthicsArchetype = {
  name: "Moral Remainder",
  theoreticalBasis: "Bernard Williams, 'Ethical Consistency' (1965): when a genuine moral dilemma is resolved, the unchosen option does not simply disappear. It leaves a remainder — the residue of the moral obligation that was not fulfilled. The moral remainder is the appropriate response to having failed to meet a genuine moral obligation, even when that failure was the best available option. Williams distinguishes this from agent-regret: the specific form of regret appropriate to having been the agent of something unfortunate, even if the action was right.",
  coreDescription: "The scene after the right choice — the scene that shows what the right choice cost. The character made the correct decision by any defensible ethical standard, and they are still carrying the weight of the obligation they could not fulfill. The moral remainder is not self-flagellation; it is the honest acknowledgment that genuine dilemmas leave genuine wreckage.",
  foundationsInConflict: "Any two genuine foundations — the moral remainder is produced whenever two real obligations conflict and one must be sacrificed",
  intuitionMechanism: "The moral remainder is felt in the body after the decision, not during it. The specific sadness about the specific person who was not saved, the specific regret about the obligation not fulfilled — these are not signs of error but of moral seriousness.",
  remainderPotential: "Maximum — the moral remainder is the archetype specifically about this residue",
  writingDirectives: [
    "The character made the right choice — this is not about guilt for the wrong decision",
    "The moral remainder is specific: the name, the face, the claim that was real and could not be fulfilled",
    "The remainder persists — it should not be resolved within the scene",
    "Williams' agent-regret: the character regrets their role in the outcome even though they chose correctly",
    "The character who has no moral remainder after a genuine dilemma is either morally insensitive or has not fully understood the weight of what was sacrificed",
  ],
  failureModes: [
    "The moral remainder is treated as evidence the character made the wrong choice",
    "The remainder resolves — the character comes to terms with it and moves on within the scene",
    "The character's regret is about guilt for wrongdoing rather than grief for the unmet obligation",
    "The dilemma was not genuine — one option was clearly correct, so there is no remainder",
  ],
  systemDirectives: [
    "Establish that the choice was correct — the remainder is not about error",
    "Name and individualize the unmet obligation: not 'someone was not saved' but who specifically",
    "The remainder is a body state: the specific feeling of having done the right thing and still carrying what the right thing cost",
    "The scene ends without resolution — the remainder persists past the scene's boundaries",
  ],
  writingNotes: "The moral remainder scene is the most sophisticated available scene about ethical life because it takes seriously something the trolley-problem tradition tends to ignore: the weight of what was not chosen. The doctor who made the correct triage decision carries the specific face of the patient who was not treated. This carrying is not weakness — it is the evidence of moral seriousness."
};

export const POST_HOC_RATIONALIZATION: EthicsArchetype = {
  name: "Post-Hoc Rationalization",
  theoreticalBasis: "Haidt's Social Intuitionist Model and the lawyer analogy: the reasoning mind is not a judge, reaching a verdict after impartial review of evidence. It is a lawyer, whose client (the intuition) has already decided and who now constructs the most convincing available case for the pre-established conclusion. Confirmation bias, motivated reasoning, and the post-hoc construction of ethical arguments all follow from this model. Key finding: people are very good at constructing rationalizations and believe they are reasoning even when they are rationalizing.",
  coreDescription: "The scene where the character believes they are reasoning to a moral conclusion but are actually building a case for what they have already decided. The rationalization is not conscious dishonesty — it is the normal operation of a moral psychology that runs intuition first and reasoning after.",
  foundationsInConflict: "The character's dominant foundation creates an intuition. The conflict is internal: the character's self-image as a rational moral agent vs. the reality of their intuition-first process.",
  intuitionMechanism: "The intuition arrives first and is felt as a moral fact. The character then constructs arguments that they experience as the source of the position rather than the post-hoc support for it. The tell: when their argument is countered, they shift to a different argument — not because they have updated their position but because the intuition remains.",
  remainderPotential: "The character who discovers they have been rationalizing faces a specific crisis of self-understanding.",
  writingDirectives: [
    "The character genuinely believes they are reasoning — the self-deception is complete, not partial",
    "The tell: when one rationalization is countered, they produce another — the intuition remains constant, only the arguments change",
    "The reader should see the rationalization before the character does, if they ever do",
    "The specific intuition driving the rationalization must be identifiable: what is the character actually committed to?",
    "Post-hoc rationalization is normal — it is not a character flaw but a universal tendency",
  ],
  failureModes: [
    "The character knows they are rationalizing — this removes the tragedy",
    "The rationalization is obviously weak — Haidt's finding is that people construct sophisticated rationalizations they find completely convincing",
    "The character updates their position when their argument is defeated — real motivated reasoning does not work this way",
    "Post-hoc rationalization is presented as moral dishonesty rather than as the normal operation of moral psychology",
  ],
  systemDirectives: [
    "Establish the intuition that is being rationalized — what does the character already believe, and why?",
    "The arguments the character makes must be genuinely good — post-hoc rationalization is sophisticated",
    "The tell must be present but subtle: the argument that shifts but the conviction that doesn't",
    "The character's self-image as a rational moral reasoner must be intact throughout — they cannot see what they are doing",
  ],
  writingNotes: "The post-hoc rationalization scene is the scene that most honestly represents how moral discourse actually operates. The tragic version: the character who discovers, too late, that the elaborate reasoning they built to justify a decision was constructed entirely after the decision was already made."
};

export const TRAGIC_CHOICE: EthicsArchetype = {
  name: "Tragic Choice",
  theoreticalBasis: "The philosophical tradition of genuine dilemma — from Sophocles' Antigone through Bernard Williams' moral remainder to Martha Nussbaum, The Fragility of Goodness (1986): some choices are genuinely tragic because they involve the real destruction of something that has genuine value, regardless of which option is chosen. This is different from a trolley problem (where the calculus, however difficult, is in principle resolvable) — a tragic choice is one where the resolution does not make the loss disappear and the moral remainder is structural. Nussbaum: the good life is fragile because it involves commitments that can genuinely conflict.",
  coreDescription: "The scene where every available option involves the genuine sacrifice of something genuinely valuable. Not a puzzle to solve but a situation to survive. The tragic choice cannot be made well — it can only be made. And the making of it costs something that cannot be recovered.",
  foundationsInConflict: "Two or more genuine moral foundations in direct, irresolvable conflict. The specific foundations in conflict determine the specific shape of the tragedy.",
  intuitionMechanism: "In a tragic choice, the intuitions are at war. There is no clear pre-established position — both options have strong moral intuitions supporting them. This is the distinction between a tragic choice (intuitions in conflict) and a rationalized decision (intuition established, argument constructed).",
  remainderPotential: "Maximum and structural — the tragic choice is the source of the largest possible moral remainder because the sacrificed value was genuinely obligatory",
  writingDirectives: [
    "Both options must have genuine moral weight — there is no obviously correct answer",
    "The character cannot get through the choice by reasoning harder — the difficulty is structural",
    "After the choice is made, what was sacrificed must be named and mourned",
    "The character who makes the tragic choice correctly is still carrying something that does not resolve",
    "Nussbaum: the good life includes genuine moral tragedy — being good does not protect from genuine dilemma",
  ],
  failureModes: [
    "One option is secretly better and the scene is about reaching it",
    "The tragic choice is resolved through a third option that the character 'finds' — this defuses the tragedy",
    "The choice is made too easily — genuine tragic choices are physically costly to make",
    "The moral remainder is absent — the character is at peace after the tragic choice",
  ],
  systemDirectives: [
    "Both options must have strong and genuine moral support — establish what each option protects and what it sacrifices",
    "The choice must be genuinely forced — eliminate all third-option solutions before writing the scene",
    "The making of the choice is a physical event: the moment of commitment should register in the body",
    "The scene continues past the choice to show what was lost — the moral remainder is the scene's last movement",
  ],
  writingNotes: "The tragic choice scene is the ultimate test of the writer's commitment to moral seriousness. The temptation is always to provide an escape: the third option, the lucky intervention, the reframing that makes the choice less costly. Nussbaum's insight: the fragility of the good life means that genuine virtue sometimes requires genuine loss."
};
