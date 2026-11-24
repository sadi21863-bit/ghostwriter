export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import { letterComicPanel } from "@/lib/core/handlers/comics";
import { pgComicPanelCrudRepository } from "@/lib/core/pg-comic-repos";
import { pgChildResourceRepository, pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { put } from "@vercel/blob";
import { compositeLettering, type BubbleType } from "@/lib/comic-lettering/composite-panel";

// Zero-spend: composites speech/caption lettering onto the panel's ALREADY-
// generated art (no AI/Segmind call). Writes a separate letteredImageUrl so the
// raw imageUrl is never overwritten — re-lettering after a text edit never
// re-runs (or re-pays for) image generation.
//
// Phase 2 / v4 §7: the refusal ladder (project 404 → panel 404 → page 404 →
// the dialogue/caption 400) and the scoped letteredImageUrl write + §11
// revision bump live in `letterComicPanel`. What stays here are the transport
// concerns the handler sensibly refuses to know about: the Blob-config env
// gate, the source-image fetch, the sharp composite, and the Blob upload.
export async function POST(_: Request, { params }: { params: Promise<{ projectId: string; pageId: string; panelId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, pageId, panelId } = await params;
  const result = await letterComicPanel(
    fromSession(s),
    { projectId, pageId, panelId },
    {
      panelRepo: pgComicPanelCrudRepository,
      pageRepo: pgChildResourceRepository,
      compose: async ({ panel }) => {
        if (!process.env.BLOB_READ_WRITE_TOKEN)
          return { ok: false, status: 500, reason: "Blob storage is not configured." };
        const imgRes = await fetch(panel.imageUrl);
        if (!imgRes.ok)
          return { ok: false, status: 502, reason: "Could not fetch the panel's source image." };
        const imageBuffer = Buffer.from(await imgRes.arrayBuffer());
        const lettered = await compositeLettering({
          imageBuffer,
          dialogue: panel.dialogue ?? "",
          caption: panel.caption ?? "",
          speakerName: panel.speakerName ?? "",
          bubbleType: (panel.bubbleType as BubbleType) ?? "speech",
        });
        return { ok: true, lettered };
      },
      upload: async ({ lettered, panel, projectId, pageId }) => {
        const blob = await put(
          `comics/${projectId}/${pageId}/panel-${panel.panelIndex}-lettered-${Date.now()}.png`,
          lettered,
          { access: "public", contentType: "image/png" }
        );
        return blob.url;
      },
    },
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: result.status });
  return NextResponse.json({ panel: result.panel });
}
