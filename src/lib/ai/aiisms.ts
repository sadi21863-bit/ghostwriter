// Research-backed list of AI fiction tells (2025-2026)
// Sources: Wikipedia Signs of AI Writing, Grammarly AI word analysis,
//          van Nuenen Berkeley study stylometric findings, GPTZero vocabulary research

export const FICTION_AIISMS = [
  // Emotional tells
  'heart raced', 'heart pounded', 'heart hammered',
  'tears welled', 'tears pricked', 'eyes stung',
  'wave of', 'surge of', 'rush of',
  'knot in', 'lump in her throat', 'lump in his throat',
  "couldn't help but", "couldn't help feeling",
  'found herself', 'found himself', 'found themselves',
  'swallowed hard', 'swallowed the lump',
  'nodded slowly', 'nodded silently',
  'eyes widened', 'eyes narrowed',
  'breath caught', 'breath hitched',
  // Purple prose markers
  'tapestry', 'testament to', 'beacon of', 'realm of',
  'symphony of', 'nuanced', 'at its core',
  'delve into', 'dive deep',
  // Structural tells
  "couldn't believe", "couldn't believe what",
  'seemed to',
  // Transition tells
  'in that moment', 'at that moment',
  'all at once', 'all of a sudden',
  // Claude-specific artifacts
  "I've rewritten", "I've adjusted",
  'to be sure', 'needless to say',
];

export const HIGH_FREQUENCY_WORDS = [
  'suddenly', 'immediately', 'slowly', 'quietly',
  'gently', 'softly', 'quickly', 'carefully',
  'slightly', 'briefly', 'deeply',
];

export function buildAiismsInstruction(): string {
  return `AIISMS CHECK — after writing, verify none of these phrases appear:
Fiction clichés: ${FICTION_AIISMS.slice(0, 20).join(' | ')}

If any appear, replace with specific physical action or concrete detail.
"Heart raced" → describe exactly what the character does with that feeling.
"Wave of fear" → what does fear feel like in this character's specific body?`.trim();
}
