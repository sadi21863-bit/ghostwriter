// src/lib/suggestions/passive.ts
// Zero-cost passive checks. Runs on chapter save via regex/algorithmic analysis.
// No AI call. Returns structured suggestions the UI can display as dismissable chips.

export type SuggestionCategory =
  | "repeated_opener"
  | "word_repetition"
  | "pacing"
  | "dialogue_ratio"
  | "sentence_uniformity";

export interface PassiveSuggestion {
  id: string;
  category: SuggestionCategory;
  message: string;
  excerpt: string;
  severity: "warning" | "info";
}

export function runPassiveChecks(text: string): PassiveSuggestion[] {
  if (!text || text.length < 100) return [];
  const suggestions: PassiveSuggestion[] = [];

  suggestions.push(...checkRepeatedSentenceOpeners(text));
  suggestions.push(...checkWordRepetition(text));
  suggestions.push(...checkPacing(text));
  suggestions.push(...checkDialogueRatio(text));
  suggestions.push(...checkSentenceUniformity(text));

  return suggestions;
}

function checkRepeatedSentenceOpeners(text: string): PassiveSuggestion[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [];
  const suggestions: PassiveSuggestion[] = [];
  let streak = 1;
  let prevOpener = "";

  for (let i = 1; i < sentences.length; i++) {
    const opener = sentences[i].trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "");
    if (opener === prevOpener && opener.length > 2) {
      streak++;
      if (streak === 3) {
        suggestions.push({
          id: `repeated_opener_${i}`,
          category: "repeated_opener",
          message: `Three consecutive sentences begin with "${opener}". Vary your sentence openers.`,
          excerpt: sentences[i - 2].trim().slice(0, 60),
          severity: "warning",
        });
      }
    } else {
      streak = 1;
    }
    prevOpener = opener;
  }
  return suggestions;
}

function checkWordRepetition(text: string): PassiveSuggestion[] {
  const suggestions: PassiveSuggestion[] = [];
  const words = text.toLowerCase().match(/\b[a-z]{5,}\b/g) ?? [];
  const STOP_WORDS = new Set(["which", "there", "their", "these", "those",
    "about", "would", "could", "should", "having", "being", "after", "before",
    "while", "where", "every", "really", "quite", "other", "around", "again"]);
  const seen = new Map<string, number>();

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (STOP_WORDS.has(word)) continue;
    const prev = seen.get(word);
    if (prev !== undefined && i - prev <= 50) {
      const rawWords = text.split(/\s+/);
      const wordIndex = rawWords.findIndex(w => w.toLowerCase().replace(/[^a-z]/g, "") === word);
      const excerpt = rawWords.slice(Math.max(0, wordIndex - 2), wordIndex + 5).join(" ");
      suggestions.push({
        id: `word_rep_${word}_${i}`,
        category: "word_repetition",
        message: `"${word}" appears twice within 50 words.`,
        excerpt: excerpt.slice(0, 60),
        severity: "info",
      });
      seen.delete(word);
    } else {
      seen.set(word, i);
    }
  }
  return suggestions.slice(0, 3);
}

function checkPacing(text: string): PassiveSuggestion[] {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const suggestions: PassiveSuggestion[] = [];

  if (wordCount > 0 && wordCount < 200) {
    suggestions.push({
      id: "pacing_short",
      category: "pacing",
      message: `This chapter is only ${wordCount} words. Chapters under 200 words may feel incomplete.`,
      excerpt: text.slice(0, 60),
      severity: "info",
    });
  }

  if (wordCount > 5000) {
    suggestions.push({
      id: "pacing_long",
      category: "pacing",
      message: `This chapter is ${wordCount} words. Chapters over 5,000 words may benefit from a split.`,
      excerpt: text.slice(0, 60),
      severity: "info",
    });
  }

  return suggestions;
}

function checkDialogueRatio(text: string): PassiveSuggestion[] {
  const dialogueMatches = text.match(/"[^"]+"/g) ?? [];
  const dialogueChars = dialogueMatches.reduce((sum, m) => sum + m.length, 0);
  const ratio = dialogueChars / text.length;

  if (ratio > 0.75 && text.length > 500) {
    return [{
      id: "dialogue_ratio",
      category: "dialogue_ratio",
      message: `Over 75% of this chapter is dialogue with little scene movement or description.`,
      excerpt: (dialogueMatches[0] ?? "").slice(0, 60),
      severity: "warning",
    }];
  }
  return [];
}

function checkSentenceUniformity(text: string): PassiveSuggestion[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [];
  if (sentences.length < 10) return [];

  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;

  if (variance < 10 && avg > 8) {
    return [{
      id: "sentence_uniformity",
      category: "sentence_uniformity",
      message: `Sentence lengths are very uniform (~${Math.round(avg)} words each). Vary short and long sentences for rhythm.`,
      excerpt: (sentences[0] ?? "").trim().slice(0, 60),
      severity: "info",
    }];
  }
  return [];
}
