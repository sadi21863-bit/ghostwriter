// src/app/api/ai/scene-to-video-prompt/route.ts
// Converts story scene text into optimised Higgsfield video generation prompts.

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { CAMERA_PRESETS, VIRAL_PRESETS, getRecommendedViralPreset } from "@/lib/higgsfield/presets";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";

const anthropic = new Anthropic();

const MODE_TO_MODEL: Record<string, string> = {
  combat:     "kling",
  horror:     "sora",
  comedy:     "seedance",
  romance:    "veo",
  dialogue:   "veo",
  atmosphere: "veo",
  tension:    "kling",
  emotional:  "veo",
  default:    "kling",
};

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "story_modes_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "story_modes_advanced" }, { status: 403 });
  }

  const {
    sceneText,
    projectName,
    format,
    genre,
    activeMode,
    characterDescriptions,
    styleDna,
  } = await req.json();

  if (!sceneText || sceneText.length < 50) {
    return NextResponse.json({ error: "Scene text too short" }, { status: 400 });
  }

  const suggestedViral = getRecommendedViralPreset(
    activeMode ?? "default",
    genre ?? "",
    activeMode
  );

  const cameraPresetList = Object.values(CAMERA_PRESETS)
    .slice(0, 12)
    .map(p => `${p.id}: ${p.label} — ${p.description}`)
    .join("\n");

  const prompt = `You are a cinematic director converting a prose scene into Higgsfield AI video generation prompts.

PROJECT: ${projectName} | Format: ${format ?? "Novel"} | Genre: ${genre ?? "General"}
${characterDescriptions ? `CHARACTERS:\n${characterDescriptions}` : ""}
${styleDna ? `VISUAL STYLE DNA:\n${styleDna}` : ""}

SCENE TO CONVERT:
${sceneText.slice(0, 2000)}

AVAILABLE CAMERA PRESETS:
${cameraPresetList}

Convert this scene into 3-5 individual video shots. Each shot should be 5-10 seconds of footage.

Return ONLY valid JSON:
{
  "shots": [
    {
      "shotNumber": 1,
      "description": "What this shot covers in plain English",
      "videoPrompt": "Optimised text for Higgsfield video generation. Specific, visual, cinematic. Include character appearance details. Under 200 words.",
      "shotType": "Establishing | Wide | Medium | Close-up | Extreme close-up | POV | Over-the-shoulder",
      "suggestedCameraPreset": "preset_id from the list above, or null if none fits",
      "aspectRatio": "16:9 | 9:16 | 1:1",
      "duration": 5,
      "lightingMood": "Golden hour | Overcast | Night | Interior | High key | Low key | etc.",
      "timeOfDay": "Dawn | Morning | Noon | Afternoon | Dusk | Night"
    }
  ],
  "suggestedModel": "kling | veo | sora | seedance | wan | hailuo",
  "modelReason": "One sentence explaining why this model fits the scene best"
}`;

  const response = await anthropic.messages.create({
    model: MODELS.default,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  const clean = text.replace(/```json\n?|```/g, "").trim();

  let result: any;
  try {
    result = JSON.parse(clean);
  } catch {
    return NextResponse.json({ error: "Failed to parse scene breakdown" }, { status: 500 });
  }

  result.suggestedViralPreset = suggestedViral ?? null;
  result.suggestedModel = result.suggestedModel ?? MODE_TO_MODEL[activeMode ?? "default"] ?? "kling";

  return NextResponse.json(result);
}
