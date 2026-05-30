export interface CraftEntry {
  libraryMode: string;
  theorist: string;
  coreInsight: string;
  fictionExample: { work: string; author: string; howItApplies: string };
  writingRule: string;
  furtherReading: string;
}

export const CRAFT_LIBRARY: CraftEntry[] = [
  {
    libraryMode: "horror",
    theorist: "Sigmund Freud — The Uncanny (Das Unheimliche, 1919)",
    coreInsight: "The uncanny is not strange — it is familiar rendered wrong. Freud's unheimlich is the return of something that should have remained hidden. Horror works not by introducing monsters but by revealing that the ordinary world already contained the horror.",
    fictionExample: { work: "The Haunting of Hill House", author: "Shirley Jackson", howItApplies: "The house is not threatening because it is strange. It is threatening because Eleanor begins to feel it is familiar — that it knows her, that she belongs there. The horror is homecoming, not invasion." },
    writingRule: "Before writing the horror scene: what familiar element is being rendered wrong? What should remain hidden that is returning? The horror is never the monster — it is the wrongness of the ordinary.",
    furtherReading: "Freud, 'The Uncanny' (1919). Shirley Jackson, Haunting of Hill House. Mark Fisher, The Weird and the Eerie.",
  },
  {
    libraryMode: "horror",
    theorist: "Junji Ito — Freeze the Horror (from the Uzumaki manga, 1998–1999)",
    coreInsight: "The animated version of Uzumaki was weaker than the manga. Ito's insight: freeze the horror at the moment of maximum wrongness. Do not animate it. The static image the reader cannot look away from is more frightening than watching it move. Horror in motion becomes spectacle; horror frozen becomes dread.",
    fictionExample: { work: "Uzumaki", author: "Junji Ito", howItApplies: "The panel of the body compressed into a spiral shell is more disturbing than any sequence showing the transformation happening. The result, frozen, is the horror." },
    writingRule: "At the moment of maximum wrongness — stop. Do not describe what happens next. Describe exactly what is there, frozen, in exhaustive detail. Let the reader's imagination animate it.",
    furtherReading: "Junji Ito, Uzumaki, Gyo, Tomie. Susan Sontag, On Photography (on the power of the still image).",
  },
  {
    libraryMode: "dialogue",
    theorist: "David Mamet — The Want-Engine",
    coreInsight: "Every character in every scene wants something specific from another character. The line of dialogue is the instrument chosen to get that thing. Mamet's test: is this line the most effective available instrument for getting that specific thing from this specific person right now? If not — cut it.",
    fictionExample: { work: "Glengarry Glen Ross", author: "David Mamet", howItApplies: "Every line of Levene's pitch to Williamson is not what Levene says it is. The surface content is the instrument for the actual want. Every sentence is a tactical move." },
    writingRule: "Before writing a dialogue scene: what does each character specifically want from the other right now? Write each line as an instrument for getting that thing. Remove any line that is not doing that work.",
    furtherReading: "David Mamet, On Directing Film. Glengarry Glen Ross (read as a tactical manual).",
  },
  {
    libraryMode: "romance",
    theorist: "Helen Fisher — Three Distinct Neurochemical Systems",
    coreInsight: "Love is not one experience but three, each with distinct neurochemistry. Lust (testosterone/oestrogen): want without specific target. Attraction (dopamine/norepinephrine): fixated, intrusive, energised, terrible sleeper. Attachment (oxytocin/vasopressin): calm, secure, capable of thought again. The drama is in their conflicts.",
    fictionExample: { work: "Anna Karenina", author: "Leo Tolstoy", howItApplies: "Vronsky triggers attraction (dopamine cascade, intrusive thoughts, loss of appetite). Karenin represents attachment (the oxytocin bond of eight years). The tragic engine is these two systems fighting each other inside one person." },
    writingRule: "Identify which stage each character is in at each moment. The most interesting scenes are the ones where two different stages conflict in the same person or between people.",
    furtherReading: "Helen Fisher, Why We Love (2004). Attachment Theory: John Bowlby, Mary Ainsworth.",
  },
  {
    libraryMode: "tension",
    theorist: "Brewer & Lichtenstein — Three Distinct States",
    coreInsight: "What writers call 'tension' is actually three different reader experiences. Suspense: reader doesn't know what happens next. Curiosity: reader knows the outcome but not how it happened. Surprise: an event breaks the reader's model. Each needs different structural production.",
    fictionExample: { work: "Crime and Punishment", author: "Fyodor Dostoevsky", howItApplies: "The murder happens in Chapter 1. The rest of the novel is curiosity (how did this happen, who is Raskolnikov) and suspense (will he be caught). Dostoevsky uses both simultaneously, on separate tracks." },
    writingRule: "Before writing a scene: which state am I designing for? Design the information architecture to produce it. Never resolve all three simultaneously — stagger them.",
    furtherReading: "Brewer & Lichtenstein, 'Event schemas, story schemas, and story grammars' (1981). Loewenstein, 'The psychology of curiosity' (1994).",
  },
  {
    libraryMode: "ethics",
    theorist: "Jonathan Haidt — Social Intuitionist Model",
    coreInsight: "Humans do not reason to moral conclusions — they feel them first and rationalize after. The reasoning mind is a lawyer whose client (the intuition) has already decided. The argument that changes someone's moral position is the one that activates a competing intuition — not one that constructs a logical proof.",
    fictionExample: { work: "The Secret in Their Eyes", author: "Juan José Campanella", howItApplies: "The audience's moral response to the ending is visceral before it is reasoned. Both moral intuitions are activated simultaneously, which is why the ending is so disturbing." },
    writingRule: "In a moral conflict scene, construct both sides as internally coherent intuition-first positions. Give each a moral foundation (Care, Fairness, Loyalty, Authority, Sanctity, Liberty). The argument that lands will not be the most logical — it will be the one that activates the other person's existing foundation.",
    furtherReading: "Jonathan Haidt, The Righteous Mind (2012). Bernard Williams, Ethics and the Limits of Philosophy.",
  },
  {
    libraryMode: "combat",
    theorist: "Kalari Payattu — KYO/NTU Exchange",
    coreInsight: "In Kalari (India's oldest martial art), every combat is a rhythm of KYO (open, vulnerable) and NTU (closed, guarded) states. The fighter who forces the opponent into KYO wins. Combat writing fails when every blow lands cleanly. Real fights are about the moment of openness — and who sees it first.",
    fictionExample: { work: "Blood Meridian", author: "Cormac McCarthy", howItApplies: "McCarthy's violence is relentless precisely because he shows the KYO moment: the instant before the fatal blow when the victim's guard drops. The horror is not the violence — it is the vulnerability preceding it." },
    writingRule: "Map each fighter's KYO/NTU state across the fight. The climax is whoever exploits KYO first. Every blow that lands required a prior moment of exposure. Write that exposure.",
    furtherReading: "Phillip Zarrilli, Psychophysical Acting. McCarthy, Blood Meridian.",
  },
  {
    libraryMode: "setting",
    theorist: "Jay Appleton — Prospect-Refuge Theory",
    coreInsight: "Human aesthetic responses to landscape are rooted in evolutionary survival. We prefer settings that offer prospect (the ability to see without being seen) and refuge (a protected position). Settings that provide both simultaneously feel safe and beautiful. Settings that deny both feel threatening.",
    fictionExample: { work: "Rebecca", author: "Daphne du Maurier", howItApplies: "Manderley offers prospect (the narrator can see the whole grounds) but denies refuge (every room holds Mrs. Danvers, every space belongs to Rebecca). The psychological unease of the setting is pure Appleton — visible but unsafe." },
    writingRule: "Map your setting on the prospect-refuge matrix. A safe setting has both. A threatening setting denies one or both. When your character needs to feel safe, give them refuge. When you need dread, remove it.",
    furtherReading: "Jay Appleton, The Experience of Landscape (1975). Yi-Fu Tuan, Topophilia.",
  },
  {
    libraryMode: "historical",
    theorist: "Fernand Braudel — Three Timescales",
    coreInsight: "Braudel's Annales school distinguishes three historical timescales: the longue durée (geographic and structural change, centuries), conjunctures (medium-term social and economic change, decades), and événements (short-term events, days and years). Most historical fiction only operates at the événements level. The deepest work operates across all three simultaneously.",
    fictionExample: { work: "War and Peace", author: "Leo Tolstoy", howItApplies: "The 1812 invasion (événement) is embedded in Russian social change (conjuncture) embedded in the permanent question of the Russian soul and landscape (longue durée). The famous ending is pure Braudel — what do events mean against geological time?" },
    writingRule: "For every event in your historical fiction, ask: what is the conjuncture it is embedded in? What is the longue durée beneath that? The event gains meaning from the deeper time.",
    furtherReading: "Fernand Braudel, The Mediterranean (1949). Tolstoy, War and Peace.",
  },
  {
    libraryMode: "atmosphere",
    theorist: "Roland Barthes — The Punctum",
    coreInsight: "Barthes distinguishes the studium (the general studied interest in an image — what it is supposed to show) from the punctum (the detail that pierces you, that you did not expect, that cannot be explained). Atmosphere in fiction operates the same way. The detail that creates atmosphere is never the one trying to.",
    fictionExample: { work: "The Remains of the Day", author: "Kazuo Ishiguro", howItApplies: "The atmosphere of repression is not created by descriptions of Stevens's emotional restraint (studium). It is created by punctum: the way he describes polishing the silver, the specific tone when he mentions Miss Kenton's laugh. These details were not selected for atmosphere — they puncture through it." },
    writingRule: "Do not select your atmospheric details. Describe the scene as a witness would describe it, including the detail that seems irrelevant. The irrelevant detail becomes punctum. The detail you chose for atmosphere becomes studium and dies.",
    furtherReading: "Roland Barthes, Camera Lucida (1980). Ishiguro, The Remains of the Day.",
  },
];
