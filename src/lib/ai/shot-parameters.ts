export const SHOT_TYPES = [
  "Establishing shot", "Wide shot", "Medium shot", "Close-up",
  "Extreme close-up", "Over-the-shoulder", "POV", "Bird's eye", "Worm's eye",
];

export const CAMERA_MOVEMENTS = [
  "Static", "Pan left", "Pan right", "Tilt up", "Tilt down",
  "Dolly in", "Dolly out", "Tracking shot", "Handheld", "Crane up",
];

export const LIGHTING_MOODS = [
  "Golden hour", "Blue hour", "Harsh midday", "Overcast soft",
  "Dramatic side light", "Backlit silhouette", "Neon night", "Candlelit",
  "Fluorescent cold", "Storm light",
];

export const TIME_OF_DAY = [
  "Dawn", "Morning", "Midday", "Afternoon",
  "Golden hour", "Dusk", "Night", "Deep night",
];

export const PROMPT_TRANSLATIONS: Record<string, string> = {
  "Golden hour":         "warm golden hour lighting, long shadows, lens flare, cinematic glow",
  "Neon night":          "neon-lit night, vibrant colored light reflections, urban atmosphere",
  "Blue hour":           "cool blue twilight, soft diffused light, moody atmosphere",
  "Dramatic side light": "dramatic side lighting, strong shadows, chiaroscuro effect",
  "Backlit silhouette":  "strong backlight, subject silhouetted, glowing rim light",
  "Candlelit":           "warm candlelight, flickering shadows, intimate close atmosphere",
  "Storm light":         "dramatic storm light, dark clouds, high contrast, ominous atmosphere",
  "Harsh midday":        "harsh midday sun, hard shadows, high contrast, intense light",
  "Overcast soft":       "overcast sky, soft diffused light, no harsh shadows, flat even lighting",
  "Fluorescent cold":    "cold fluorescent lighting, clinical, sterile, harsh white light",
  "Dolly in":            "slow cinematic dolly push-in, building tension, focus pull",
  "Dolly out":           "cinematic dolly pull-back, revealing wider context, dramatic",
  "Handheld":            "handheld camera, slight organic movement, documentary immediacy",
  "Crane up":            "camera cranes upward, revealing scale, grand and epic",
  "Tracking shot":       "smooth tracking shot following subject, fluid motion",
  "Bird's eye":          "overhead bird's eye view, top-down, geometric perspective",
  "Extreme close-up":    "extreme close-up, macro detail, intimate and intense",
  "Over-the-shoulder":   "over-the-shoulder framing, depth of field, conversational",
  "Pan left":            "slow pan left, sweeping reveal, deliberate motion",
  "Pan right":           "slow pan right, sweeping reveal, deliberate motion",
  "Tilt up":             "camera tilts up, revealing height, powerful upward motion",
  "Tilt down":           "camera tilts down, descending reveal, grounding motion",
  "POV":                 "first-person POV shot, immersive, subjective camera",
  "Worm's eye":          "worm's eye view, looking up, imposing and powerful",
  "Establishing shot":   "wide establishing shot, setting context, environmental storytelling",
  "Wide shot":           "wide shot, full figure in environment, spatial context",
  "Medium shot":         "medium shot, waist-up framing, balanced composition",
  "Close-up":            "close-up shot, face or object detail, emotional intimacy",
  "Static":              "static camera, stable, composed, deliberate framing",
};

export function buildShotPromptFragment(params: {
  shotType: string;
  cameraMovement: string;
  lightingMood: string;
  timeOfDay: string;
}): string {
  return [
    PROMPT_TRANSLATIONS[params.shotType]       || params.shotType,
    PROMPT_TRANSLATIONS[params.cameraMovement] || params.cameraMovement,
    PROMPT_TRANSLATIONS[params.lightingMood]   || params.lightingMood,
    `time of day: ${params.timeOfDay}`,
  ].filter(Boolean).join(", ");
}
