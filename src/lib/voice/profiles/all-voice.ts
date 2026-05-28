// src/lib/voice/profiles/all-voice.ts
import type { VoiceProfile } from "../types";

export const VOCABULARY_REGISTER: VoiceProfile = {
  name: "Vocabulary Register",
  theoreticalBasis: "Labov (1972): vocabulary range and register selection are socially determined and reveal class, education, and group membership. Code-switching — shifting register based on social context — is universal but varies in range and fluency. A person with a wide register range (academic to street) has more social mobility than they may consciously know. A person with a narrow register is not less intelligent — their register serves their community completely.",
  coreDescription: "This voice profile governs vocabulary: how many words the character uses for the same concept, which register they default to, and how they switch between registers in different social contexts.",
  bigFiveProfile: "Openness (high): broad vocabulary, abstract words, cross-register range. Conscientiousness (high): precise terminology, professional register preference. Extraversion (high): accessible vocabulary, colloquial range.",
  vocabularyRange: "The character's vocabulary range determines their options per concept. A narrow-range character uses the same word every time. A wide-range character has social vocabulary, technical vocabulary, and colloquial vocabulary for the same thing and chooses based on who they're with.",
  syntacticFingerprint: "Vocabulary register affects sentence length: high-register vocabulary often appears in longer, more complex sentences. Low-register vocabulary in shorter, more direct sentences. The character who mixes registers within a sentence is either code-switching fluently or has a specific relationship between their formal and informal self.",
  functionWordPattern: "Pennebaker: high-register speakers use more articles and prepositions (grammatically complex). Low-register speakers use more pronouns and simpler connectors.",
  registerBehavior: "Labov's key finding: people shift register downward (toward vernacular) when emotionally activated or with in-group members. Shift upward (toward formal register) with authority figures or when performing competence. The direction and range of this shift is diagnostic of the character.",
  emotionalDegradation: "Under stress: the character retreats to their most natural register — not their most elevated. The academic who swears. The street voice that surfaces under fear. The register that was always underneath.",
  specimenLines: [
    "High register default: 'I'm concerned that the situation has developed in a way that is unlikely to produce the outcome we discussed.'",
    "Low register default: 'This is going wrong and you know it.'",
    "Wide range, code-switching: 'The methodology is sound — but honestly? It's broken.'",
  ],
  forbiddenPatterns: [
    "High-register character using perfect colloquial slang without social motivation",
    "Low-register character suddenly producing formal subordinate clauses without code-switch signal",
  ],
  systemDirectives: [
    "Assign the character one default register and write all their lines in that register unless context demands a switch",
    "Code-switches must be motivated: who are they talking to, and what social need drives the shift",
    "Under emotional stress: character retreats to their most natural register, not their most elevated",
    "The vocabulary range is consistent across scenes — it is a fingerprint, not a choice",
  ],
  writingNotes: "The character who always uses formal register when speaking to authority but drops to street vernacular with their friends is not inconsistent — they are using their full range appropriately. The character who always uses the same register regardless of context is either extremely confident or has very limited range. Both are characterizations.",
};

