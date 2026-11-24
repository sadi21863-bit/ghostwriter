export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import { ownsChildResource } from "@/lib/core/ownership";
import { deployPanelImage } from "@/lib/core/handlers/comics";
import { pgComicPanelCrudRepository } from "@/lib/core/pg-comic-repos";
import { pgChildResourceRepository, pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { db } from "@/db";
import { characters, comicPanels, projects, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getImageProvider } from "@/lib/media/registry";
import { decrypt } from "@/lib/crypto";
import { put } from "@vercel/blob";
import { critiqueShot } from "@/lib/production/vision-critic";
import { scoreShot, retryHint } from "@/lib/production/self-eval";
import { getCharacterSoulReference } from "@/lib/production/character-reference";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

/**
 * Phase 2 / v4 §7 — the generation stays transport-coupled (the provider call
 * and its Blob upload are external-spend orchestration, not ported until the
 * image-provider slice ships a generation port — see handlers/comics.ts); the
 * post-generation DB write is not. Both Phase-C branches (candidate-append vs
 * primary-overwrite) go through `deployPanelImage`, which owns the array
 * mechanics and the `comicPanel.regenerate` §11 bump. The route keeps the
 * keepAsCandidate decision itself: it needs the pre-generation panel state
 * (`!!panel.imageUrl`) for generation AND for that decision.
 */
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; pageId: string; panelId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, pageId, panelId } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const panel = await db.query.comicPanels.findFirst({
    where: and(eq(comicPanels.id, panelId), eq(comicPanels.projectId, projectId)),
  });
  if (!panel) return NextResponse.json({ error: "Panel not found" }, { status: 404 });

  // Phase 2 / v4 §7: ownership proven through the Core helper — context scope is
  // enforced, and the resource is named rather than passed as a Drizzle table.
  const ctx = fromSession(s);
  const pageOwned = await ownsChildResource(
    ctx,
    { resource: "comic_pages", childId: pageId, projectId },
    pgChildResourceRepository,
  );
  if (!pageOwned.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const imageProviderId = user.imageProviderId || "segmind_soul";
  const provider = getImageProvider(imageProviderId);
  const rawKey = imageProviderId === "openai_gpt_image" ? user.openaiApiKey : user.segmindApiKey;
  const apiKey = decrypt(rawKey ?? "");

  if (!apiKey) {
    return NextResponse.json({ error: `Add your ${provider.name} API key in Settings to generate panels.` }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const keepAsCandidate = body?.keepAsCandidate === true && !!panel.imageUrl;

  // Re-resolve the character's LIVE soul reference by name rather than reusing
  // panel.referenceImageUrl, which stores whichever value the initial
  // generation used (a soulId UUID OR a portrait URL, conflated in one
  // column) — passing a stale soulId through as referenceImageUrl silently
  // breaks character consistency on every regenerate. This also picks up a
  // Soul ID trained after the panel was first created.
  const projectCharacters = await db.query.characters.findMany({
    where: eq(characters.projectId, projectId),
  });
  const { referenceImageUrl, soulId } = getCharacterSoulReference((panel as any).characterName, projectCharacters);

  const result = await provider.generate({
    prompt: panel.panelPrompt,
    stylePreset: panel.artStylePreset || undefined,
    referenceImageUrl,
    soulId,
  }, apiKey);

  const rawUrl = result.url!;
  let imageUrl = rawUrl;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const imgRes = await fetch(rawUrl);
    const imgBuffer = await imgRes.arrayBuffer();
    const blob = await put(
      `comics/${projectId}/${pageId}/panel-${panel.panelIndex}-regen-${Date.now()}.png`,
      imgBuffer,
      { access: "public", contentType: "image/png" }
    );
    imageUrl = blob.url;
  }

  const imageWrite = await deployPanelImage(
    ctx,
    {
      projectId,
      panelId,
      imageUrl,
      keepAsCandidate,
      existingCandidateUrls: (panel as any).candidateImageUrls ?? [],
    },
    pgComicPanelCrudRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!imageWrite.ok) return NextResponse.json({ error: imageWrite.reason }, { status: imageWrite.status });

  // Phase B vision-critic — see comics/route.ts for the same pattern.
  (async () => {
    const prevPanel = await db.query.comicPanels.findFirst({
      where: and(eq(comicPanels.pageId, panel.pageId), eq(comicPanels.panelIndex, panel.panelIndex - 1)),
    });
    const raw = await critiqueShot({
      imageUrl,
      prompt: panel.panelPrompt,
      referenceImageUrl: panel.referenceImageUrl || undefined,
      previousShotImageUrl: prevPanel?.imageUrl,
    });
    if (Object.keys(raw).length === 0) return;
    const result = scoreShot(raw);
    await db.update(comicPanels)
      .set({ qualityScore: result.overall, qualityWeakest: result.weakest, qualityNote: retryHint(result) })
      .where(and(eq(comicPanels.id, panelId), eq(comicPanels.projectId, projectId)));
  })().catch(err => console.error('[critiqueShot] panel regenerate failed:', err));

  return NextResponse.json({ panel: imageWrite.panel });
}
