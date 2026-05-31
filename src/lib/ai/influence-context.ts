import type { WorkPacketPrinciple } from '@/types';

interface WorkPacket {
  title: string;
  creator: string;
  medium: string;
  thematicCore: string;
  craftPrinciples: WorkPacketPrinciple[];
  structuralNotes?: string;
  characterNotes?: string;
  dialogueNotes?: string;
}

export function buildInfluenceContext(packet: WorkPacket, mode: string): string {
  const relevantPrinciples = packet.craftPrinciples
    .filter(p => !p.applicableTo?.length || p.applicableTo.includes(mode) || p.applicableTo.includes('write'))
    .slice(0, 4);

  if (relevantPrinciples.length === 0) return '';

  const lines = [
    `ACTIVE INFLUENCE: The writer has asked to channel the craft of "${packet.title}" (${packet.medium}${packet.creator ? ', ' + packet.creator : ''}).`,
    `Thematic DNA: ${packet.thematicCore}`,
    '',
    `APPLY THESE CRAFT PRINCIPLES — do not copy plot or characters, only technique:`,
  ];

  relevantPrinciples.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.principle}`);
    if (p.example) lines.push(`   Demonstrated in the source work: ${p.example}`);
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
