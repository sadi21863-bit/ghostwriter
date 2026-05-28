// src/app/api/audio/generate/route.ts
// Converts a chapter to audio using OpenAI TTS.
// Characters speak in their assigned voices; narration uses the narrator voice.
// Cost: OpenAI TTS-1 at $15/1M chars ≈ ₹1.25/1K chars.

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier } from "@/lib/subscription";
import { db } from "@/db";
import { projects, chapters, characters, audioExports, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import OpenAI from "openai";

const NARRATOR_VOICE = "fable";

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
  const openaiKey = user?.openaiApiKey
    ? decrypt(user.openaiApiKey)
    : process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    return NextResponse.json({
      error: "OpenAI API key required for Audio Novel. Add your key in Settings.",
    }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  const [exportRecord] = await db.insert(audioExports).values({
    projectId,
    chapterId,
    status: "processing",
    estimatedCost: `₹${Math.round(chapter.content.length * 0.00125)}`,
  }).returning();

  const segments = parseChapterIntoSegments(chapter.content, projectChars);

  const audioBuffers: Buffer[] = [];

  for (const segment of segments) {
    try {
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: segment.voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
        input: segment.text,
        speed: 1.0,
      });
      const buffer = Buffer.from(await response.arrayBuffer());
      audioBuffers.push(buffer);
    } catch (err: any) {
      await db.update(audioExports)
        .set({ status: "failed" })
        .where(eq(audioExports.id, exportRecord.id));
      return NextResponse.json({ error: `TTS failed: ${err.message}` }, { status: 500 });
    }
  }

  const combinedAudio = Buffer.concat(audioBuffers);

  const { put } = await import("@vercel/blob");
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

// ── Dialogue parsing ──────────────────────────────────────────────────────────

interface Segment {
  text: string;
  voice: string;
  type: "narration" | "dialogue";
  characterName?: string;
}

function parseChapterIntoSegments(
  content: string,
  chars: Array<{ name: string; voiceId: string | null }>
): Segment[] {
  const segments: Segment[] = [];
  const parts = content.split(/("(?:[^"\\]|\\.)*")/g);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part.trim()) continue;

    if (part.startsWith('"') && part.endsWith('"')) {
      const precedingText = parts[i - 1] || "";
      const followingText = parts[i + 1] || "";
      const speaker = findSpeaker(precedingText, followingText, chars);
      const voice = speaker?.voiceId || NARRATOR_VOICE;

      segments.push({
        text: part.slice(1, -1),
        voice,
        type: "dialogue",
        characterName: speaker?.name,
      });
    } else {
      const trimmed = part.trim();
      if (trimmed) {
        segments.push({
          text: trimmed,
          voice: NARRATOR_VOICE,
          type: "narration",
        });
      }
    }
  }

  return segments;
}

function findSpeaker(
  before: string,
  after: string,
  chars: Array<{ name: string; voiceId: string | null }>
): { name: string; voiceId: string } | null {
  const context = (before + " " + after).toLowerCase();
  for (const char of chars) {
    if (char.voiceId && context.includes(char.name.toLowerCase())) {
      return { name: char.name, voiceId: char.voiceId };
    }
  }
  return null;
}
