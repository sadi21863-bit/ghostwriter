// src/lib/dialogue/archetypes/argument.ts — UPGRADED with psychological layer
import type { DialogueArchetype } from "../types";

export const ARGUMENT: DialogueArchetype = {
  name: "Argument",
  description: "Two or more characters in direct conflict. Not necessarily shouting — the most devastating arguments are cold and precise. What matters is incompatible wants and unwillingness to concede.",
  underlyingConflict: "The surface argument is never the real argument. Characters fight about dishes when they mean they feel unseen. Identify the real conflict one level below what is being said.",
  powerDynamic: "Arguments are not static — power shifts. The character who opened from strength often ends weaker. Track who has power after each exchange and mark the moment it transfers.",
  sceneStructure: "Opening positions — First attack — Counterattack — Revelation (something true said that cannot be unsaid) — New state (relationship different).",
  subtextRules: [
    "Every line that attacks is actually a defense — characters attack when frightened.",
    "The thing a character refuses to say is more important than what they say.",
    "People answer the question they're afraid of, not the one that was asked.",
    "Apologies in arguments are tactical retreats, not genuine.",
    "The loudest line is rarely the most damaging.",
  ],
  rhythmPattern: "Breathing pattern: escalation (lines shorter, faster) — plateau (peak intensity) — puncture (one line changes temperature). Never sustain peak intensity for more than 3–4 exchanges.",
  openingPrinciple: "Never start with the argument already in progress. Start in the ordinary moment that the argument will rupture. The contrast between ordinary opening and first real line is where power lives.",
  escalationMechanics: "Each exchange raises stakes by introducing something new: a hidden fact, a denied feeling, a buried memory. Arguments escalate through revelation, not volume.",
  breakingPoint: "The revelation — moment when something true and irreversible is said. After this, neither character can pretend they didn't say it.",
  failureModes: [
    "Both characters say exactly what they mean — no subtext, no deflection, no circling.",
    "Argument resolved logically — one makes good point, other concedes.",
    "Both characters have same rhythm and vocabulary.",
    "Escalates by repetition rather than revelation.",
    "Scene ends with conflict resolved.",
  ],
  systemDirectives: [
    "Never let a character say what they actually mean in the first half.",
    "Give each character different sentence length and rhythm.",
    "Include at least one moment where a character answers a question not asked.",
    "Power must transfer at least once.",
    "End in a new state, not a resolved state.",
  ],
  writingNotes: "The most powerful arguments in fiction are the ones the reader recognizes — not the specific fight but the specific pain. Keep surface stakes trivial; real stakes enormous.",

  psychological: {
    partyAState: "sympathetic",
    partyBState: "sympathetic",
    stateShift: "Both begin in sympathetic. As the revelation approaches, one party may momentarily drop to dorsal vagal (shutdown, the person who goes quiet and still) while the other escalates further into sympathetic. The person who goes quiet is usually the more dangerous one — the dorsal vagal drop in the middle of an argument signals that the person has passed through rage into a different territory.",

    partyAVoice: {
      pitch: "Elevated — sympathetic activation raises the larynx. In high argument, voice becomes slightly harsh.",
      rate: "Accelerating — the fight shortens the gaps between thoughts.",
      volume: "Elevated then variable — the volume pattern traces the emotional pattern.",
      prosody: "Degraded — the modulation that makes speech socially readable breaks down. Words that should be stressed aren't; pauses fall in wrong places.",
      breathSupport: "Audible, effortful — the body is working at elevated output.",
    },
    partyBVoice: {
      pitch: "Same elevated signature — unless Party B has shifted to dorsal vagal, in which case pitch drops unnaturally and volume goes very quiet.",
      rate: "Either accelerating with Party A, or suddenly slowing (the dorsal vagal drop). The contrast between the rates marks the power shift.",
      volume: "Dropping voice mid-argument is often more frightening than raised voice — it signals something has changed.",
      prosody: "The person who has moved past the surface argument speaks with flat, abnormal prosody — the system is prioritizing content over social signaling.",
      breathSupport: "If Party B has gone cold: the breath becomes controlled and deliberate — they are choosing every word.",
    },

    activeFacsSignals: [
      "Both: AU4 (brow lowerer) sustained throughout — the focused threat engagement",
      "AU23 (lip tightener) + AU24 (lip pressor) = the mouth controlling words it wants to say",
      "The attacked party: AU17 (chin raiser) appears underneath the anger — the hurt underneath the fight",
      "AU5 (upper lid raiser) when someone says something that lands: the eyes widen involuntarily at impact",
      "Suppressed crying tells: AU17 + jaw rigidity = someone fighting back tears during an argument",
    ],

    somaticPresence: "Both characters: elevated heart rate audible to them (in the ears, the throat). Hands that want to move — gesturing or gripping. The jaw of one character held deliberately shut. The somatic marker of the argument's real subject is often in the gut: nausea that arrives before the character recognizes what they are really fighting about.",

    informationDynamics: {
      structure: "suspense",
      readerKnows: "What the argument is really about — the real conflict beneath the surface. Reader sees this before the characters name it.",
      characterKnows: "Each character knows their own real grievance but not fully the other's. They may not know their own.",
      gap: "The real subject. Every exchange that argues about the surface widens the gap. The breaking point arrives when the real subject finally enters the room.",
    },

    psychologicalDirectives: [
      "Write the AU17 underneath the anger: the chin dimple of suppressed hurt appearing during the fight.",
      "Write the controlled jaw — the person who has gone cold and is now choosing every word.",
      "The nausea that arrives before the character knows what they're really fighting about.",
      "At least one involuntary voice pitch change — the body escalating before the character decides to.",
      "The hands: what are they doing throughout. Not generic gesturing but the specific posture of this person's anger.",
    ],
  },
};
