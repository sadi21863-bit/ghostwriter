import type { WorkPacketPrinciple } from '@/types';

export interface WorkPacket {
  title: string;
  creator: string;
  medium: string;
  thematicCore: string;
  craftPrinciples: WorkPacketPrinciple[];
  structuralNotes?: string;
  characterNotes?: string;
  dialogueNotes?: string;
}

const MEDIUM_FORMAT_COMPATIBILITY: Record<string, string[]> = {
  'manga':       ['Web Series', 'Novel'],
  'film':        ['Screenplay', 'Web Series', 'Novel'],
  'tv':          ['Web Series', 'Screenplay', 'Novel'],
  'novel':       ['Novel', 'Screenplay'],
  'short-story': ['Novel', 'Web Series'],
};

const VISUAL_GRAMMAR_TERMS = [
  'panel', 'panels', 'cut to', 'smash cut', 'montage', 'close-up', 'wide shot',
  'page turn', 'spread', 'white space', 'gutters', 'bleed', 'splash page',
];

export function buildInfluenceContext(
  packet: WorkPacket,
  mode: string,
  projectFormat?: string
): string {
  const relevantPrinciples = packet.craftPrinciples
    .filter(p => !p.applicableTo?.length || p.applicableTo.includes(mode) || p.applicableTo.includes('write'))
    .filter(p => {
      if (!projectFormat || !['Novel', 'Screenplay'].includes(projectFormat)) return true;
      const hasVisualGrammar = VISUAL_GRAMMAR_TERMS.some(term =>
        p.principle.toLowerCase().includes(term) || p.example?.toLowerCase().includes(term)
      );
      return !hasVisualGrammar;
    })
    .slice(0, 4);

  if (relevantPrinciples.length === 0) return '';

  const isCompatible = !projectFormat || !packet.medium ||
    (MEDIUM_FORMAT_COMPATIBILITY[packet.medium] ?? []).includes(projectFormat);

  const lines = [
    `ACTIVE INFLUENCE: The writer has asked to channel the craft of "${packet.title}" (${packet.medium}${packet.creator ? ', ' + packet.creator : ''}).`,
    `Thematic DNA: ${packet.thematicCore}`,
  ];

  if (!isCompatible && projectFormat) {
    lines.push(`Note: This work is from a different medium (${packet.medium} → ${projectFormat}). Apply the narrative and emotional techniques only — not the format-specific visual grammar.`);
  }

  lines.push('', `APPLY THESE CRAFT PRINCIPLES — technique only, never plot or characters:`);

  relevantPrinciples.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.principle}`);
    if (p.example) lines.push(`   Source example: ${p.example}`);
  });

  if (mode === 'write' && packet.structuralNotes) {
    lines.push('', `STRUCTURAL APPROACH: ${packet.structuralNotes}`);
  }
  if (mode === 'dialogue' && packet.dialogueNotes) {
    lines.push('', `DIALOGUE APPROACH: ${packet.dialogueNotes}`);
  }
  if ((mode === 'emotional' || mode === 'atmosphere') && packet.characterNotes) {
    lines.push('', `CHARACTER REGISTER: ${packet.characterNotes}`);
  }

  lines.push('', `IMPORTANT: Generate original content. The above describes techniques, not content to reproduce.`);
  return lines.join('\n');
}
