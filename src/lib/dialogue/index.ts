export type { DialogueArchetype } from "./types";
export { buildDialogueContext, getDialogueArchetypeNames } from "./context";
export { DIALOGUE_ARCHETYPES } from "./_registry";

export const DIALOGUE_SYSTEM_PROMPT = `DIALOGUE TECHNICAL SYSTEM:

THE FIVE FUNCTIONS — every line must serve at least two simultaneously:
1. Characterise: HOW they speak (vocabulary register, sentence architecture,
   what they avoid, how they listen or don't) — not what they say
2. Advance narrative: something must change or be revealed
3. Convey information: always masked — embedded in conflict, never delivered directly
4. Create or sustain tension: want + obstacle + resistance present in every exchange
5. Express subtext: what is not said organises what is said
Any line serving only one function is a candidate for cutting.

SPEECH ACT THEORY (Austin 1962, Searle 1969):
Every line performs an illocutionary act — what is DONE by saying it.
The surface words conceal the real action. Ask for every line: what does this
character DO by saying this? Not what do they SAY.
Five illocutionary categories: Assertives (claiming truth), Directives (requesting
or demanding), Commissives (promising or threatening), Expressives (thanking,
apologising, blaming), Declarations (words that enact: "You're fired", "I do",
"I quit" — the spoken act that changes reality).
The gap between the locutionary content (what is said) and the illocutionary act
(what is done) is where subtext lives.

MAMET'S WANT-ENGINE:
Every character in every scene wants something specific from the other character.
The line of dialogue is the instrument they choose to get it.
Diagnostic: is this line the most effective available instrument for getting that
specific thing from this specific person right now? If not, cut it or replace it.

FIVE SUBTEXT PRODUCTION METHODS (Pinter):
1. Deflection — answers a related but different subject than the one raised
2. Displacement — the argument is nominally about something trivial (the milk,
   the weather, who left the window open) but emotionally organised around what
   cannot be named directly
3. Excessive precision — the over-specific answer reveals what is really being asked
4. Apparent non-sequitur — emotionally connected to the previous line, logically disconnected
5. Conspicuous absence — what the character does not say when they obviously should

FIVE VOICE DIFFERENTIATION AXES (the blind test):
Cover all attribution tags. You must be able to identify who is speaking from:
1. Sentence architecture — long-subordinated / short-declarative / fragmented / periodic
2. Vocabulary register — Anglo-Saxon concrete / Latinate abstract / professional-domain
3. Characteristic evasion — deflects-with-humour / counter-questions / goes silent / qualifies-everything
4. Reference system — sport / film / nature / professional domain / personal history
5. Listening behaviour — answers the question asked / answers the emotional content / doesn't listen
If you cannot identify the speaker without the tag: the voices are not differentiated.

MASKED EXPOSITION — the four techniques:
Characters telling each other things they both already know is the cardinal sin.
1. Conflict delivery: the information is revealed as a weapon in argument
2. Resistance delivery: one character tries to avoid the subject; the other forces it
3. Partial revelation: one character knows only part; the exchange completes it
4. Subtext delivery: the information is present but never stated — the reader infers it`;
