export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { anthropic } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";


export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "story_modes_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "story_modes_advanced" }, { status: 403 });
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, (await params).projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { sceneContent, declaredPurposes } = await req.json();

  if (!sceneContent || !declaredPurposes?.length) {
    return NextResponse.json({ error: "scene content and at least one declared purpose required" }, { status: 400 });
  }

  const response = await anthropic.messages.create({
    model: MODELS.fast,
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: `Analyse this scene against its declared purposes using Swain's Scene-Sequel Framework and Aristotle's necessity principle.

DECLARED PURPOSES: ${declaredPurposes.join(", ")}

SCENE:
${sceneContent.slice(0, 6000)}

For each declared purpose, assess whether the scene fulfills it.
Then check the Swain structure: is there a Goal → Conflict → Outcome (Yes/No/Yes-but/No-and-furthermore)?
Apply the Aristotle removal test: if this scene were removed, would the story still work?

Return ONLY valid JSON:
{
  "purposeChecks": [
    { "purpose": "purpose name", "fulfilled": true, "evidence": "one sentence of evidence or gap", "suggestion": "specific fix if not fulfilled" }
  ],
  "swainStructure": {
    "hasGoal": true, "goalDescription": "what the goal is or 'not found'",
    "hasConflict": true, "conflictDescription": "what resists the goal or 'not found'",
    "outcome": "Yes | No | Yes-but | No-and-furthermore | not found",
    "outcomeAssessment": "one sentence"
  },
  "removalTest": { "removable": true, "reason": "why or why not" },
  "overallVerdict": "passes | needs-work | rewrite",
  "priorityFix": "the single most important thing to address, in one sentence"
}`,
    }],
  });

  const raw = response.content.filter(b => b.type === "text").map(b => (b as any).text).join("") || "{}";
  try {
    return NextResponse.json(JSON.parse(raw.replace(/```json\n?|```/g, "").trim()));
  } catch {
    return NextResponse.json({ error: "Parse failed" }, { status: 500 });
  }
}
