import { anthropic as client } from "@/lib/ai/client";

export interface ResearchResult {
  title: string;
  creator: string;
  medium: string;
  genres: string[];
  thematicCore: string;
  craftPrinciples: { principle: string; example: string; applicableTo: string[] }[];
  structuralNotes: string;
  characterNotes: string;
  dialogueNotes: string;
  confidence: 'high' | 'medium' | 'low';
}

export async function researchWorkPacket(title: string, medium?: string): Promise<ResearchResult> {

  // Step 1 — Identify and verify the work (with web search for obscure/recent works)
  const { MODELS } = await import('@/lib/ai/engine');
  const identifyResponse = await client.messages.create({
    model: MODELS.quality,
    max_tokens: 1000,
    tools: [{ type: 'web_search_20250305' as any, name: 'web_search' }],
    messages: [{
      role: 'user',
      content: `Search for "${title}"${medium ? ` (${medium})` : ''} and identify: full title, creator/director/author, year of release, medium/format, primary genres, and a one-sentence thematic core. I need the actual creative work, not a description of similar works.`,
    }],
  });

  const identifyText = identifyResponse.content
    .filter(b => b.type === 'text').map(b => (b as any).text).join('');

  // Step 2 — Craft analysis
  const craftResponse = await client.messages.create({
    model: MODELS.quality,
    max_tokens: 2000,
    system: `You are a craft analyst extracting actionable writing principles from creative works.
Your output must be: specific, example-grounded, and applicable to fiction writing.
NEVER include plot spoilers as principles. Focus on HOW the work achieves its effects.
Each principle must be a technique, not a description.`,
    messages: [{
      role: 'user',
      content: `Based on your knowledge of "${title}", extract 4-6 craft principles.
Each principle must:
1. State a specific technique (not a theme or plot point)
2. Give a concrete example from the work
3. Note which writing modes it applies to: write, brainstorm, dialogue, emotional, atmosphere, tension, horror, mystery, romance, action, comedy

Format as JSON only:
{
  "craftPrinciples": [
    { "principle": "...", "example": "...", "applicableTo": ["write", "emotional"] }
  ],
  "structuralNotes": "...",
  "characterNotes": "...",
  "dialogueNotes": "..."
}`,
    }],
  });

  const craftText = craftResponse.content
    .filter(b => b.type === 'text').map(b => (b as any).text).join('');

  let craftData = { craftPrinciples: [] as any[], structuralNotes: '', characterNotes: '', dialogueNotes: '' };
  try {
    const jsonMatch = craftText.match(/\{[\s\S]*\}/);
    if (jsonMatch) craftData = JSON.parse(jsonMatch[0]);
  } catch {
    // If JSON parse fails, provisional packet is still created with empty principles
  }

  const creatorMatch = identifyText.match(/(?:creator|director|author|by)[:\s]+([^\n,\.]+)/i);
  const mediumMatch  = identifyText.match(/(?:medium|format|type)[:\s]+([^\n,\.]+)/i);
  const thematicMatch = identifyText.match(/(?:thematic core|theme|about)[:\s]+([^\n\.]+)/i);

  return {
    title,
    creator:        creatorMatch?.[1]?.trim()  ?? '',
    medium:         mediumMatch?.[1]?.trim()   ?? medium ?? 'unknown',
    genres:         [],
    thematicCore:   thematicMatch?.[1]?.trim() ?? '',
    craftPrinciples: craftData.craftPrinciples,
    structuralNotes: craftData.structuralNotes,
    characterNotes:  craftData.characterNotes,
    dialogueNotes:   craftData.dialogueNotes,
    confidence: craftData.craftPrinciples.length >= 4 ? 'high'
              : craftData.craftPrinciples.length >= 2 ? 'medium'
              : 'low',
  };
}
