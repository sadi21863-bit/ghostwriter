export const EMOTIONAL_TONES = [
  'Grief', 'Rage', 'Fear', 'Shame', 'Despair',
  'Dread', 'Tenderness', 'Joy', 'Hope', 'Wonder',
  'Tension', 'Resolve', 'Relief', 'Anticipation',
] as const;

export const ARC_POSITIONS = [
  'Status Quo',
  'Inciting Incident',
  'Rising Action',
  'Midpoint Turn',
  'Dark Night / All Is Lost',
  'Crisis',
  'Climax',
  'Resolution',
  'Denouement',
] as const;

export const SCENE_PURPOSES: Record<string, string> = {
  'plot-advance':       'Plot Advance',
  'character-reveal':   'Character Reveal',
  'relationship-shift': 'Relationship Shift',
  'world-reveal':       'World Reveal',
  'tension-escalation': 'Tension Escalation',
  'emotional-payoff':   'Emotional Payoff',
  'thematic-beat':      'Thematic Beat',
  'transition':         'Transition',
};

export const ARC_POSITION_DIRECTIVES: Record<string, string> = {
  'Status Quo':              'The story has not yet broken. Write the world as it is — but seed the instability that will shatter it.',
  'Inciting Incident':       'Something irreversible just happened or is happening. The old normal is ending. The character does not yet know the full consequence.',
  'Rising Action':           'The protagonist is in motion. Stakes are escalating. Every scene must add pressure — nothing resolves here.',
  'Midpoint Turn':           'The midpoint shift — the story pivots on this. Something is revealed or decided that changes the nature of the conflict.',
  'Dark Night / All Is Lost':'The protagonist has failed or is about to. This is the emotional floor of the story. Do not rush out of it.',
  'Crisis':                  'The moment of irreversible decision. The protagonist chooses — and this choice costs them something they cannot get back.',
  'Climax':                  'The confrontation of maximum stakes. All threads converge. The outcome is genuinely uncertain until it is not.',
  'Resolution':              'The aftermath of the climax. Do not wrap up too neatly. Show the cost as well as the outcome.',
  'Denouement':              'The world after. The character is changed. Show who they are now, briefly, without explaining the transformation.',
};
