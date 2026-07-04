import { anthropic as client } from "@/lib/ai/client";

interface PacketForPattern {
  title: string;
  medium: string;
  genres: string[];
  thematicCore: string;
  craftPrinciples: { principle: string; example: string }[];
}

export async function generatePatterns(packets: PacketForPattern[]): Promise<{
  name: string;
  description: string;
  medium: string;
  genres: string[];
  supportingPacketTitles: string[];
  generationDirective: string;
  applicableTo: string[];
}[]> {

  const packetSummary = packets.map(p =>
    `WORK: ${p.title} (${p.medium}) — ${p.thematicCore}\nPRINCIPLES: ${p.craftPrinciples.map(c => c.principle).join('; ')}`
  ).join('\n\n');

  const { MODELS } = await import('@/lib/ai/engine');
  const response = await client.messages.create({
    model: MODELS.quality,
    max_tokens: 3000,
    system: `You are a cross-media narrative analyst. Your job is to identify craft patterns
that appear across multiple creative works — structures, techniques, and conventions
that writers can deliberately apply.

A good pattern:
- Appears in at least 3 of the provided works (even if expressed differently)
- Is a technique or structure, not a theme
- Can be expressed as a generation directive (instructions to a writing AI)
- Is named memorably: "Slow-burn betrayal arc", "The false mentor reveal", "Earned violence"

Your output must be JSON only, no markdown, no explanation.`,
    messages: [{
      role: 'user',
      content: `Analyze these ${packets.length} works and extract 4-8 cross-work craft patterns.

${packetSummary}

Return JSON:
{
  "patterns": [
    {
      "name": "Short memorable name",
      "description": "2-sentence explanation of the pattern",
      "medium": "cross-medium | film | manga | tv | novel",
      "genres": ["applicable genre"],
      "supportingPacketTitles": ["Title 1", "Title 2", "Title 3"],
      "generationDirective": "Specific instruction for the writing AI when this pattern is active (2-4 sentences)",
      "applicableTo": ["write", "brainstorm", "dialogue", "emotional"]
    }
  ]
}`,
    }],
  });

  const text = response.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed.patterns ?? [];
  } catch {
    return [];
  }
}