export const SYNTACTIC_FINGERPRINT: VoiceProfile = {
  name: "Syntactic Fingerprint",
  theoreticalBasis: "Every person has a characteristic sentence-construction pattern — their syntactic fingerprint. Some people build complex subordinated sentences that hold multiple qualifications simultaneously. Others speak in short declarative chains. Some embed qualifications at the start of sentences; others at the end. These patterns are as identifying as vocabulary and more consistent under stress.",
  coreDescription: "This profile governs sentence structure: length, complexity, subordination patterns, and the characteristic ways a character builds and ends their sentences.",
  bigFiveProfile: "High Conscientiousness: long, carefully constructed sentences with appropriate subordination. High Neuroticism: short sentences with frequent qualification and hedging. High Extraversion: medium sentences, end-loaded with energy.",
  vocabularyRange: "Syntactic complexity and vocabulary range often correlate but do not have to. A character can use simple vocabulary in complex sentence structures (Hemingway in the vernacular) or complex vocabulary in simple structures.",
  syntacticFingerprint: "The characteristic pattern: Does the character build toward their main point or lead with it? Do they qualify before or after the assertion? Do their sentences tend to close with a punch or trail off? How often do they use subordinate clauses? Do they use list structures? These are consistent and diagnostic.",
  functionWordPattern: "Pennebaker: subordinating conjunctions (because, although, while) indicate analytical, complex thinking. Coordinating conjunctions (and, but) indicate simpler, additive processing. The ratio of these is a character fingerprint.",
  registerBehavior: "Syntactic complexity tends to flatten under emotional stress — the character who normally speaks in elegant periodic sentences under pressure speaks in short declaratives. This is one of the most reliable tells for character under duress.",
  emotionalDegradation: "Syntactic complexity degrades under stress faster than vocabulary. The character who normally builds complex arguments reduces to short declaratives or even fragments when frightened, angry, or overwhelmed.",
  specimenLines: [
    "Periodic (builds to main point): 'Though I had considered every possibility, and though I had every reason to believe he was wrong, it turned out he was right.'",
    "Cumulative (main point first, detail after): 'He was right — completely, infuriatingly, obviously right — and I had missed it.'",
    "Short declarative chain: 'He was right. I was wrong. That was it.'",
  ],
  forbiddenPatterns: [
    "A character with an established periodic sentence pattern suddenly using cumulative structure without register shift",
    "A character whose stress-degradation pattern doesn't appear under genuine duress",
  ],
  systemDirectives: [
    "Establish one dominant syntactic pattern in the first scene and maintain it consistently",
    "Under emotional stress: flatten syntax toward shorter declaratives",
    "The end of sentences is where personality shows most — punch or trail",
    "The pattern must be consistent enough that the reader could identify the character from a paragraph without dialogue tags",
  ],
  writingNotes: "The syntactic fingerprint is the hardest voice element to maintain because it requires the writer to think about sentence structure consciously at the moment of generation. The payoff is the character who sounds like themselves even in scenes where nothing else identifies them.",
};

export const PERSONALITY_LANGUAGE: VoiceProfile = {
  name: "Personality-Language",
  theoreticalBasis: "Mairesse et al. (2007): the Big Five personality dimensions produce systematic, measurable differences in natural language use. High Extraversion uses more social processes words, positive emotion words, and references to others. High Neuroticism uses more negative emotion words, first-person singular, and anxiety-related words. High Conscientiousness uses more achievement words and present-tense constructions. High Agreeableness uses more we-language, hedging, and fewer negative words. High Openness uses more cognitive process words, complex vocabulary, and tentative language.",
  coreDescription: "This profile maps a character's Big Five personality to their language patterns. Not the personality traits themselves — their linguistic expressions. The neurotic who says 'I' more often. The agreeable person who says 'we' and hedges. The open person who says 'perhaps' and 'it seems.'",
  bigFiveProfile: "Any Big Five configuration — this profile provides the mapping. The character's dominant dimensions determine which patterns dominate.",
  vocabularyRange: "Openness (high) correlates with broader vocabulary. The other dimensions affect word choice within vocabulary range.",
  syntacticFingerprint: "Neuroticism: shorter sentences, more qualifications. Conscientiousness: more structured sentences. Agreeableness: hedging phrases ('I think,' 'perhaps,' 'maybe').",
  functionWordPattern: "Pennebaker's most robust findings: Neurotic characters use 'I' significantly more. Agreeable characters use 'we' significantly more. These are unconscious patterns — the character doesn't know they do it.",
  registerBehavior: "Personality-language patterns are more consistent across registers than syntactic patterns. The neurotic's self-reference persists even in formal register. The agreeable person's we-language persists even in private thought.",
  emotionalDegradation: "Under stress, personality-language patterns intensify rather than flatten. The neurotic uses even more first-person, more negative words. The extraverted person reaches out in language even when they shouldn't.",
  specimenLines: [
    "High Neuroticism: 'I don't know — I thought I understood it, but now I'm not sure. I keep thinking I missed something.'",
    "High Extraversion: 'It's going to be great! Everyone's excited, you can tell. The energy in that room was—'",
    "High Agreeableness: 'Maybe we could try it this way? Just a thought — we don't have to if it doesn't feel right.'",
    "High Conscientiousness: 'The plan is clear. Step one is done. Step two is ready. Step three requires verification before proceeding.'",
    "High Openness: 'It's interesting — I wonder if there's a way to look at it that accounts for both possibilities. It seems like there might be a connection...'",
  ],
  forbiddenPatterns: [
    "High-neurotic character speaking without first-person singular in an emotional scene",
    "High-agreeable character asserting without hedging in a conflict scene",
  ],
  systemDirectives: [
    "Identify the character's dominant Big Five dimension and apply the corresponding language pattern consistently",
    "The pattern is unconscious — the character doesn't know they're doing it",
    "Under emotional stress: the pattern intensifies, not disappears",
    "First-person singular frequency is the single most reliable Neuroticism marker — count it",
  ],
  writingNotes: "The personality-language mapping is the most rigorously empirical voice tool in this library. Mairesse et al. trained classifiers that could identify Big Five scores from natural text with above-chance accuracy. The patterns are real and consistent. A high-neurotic character who doesn't use excessive first-person singular is either suppressing their personality in that scene or has been written without their voice.",
};

