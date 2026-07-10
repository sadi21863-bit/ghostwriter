// Orchestrates a StoryDiffusion comic page generation: submit -> poll -> crop
// -> upload, producing the SAME per-panel result shape the existing per-panel
// generateSoulImage() path returns, so comics/route.ts's downstream insert +
// Phase B vision-critic code needs zero changes regardless of which path ran.
//
// This closes the gap documented in CLAUDE.md item 26 / the 2026-06-25 gap
// analysis: generateStoryDiffusion() (src/lib/higgsfield/client.ts) and
// cropFourPanelGrid() (storydiffusion.ts, fixed 2026-07-09) both existed and
// were validated via standalone real-money test scripts, but neither was ever
// wired into the product's actual /comics generation route.
import type { PanelSpec, ArtStyle } from "@/lib/ai/panel-prompt-builder";
import { generateStoryDiffusion, pollJob } from "@/lib/higgsfield/client";
import { buildComicDescription, cropFourPanelGrid, storyDiffusionStyleFor } from "./storydiffusion";
import { getCharacterSoulReference } from "@/lib/production/character-reference";

export interface StoryDiffusionCharacterSource {
  name: string;
  appearance?: string | null;
  visualProfile?: string | null;
  soulId?: string | null;
  portraitUrl?: string | null;
}

export interface StoryDiffusionPanelResult {
  prompt: string;
  imageUrl: string;
  referenceImageUrl: string;
  characterName: string;
  index: number;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

/** Only "Four Pannel" output has the uniform 2x2 grid cropFourPanelGrid() can
 *  safely crop by index - "Classic Comic Style"'s irregular layout has no
 *  fixed geometry (confirmed the hard way, see storydiffusion.ts). StoryDiffusion
 *  is capped at 4 panels for this reason, unlike the per-panel path's 6. */
export const STORYDIFFUSION_MAX_PANELS = 4;

/**
 * Generate a comic page via Segmind StoryDiffusion (one call, multi-panel,
 * one consistent character identity) instead of N independent per-panel Soul
 * calls. `uploadPanel` is injected so this stays testable without a real
 * @vercel/blob token or network access.
 */
export async function generateComicPageViaStoryDiffusion(params: {
  apiKey: string;
  specs: PanelSpec[];
  characters: StoryDiffusionCharacterSource[];
  artStyle: ArtStyle;
  uploadPanel: (buf: Buffer, index: number) => Promise<string>;
  pollTimeoutMs?: number;
}): Promise<StoryDiffusionPanelResult[]> {
  const specs = params.specs.slice(0, STORYDIFFUSION_MAX_PANELS);

  // StoryDiffusion's model keeps ONE character identity consistent across the
  // whole comic_description (per its own design, see storydiffusion.ts) - pick
  // the first named character across the panels as the recurring lead, mirroring
  // the same "first-named character" convention buildPanelPrompt already uses
  // per-panel via spec.characters?.[0].
  const primarySpec = specs.find(s => s.characters?.length);
  const primaryName = primarySpec?.characters?.[0];
  const primaryChar = primaryName ? params.characters.find(c => c.name === primaryName) : undefined;
  const characterDescription = primaryChar
    ? `${primaryChar.name}: ${primaryChar.visualProfile || primaryChar.appearance || "no description"}`
    : "No recurring named character in this sequence.";

  // StoryDiffusion's ref_image expects a plain image URL, not a Higgsfield Soul
  // ID (custom_reference_id) - those are two different providers' consistency
  // mechanisms and aren't interchangeable, so a soulId-only reference is
  // deliberately left unused here rather than sent to a field that doesn't
  // understand it.
  const soulRef = primaryChar
    ? getCharacterSoulReference(primaryChar.name, params.characters)
    : undefined;
  const refImage = soulRef?.referenceImageUrl;

  const comicDescription = buildComicDescription(
    specs.map(s => ({ action: s.action, hasCharacter: (s.characters?.length ?? 0) > 0 })),
  );

  const submission = await generateStoryDiffusion({
    apiKey: params.apiKey,
    characterDescription,
    comicDescription,
    styleName: storyDiffusionStyleFor(params.artStyle),
    comicStyle: "Four Pannel",
    refImage,
    numIds: 1,
  });

  let pageUrl = submission.mediaUrl;
  if (!pageUrl) {
    if (!submission.pollingUrl) throw new Error("StoryDiffusion submission returned neither a media URL nor a polling URL");
    const timeoutMs = params.pollTimeoutMs ?? 180_000;
    const start = Date.now();
    let lastStatus: string | undefined;
    while (Date.now() - start < timeoutMs) {
      await sleep(5000);
      const poll = await pollJob({ apiKey: params.apiKey, pollingUrl: submission.pollingUrl });
      lastStatus = poll.status;
      if (poll.status === "COMPLETED") { pageUrl = poll.mediaUrl; break; }
      if (poll.status === "FAILED" || poll.status === "ERROR") {
        throw new Error(`StoryDiffusion generation failed: ${poll.error ?? "unknown error"}`);
      }
    }
    if (!pageUrl) throw new Error(`StoryDiffusion generation did not complete in time (last status: ${lastStatus ?? "none"})`);
  }

  const pageRes = await fetch(pageUrl);
  if (!pageRes.ok) throw new Error(`Failed to download StoryDiffusion page image (${pageRes.status})`);
  const pageBuf = Buffer.from(await pageRes.arrayBuffer());

  const results: StoryDiffusionPanelResult[] = [];
  for (let i = 0; i < specs.length; i++) {
    const panelIndex = i as 0 | 1 | 2 | 3;
    const cropped = await cropFourPanelGrid(pageBuf, panelIndex);
    const imageUrl = await params.uploadPanel(cropped, i);
    const spec = specs[i];
    results.push({
      prompt: `${characterDescription !== "No recurring named character in this sequence." ? characterDescription + ". " : ""}${spec.action}`,
      imageUrl,
      referenceImageUrl: soulRef?.soulId ?? refImage ?? "",
      characterName: spec.characters?.[0] ?? "",
      index: i,
    });
  }
  return results;
}
