export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { getUserTier, canAccessFeature } from '@/lib/subscription';

export async function POST(req: NextRequest) {
  const session = await getRequiredSession();
  const tier = await getUserTier(session.user.id);

  if (!canAccessFeature(tier, 'creator_tools_advanced')) {
    return NextResponse.json({ error: 'upgrade_required', feature: 'video_analysis' }, { status: 403 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Video analysis not configured' }, { status: 503 });
  }

  const { youtubeUrl, format } = await req.json();

  if (!youtubeUrl || (!youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be'))) {
    return NextResponse.json({ error: 'Valid YouTube URL required' }, { status: 400 });
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        { fileData: { fileUri: youtubeUrl } },
        {
          text: `Analyze this ${format || 'YouTube'} video for a creator who wants to write content in a similar style.

Extract these specifically:
1. HOOK STRUCTURE: How does the video open? What happens in the first 30 seconds? What makes it work?
2. CONTENT SECTIONS: What are the main sections? How does each begin and end?
3. PACING: How does energy and pace change across the video? Where does it speed up or slow down?
4. RETENTION HOOKS: What techniques keep viewers watching? (callbacks, loops, pattern interrupts)
5. TONE & VOICE: How does the presenter speak? Casual or formal? High energy or measured?
6. STRUCTURAL MOVE: What is the single most effective structural decision in this video?

Return as clear production directives a writer can follow when scripting similar content.
Be specific about what works — not generic observations.`,
        },
      ],
    });

    const directives = response.text || '';
    return NextResponse.json({ directives, success: true });

  } catch (err: any) {
    console.error('[analyze-reference-video]', err);
    if (err.message?.includes('private') || err.message?.includes('unavailable')) {
      return NextResponse.json({
        error: 'This video is private or unavailable. Use a public YouTube URL.',
      }, { status: 400 });
    }
    return NextResponse.json({ error: 'Video analysis failed. Try again.' }, { status: 500 });
  }
}