export const EMOTIONAL_DEGRADATION: VoiceProfile = {
  name: "Emotional Degradation",
  theoreticalBasis: "Every character's voice degrades under stress, but the direction and form of degradation is character-specific. A person who relies on complex language under normal circumstances may find their language simplifying rapidly under stress. A person who is verbally precise normally may become repetitive under pressure. The degradation pattern is as identifying as the baseline voice — it reveals what the voice is built on and what it loses first.",
  coreDescription: "This profile specifically governs how a character's voice changes when they are frightened, angry, grieving, or overwhelmed. The baseline voice is established by their other profile elements. This profile describes the degradation: what is lost first, what remains, and what new patterns emerge.",
  bigFiveProfile: "All — degradation patterns interact with baseline personality. High-Conscientiousness characters lose structure first. High-Openness characters lose abstractness. High-Neuroticism characters lose even the pretense of control.",
  vocabularyRange: "Vocabulary range narrows under stress. The character retreats to their core vocabulary — the words they would have used before they developed their current register.",
  syntacticFingerprint: "Complex syntax degrades to simple syntax. Periodic sentences become declaratives. Long sentences become short. Eventually: fragments.",
  functionWordPattern: "Under stress: pronouns may simplify (more 'I', less 'we'), tense may shift (past tense processing, future tense anxiety), hedging may disappear (high-conscientiousness) or increase (high-neuroticism).",
  registerBehavior: "The character's degradation reveals their true register — the one underneath the performed one. The character who performs professional-register fluency under normal conditions may reveal street register under extreme stress.",
  emotionalDegradation: "This IS the profile — the specific pattern of degradation for this character. Define: what is lost first (syntax, vocabulary range, register performance), what new patterns emerge (repetition, shorter units, shifted tense), and what remains (the core voice that cannot be removed).",
  specimenLines: [
    "Baseline (controlled): 'I believe the situation requires immediate consideration of our alternatives, given the constraints we're operating under.'",
    "Moderate stress: 'We need to think about this. Right now. All of it.'",
    "High stress: 'Think. Just think. What do we do.'",
    "Extreme stress: 'What do we do. What. What do we do.'",
  ],
  forbiddenPatterns: [
    "The character under extreme stress speaks with their baseline voice quality intact",
    "The degradation pattern is unpredictable — it must be consistent with the character's baseline",
  ],
  systemDirectives: [
    "Establish the degradation arc for this character before the scene that requires it",
    "Degradation is gradual: define the four levels (baseline, moderate stress, high stress, extreme stress)",
    "The degradation must be consistent with the baseline — what is lost is what the baseline most depends on",
    "What remains at extreme stress is the core voice: the words, rhythms, and patterns that cannot be removed",
    "Recovery is not instant — the character re-assembles their voice as stress reduces",
  ],
  writingNotes: "Emotional degradation is the most powerful voice tool because it reveals what is real. The well-constructed voice is a performance. The degraded voice is the person. The character whose voice degrades under pressure shows the reader something they would not see otherwise: what they are underneath what they present.",
};

