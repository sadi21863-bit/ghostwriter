import { LAYER_OPTIONS, type CompositionLayer, type CompositionLayerType } from "@/lib/ai/composer";

export interface CompositionSuggestion {
  layers: CompositionLayer[];
  reason: string;
}

// Broad per-type detectors, run independently (unlike classifyBeat()/suggestSkill(),
// which each pick exactly ONE mode via first-match-wins). Composition mode can have
// 2-4 layers active simultaneously, so detection here must be able to fire on several
// types for the same beat rather than stopping at the first hit.
const TYPE_PATTERNS: Record<CompositionLayerType, RegExp> = {
  combat:     /\b(fight|punch|kick|stab|sword|knife|combat|battle|spar|brawl|block|dodge|strike|wrestl)/i,
  emotional:  /\b(grief|griev|mourn|cry|cried|sob|wept|rage|fury|furious|fear|afraid|terrified|shame|humiliat|joy|elated|intima|despair|hopeless)/i,
  tension:    /\b(suspense|dread|paranoi|countdown|ticking|deadline|curious|curiosity|watch(ed|ing)?|follow(ed|ing)?|trap|threat)/i,
  atmosphere: /\b(fog|mist|rain|decay|ruin|abandoned|urban|city street|confined|trapped in|liminal|forest|wilderness)/i,
};

// Sub-detectors: given a detected TYPE, guess the specific LAYER_OPTIONS param from more
// targeted keywords. Only returns a name the type actually offers — never invents one.
const PARAM_KEYWORDS: Partial<Record<CompositionLayerType, Record<string, RegExp>>> = {
  emotional: {
    Grief: /\b(grief|griev|mourn|funeral|loss|died)/i,
    Rage: /\b(rage|fury|furious|screamed|explod)/i,
    Fear: /\b(fear|afraid|terrified|panic)/i,
    Shame: /\b(shame|humiliat|flush)/i,
    Joy: /\b(joy|elated|delight)/i,
    Intimacy: /\b(intima|held each other|closeness)/i,
    Despair: /\b(despair|hopeless)/i,
  },
  tension: {
    Dread: /\b(dread|something.?s wrong)/i,
    Paranoia: /\b(paranoi|being watched|followed)/i,
    Countdown: /\b(countdown|ticking|deadline|running out of time)/i,
    Curiosity: /\b(curious|curiosity|wondered what)/i,
    Suspense: /\b(suspense|waited|held (her|his|their) breath)/i,
  },
  atmosphere: {
    Abandoned: /\b(abandoned|ruin|decay|derelict)/i,
    Urban: /\b(city|urban|street|traffic|neon)/i,
    Confined: /\b(confined|cramped|trapped|small room|elevator)/i,
    Liminal: /\b(liminal|hallway|threshold|in-between)/i,
    Natural: /\b(forest|wilderness|mountain|river|woods)/i,
  },
};

function guessParam(type: CompositionLayerType, text: string): string {
  if (type === "combat") {
    // Only claim a specific style if its exact name is actually named in the text —
    // generic combat keywords (punch/kick/fight) don't imply which style.
    const named = LAYER_OPTIONS.combat.find((style) => text.toLowerCase().includes(style.toLowerCase()));
    return named ?? LAYER_OPTIONS.combat[0];
  }
  const table = PARAM_KEYWORDS[type];
  if (table) {
    for (const [name, pattern] of Object.entries(table)) {
      if (pattern.test(text)) return name;
    }
  }
  return LAYER_OPTIONS[type][0];
}

/**
 * Detects whether MULTIPLE technique-library layers (combat/emotional/tension/
 * atmosphere) are simultaneously present in a beat, producing a ready-to-apply
 * CompositionLayer[] — unlike classifyBeat()/suggestSkill(), which each pick exactly
 * one mode. Still a pure, zero-latency, zero-cost keyword heuristic (no LLM call),
 * surfaced as a suggestion for a human to confirm — mirrors classifyBeat's
 * "suggest, never auto-apply" contract; it never fires generation itself. Only
 * returns when 2+ layer types are detected — a single-layer match is exactly what
 * classifyBeat/suggestSkill already handle well, so this stays out of their way.
 */
export function suggestComposition(text: string): CompositionSuggestion | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;

  const detectedTypes = (Object.keys(TYPE_PATTERNS) as CompositionLayerType[])
    .filter((type) => TYPE_PATTERNS[type].test(trimmed));

  if (detectedTypes.length < 2) return null;

  const layers: CompositionLayer[] = detectedTypes.slice(0, 4).map((type) => ({
    type,
    param: guessParam(type, trimmed),
  }));

  const names = layers.map((l) => `${l.type} (${l.param})`).join(" + ");
  return {
    layers,
    reason: `Detected ${names} operating together in this beat — Composition mode can write their intersection instead of just one library at a time.`,
  };
}
