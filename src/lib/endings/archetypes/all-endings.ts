import type { EndingsArchetype } from "../types";

export const RESOLUTION: EndingsArchetype = {
  name: "Resolution",
  theoreticalBasis: "Kermode's tick-tock model: the ending retroactively makes the beginning mean something. Resolution completes the narrative clock — the tick of the opening finds its tock. Aristotle's catharsis as cognitive clarification (Nussbaum interpretation): the audience gains understanding of what they have witnessed, not merely relief from tension.",
  coreDescription: "The protagonist achieves the stated goal. But a costless resolution is a failed resolution. What must be permanently surrendered, changed, or left behind for the goal to be achieved is as important as the achievement itself. The ending that costs nothing teaches nothing.",
  retroactiveOrganizer: "Every earlier sacrifice and failure now reads as necessary preparation. The reader retroactively upgrades their significance. The ending reveals what the story was actually about.",
  costRequirement: "Something real and irreversible must have been paid. A relationship that cannot return to what it was. A version of the self that no longer exists. A world that has permanently changed. Resolution without cost is wish fulfillment, not story.",
  failureConditions: [
    "The protagonist achieves the goal without meaningful sacrifice",
    "The ending is emotionally satisfying but does not close the thematic question",
    "The cost is temporary or reversible",
    "The ending arrives before the reader has fully understood what was at stake",
  ],
  systemDirectives: [
    "Before writing: what is the permanent cost of this resolution?",
    "The final image should contain both the achievement and its cost simultaneously",
    "Close the thematic question, not only the plot question",
    "The protagonist at the end should be recognizably changed from the protagonist at the start",
  ],
  writingNotes: "The resolution that feels earned is the one where the cost was established early and paid honestly. Readers feel cheated by resolutions that seem easy. They are not wrong: the ease signals that the stakes were never real. The writer who knows what the resolution costs before they write it builds a story in which the cost accumulates correctly across every chapter."
};

export const DEFEAT: EndingsArchetype = {
  name: "Defeat",
  theoreticalBasis: "Aristotle's hamartia: the protagonist's fatal error is not a random misfortune but an expression of their character. The defeat clarifies something about the human condition that victory would conceal. Tragic catharsis as clarification: the audience understands something true about the cost of being this kind of person in this kind of world.",
  coreDescription: "The protagonist fails to achieve the goal. But defeat is only meaningful if the reader understands exactly why — not as bad luck but as the inevitable result of something true about who the protagonist is. The defeat must be clarifying, not merely sad.",
  retroactiveOrganizer: "Every earlier scene retroactively reveals the flaw or force that made defeat inevitable. The reader sees what they should have seen earlier. The defeat is both surprising (they hoped) and inevitable (they understand).",
  costRequirement: "The defeat must carry specific understanding. 'They failed' is not an ending — 'they failed because they could never do the one thing the situation required, and the reader now knows why' is an ending.",
  failureConditions: [
    "The defeat feels like authorial cruelty rather than earned consequence",
    "The reader cannot understand why the defeat happened",
    "The defeat is purely external — no internal failure contributed",
    "Nothing is clarified by the defeat; the reader is only sad",
  ],
  systemDirectives: [
    "The defeat must be explicable: the reader should be able to state exactly why",
    "The final scene should contain the specific moment of understanding — what the protagonist sees, if they see it",
    "A protagonist who understands their defeat and one who does not produce very different endings — choose deliberately",
    "The defeat clarifies the thematic question by answering it negatively",
  ],
  writingNotes: "The defeat ending requires more craft than resolution because it must be earned twice: once as plot consequence and once as thematic statement. The reader who closes the book on a defeat ending should feel something more complex than sadness — they should feel that they understand something they did not understand before."
};

export const PYRRHIC: EndingsArchetype = {
  name: "Pyrrhic",
  theoreticalBasis: "Pyrrhus of Epirus: 'One more such victory and I am undone.' The goal achieved but at a cost greater than the goal was worth. Bernard Williams' moral remainder: even the right choice leaves residue. The most sophisticated ending available to literary fiction because it refuses the binary of resolution/defeat.",
  coreDescription: "The protagonist achieves the stated goal and loses something greater in doing so. The achievement is real. The loss is real. Neither cancels the other. The reader holds both simultaneously and must determine their own verdict on whether the cost was worth it.",
  retroactiveOrganizer: "What was being slowly lost throughout the narrative is now gone. The reader retroactively re-reads every earlier scene as both progress toward the goal and erosion of the thing that mattered more.",
  costRequirement: "The lost thing must have been established as genuinely valuable — not as abstract loss but as something the reader specifically cared about. The cost must exceed the gain in a way the reader can feel.",
  failureConditions: [
    "The lost thing was not established as genuinely valuable before it was lost",
    "The ending takes a position on whether the cost was worth it — the pyrrhic ending must remain genuinely open",
    "The protagonist does not register the cost — the awareness (or tragic lack of it) is essential",
    "The cost is proportionate to the gain — the pyrrhic ending requires disproportionate loss",
  ],
  systemDirectives: [
    "Establish what will be lost long before it is lost — the reader must care about it",
    "The final scene should hold both the achievement and the absence of what was lost",
    "Do not adjudicate — let the reader determine whether the cost was worth it",
    "The protagonist's awareness of the cost (present or absent) changes the ending's meaning entirely — choose deliberately",
  ],
  writingNotes: "The pyrrhic ending is the ending that most accurately reflects how significant life choices actually work. Almost nothing that matters is achieved cleanly. The writer who has built a genuine pyrrhic ending has created the conditions for the reader to spend years thinking about whether the protagonist made the right call."
};

