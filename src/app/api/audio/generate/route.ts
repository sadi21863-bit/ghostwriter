export const dynamic = 'force-dynamic';
// Looping TTS calls per chapter segment can run well past Vercel's default
// function timeout; without this the function gets killed mid-run with the
// client never receiving a response (a stuck "Generating…" state). Matches
// the same 300s budget already used by the other long-running AI routes
// (production/comics video & image generation).
export const maxDuration = 300;

// src/app/api/audio/generate/route.ts
// Converts a chapter to audio. Provider is user-selectable (users.ttsProviderId,
// default "openai") — OpenAI TTS-1 ($0.015/1K chars, proven, needs its own key)
// or Segmind's Grok TTS ($0.01875/1K chars, uses the same Segmind key already
// used for images/video/lipsync, no second key needed). See
// src/lib/audio/{providers,registry,adapters}.ts.
// Characters speak in their assigned voices; narration uses the provider's
// default/narrator voice.

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier } from "@/lib/subscription";
import { db } from "@/db";
import { projects, chapters, characters, audioExports, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { put } from "@vercel/blob";
import { decrypt } from "@/lib/crypto";
import { getTTSProvider } from "@/lib/audio/registry";
import { parseChapterIntoSegments } from "@/lib/audio/segment-chapter";

// USD/char rates, converted at the same ~83.33 INR/USD ratio the original
// OpenAI-only estimate used (0.00125 INR/char == $0.015/1K chars * 83.33).
const COST_INR_PER_CHAR: Record<string, number> = {
  openai: 0.00125,        // $0.015/1K chars
  segmind_grok: 0.0015625, // $0.01875/1K chars
};

export async function POST(req: Request) {
  const session = await getRequiredSession();

  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const tier = await getUserTier(session.user.id);
  if (!["story_pro", "all_access"].includes(tier)) {
    return NextResponse.json({
      error: "upgrade_required",
      feature: "audio_novel",
      message: "Audio Novel is available on Story Pro and All-Access plans.",
    }, { status: 403 });
  }

  const { projectId, chapterId } = await req.json();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const chapter = await db.query.chapters.findFirst({
    where: eq(chapters.id, chapterId),
  });
  if (!chapter?.content) {
    return NextResponse.json({ error: "Chapter has no content" }, { status: 400 });
  }

  const projectChars = await db.query.characters.findMany({
    where: eq(characters.projectId, projectId),
  });

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  const provider = getTTSProvider(user?.ttsProviderId || "openai");

  const apiKey = provider.id === "segmind_grok"
    ? decrypt(user?.segmindApiKey ?? "")
    : (user?.openaiApiKey ? decrypt(user.openaiApiKey) : process.env.OPENAI_API_KEY);

  if (!apiKey) {
    const keyName = provider.id === "segmind_grok" ? "Segmind" : "OpenAI";
    return NextResponse.json({
      error: `${keyName} API key required for Audio Novel. Add your key in Settings.`,
    }, { status: 400 });
  }

  const costPerChar = COST_INR_PER_CHAR[provider.id] ?? COST_INR_PER_CHAR.openai;
  const [exportRecord] = await db.insert(audioExports).values({
    projectId,
    chapterId,
    status: "processing",
    estimatedCost: `₹${Math.round(chapter.content.length * costPerChar)}`,
  }).returning();

  const segments = parseChapterIntoSegments(chapter.content, projectChars, provider);

  const audioBuffers: Buffer[] = [];

  for (const segment of segments) {
    try {
      const buffer = await provider.generate({ text: segment.text, voiceId: segment.voice, speed: 1.0 }, apiKey);
      audioBuffers.push(buffer);
    } catch (err: any) {
      await db.update(audioExports)
        .set({ status: "failed" })
        .where(eq(audioExports.id, exportRecord.id));
      console.error('[audio] TTS error:', err);
      return NextResponse.json({ error: "Audio generation failed. Please try again." }, { status: 500 });
    }
  }

  const combinedAudio = Buffer.concat(audioBuffers);

  const filename = `audio/${projectId}/${chapterId}-${Date.now()}.mp3`;
  const blob = await put(filename, combinedAudio, {
    access: "public",
    contentType: "audio/mpeg",
  });

  const wordCount = chapter.content.split(/\s+/).length;
  const durationSeconds = Math.round((wordCount / 150) * 60);

  await db.update(audioExports)
    .set({
      status: "completed",
      audioUrl: blob.url,
      durationSeconds,
      characterCount: chapter.content.length,
    })
    .where(eq(audioExports.id, exportRecord.id));

  return NextResponse.json({
    audioUrl: blob.url,
    durationSeconds,
    exportId: exportRecord.id,
    segments: segments.length,
  });
}
