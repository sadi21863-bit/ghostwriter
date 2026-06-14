// src/lib/modes/beats.ts
export function parseBeatList(text: string): string[] | null {
  const lines = text.split('\n').filter(l => l.trim().startsWith('BEAT:'));
  if (lines.length < 3) return null;
  return lines.map(l => l.replace(/^BEAT:\s*/, '').trim());
}
