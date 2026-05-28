// src/lib/mystery/archetypes/all-mystery.ts
import type { MysteryArchetype } from "../types";

export const CLUE_PLANTING: MysteryArchetype = {
  name: "Clue Planting",
  theoreticalBasis: "Knox's fair-play contract: every clue must be available to the reader before the solution is revealed. The reader and author play by the same rules. The clue cannot be withheld. Brewer & Lichtenstein curiosity structure: the reader is working backward from an outcome. Each planted clue is a piece of the causal chain they are assembling.",
  coreDescription: "The craft of making the crucial visible without making it obvious. The clue lives in the sentence that reads as description. It is present, verifiable in retrospect, and invisible on first read because the reader's attention is legitimately elsewhere.",
  fairPlayRequirement: "The clue must appear in the scene before the solution. It cannot be introduced in the resolution chapter. The reader must have had access to it. If the reader re-reads the scene after the reveal, the clue must be unambiguously present.",
  misdirectionMechanic: "Macknik's covert attention field: the clue occupies the background of the reader's attention while something else occupies the foreground. The detective notices the absence of dog hairs on the coat while the reader is focused on the coat's owner. The clue and the misdirection occupy the same sentence.",
  informationStructure: "The clue is known to the scene — it exists in the physical world of the scene — but its significance is not. The reader sees it the way the detective initially does: without knowing what it means. The meaning comes later.",
  plantingRules: [
    "The clue lives in a sentence that reads as setting or character description, not as 'important detail'",
    "Surround the clue with irrelevant-seeming details at the same level of specificity",
    "The clue must be specific — not 'she wore a hat' but the specific hat that matters",
    "Never follow the clue sentence with a reaction from the POV character that flags its importance",
    "The reader should be able to find it on re-read and think 'of course — it was there'",
  ],
  revelationMechanics: "In the solution scene, the detective returns to the clue and names its significance — but the reader must recognize it as something they saw. The moment of 'oh — the hat' is the reader's pleasure. Deny them the recognition and you deny them the genre's core satisfaction.",
  failureModes: [
    "The clue is followed by a reaction that flags its importance — the POV character notices it as significant",
    "The clue is introduced in the solution scene for the first time — violation of fair play",
    "The clue is so obscure that the reader could not have noticed it even in good faith",
    "Multiple clues are planted in the same sentence — the reader knows one of them matters",
    "The narrator says 'she noticed the detail but thought nothing of it' — direct flag",
  ],
  systemDirectives: [
    "Place the clue in a description sentence alongside two or three irrelevant details at equal specificity",
    "No POV reaction to the clue that differs from reaction to the surrounding details",
    "The clue must be specific enough to be recalled — not 'some object' but the exact object",
    "The clue must be present in the scene before the solution chapter — no retroactive planting",
    "Write the clue sentence last, then surround it with equally specific irrelevancies",
  ],
  writingNotes: "The best-planted clues are hiding in plain sight inside the sentences that feel most like atmosphere. 'The room smelled of pine cleaner, last week's newspaper, and something she couldn't name' — the something she couldn't name is the clue. The reader registers it and files it as unresolved. When the reveal arrives, the recognition is the pleasure.",
};

export const RED_HERRING: MysteryArchetype = {
  name: "Red Herring",
  theoreticalBasis: "Macknik & Martinez-Conde (2010) overt misdirection: a stimulus that captures gaze and conscious attention, pulling it away from the actual site of the deception. In mystery, the red herring is the false suspect, the false trail, the false motive — it captures the reader's logical inference engine and directs it productively away from the real solution.",
  coreDescription: "The red herring is not a lie. It is a truth that points in the wrong direction. The false suspect really did have a motive. The false trail really does lead somewhere. The red herring must be genuinely plausible — a guess that a reasonable reader would make — or it fails as misdirection and becomes a waste of the reader's time.",
  fairPlayRequirement: "The red herring must be resolvable — the reader must be able to understand, at the solution, why the false trail existed and why it was wrong. Knox: the solution cannot depend on accident. The red herring's falsity must be explicable by evidence already in the story.",
  misdirectionMechanic: "Macknik's overt attention capture: give the reader something compelling to look at. The false suspect must be more interesting, more obviously guilty-seeming, more narratively satisfying as a target than the real culprit. The reader follows because the herring is the better story — until it isn't.",
  informationStructure: "The red herring exploits the reader's tendency to form hypotheses early and test evidence against them rather than generate new hypotheses. Once the reader has settled on a suspect, confirming evidence accumulates and disconfirming evidence is rationalized. The red herring is designed to feed this confirmation bias.",
  plantingRules: [
    "The red herring suspect must have a real motive and a real opportunity — not a fabricated one",
    "Evidence pointing at the red herring must be genuinely ambiguous, not false",
    "The red herring must be more interesting than the real culprit — better story, stronger apparent motive",
    "The resolution of the red herring must be satisfying: we understand why they seemed guilty",
    "Never have the detective dismiss the red herring too quickly — it must absorb real investigation time",
  ],
  revelationMechanics: "The red herring is resolved before the real solution — the reader learns the false suspect is innocent, usually with a moment of 'then who?' before the real clues consolidate. This reset is the genre's second pleasure after the final revelation.",
  failureModes: [
    "The red herring suspect is obviously not guilty from the first scene — no genuine misdirection",
    "The red herring is resolved by the detective dismissing it arbitrarily rather than through evidence",
    "The red herring's motive is fabricated rather than real — violates fair play",
    "Too many red herrings — the reader stops investing in any hypothesis",
    "The red herring is forgotten rather than resolved — the reader notices",
  ],
  systemDirectives: [
    "The red herring suspect must have a stronger apparent motive than the real culprit",
    "Plant at least two pieces of genuine evidence that support the false hypothesis",
    "The red herring must be resolved — the reader must understand why it was wrong",
    "The resolution of the red herring must arrive before the final reveal, not simultaneously",
    "Let the detective pursue the red herring seriously — time spent, deductions made",
  ],
  writingNotes: "The red herring works when the reader is rooting for it. The false suspect is more compelling, the motive more satisfying, the narrative tidier if they did it. When the herring is resolved and the real culprit is revealed, the better story turns out to be the one the reader wasn't watching. That is the mystery genre's specific pleasure.",
};