export const PROSODIC_RHYTHM: VoiceProfile = {
  name: "Prosodic Rhythm",
  theoreticalBasis: "Prosody in speech refers to the rhythm, stress, and intonation patterns that give language its music. In prose, prosodic rhythm is the pattern of stressed and unstressed syllables, the placement of pauses, and the characteristic stress patterns of a character's speech. These patterns are as identifying as vocabulary — people who know someone well can often recognize them from rhythm alone, before content registers.",
  coreDescription: "This profile governs the rhythmic texture of a character's speech: where they place stress, how they build and release tension within sentences, whether they speak in bursts or flows, and the characteristic music of their voice.",
  bigFiveProfile: "Extraversion (high): energetic, front-loaded stress, builds to peaks. Introversion: end-loaded, quieter peaks, longer holds. Neuroticism: irregular stress, unpredictable rhythm. Conscientiousness: metered, regular, deliberate.",
  vocabularyRange: "Rhythm and vocabulary interact: Latinate vocabulary has heavier, more regular stress patterns. Germanic/Anglo-Saxon vocabulary has lighter, more variable stress. A character's vocabulary preference shapes their prosodic texture.",
  syntacticFingerprint: "Rhythm and syntax are inseparable. The character who ends sentences with one-syllable punches ('He was wrong. Full stop.') has a different prosodic profile from the character who trails into subordinate clauses.",
  functionWordPattern: "Function words are typically unstressed — the ratio of function words to content words affects the rhythmic density of speech. High-function-word speech has more rhythmic 'give.' High-content-word speech is more rhythmically dense.",
  registerBehavior: "Prosodic rhythm is one of the last things to shift in register switching — it is deeply ingrained. A character can switch vocabulary and syntax more easily than they can change their fundamental rhythm.",
  emotionalDegradation: "Under stress: rhythm typically accelerates and becomes more irregular. The careful metered rhythm of a controlled speaker breaks into irregular bursts. OR: extreme stress may produce a forced, over-regular rhythm — the person counting syllables to stay in control.",
  specimenLines: [
    "Burst rhythm: 'Not good. Not good at all. We need to — no, listen. Stop. Listen.'",
    "Flow rhythm: 'What I'm trying to say, and I want to be clear about this, is that the situation isn't as straightforward as it seems.'",
    "Metered rhythm: 'One thing at a time. We do the first thing. Then the second. Then we see.'",
  ],
  forbiddenPatterns: [
    "A burst-rhythm character suddenly producing long flowing periods without a shift signal",
    "A metered character losing their meter under stress without the loss being marked",
  ],
  systemDirectives: [
    "Read the character's lines aloud — the rhythm must be consistent and identifiable",
    "Assign one dominant rhythmic pattern: burst, flow, or metered",
    "Under stress: burst characters become more fragmented; flow characters lose their flow; metered characters either over-meter or lose it entirely",
    "The rhythm must be hearable on the page — vary sentence endings to create the pattern",
  ],
  writingNotes: "Prosodic rhythm is the element of voice that most improves with reading aloud. A character who sounds right when read silently may have their rhythm destroyed by reading aloud. A character who sounds right aloud has been written with their music. The music is the test.",
};
