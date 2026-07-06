export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { generateEntity, MODELS } from "@/lib/ai/engine";
import { anthropic } from "@/lib/ai/client";


export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "entity");
  if (gate) return gate;
  const { type, prompt, projectContext, existing, name, role, appearance } = await req.json();

  try {
    if (type === "visual_profile") {
      const userPrompt = `Convert this character description into a structured visual profile for image generation.

Character: ${name || "Unknown"}${role ? ` (${role})` : ""}
Appearance: ${appearance || "No description provided"}

Output ONLY this format (under 80 words):
"[gender], [approximate age], [hair: length + colour + texture], [eyes: colour + shape], [build], [skin tone], [1-2 distinguishing features], [typical clothing style]."`;

      const response = await anthropic.messages.create({
        model: MODELS.fast,
        max_tokens: 150,
        messages: [{ role: "user", content: userPrompt }],
      });
      const text = response.content.filter(b => b.type === "text").map(b => (b as any).text).join("").trim();
      return NextResponse.json({ visualProfile: text });
    }

    return NextResponse.json(await generateEntity(type, prompt, projectContext, existing));
  } catch (e: any) {
    await refundCredits(session.user.id, "entity");
    return NextResponse.json({ error: "Entity generation failed. Please try again." }, { status: 500 });
  }
}