export const ALIBI_CONSTRUCTION: MysteryArchetype = {
  name: "Alibi Construction",
  theoreticalBasis: "The witness problem in epistemology: multiple observers of the same event produce different accounts. Memory is reconstructive (Loftus, 1974) — witnesses fill gaps with inference. Applied to mystery: the alibi scene presents the same time period through multiple accounts that cannot all be true, or through a single account whose reliability is in question.",
  coreDescription: "The alibi scene is a puzzle of time, location, and witness reliability. Someone claims to have been elsewhere. One or more witnesses confirm this. The detective must determine whether the alibi holds — and the reader must have enough information to make their own assessment.",
  fairPlayRequirement: "The flaw in the alibi must be derivable from information available to the reader. The witness whose testimony is wrong must have said something the reader noticed. The timing discrepancy must be calculable from the chapter's own internal time.",
  misdirectionMechanic: "The false alibi works by exploiting the social contract: we trust witnesses who have no apparent motive to lie. The strongest false alibis are provided by witnesses who believe they are telling the truth. The flaw is not in their honesty but in their perception.",
  informationStructure: "Present the alibi through the alibi-provider's own account first, then through the witnesses, then through the physical evidence. The reader assembles these three sources and the discrepancy emerges from the assembly.",
  plantingRules: [
    "The alibi must be almost perfect — one specific flaw, not multiple obvious ones",
    "The flaw must be something the reader could calculate from the scene's own time/space information",
    "The witness must have a reason to believe what they're saying — not conscious deception",
    "The physical evidence that disproves the alibi must appear in the scene before the solution",
    "The alibi-giver must be convincing enough that the reader considers it plausible",
  ],
  revelationMechanics: "The alibi is broken by the detective identifying the single specific flaw: the time that cannot be reconciled, the physical impossibility, the witness who was wrong about what they saw. The reader should be able to say 'I could have seen that.'",
  failureModes: [
    "The alibi has multiple obvious flaws — too easy to break, no real tension",
    "The alibi is broken by information introduced only in the solution scene",
    "The witness is obviously lying — the reader knows immediately there is no alibi tension",
    "The timing discrepancy cannot be calculated from the available information",
    "The alibi is forgotten and not addressed in the solution",
  ],
  systemDirectives: [
    "Present the alibi through at least two sources: the person giving it and at least one witness",
    "The single flaw must be calculable — include the timing, distance, or physical detail that makes it possible",
    "The witness must be credible and apparently sincere",
    "Do not have the detective immediately identify the flaw — let the alibi stand for at least a scene",
    "The physical evidence contradicting the alibi must appear before the solution chapter",
  ],
  writingNotes: "The best alibi scenes are the ones where the reader believes the alibi until the moment they don't. The detective asks the witness 'what time did they arrive?' The witness says 'seven.' The detective asks no follow-up. The reader doesn't flag it. Later: the train from the station where the murder occurred takes forty minutes. The seven o'clock arrival is impossible. The reader re-reads the witness scene. It was there.",
};

