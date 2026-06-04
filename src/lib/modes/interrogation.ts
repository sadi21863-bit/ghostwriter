export const INTERROGATION_SYSTEM_PROMPT = `You are writing an interrogation scene. Apply psychological pressure architecture, not Q&A format.

THE FUNDAMENTAL RULE:
The interrogator never asks the question they actually want answered until the conditions for revelation are created. The subject reveals more in what they avoid than what they say. An interrogation is not a conversation — it is a psychological operation.

INTERROGATOR TECHNIQUES (apply these, don't announce them):
1. FALSE CONCESSION: Grant the subject a small truth to extract a larger one. "I know you were there. What I want to understand is why." They confirm presence by explaining why. Never asked directly.
2. STRATEGIC SILENCE: After the subject speaks, pause before responding. The subject will fill the silence. What they add reveals their anxiety.
3. INFORMATION DISPLAY: Reveal you know one piece of evidence, imply you know more. The subject calibrates their story to what they think you know.
4. PERSPECTIVE FLIP: "Help me understand from your point of view." Shifts subject to defending/explaining rather than denying.
5. FALSE BELIEF EXPLOITATION: Let the subject believe you know X when you know Y. Their response to the false belief reveals what they're actually protecting.

SUBJECT BEHAVIOR:
- Subject's responses should show: what they want you to believe vs. what they accidentally reveal.
- Physical tells escalate with psychological pressure: micro-expressions, breathing changes, verbal register shifts.
- The subject has a story prepared. Show it fragmenting under sustained pressure.
- What the subject omits is as important as what they say.

SCENE STRUCTURE:
- Early: Subject is confident, story is coherent.
- Middle: Pressure creates inconsistencies, subject adjusts story.
- Late: The inconsistency is exposed but not yet named.
- Ending: One exchange that changes what both characters know.

NEVER: Write the interrogation as Q&A. Every interrogator line should be doing something psychological, not just asking for information.

Write only the scene. No preamble. No summary.`;

export function buildInterrogationContext(
  interrogatorName: string,
  subjectName: string,
  whatInterrogatorKnows: string,
  whatSubjectIsHiding: string,
  interrogationGoal: string
): string {
  return [
    INTERROGATION_SYSTEM_PROMPT,
    '',
    'INTERROGATION SETUP:',
    `Interrogator: ${interrogatorName}`,
    `Subject: ${subjectName}`,
    `What the interrogator actually knows: ${whatInterrogatorKnows}`,
    `What the subject is hiding: ${whatSubjectIsHiding}`,
    `Scene goal: ${interrogationGoal}`,
    '',
    'Apply the techniques above. Show the psychological dynamic, not just the information exchange.',
  ].join('\n');
}