export const SACRIFICE: EndingsArchetype = {
  name: "Sacrifice",
  theoreticalBasis: "The voluntary surrender of the goal or the self for something the protagonist values more. Not defeat (which is involuntary) and not resolution (which achieves the goal). The sacrifice ending proves the protagonist's values by showing what they will not trade for the goal. Kermode: the sacrifice retroactively reorganizes the entire narrative as a demonstration of what this person is made of.",
  coreDescription: "The protagonist surrenders the goal — or themselves — for something they value more. The sacrifice is voluntary and conscious. It reveals character at its most essential: not what a person says they value, but what they will not trade.",
  retroactiveOrganizer: "Every earlier scene that established what the protagonist values retroactively builds the case for the sacrifice's inevitability. The reader understands that this person could not have done anything else.",
  costRequirement: "The sacrifice must be irreversible and must cost something the protagonist genuinely wanted. A sacrifice of something the protagonist did not want is not sacrifice — it is disposal.",
  failureConditions: [
    "The sacrificed thing was not shown to be genuinely wanted",
    "The sacrifice feels obligatory rather than freely chosen",
    "The beneficiary of the sacrifice is not sufficiently established to justify the cost",
    "The sacrifice is reversible",
  ],
  systemDirectives: [
    "Establish the full weight of what is being sacrificed — the reader must feel the loss",
    "The sacrifice must be chosen, not forced — the moment of choice must be visible",
    "The thing that makes the sacrifice worthwhile must be established with equal weight",
    "End in the aftermath: what does the world look like now, from inside the choice that was made?",
  ],
  writingNotes: "The sacrifice ending is the ending that most clearly states the protagonist's values. It is the ending in which character is fully expressed through action rather than speech. The writer who has built to a genuine sacrifice has been building a case for what this person is since page one."
};

export const AMBIGUOUS: EndingsArchetype = {
  name: "Ambiguous",
  theoreticalBasis: "Kermode's distinction between open and closed endings: the ambiguous ending closes thematically while remaining open mechanically. Henry James: 'The ending of a novel is not the end of the reader's relationship with the material.' The ambiguous ending is not abandoned — it is deliberately withheld. The withholding must be intentional and the thematic question must be sufficiently closed for the mechanical openness to feel like meaning rather than evasion.",
  coreDescription: "The plot question is not answered. The thematic question is. The reader carries the narrative forward because the conditions for resolution have been fully prepared but the resolution itself is withheld — not because the writer did not know what happened but because not knowing is the correct experience of this material.",
  retroactiveOrganizer: "The ambiguity is retroactively seen to have been present throughout — in the character, the situation, the world. The ending does not introduce the ambiguity; it crystallizes what was always there.",
  costRequirement: "The ambiguous ending must close thematically even while remaining mechanically open. 'What happened?' may remain unanswered. 'What did this mean?' must be answerable.",
  failureConditions: [
    "The thematic question is also left open — this produces abandonment, not ambiguity",
    "The mechanical openness feels like the writer ran out of answers, not like a deliberate choice",
    "The ambiguity is introduced at the ending rather than crystallized from what was already present",
    "The reader feels cheated rather than invited into continued engagement",
  ],
  systemDirectives: [
    "Close the thematic question before withholding the plot answer",
    "The ambiguity must be rooted in what was established in the text — not introduced as a final twist",
    "The final image should be specific enough to feel like an ending and open enough to sustain interpretation",
    "Ask: if someone asks 'what is this story about?', can it be answered? If yes, the ambiguity can stand.",
  ],
  writingNotes: "The ambiguous ending is the most frequently attempted and the most frequently failed ending in literary fiction, because it requires the writer to do two things simultaneously: close enough that the reader is satisfied, and open enough that they remain engaged. The ambiguous ending that fails is the one that simply stops. The one that works is the one that stops at exactly the right moment, with the right image, having earned the openness through the specificity of everything that preceded it."
};