export const REVELATION_SCENE: MysteryArchetype = {
  name: "Revelation Scene",
  theoreticalBasis: "Brewer & Lichtenstein curiosity resolution: the reader has been working backward from the outcome. The revelation scene completes the causal chain. Knox's contract: the solution must emerge from the clues that were present, not from information withheld. The revelation scene is the genre's promise kept.",
  coreDescription: "The scene where the detective names the solution and demonstrates how the evidence leads to it. Every clue that was planted must be accounted for. Every red herring must be explained. The revelation must feel both surprising and inevitable — surprising because the reader didn't see it, inevitable because the evidence was always there.",
  fairPlayRequirement: "The revelation cannot introduce new evidence. It can only show the significance of evidence the reader already has. If the detective names a new fact in the revelation scene that was not available before, Knox's contract is broken.",
  misdirectionMechanic: "The revelation inverts the misdirection: everything the reader was looking at (the red herring, the obvious suspect) is shown to be the cover. Everything in the background (the planted clues) is shown to be the foreground. The reader's attention map is flipped.",
  informationStructure: "Revelation structure: name the solution — return to each clue and show its significance — explain each red herring — account for the motive — demonstrate the opportunity. This order ensures the reader can track the logic.",
  plantingRules: [
    "Account for every significant clue that was planted — if it was planted, it must appear in the revelation",
    "Explain every red herring — the reader needs to understand why it was wrong",
    "The motive must be explicable from character information that was available",
    "The revelation cannot introduce new facts — only new significance for old facts",
    "The detective must be wrong about at least one thing before arriving at the solution — omniscience is unconvincing",
  ],
  revelationMechanics: "Begin with the conclusion (I know who did it), then demonstrate the chain of evidence in chronological order of the crime (not the investigation). The reader should experience the crime unfolding for the first time as the detective describes it — and recognize each element from the planted clues.",
  failureModes: [
    "New information introduced in the revelation scene — fair play violation",
    "Red herrings not accounted for — the reader remembers them",
    "The motive depends on character psychology that was not established",
    "The revelation proceeds too quickly — the reader cannot track the logic",
    "The detective is never wrong — the solution arrives without a prior false path",
  ],
  systemDirectives: [
    "Begin with the conclusion, then demonstrate the evidence chain",
    "Account for every planted clue — name it and show its significance",
    "Explain every red herring — why it pointed away from the real solution",
    "No new facts — only new significance for facts already in the story",
    "Include one moment where the detective acknowledges what they got wrong first",
  ],
  writingNotes: "The revelation scene's pleasure is recognition. The reader hears the detective name the significance of the hat in chapter three and thinks — I read that sentence. I could have known. That gap between 'I could have known' and 'I didn't know' is the genre's central experience. The reader who is angry at themselves for missing it has had the best possible mystery experience.",
};

export const MISDIRECTION: MysteryArchetype = {
  name: "Misdirection",
  theoreticalBasis: "Macknik & Martinez-Conde (2010): professional misdirection operates on two levels simultaneously. The magician shows you something with one hand while the other hand does the real work. The key finding: the most effective misdirection directs attention using the same cognitive tools the viewer is using to detect the deception. Applied to mystery: the reader is actively looking for the deception, and the misdirection exploits that very act of looking.",
  coreDescription: "The deepest misdirection in mystery is not the false suspect or the red herring — it is the structural deception. The chapter that feels like it is about one thing while actually being about another. The scene whose real function is invisible because its apparent function is so legible. The reader who is reading for clues is the most susceptible to a scene that looks like a clue and is something else entirely.",
  fairPlayRequirement: "The misdirection must not hide information that the reader is entitled to. Knox: the detective cannot have knowledge the reader doesn't have access to. Misdirection can redirect attention — it cannot withhold the object of attention entirely.",
  misdirectionMechanic: "The active reader: a mystery reader is searching for significance in everything. They over-weight details that seem significant and under-weight details that seem atmospheric. The misdirection writes the atmospheric details as if they are significant (specific, named, foregrounded) and writes the genuinely significant details as if they are atmospheric (vague, unnamed, backgrounded).",
  informationStructure: "The misdirection scene presents two layers: the layer the reader is watching (apparently significant, actually irrelevant) and the layer the reader isn't watching (apparently irrelevant, actually the key). The reader must have access to both layers — misdirection is not concealment.",
  plantingRules: [
    "Write the apparently-significant layer with the specificity readers associate with clues",
    "Write the actually-significant layer with the vagueness readers associate with atmosphere",
    "The reader must have access to the actually-significant layer — it must be in the text",
    "The apparently-significant layer must resolve into irrelevance — not disappear",
    "The misdirection works once per scene; reuse in the same chapter breaks the spell",
  ],
  revelationMechanics: "The misdirection resolves when the reader re-reads and notices the layer they weren't watching. The best revelation is the one where the reader reads the apparently-atmospheric sentence again and realizes it was the most important sentence in the chapter.",
  failureModes: [
    "The actually-significant layer is completely absent — this is concealment, not misdirection",
    "The apparently-significant layer is too obviously a plant — the reader is suspicious of it",
    "The misdirection is not resolved — the reader never learns what they missed",
    "The same misdirection technique is used multiple times in the same chapter",
    "The apparently-significant layer is resolved as meaningless without explanation",
  ],
  systemDirectives: [
    "Write one apparently-significant detail at high specificity that is actually irrelevant",
    "Write the actually-significant detail at low specificity in the same scene",
    "Both layers must be present and accessible — misdirection is not hiding",
    "Resolve the apparently-significant layer before the final reveal",
    "The re-readable sentence — the one that contains the real clue — must be in the scene",
  ],
  writingNotes: "The highest form of mystery misdirection is the sentence the reader reads twice, once going forward and once going backward, and means different things each time. Going forward: 'The flowers on the hall table were beginning to wilt.' Atmospheric. Going backward: 'The flowers were cut three days ago — the same day the gardener says he was dismissed.' The sentence didn't change. The reader changed.",
};
