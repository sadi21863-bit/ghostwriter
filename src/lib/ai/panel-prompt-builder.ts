export const ART_STYLES = [
  { id: "manga",         label: "Manga",         higgsfieldPreset: "Manga" },
  { id: "western",       label: "Western Comic",  higgsfieldPreset: "Comic Book" },
  { id: "graphic_novel", label: "Graphic Novel",  higgsfieldPreset: "Graphic Novel" },
  { id: "watercolor",    label: "Watercolor",     higgsfieldPreset: "Watercolor" },
  { id: "noir",          label: "Noir",           higgsfieldPreset: "Dark Fantasy" },
  { id: "anime",         label: "Anime",          higgsfieldPreset: "Anime" },
  { id: "cartoon",       label: "Cartoon",        higgsfieldPreset: "Cartoon" },
];

export type PanelSpec = {
  beatIndex: number;
  action: string;
  characters: string[];
  location: string;
  shotType: string;
  mood: string;
};

export function buildBreakdownPrompt(sceneContent: string, characters: any[]): string {
  const charList = characters.map((c: any) => c.name).join(", ");
  return `Break this story scene into exactly 6 comic panel visual descriptions.

Characters in this story: ${charList || "none specified"}

Rules:
- action must be purely visual (no dialogue, no inner thoughts)
- Vary shot types: establishing, wide, medium, close-up, over-the-shoulder, POV
- Return ONLY a JSON array of 6 objects, no markdown, no explanation:
[{"beatIndex":0,"action":"...","characters":["Name"],"location":"...","shotType":"...","mood":"..."}]

Scene:
${sceneContent.substring(0, 3000)}`;
}

export function buildPanelPrompt(
  spec: PanelSpec,
  characters: any[],
  artStyle: typeof ART_STYLES[0],
  projectName: string
): string {
  const charDetails = spec.characters
    .map((name: string) => characters.find((c: any) => c.name === name))
    .filter(Boolean)
    .map((c: any) => `${c.name}: ${c.appearance || "no appearance description"}`)
    .join(". ");

  return `${artStyle.higgsfieldPreset} style comic panel. ${spec.shotType}. ${spec.action}. Setting: ${spec.location}. Mood: ${spec.mood}.${charDetails ? " Characters — " + charDetails + "." : ""} Story: ${projectName}. Professional sequential art, cinematic framing, high detail. Leave blank space at bottom 15% for dialogue overlay. No text, no speech bubbles, no captions in the image.`;
}

export function getCharacterReference(characterName: string, characters: any[]): string | undefined {
  const char = characters.find((c: any) => c.name === characterName);
  return char?.portraitUrl || undefined;
}
