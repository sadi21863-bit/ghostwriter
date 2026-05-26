import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";

export async function POST(req: Request) {
  await getRequiredSession();
  const { youtubeUrl, creatorBible } = await req.json();

  if (!youtubeUrl?.trim()) {
    return NextResponse.json({ error: "YouTube URL required" }, { status: 400 });
  }

  const isYouTube = /youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\//.test(youtubeUrl);
  if (!isYouTube) {
    return NextResponse.json({ error: "Please provide a valid YouTube URL" }, { status: 400 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: "Video analysis unavailable" }, { status: 503 });
  }

  const channelContext = creatorBible
    ? `\nCreator's channel: ${creatorBible.channelName || ""} | Niche: ${creatorBible.niche || ""} | Voice: ${creatorBible.channelVoice || ""}`
    : "";

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                file_data: {
                  file_uri: youtubeUrl,
                  mime_type: "video/mp4",
                },
              },
              {
                text: `Analyse this YouTube video in detail as a content strategist.${channelContext}

Return ONLY valid JSON:
{
  "title": "video title if visible",
  "format": "Long-form | Short | Reel",
  "hookType": "fear | curiosity | controversy | story | statistic | question | challenge",
  "openingLine": "exact first sentence or text shown",
  "totalStructure": [
    {
      "timestamp": "0:00-0:30",
      "section": "section name",
      "technique": "specific retention technique used",
      "purpose": "what this achieves"
    }
  ],
  "reHooks": [
    { "timestamp": "string", "technique": "how energy is re-spiked here" }
  ],
  "payoffMoment": "timestamp where the main promise is delivered",
  "angle": "the specific angle this creator took on the topic",
  "whatWorked": ["specific thing that makes this video effective"],
  "whatToSteal": ["specific technique to replicate"],
  "freshAngles": ["angle this video did NOT take that could work"],
  "estimatedRetentionRisk": ["timestamp where viewers likely drop off and why"]
}`
              }
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          }
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 400 && err.includes("video")) {
        return NextResponse.json({
          error: "Could not access this video. Make sure it is public and not age-restricted."
        }, { status: 400 });
      }
      return NextResponse.json({ error: "Video analysis failed. Please try again." }, { status: 500 });
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return NextResponse.json({ error: "No analysis returned" }, { status: 500 });

    try {
      const analysis = JSON.parse(text.replace(/```json\n?|```/g, "").trim());
      return NextResponse.json({ analysis });
    } catch {
      return NextResponse.json({ error: "Analysis parsing failed" }, { status: 500 });
    }

  } catch {
    return NextResponse.json({ error: "Video analysis failed. Please try again." }, { status: 500 });
  }
}
