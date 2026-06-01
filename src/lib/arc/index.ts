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
  'Status Quo':              'The story has not yet broken. Write the world as it is — but seed the instability that will shatter it. Prose rhythm: measured, establishing, specific detail over summary. The ordinary should feel almost too ordinary.',
  'Inciting Incident':       'Something irreversible just happened or is happening. The old normal is ending. The character does not yet know the full consequence. Prose rhythm: slight acceleration, sentences begin to shorten as the event arrives.',
  'Rising Action':           'The protagonist is in motion. Stakes are escalating. Every scene must add pressure — nothing resolves here. Prose rhythm: building pace, compression between scenes of tension, expand only on moments of highest pressure.',
  'Midpoint Turn':           'The story pivots. Something is revealed or decided that changes the nature of the conflict. Prose rhythm: the turn itself gets slow, deliberate prose — then acceleration after the pivot.',
  'Dark Night / All Is Lost': 'The protagonist has failed or is about to. This is the emotional floor of the story. Do not rush out of it. Prose rhythm: SLOW. Long sentences that don\'t want to close. Grief delays. Do not resolve the paragraph until the feeling resolves. White space is silence.',
  'Crisis':                  'The moment of irreversible decision. The protagonist chooses — and this choice costs them something they cannot get back. Prose rhythm: SHORT. Four words. Then three. The decision itself gets one clear sentence. The cost gets another.',
  'Climax':                  'Maximum stakes. All threads converge. Time slows — the outcome is genuinely uncertain until it is not. Prose rhythm: SLOW DOWN here. Give individual actions full prose attention. Every physical detail is significant. This is the moment the whole story has been building toward — do not rush through it.',
  'Resolution':              'The aftermath of the climax. Do not wrap up too neatly. Show cost as well as outcome. Prose rhythm: compress time after the climax. The reader needs closure, not detail. Trust the summary.',
  'Denouement':              'The world after. The character is changed. Show who they are now, briefly, without explaining the transformation. Prose rhythm: quiet, spare, specific. One image or action that contains the whole arc without naming it.',
};
