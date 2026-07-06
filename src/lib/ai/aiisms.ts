// Research-backed list of AI fiction tells (2025-2026)
// Sources: Wikipedia Signs of AI Writing, Grammarly AI word analysis,
//          van Nuenen Berkeley study stylometric findings, GPTZero vocabulary research
//
// 2026-07-06 upgrade, patterns extracted (not copied — see
// docs/2026-07-06-repo-research-findings.md) from leaked production system
// prompts in asgeirtj/system_prompts_leaks:
//   - Active self-scan framing (Docker Gordon's leaked prompt): a passive "verify
//     none of these appear" checklist is weaker than an explicit "scan for every
//     instance and delete/replace it" instruction issued right before the model
//     finalizes output. buildAiismsInstruction() below now uses that framing.
//   - Echo-avoidance + no-double-statement (Sesame's Maya leaked prompt): two
//     structural fiction tells that aren't fixed phrases (so they can't live in
//     FICTION_AIISMS's literal-match array) — a character/narrator repeating back
//     words another character just said, and making the same beat twice in one
//     passage with different phrasing. Added as explicit rules alongside the list.
// The literal wording of the leaked prompts is not reproduced here — only the
// generic, unprotectable techniques.

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
  // Crutch-word tells (extracted from a 22-pass manuscript-editorial prompt shared
  // 2026-07-06 — see docs/2026-07-06-repo-research-findings.md; only the two
  // multi-word phrases live here, single-word crutch words go in
  // HIGH_FREQUENCY_WORDS below since that array is scanned separately).
  'started to', 'began to', 'appeared to',
];

export const HIGH_FREQUENCY_WORDS = [
  'suddenly', 'immediately', 'slowly', 'quietly',
  'gently', 'softly', 'quickly', 'carefully',
  'slightly', 'briefly', 'deeply',
  // Crutch/filler words (same source as the phrase additions above).
  'just', 'really', 'very', 'quite', 'actually', 'basically', 'literally',
];

// Structural tells that can't live in FICTION_AIISMS's literal-phrase array —
// each is a pattern of construction, not a fixed string. Exported (not just
// inlined in the instruction text) so a future post-generation validator can
// reference the same canonical descriptions.
export const STRUCTURAL_AIISMS = [
  {
    label: 'ECHO',
    detail: "a character or the narrator repeating back words another character just said in the same exchange (e.g. Character A says \"leaving,\" Character B's next line or the narration echoes \"leaving\" back). Cut the echo — respond to the content, not the word.",
  },
  {
    label: 'DOUBLE-STATEMENT',
    detail: 'making the same point twice in one passage with different phrasing (saying it, then re-saying it another way for emphasis). Keep the stronger version, cut the other.',
  },
];

export function buildAiismsInstruction(): string {
  const structuralLines = STRUCTURAL_AIISMS.map((s) => `- ${s.label}: ${s.detail}`).join('\n');
  return `AIISMS SELF-SCAN — before finalizing your output, scan every sentence you just wrote for each phrase below. Delete or rewrite every occurrence you find — do not leave a single one in the final text:
Fiction clichés: ${FICTION_AIISMS.join(' | ')}

If any appear, replace with specific physical action or concrete detail.
"Heart raced" → describe exactly what the character does with that feeling.
"Wave of fear" → what does fear feel like in this character's specific body?

Also scan for these structural tells, which are not fixed phrases:
${structuralLines}

CRUTCH WORDS — these are real words with legitimate uses, so don't ban them outright, but they're overused in AI prose. If more than one appears in a single paragraph, cut or replace all but one: ${HIGH_FREQUENCY_WORDS.join(', ')}.`.trim();
}
