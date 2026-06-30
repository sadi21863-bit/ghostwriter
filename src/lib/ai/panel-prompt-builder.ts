// Each art style now carries concrete `styleModifiers` (line work, colour
// treatment, shading, reading feel) that get baked into the panel prompt — a
// zero-extra-cost quality lift over the bare preset label. `color` drives future
// layout/format logic. `higgsfieldPreset` is kept for backward compatibility
// (ComicStudio's picker + the persisted artStylePreset column still read it).
export const ART_STYLES = [
  { id: "manga",         label: "Manga",            higgsfieldPreset: "Manga",         color: "bw",
    styleModifiers: "authentic black-and-white manga, crisp inked linework, screentone shading, expressive eyes, dynamic diagonal composition, speed lines for motion" },
  { id: "manhwa",        label: "Manhwa / Webtoon", higgsfieldPreset: "Anime",         color: "color",
    styleModifiers: "full-colour Korean manhwa / webtoon art, soft cel shading, clean digital linework, vibrant ambient lighting, tall vertical-scroll friendly composition" },
  { id: "western",       label: "Western Comic",    higgsfieldPreset: "Comic Book",    color: "color",
    styleModifiers: "American comic-book art, bold confident ink outlines, halftone dot shading, saturated primary colours, dramatic chiaroscuro lighting" },
  { id: "graphic_novel", label: "Graphic Novel",    higgsfieldPreset: "Graphic Novel", color: "color",
    styleModifiers: "literary graphic-novel illustration, painterly muted palette, textured brushwork, grounded realistic proportions, atmospheric lighting" },
  { id: "watercolor",    label: "Watercolor",       higgsfieldPreset: "Watercolor",    color: "color",
    styleModifiers: "soft watercolour illustration, bleeding pigments, visible paper texture, gentle gradients, delicate linework" },
  { id: "noir",          label: "Noir",             higgsfieldPreset: "Dark Fantasy",  color: "bw",
    styleModifiers: "high-contrast noir ink art, deep blacks, hard rim light, heavy shadow, rain-slick textures, moody low-key lighting" },
  { id: "anime",         label: "Anime",            higgsfieldPreset: "Anime",         color: "color",
    styleModifiers: "modern anime key-visual style, clean cel shading, bright saturated colours, sharp highlights, detailed eyes" },
  { id: "cartoon",       label: "Cartoon",          higgsfieldPreset: "Cartoon",       color: "color",
    styleModifiers: "stylised cartoon art, bold simple shapes, thick clean outlines, flat bright colours, exaggerated expressions" },
];

export type ArtStyle = typeof ART_STYLES[number];

export type PanelSpec = {
  beatIndex: number;
  action: string;
  characters: string[];
  location: string;
  shotType: string;
  mood: string;
};

export function buildBreakdownPrompt(sceneContent: string, characters: any[], worldEntities: any[] = []): { prompt: string; wasTruncated: boolean } {
  const MAX_CHARS = 3000;
  const wasTruncated = sceneContent.length > MAX_CHARS;
  const content = sceneContent.substring(0, MAX_CHARS);
  const charList = characters.map((c: any) => c.name).join(", ");
  const elementList = (worldEntities ?? []).map((e: any) => e.name).filter(Boolean).join(", ");
  return {
    prompt: `Break this story scene into exactly 6 comic panel visual descriptions.

Characters in this story: ${charList || "none specified"}${elementList ? `\n\nKey world elements (objects, weapons, organizations, phenomena) — depict these when the scene calls for them: ${elementList}` : ""}

Rules:
- action must be purely visual (no dialogue, no inner thoughts)
- Vary shot types: establishing, wide, medium, close-up, over-the-shoulder, POV
- Return ONLY a JSON array of 6 objects, no markdown, no explanation:
[{"beatIndex":0,"action":"...","characters":["Name"],"location":"...","shotType":"...","mood":"..."}]

Scene:
${content}`,
    wasTruncated,
  };
}

// Pick the world elements visually relevant to a panel: any flagged
// alwaysInContext (signature props/factions you want consistent everywhere) plus
// any whose name is mentioned in the panel's action text. Capped so the prompt
// stays focused.
export function relevantWorldElements(action: string, worldEntities: any[]): any[] {
  if (!worldEntities?.length) return [];
  const actionLower = (action || "").toLowerCase();
  return worldEntities
    .filter((e: any) => e?.name && (e.alwaysInContext || actionLower.includes(String(e.name).toLowerCase())))
    .slice(0, 4);
}

export function buildPanelPrompt(
  spec: PanelSpec,
  characters: any[],
  artStyle: ArtStyle,
  projectName: string,
  worldEntities: any[] = []
): string {
  const charDetails = spec.characters
    .map((name: string) => characters.find((c: any) => c.name === name))
    .filter(Boolean)
    .map((c: any) => `${c.name}: ${c.visualProfile || c.appearance || "no description"}`)
    .join(". ");

  // Prefer the rich style modifiers; fall back to the legacy preset label for any
  // style that hasn't been given modifiers.
  const styleDirective = (artStyle as any).styleModifiers
    ? `${(artStyle as any).styleModifiers}.`
    : `${artStyle.higgsfieldPreset} style.`;

  // Inject visually-relevant world elements (a signature weapon, a faction's
  // banner, a phenomenon) so the image generator renders them consistently —
  // the visual parallel to the prose context's WORLD ELEMENTS section.
  const elementDetails = relevantWorldElements(spec.action, worldEntities)
    .map((e: any) => `${e.name}: ${e.summary || e.description || e.properties?.significance || "as described"}`)
    .join(". ");

  return `Comic panel, ${styleDirective} ${spec.shotType}. ${spec.action}. Setting: ${spec.location}. Mood: ${spec.mood}.${charDetails ? " Characters — " + charDetails + "." : ""}${elementDetails ? " World elements — " + elementDetails + "." : ""} Story: ${projectName}. Professional sequential art, consistent character designs, anatomically correct with natural proportions and correct hands, physically plausible poses, cinematic framing, high detail. Leave blank space at the bottom 15% for a dialogue bubble. No text, no speech bubbles, no captions, no lettering in the image.`;
}

export function getCharacterReference(characterName: string, characters: any[]): string | undefined {
  const char = characters.find((c: any) => c.name === characterName);
  return char?.portraitUrl || undefined;
}
