import type { DialogueArchetype } from "../types";

export const ARGUMENT: DialogueArchetype = {
  name: "Argument",
  description: "Two or more characters in direct conflict. Not necessarily shouting — the most devastating arguments are cold and precise. What matters is that both parties want something incompatible, and neither is willing to concede it.",
  underlyingConflict: "The surface argument is never the real argument. Characters fight about dishes when they mean they feel unseen. They argue about money when they mean they have different values. The real conflict lives one level below what is being said. Identify it and let every surface line carry its weight.",
  powerDynamic: "Arguments are not static — power shifts. The character who opened from strength often ends weaker. The one who seemed to be losing often finds the single line that changes everything. Track who has the power after each exchange and mark the moment it transfers.",
  sceneStructure: "Opening position (both state their case) — First attack (one escalates, the other absorbs) — Counterattack (the absorbing character fights back, harder) — Revelation (something true is said that cannot be unsaid) — New state (the relationship is different now — worse, closer, or permanently changed).",
  subtextRules: [
    "Every line that attacks is actually a defense. Characters attack when they are frightened.",
    "The thing a character refuses to say is more important than what they say.",
    "People in arguments often answer a question that wasn't asked — they answer the question they're afraid of.",
    "Apologies in arguments are almost never real — they are tactical retreats or further provocations.",
    "The loudest line is rarely the most damaging. The quiet line that arrives after the shouting is.",
  ],
  rhythmPattern: "Arguments have a breathing pattern: escalation (lines get shorter, faster), plateau (both characters at peak volume/intensity), puncture (one line that changes the temperature). After puncture, lines slow again. The scene should never stay at peak intensity for more than 3–4 exchanges before something shifts.",
  openingPrinciple: "Never start an argument scene with the argument already in progress. Start in the moment before — the ordinary moment that the argument will rupture. The contrast between the ordinary opening and the first real line of conflict is where the scene's power lives.",
  escalationMechanics: "Each exchange should raise the stakes by introducing something new: a fact that was hidden, a feeling that was denied, a memory that was buried. The argument escalates not because voices get louder but because the territory of what is being fought over keeps expanding.",
  breakingPoint: "The revelation — the moment when something true and irreversible is said. It can be an accusation, a confession, an admission of defeat, or a cruelty. After the breaking point, the characters cannot pretend they didn't say it. The breaking point is what the whole scene was building toward.",
  failureModes: [
    "Both characters say exactly what they mean — no subtext, no deflection, no circling.",
    "The argument is resolved logically — one person makes a good point and the other concedes.",
    "Both characters have the same rhythm and vocabulary — identical voices.",
    "The argument escalates by repetition (saying the same thing louder) rather than by revelation.",
    "The breaking point is telegraphed — the reader sees it coming long before it arrives.",
    "The scene ends with the conflict resolved — real arguments rarely resolve in the scene.",
  ],
  systemDirectives: [
    "Never let a character say what they actually mean in the first half of the scene.",
    "Give each character a different sentence length and rhythm — one speaks in short bursts, one in longer defensive explanations.",
    "Include at least one moment where a character answers a question that wasn't asked.",
    "The power must transfer at least once — identify who holds it at the start and make sure it is different by the end.",
    "End the scene in a new state, not a resolved state — the relationship after the argument is different from before it.",
  ],
  writingNotes: "The most powerful arguments in fiction are the ones the reader recognizes — not because they have had this specific fight, but because they have felt this specific pain. Keep the surface stakes domestic or trivial; the real stakes should feel enormous. A fight about who forgot to buy milk can carry the weight of a failing marriage.",
};
