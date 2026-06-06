// Constraint-based voice preservation
// Based on Van Nuenen (2026): prompt-based voice instructions drift — constraints don't

export interface VoiceFingerprint {
  avgSentenceLength: number;
  contractionRate: number;
  firstPersonRate: number;
  avgWordLength: number;
  shortSentenceRate: number;
  longSentenceRate: number;
  dialogueRatio: number;
  questionRate: number;
  paragraphLengthAvg: number;
  wordDiversityRatio: number;
}

function countContractions(text: string): number {
  return (text.match(/\b\w+'\w+\b/g) || []).length;
}

function countFirstPerson(words: string[]): number {
  const fp = new Set(['i', "i'm", "i've", "i'll", "i'd", 'me', 'my', 'mine', 'myself']);
  return words.filter(w => fp.has(w.toLowerCase())).length;
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
}

function splitParagraphs(text: string): string[] {
  return text.split(/\n\n+/).filter(p => p.trim().length > 0);
}

export function extractVoiceFingerprint(chapters: string[]): VoiceFingerprint | null {
  if (!chapters || chapters.length === 0) return null;

  const combined = chapters
    .filter(c => c && c.trim().length > 100)
    .join('\n\n');

  if (combined.length < 500) return null;

  const words = combined.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const sentences = splitSentences(combined);
  const paragraphs = splitParagraphs(combined);

  if (sentences.length < 10) return null;

  const dialogueChars = (combined.match(/[""][^""]*[""]|"[^"]*"/g) || [])
    .reduce((acc, s) => acc + s.length, 0);

  const sentenceLengths = sentences.map(s => s.split(/\s+/).length);

  return {
    avgSentenceLength: sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length,
    contractionRate: countContractions(combined) / words.length,
    firstPersonRate: (countFirstPerson(words) / words.length) * 100,
    avgWordLength: words.reduce((acc, w) => acc + w.replace(/[^a-z]/g, '').length, 0) / words.length,
    shortSentenceRate: sentenceLengths.filter(l => l < 6).length / sentenceLengths.length,
    longSentenceRate: sentenceLengths.filter(l => l > 20).length / sentenceLengths.length,
    dialogueRatio: dialogueChars / combined.length,
    questionRate: sentences.filter(s => s.trim().endsWith('?')).length / sentences.length,
    paragraphLengthAvg: sentences.length / Math.max(paragraphs.length, 1),
    wordDiversityRatio: new Set(words).size / words.length,
  };
}

export function fingerprintToConstraints(fp: VoiceFingerprint): string {
  const lines: string[] = [
    "BINDING VOICE CONSTRAINTS — measured from this author's existing prose.",
    'These are not stylistic suggestions. They are numerical facts about how this writer writes.',
    'Every paragraph must fall within ±20% of these targets:',
    '',
    `• Average sentence length: ${fp.avgSentenceLength.toFixed(1)} words`,
    `  ${fp.avgSentenceLength < 10 ? '→ Short, punchy sentences. No sprawling syntax.' : fp.avgSentenceLength > 18 ? '→ Long, complex sentences. Subordinate clauses acceptable.' : '→ Moderate length. Mix short and long.'}`,
    '',
    `• Short sentences (under 6 words): ${(fp.shortSentenceRate * 100).toFixed(0)}% of sentences`,
    `• Long sentences (over 20 words): ${(fp.longSentenceRate * 100).toFixed(0)}% of sentences`,
    '',
    `• Contractions: ${(fp.contractionRate * 100).toFixed(1)}% of words`,
    `  ${fp.contractionRate > 0.03 ? "→ Use contractions freely (don't, he'd, she's)." : '→ Formal register. Avoid contractions.'}`,
    '',
    `• First-person pronouns (I/me/my): ${fp.firstPersonRate.toFixed(1)} per 100 words`,
    `  ${fp.firstPersonRate > 5 ? '→ Close, intimate narration. High "I" density expected.' : fp.firstPersonRate < 1 ? '→ Third-person or distant narrator. Minimal first-person.' : '→ Moderate first-person presence.'}`,
    '',
    `• Dialogue ratio: ${(fp.dialogueRatio * 100).toFixed(0)}% of text`,
    `  ${fp.dialogueRatio > 0.3 ? '→ Dialogue-heavy. Conversations drive the prose.' : fp.dialogueRatio < 0.1 ? '→ Prose-heavy. Internal narration dominates.' : '→ Balanced dialogue and narration.'}`,
    '',
    `• Word diversity: ${(fp.wordDiversityRatio * 100).toFixed(0)}% unique words`,
    `  ${fp.wordDiversityRatio < 0.4 ? '→ Repetitive vocabulary. Simple, direct word choice.' : '→ Varied vocabulary. Rich word selection expected.'}`,
    '',
    "STRICTLY FORBIDDEN (AI tells that violate this author's voice):",
    '- "heart raced", "tears welled", "wave of [emotion]"',
    '- "couldn\'t help but", "found themselves", "as if"',
    '- "tapestry", "testament", "beacon", "realm", "symphony", "nuanced"',
    '- "couldn\'t believe", "nodded slowly", "eyes widened", "swallowed hard"',
    '- Starting consecutive sentences with the same word',
    '- Em dash overuse (maximum one per paragraph)',
  ];

  return lines.join('\n');
}
