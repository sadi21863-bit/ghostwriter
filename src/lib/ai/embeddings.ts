import OpenAI from 'openai';

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  });
  return response.data[0].embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}

export function buildPacketEmbeddingText(packet: {
  title: string;
  medium: string;
  thematicCore: string;
  craftPrinciples: { principle: string }[];
}): string {
  return [
    `${packet.title} (${packet.medium})`,
    packet.thematicCore,
    ...packet.craftPrinciples.slice(0, 4).map(p => p.principle),
  ].join('. ');
}
