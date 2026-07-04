export const dynamic = 'force-dynamic';

// src/app/api/ai/scene-to-video-prompt/route.ts
// Converts story scene text into optimised Higgsfield video generation prompts.

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { CAMERA_PRESETS, VIRAL_PRESETS, getRecommendedViralPreset } from "@/lib/higgsfield/presets";
import { ACTIVE_VIDEO_MODELS, VIDEO_MODELS, MODE_TO_MODEL } from "@/lib/higgsfield/models";
import { anthropic } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";


export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "scene-to-video-prompt");
  if (gate) return gate;

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
  "suggestedModel": "${ACTIVE_VIDEO_MODELS.map(m => m.id).join(" | ")}",
  "modelReason": "One sentence explaining why this model fits the scene best"
}`;

  try {
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
    const suggested = result.suggestedModel;
    const suggestedIsUsable = suggested && VIDEO_MODELS[suggested] && !VIDEO_MODELS[suggested].deprecated;
    result.suggestedModel = suggestedIsUsable ? suggested : (MODE_TO_MODEL[activeMode ?? "default"] ?? "kling");

    return NextResponse.json(result);
  } catch (e: any) {
    await refundCredits(session.user.id, "scene-to-video-prompt");
    return NextResponse.json({ error: "Scene to video prompt failed. Please try again." }, { status: 500 });
  }
}
