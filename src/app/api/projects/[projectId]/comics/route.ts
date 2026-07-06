export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { chapters, comicPages, comicPanels, projects, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { anthropic as client } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";
import { put } from "@vercel/blob";
import { generateSoulImage } from "@/lib/higgsfield/client";
import { critiqueShot } from "@/lib/production/vision-critic";
import { scoreShot, retryHint } from "@/lib/production/self-eval";
import { ART_STYLES, PanelSpec, buildBreakdownPrompt, buildPanelPrompt } from "@/lib/ai/panel-prompt-builder";
import { decrypt } from "@/lib/crypto";
import { getCharacterSoulReference } from "@/lib/production/character-reference";


function safeParseJson(raw: string) {
  const clean = raw.replace(/```json\n?|```/g, "").trim();
  try { return JSON.parse(clean); } catch { return null; }
}

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pages = await db.query.comicPages.findMany({
    where: eq(comicPages.projectId, (await params).projectId),
    with: { panels: { orderBy: (p, { asc }) => [asc(p.panelIndex)] } },
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });

  return NextResponse.json({ pages });
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const tier = await getUserTier(s.user.id);
  if (!canAccessFeature(tier, "comic_studio")) {
    return NextResponse.json({ error: "upgrade_required", feature: "comic_studio" }, { status: 403 });
  }
  if (!await verifyOwnership((await params).projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  // Comic panel generation routes through Segmind (api.segmind.com), not Higgsfield's native API.
  const segmindKey = decrypt(user?.segmindApiKey ?? "");
  if (!segmindKey)
    return NextResponse.json({ error: "Add your Segmind API key in Settings to generate comics." }, { status: 400 });

  const { chapterId, artStyleId } = await req.json();

  const chapter = await db.query.chapters.findFirst({
    where: and(eq(chapters.id, chapterId), eq(chapters.projectId, (await params).projectId)),
  });
  if (!chapter?.content?.trim())
    return NextResponse.json({ error: "Write your story first, then come back to generate comic panels." }, { status: 400 });

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, (await params).projectId),
    with: { characters: true, worldEntities: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const worldEntities = (project as any).worldEntities ?? [];

  // Determine page number
  const existingPages = await db.query.comicPages.findMany({ where: eq(comicPages.projectId, (await params).projectId) });
  const pageNumber = existingPages.length + 1;

  // Call Claude to break scene into panel specs
  const { prompt: breakdownPrompt, wasTruncated } = buildBreakdownPrompt(chapter.content, project.characters, worldEntities);
  const msg = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 1200,
    messages: [{ role: "user", content: breakdownPrompt }],
  });
  const raw = msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  let specs: PanelSpec[] = safeParseJson(raw);
  if (!Array.isArray(specs) || specs.length < 1)
    return NextResponse.json({ error: "Failed to analyze scene structure. Try a longer chapter." }, { status: 500 });
  if (specs.length > 6) specs = specs.slice(0, 6);

  const artStyleObj = ART_STYLES.find(a => a.id === artStyleId) ?? ART_STYLES[0];

  // Create page record
  const [page] = await db.insert(comicPages).values({
    projectId: (await params).projectId,
    chapterId,
    pageNumber,
    artStyle: artStyleId ?? "manga",
  }).returning();

  // A single page-level seed base keeps every panel on the page visually
  // coherent (style/character feel) while `+ i` keeps each panel distinct and
  // the whole page reproducible. Costs nothing extra — same number of calls.
  const pageSeed = Math.floor(Math.random() * 900000);

  // Generate all panels (allow partial success)
  const panelResults = await Promise.allSettled(
    specs.map(async (spec, i) => {
      const prompt = buildPanelPrompt(spec, project.characters, artStyleObj, project.name, worldEntities);
      const refName = spec.characters?.[0];
      const { referenceImageUrl, soulId, referenceStrength } = refName
        ? getCharacterSoulReference(refName, project.characters)
        : { referenceStrength: 0.85 };

      const soulUrl = await generateSoulImage({
        apiKey: segmindKey,
        prompt,
        stylePreset: artStyleObj.higgsfieldPreset,
        referenceImageUrl,
        soulId,
        referenceStrength,
        seed: pageSeed + i,
      });

      let imageUrl = soulUrl;
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const imgRes = await fetch(soulUrl);
        const imgBuf = await imgRes.arrayBuffer();
        const blob = await put(
          `comics/${(await params).projectId}/${page.id}/panel-${i}.png`,
          imgBuf,
          { access: "public", contentType: "image/png" }
        );
        imageUrl = blob.url;
      }

      return { prompt, imageUrl, referenceImageUrl: soulId ?? referenceImageUrl ?? "", characterName: refName ?? "", index: i };
    })
  );

  // Insert successful panels
  const panels: any[] = [];
  for (const result of panelResults) {
    if (result.status === "fulfilled") {
      const { prompt, imageUrl, referenceImageUrl, characterName, index } = result.value;
      const [panel] = await db.insert(comicPanels).values({
        pageId: page.id,
        projectId: (await params).projectId,
        panelIndex: index,
        imageUrl,
        panelPrompt: prompt,
        referenceImageUrl,
        characterName,
        artStylePreset: artStyleObj.higgsfieldPreset,
      }).returning();
      panels.push(panel);
    }
  }

  // Phase B vision-critic (docs/2026-06-25-ai-director-editor-production-studio-gap-analysis.md):
  // score each panel in the background against its prompt, reference image and
  // the previous panel on the page. Never blocks the response, never gates
  // anything — pure data collection for the future review UI.
  const sortedPanels = [...panels].sort((a, b) => a.panelIndex - b.panelIndex);
  sortedPanels.forEach((panel, i) => {
    (async () => {
      const raw = await critiqueShot({
        imageUrl: panel.imageUrl,
        prompt: panel.panelPrompt,
        referenceImageUrl: panel.referenceImageUrl || undefined,
        previousShotImageUrl: sortedPanels[i - 1]?.imageUrl,
      });
      if (Object.keys(raw).length === 0) return;
      const result = scoreShot(raw);
      await db.update(comicPanels)
        .set({ qualityScore: result.overall, qualityWeakest: result.weakest, qualityNote: retryHint(result) })
        .where(eq(comicPanels.id, panel.id));
    })().catch(err => console.error('[critiqueShot] comic panel failed:', err));
  });

  const failedCount = panelResults.filter(r => r.status === "rejected").length;
  return NextResponse.json({
    page: { ...page, panels: panels.sort((a, b) => a.panelIndex - b.panelIndex) },
    errors: failedCount > 0 ? `${failedCount} panel(s) failed to generate.` : null,
    truncationWarning: wasTruncated ? "Scene was long — panels cover the opening section only. Break the scene into shorter parts for full coverage." : null,
  });
}
