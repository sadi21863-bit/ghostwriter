export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, MONTHLY_GENERATION_LIMITS } from "@/lib/subscription";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const tier = await getUserTier(session.user.id);
  const monthlyLimit = MONTHLY_GENERATION_LIMITS[tier] ?? 10;

  if (monthlyLimit !== -1) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { monthlyGenerations: true, monthlyGenerationsResetAt: true },
    });
    const now = new Date();
    const resetAt = user?.monthlyGenerationsResetAt;
    const isNewMonth = !resetAt ||
      resetAt.getMonth() !== now.getMonth() ||
      resetAt.getFullYear() !== now.getFullYear();

    if (isNewMonth) {
      await db.update(users)
        .set({ monthlyGenerations: 0, monthlyGenerationsResetAt: now })
        .where(eq(users.id, session.user.id));
    } else if ((user?.monthlyGenerations ?? 0) >= monthlyLimit) {
      return NextResponse.json({ directives: "" });
    }
  }

  const { passage } = await req.json();

  if (!passage || passage.length < 30) {
    return NextResponse.json({ directives: "" });
  }

  try {
    const msg = await client.messages.create({
      model: MODELS.default,
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `Analyze this passage and extract its specific craft techniques as a set of generation directives. Be concrete and technical, not generic.

PASSAGE:
${passage.slice(0, 2000)}

Return ONLY a brief set of directives (5-7 lines max) that describe HOW this passage achieves its effect — sentence rhythm, subtext mechanisms, what the narrator notices, physical vs emotional register, pacing technique, specific structural moves. Do not describe WHAT it contains. Describe HOW it works.
Start each line with a verb. Be specific enough that an AI could apply these techniques to completely different content.`,
      }],
    });

    const text = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("").trim();

    if (text && monthlyLimit !== -1) {
      await db.update(users)
        .set({ monthlyGenerations: sql`${users.monthlyGenerations} + 1` })
        .where(eq(users.id, session.user.id));
    }

    return NextResponse.json({ directives: text ? `REFERENCE PASSAGE TECHNIQUE:\n${text}` : "" });
  } catch {
    return NextResponse.json({ directives: "" });
  }
}
