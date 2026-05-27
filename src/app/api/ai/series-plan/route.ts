import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const s = await getRequiredSession();
  const rl = await checkAiRateLimit(s.user.id);
  if (rl) return rl;
  const { creatorBible, format, currentProjectId } = await req.json();
  if (!format) return NextResponse.json({ error: "format required" }, { status: 400 });

  const pastProjects = await db.query.projects.findMany({
    where: eq(projects.userId, s.user.id),
    with: { chapters: true },
  });
  const pastTitles = pastProjects
    .filter((p: any) => p.format === format && p.id !== currentProjectId)
    .flatMap((p: any) => [p.name, ...(p.chapters || []).map((c: any) => c.title)])
    .filter(Boolean);

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514", max_tokens: 2000,
      system: `You are a content strategist for ${format} creators. Return ONLY JSON.`,
      messages: [{ role: "user", content: `Channel: ${creatorBible?.channelName || ""}\nNiche: ${creatorBible?.niche || ""}\nAudience: ${creatorBible?.audienceAge || ""}, interests: ${creatorBible?.audienceInterests || ""}\nPillars: ${(creatorBible?.contentPillars || []).join(", ")}\nVoice: ${creatorBible?.channelVoice || ""}\n\nPast content (already covered):\n${pastTitles.map((t: string) => "- " + t).join("\n") || "None yet"}\n\nGenerate a 4-week content plan. Avoid repeating past angles.\nReturn JSON: { "gaps": ["string"], "weeks": [{ "week": 1, "videos": [{ "title": "string", "hook": "string", "pillar": "string", "angle": "string", "seriesConnection": null }] }] }` }],
    });
    const raw = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("");
    try { return NextResponse.json({ plan: JSON.parse(raw.replace(/```json\n?|```/g, "").trim()) }); }
    catch { return NextResponse.json({ error: "Failed to parse plan" }, { status: 500 }); }
  } catch (e: any) {
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Rate limit hit. Try again in a moment." }, { status: 429 });
    return NextResponse.json({ error: "Series plan failed." }, { status: 500 });
  }
}
