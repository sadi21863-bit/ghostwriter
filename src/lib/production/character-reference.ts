// Shared character-consistency resolution — prefers a trained Higgsfield Soul
// ID (custom_reference_id) over a raw portrait image URL, since a trained Soul
// ID is a materially stronger consistency mechanism (per-character, trained on
// 3+ images) than a single static reference photo. Extracted from
// comics/route.ts so Production Studio's shot preview routes and the comic
// panel regenerate route can share one resolution path instead of Production
// Studio only ever checking portraitUrl.

export interface CharacterSoulSource {
  name: string;
  soulId?: string | null;
  portraitUrl?: string | null;
}

export interface CharacterSoulReference {
  referenceImageUrl?: string;
  soulId?: string;
  referenceStrength: number;
}

export function getCharacterSoulReference(
  characterName: string | undefined | null,
  characters: CharacterSoulSource[],
): CharacterSoulReference {
  const char = characterName ? characters.find(c => c.name === characterName) : undefined;
  if (!char) return { referenceStrength: 0.85 };
  if (char.soulId) return { soulId: char.soulId, referenceStrength: 0.95 };
  if (char.portraitUrl) return { referenceImageUrl: char.portraitUrl, referenceStrength: 0.85 };
  return { referenceStrength: 0.85 };
}
