// Deterministic "humanize" scorer — no LLM, instant, zero cost. A second opinion
// alongside FICTION_AIISMS (src/lib/ai/aiisms.ts, checked via prompt instruction
// before generation) and analyzeProseRhythm (rhythm.ts, sentence-level cadence).
//
// Patterns extracted (not copied) from conorbronsdon/avoid-ai-writing's public
// category descriptions (see docs/2026-07-06-repo-research-findings.md) — that
// tool's ~51 categories are mostly aimed at non-fiction/article writing (citation
// markup, hashtag stuffing, "notability name-dropping"); this file reimplements
// only the categories that transfer to fiction prose, none of which overlap with
// rhythm.ts's sentence-cadence/repetition signal:
//   - chatbot/assistant artifacts breaking character (meta-commentary, openers
//     like "Certainly!", self-congratulatory scene-labeling)
//   - named-emotion-without-body ("felt sad" instead of showing the feeling)
//   - copula-heavy formal AI constructions ("X serves as Y", "not just X but Y")
//   - generic meta scene-closing wrap-ups
// No code, regex list, or scoring formula was copied from that repo — this is an
// independent implementation of the same technique, scoped to what fiction needs.

export interface HumanizeFlag {
  label: string;
  severity: "low" | "med" | "high";
  detail: string;
}

export interface HumanizeReport {
  score: number; // 0 (clean) - 100 (heavy AI tells)
  label: "Clean" | "Minor tells" | "Noticeable AI tells" | "Heavy AI tells";
  flags: HumanizeFlag[];
}

const ASSISTANT_OPENERS = /^\s*(certainly|sure|of course|absolutely|great question|i'd be happy to|as an ai|i understand|here(?:'s| is) (?:the|your) (?:scene|chapter|passage))\b/i;

const META_COMMENTARY = [
  /\blet'?s (?:dive into|explore|take a look at)\b/i,
  /\bi hope (?:this|that) (?:helps|works|is what you)\b/i,
  /\b(?:i've|i have) (?:written|crafted|created) (?:this|the following|a)\b/i,
  /\bas (?:requested|you asked)\b/i,
  /\bnote: this (?:is|scene is|passage is)\b/i,
];

const CUTOFF_DISCLAIMERS = [
  /\bto be continued\b/i,
  /\bi'?ll continue (?:this|the scene|in the next)\b/i,
  /\[(?:continued|continues) (?:in|below|next)\]/i,
];

const SELF_LABELING = /\bthis (?:powerful|poignant|pivotal|touching|heartbreaking|climactic) (?:moment|scene)\b/i;

const NAMED_EMOTION = /\b(?:felt|was feeling)\s+(sad|happy|angry|afraid|scared|nervous|anxious|excited|terrified|furious|devastated|heartbroken|overwhelmed|frustrated|joyful|ecstatic)\b/gi;

const COPULA_AI_PATTERNS = [
  /\bis not (?:just|only)\b[^.!?]{0,60}\bbut\b/i,
  /\bserves as\b/i,
  /\bstands as a (?:testament|reminder|symbol)\b/i,
  /\bplays? an? (?:crucial|vital|significant|pivotal) role\b/i,
];

const GENERIC_CLOSERS = /^\s*(?:in the end|ultimately|in conclusion|all in all)\b/i;

function lastParagraph(text: string): string {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return paras.length ? paras[paras.length - 1] : text;
}

export function analyzeHumanize(raw: string): HumanizeReport {
  const text = (raw || "").trim();
  const flags: HumanizeFlag[] = [];
  let score = 0;

  if (!text) return { score: 0, label: "Clean", flags: [] };

  // 1. Assistant/chatbot artifacts breaking character — highest severity, these
  // are single hard failures (the model spoke as itself, not as the story).
  if (ASSISTANT_OPENERS.test(text)) {
    flags.push({ label: "Assistant opener", severity: "high", detail: 'Text opens with an assistant-voice phrase ("Certainly!", "Here\'s the scene...") instead of starting in the story.' });
    score += 35;
  }
  const metaHits = META_COMMENTARY.filter((re) => re.test(text));
  if (metaHits.length) {
    flags.push({ label: "Meta-commentary", severity: "high", detail: `Found ${metaHits.length} phrase(s) where the model talks about writing the scene rather than writing it (e.g. "let's dive into", "I hope this helps").` });
    score += 25 * metaHits.length;
  }
  const cutoffHits = CUTOFF_DISCLAIMERS.filter((re) => re.test(text));
  if (cutoffHits.length) {
    flags.push({ label: "Cutoff disclaimer", severity: "med", detail: 'Found an out-of-story disclaimer like "to be continued" or "[continues below]" instead of an in-scene ending.' });
    score += 15;
  }
  if (SELF_LABELING.test(text)) {
    flags.push({ label: "Self-labeling significance", severity: "med", detail: 'Narration labels its own moment as significant ("this powerful moment") instead of letting the scene earn that weight.' });
    score += 12;
  }

  // 2. Named emotion without physical grounding — density-based, not a hard fail.
  const emotionMatches = text.match(NAMED_EMOTION) || [];
  if (emotionMatches.length >= 2) {
    flags.push({ label: "Named emotion, no body", severity: emotionMatches.length >= 4 ? "high" : "med", detail: `${emotionMatches.length} instance(s) of a bare emotion label ("felt sad") with no physical/behavioral evidence nearby. Show the body, not the label.` });
    score += Math.min(24, emotionMatches.length * 6);
  }

  // 3. Copula-heavy formal AI constructions.
  const copulaHits = COPULA_AI_PATTERNS.filter((re) => re.test(text));
  if (copulaHits.length) {
    flags.push({ label: "Formal AI construction", severity: copulaHits.length >= 2 ? "med" : "low", detail: `${copulaHits.length} instance(s) of stock formal phrasing ("serves as", "plays a vital role", "is not just X but Y") — write the specific claim directly instead.` });
    score += 8 * copulaHits.length;
  }

  // 4. Generic meta scene-closing wrap-up.
  if (GENERIC_CLOSERS.test(lastParagraph(text))) {
    flags.push({ label: "Generic closing wrap-up", severity: "low", detail: 'Final paragraph opens with a summarizing wrap-up ("In the end...", "Ultimately...") instead of ending on a scene beat.' });
    score += 10;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const label: HumanizeReport["label"] =
    score === 0 ? "Clean" : score < 20 ? "Minor tells" : score < 50 ? "Noticeable AI tells" : "Heavy AI tells";

  return { score, label, flags };
}
