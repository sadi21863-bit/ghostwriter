export type SkillSuggestion = {
  mode: string;
  label: string;
  confidence: 'high' | 'medium';
  reason: string;
};

// Pattern map: [regex, mode, label, reason]
const SKILL_PATTERNS: [RegExp, string, string, string][] = [
  [/\b(fight|punch|kick|stab|sword|knife|combat|battle|spar|brawl|block|dodge|strike|threw|wrestl)/i,
   'combat', 'Combat Mode', 'Detected physical confrontation — Combat Mode adds biomechanical accuracy and fight choreography'],

  [/\b(grief|griev|mourn|funeral|cry|cried|sob|weep|wept|loss|died|death|tears|hollow|numb|broke down)/i,
   'emotional', 'Emotional Mode', 'Detected grief/loss — Emotional Mode applies body-first signal writing and FACS muscle-group accuracy'],
  [/\b(rage|fury|furious|screamed|explod|anger|burst|seeth|fist|slammed)/i,
   'emotional', 'Emotional Mode', 'Detected rage — Emotional Mode grounds this in sympathetic-system physiology'],
  [/\b(shame|humiliat|flush|burn|want to disappear|exposed|naked feeling|third.person)/i,
   'emotional', 'Emotional Mode', 'Detected shame response — Emotional Mode handles involuntary shame physiology'],

  [/\b(fog|mist|rain|decay|ruin|abandoned|empty|silence|dusk|dark|shadow|cold air|creak)/i,
   'atmosphere', 'Atmosphere Mode', 'Detected environmental scene — Atmosphere Mode activates multi-sensory world-building with Proust olfactory triggers'],

  [/\b(footstep|follow|watch|surveillance|trap|deadline|ticking|suspect|threat|hide|hiding|escape|caught)/i,
   'tension', 'Tension Mode', 'Detected suspense setup — Tension Mode applies Brewer & Lichtenstein structural affect engineering'],

  [/\b(monster|creature|horror|dread|terror|scream|blood|dark figure|wrong|shouldn't be|can't move)/i,
   'horror', 'Horror Mode', 'Detected horror elements — Horror Mode activates primal fear architecture'],

  [/\b(first time|eyes met|heart|breath|close|almost touch|want to|tension between|pull toward|held each other)/i,
   'romance', 'Romance Mode', 'Detected romantic tension — Romance Mode applies dopamine-uncertainty and attachment-theory grounding'],

  [/\b(clue|evidence|suspect|detective|investigate|hidden|secret|who|lie|truth|reveal|discover)/i,
   'mystery', 'Mystery Mode', 'Detected mystery/investigation — Mystery Mode applies information-gap structuring'],

  [/\b(chase|run|escape|heist|explosion|car|jump|race|sprint|pursuit|mission|assault|breach)/i,
   'action', 'Action Mode', 'Detected high-stakes action — Action Mode applies kinetic pacing and stakes management'],

  [/\b(absurd|ridiculous|irony|sarcasm|parody|joke|laugh|comic|chaos|disaster|mishap|bumble)/i,
   'comedy', 'Comedy Mode', 'Detected comedic register — Comedy Mode applies contrast mechanics and comedic rhythm'],

  [/\b(thinks|thought|realize|wonders|internal|mind|remember|memory|imagine|what if|replay|decide)/i,
   'monologue', 'Monologue Mode', 'Detected interiority — Monologue Mode applies stream-of-consciousness and self-interruption patterns'],
];

export function suggestSkill(prompt: string, currentMode: string): SkillSuggestion | null {
  if (!prompt?.trim()) return null;

  for (const [pattern, mode, label, reason] of SKILL_PATTERNS) {
    if (mode === currentMode) continue;
    if (pattern.test(prompt)) {
      const globalPattern = new RegExp(pattern.source, (pattern.flags || '') + 'g');
      const isHigh = (prompt.match(globalPattern) || []).length >= 2;
      return { mode, label, confidence: isHigh ? 'high' : 'medium', reason };
    }
  }

  return null;
}
