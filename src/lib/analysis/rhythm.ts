// Deterministic prose-rhythm & repetition analysis — no LLM, instant, zero cost.
// Catches the structural "AI degradation" signals the longform benchmark penalizes:
// monotonous sentence rhythm, repeated sentence openers, repeated phrases, adverb spray.

export interface RhythmFlag {
  label: string;
  severity: "low" | "med" | "high";
  detail: string;
}

export interface RhythmReport {
  sentenceCount: number;
  wordCount: number;
  avgSentenceLen: number;
  shortPct: number;
  longPct: number;
  monotonyRun: number;
  repeatedOpeners: { word: string; count: number }[];
  repeatedPhrases: { phrase: string; count: number }[];
  adverbPct: number;
  flags: RhythmFlag[];
}

const STOP_OPENERS = new Set(["the", "a", "an", "and", "but", "so"]);

export function analyzeProseRhythm(raw: string): RhythmReport {
  const text = (raw || "").replace(/\s+/g, " ").trim();
  const sentences = (text.match(/[^.!?]+[.!?]*/g) || [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentenceCount = sentences.length;

  const lengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const avgSentenceLen = sentenceCount ? Math.round((wordCount / sentenceCount) * 10) / 10 : 0;
  const shortPct = sentenceCount ? Math.round((lengths.filter((l) => l < 8).length / sentenceCount) * 100) : 0;
  const longPct = sentenceCount ? Math.round((lengths.filter((l) => l > 30).length / sentenceCount) * 100) : 0;

  // Longest run of consecutive sentences with near-identical length (monotony).
  let monotonyRun = 0;
  let run = 1;
  for (let i = 1; i < lengths.length; i++) {
    if (Math.abs(lengths[i] - lengths[i - 1]) <= 2) {
      run++;
      monotonyRun = Math.max(monotonyRun, run);
    } else {
      run = 1;
    }
  }
  if (lengths.length) monotonyRun = Math.max(monotonyRun, run >= 2 ? run : 0);

  // Repeated sentence openers (first word).
  const openerCounts: Record<string, number> = {};
  for (const s of sentences) {
    const w = (s.match(/[A-Za-z']+/) || [""])[0].toLowerCase();
    if (!w || STOP_OPENERS.has(w)) continue;
    openerCounts[w] = (openerCounts[w] || 0) + 1;
  }
  const openerThreshold = Math.max(3, Math.ceil(sentenceCount * 0.12));
  const repeatedOpeners = Object.entries(openerCounts)
    .filter(([, c]) => c >= openerThreshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, count]) => ({ word, count }));

  // Repeated 3-word phrases.
  const tokens = text.toLowerCase().match(/[a-z']+/g) || [];
  const phraseCounts: Record<string, number> = {};
  for (let i = 0; i + 2 < tokens.length; i++) {
    const p = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
    phraseCounts[p] = (phraseCounts[p] || 0) + 1;
  }
  const repeatedPhrases = Object.entries(phraseCounts)
    .filter(([p, c]) => c >= 3 && p.length > 8)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phrase, count]) => ({ phrase, count }));

  const adverbs = tokens.filter((t) => t.length > 4 && t.endsWith("ly")).length;
  const adverbPct = wordCount ? Math.round((adverbs / wordCount) * 1000) / 10 : 0;

  const flags: RhythmFlag[] = [];
  if (monotonyRun >= 5)
    flags.push({ label: "Monotonous rhythm", severity: monotonyRun >= 7 ? "high" : "med", detail: `${monotonyRun} sentences in a row are nearly the same length. Vary short and long for cadence.` });
  if (repeatedOpeners.length)
    flags.push({ label: "Repeated openers", severity: repeatedOpeners[0].count >= openerThreshold + 3 ? "high" : "med", detail: repeatedOpeners.map((o) => `"${o.word}" ×${o.count}`).join(", ") + " start sentences. Recast some openings." });
  if (repeatedPhrases.length)
    flags.push({ label: "Repeated phrases", severity: repeatedPhrases[0].count >= 4 ? "high" : "low", detail: repeatedPhrases.map((p) => `"${p.phrase}" ×${p.count}`).join(", ") });
  if (adverbPct >= 4)
    flags.push({ label: "Adverb spray", severity: adverbPct >= 6 ? "med" : "low", detail: `${adverbPct}% of words are -ly adverbs. Prefer stronger verbs.` });
  if (longPct >= 40)
    flags.push({ label: "Long-sentence heavy", severity: "low", detail: `${longPct}% of sentences exceed 30 words. Break a few for clarity.` });

  return { sentenceCount, wordCount, avgSentenceLen, shortPct, longPct, monotonyRun, repeatedOpeners, repeatedPhrases, adverbPct, flags };
}
