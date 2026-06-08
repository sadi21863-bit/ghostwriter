export interface Capability {
  id:        string;
  label:     string;
  hint:      string;
  checkFn:   (project: any, characters: any[]) => boolean;
}

export const AI_CAPABILITIES: Capability[] = [
  {
    id: 'voice_consistency',
    label: 'Voice consistency',
    hint: 'AI matches your sentence rhythm, contraction rate, and prose register',
    checkFn: (p, _) => !!(p.styleDna && p.styleDna.trim().length > 50),
  },
  {
    id: 'voice_fingerprint',
    label: 'Constraint-based voice',
    hint: 'AI uses measured stylometric constraints from your actual chapters',
    checkFn: (p, _) => {
      const chapters = p.chapters?.filter((c: any) => c.content?.trim().length > 200) ?? [];
      return chapters.length >= 3;
    },
  },
  {
    id: 'idiot_plot_prevention',
    label: 'Idiot plot prevention',
    hint: 'AI never lets characters act on information they don\'t have',
    checkFn: (_, chars) => chars.some((c: any) =>
      c.knowledgeMap && Object.keys(c.knowledgeMap).length > 0
    ),
  },
  {
    id: 'nvc_body_language',
    label: 'NVC body language',
    hint: 'AI generates authentic non-verbal communication from character baselines',
    checkFn: (_, chars) => chars.some((c: any) =>
      c.nvcBaseline && c.nvcBaseline.trim().length > 20
    ),
  },
  {
    id: 'flaw_driven_conflict',
    label: 'Flaw-driven conflict',
    hint: 'AI introduces tension from character flaws, not plot convenience',
    checkFn: (_, chars) => chars.some((c: any) =>
      c.flawTriangle && Object.keys(c.flawTriangle).length > 0
    ),
  },
  {
    id: 'arc_pacing',
    label: 'Arc-aware pacing',
    hint: 'AI adjusts emotional weight and sentence rhythm to your story\'s arc position',
    checkFn: (p, _) => !!(p.controllingIdea && p.controllingIdea.trim().length > 20),
  },
  {
    id: 'want_need_tension',
    label: 'Want/need collision',
    hint: 'AI generates scenes where characters\' conscious goals conflict with what they need',
    checkFn: (_, chars) => chars.some((c: any) =>
      c.characterWant && c.characterNeed
    ),
  },
  {
    id: 'aiisms_filter',
    label: 'AIisms blocked',
    hint: 'The 20 most common AI fiction tells are blocked from output',
    checkFn: (p, _) => !!(p as any).aiismsCheck,
  },
  {
    id: 'quality_grading',
    label: 'AI quality review',
    hint: 'Post-generation async check for rule violations and prose quality',
    checkFn: (p, _) => !!(p as any).qualityGradingEnabled,
  },
  {
    id: 'series_context',
    label: 'Series memory',
    hint: 'AI knows what happened in previous books — characters accumulate history',
    checkFn: (p, _) => (p.storyType === 'series' && !!(p as any).seriesParentId)
      || (p.storyType === 'universe-story' && !!(p as any).universeId),
  },
];
