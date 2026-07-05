export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { MODELS } from "@/lib/ai/engine";
import { TRANSPORTATION_CHECK_SYSTEM_PROMPT, runEditorCall } from "@/lib/roles/editor";


export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "story_modes_advanced")) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, (await params).projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { chapterContent } = await req.json();
  if (!chapterContent?.trim()) {
    return NextResponse.json({ error: "chapter content required" }, { status: 400 });
  }

  const result = await runEditorCall({
    userId: session.user.id,
    operation: "transportation-check",
    model: MODELS.fast,
    maxTokens: 2000,
    system: [{
      type: "text",
      text: TRANSPORTATION_CHECK_SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    }],
    messages: [{
      role: "user",
      content: `Analyse this prose for transportation ejection mechanisms using Green & Brock's Transportation-Imagery Model.

Transportation = the reader's cognitive, emotional, and imagery resources all focused on the story world. Ejection mechanisms break this state instantly.

THE SIX EJECTION MECHANISMS — find specific examples of each:
1. FALSE NOTE: behavioural or causal implausibility — a character acts in a way that breaks belief
2. AUTHORIAL INTRUSION: the writer becomes visible (editorialising, anachronistic vocabulary, wrong register)
3. UNEARNED EMOTION: emotional response is requested before identification is established
4. IMPLAUSIBILITY CASCADE: multiple small false notes accumulating faster than the reader can dismiss them
5. PROSE FAILURE: language that requires re-reading for comprehension (ambiguous pronoun, tangled syntax)
6. THE FAMILIAR: trope-saturated moments where recognition replaces immersion

FIRST PAGE TEST (evaluate separately):
- Does the first paragraph produce a vivid mental image?
- Is there a specific person (not a type) with a specific want?
- Is the prose free of clichés and authorial intrusion?

PROSE TO ANALYSE:
${chapterContent.slice(0, 4000)}

Return JSON:
{
  "firstPageTest": { "vivid": boolean, "specificPerson": boolean, "clean": boolean, "verdict": "string" },
  "ejections": [
    { "mechanism": "FALSE_NOTE|AUTHORIAL_INTRUSION|UNEARNED_EMOTION|IMPLAUSIBILITY_CASCADE|PROSE_FAILURE|THE_FAMILIAR",
      "excerpt": "the specific text",
      "explanation": "why this breaks transportation",
      "fix": "specific rewrite suggestion" }
  ],
  "overallScore": number,
  "summary": "string"
}`,
    }],
  });
  if (!result.ok) return result.response;

  try {
    return NextResponse.json(JSON.parse(result.text.replace(/```json\n?|```/g, "").trim()));
  } catch {
    return NextResponse.json({ error: "Parse failed" }, { status: 500 });
  }
}
