export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { db } from "@/db";
import { projects, productionShots, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateSoulImage } from "@/lib/higgsfield/client";
import { put } from "@vercel/blob";
import { decrypt } from "@/lib/crypto";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function POST(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const rl = await checkAiRateLimit(s.user.id);
  if (rl) return rl;
  if (!await verifyOwnership((await params).projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  const higgsfieldKey = decrypt(user?.higgsfieldApiKey ?? "");
  if (!higgsfieldKey)
    return NextResponse.json({ error: "Add your Higgsfield API key in Settings." }, { status: 400 });

  const shots = await db.query.productionShots.findMany({
    where: and(eq(productionShots.projectId, (await params).projectId)),
    with: { primaryCharacter: true },
    orderBy: (s, { asc }) => [asc(s.sortOrder)],
  });

  const pending = shots.filter(s => !s.previewImageUrl);
  if (pending.length === 0)
    return NextResponse.json({ completed: 0, total: 0, errors: [], remaining: 0 });

  const CEILING = 20;
  const toProcess = pending.slice(0, CEILING);
  const remaining = pending.length - toProcess.length;

  const BATCH = 3;
  let completed = 0;
  const errors: string[] = [];

  for (let i = 0; i < toProcess.length; i += BATCH) {
    const batch = toProcess.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async shot => {
        await db.update(productionShots)
          .set({ generationStatus: "generating_preview", updatedAt: new Date() })
          .where(eq(productionShots.id, shot.id));

        const referenceImageUrl = (shot.primaryCharacter as any)?.portraitUrl || undefined;
        const soulUrl = await generateSoulImage({
          apiKey: higgsfieldKey,
          prompt: shot.soulPrompt || `${shot.subject}. ${shot.action}. ${shot.location}. Cinematic, photorealistic.`,
          referenceImageUrl: referenceImageUrl || undefined,
        });

        let previewImageUrl = soulUrl;
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          const imgRes = await fetch(soulUrl);
          const imgBuf = await imgRes.arrayBuffer();
          const blob = await put(
            `production/${(await params).projectId}/${shot.id}/preview.jpg`,
            imgBuf,
            { access: "public", contentType: "image/jpeg" }
          );
          previewImageUrl = blob.url;
        }

        await db.update(productionShots)
          .set({ previewImageUrl, generationStatus: "preview_ready", updatedAt: new Date() })
          .where(eq(productionShots.id, shot.id));
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") completed++;
      else errors.push(r.reason?.message ?? "Unknown error");
    }
  }

  return NextResponse.json({ completed, total: toProcess.length, errors, remaining });
}
