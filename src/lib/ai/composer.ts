// src/lib/ai/composer.ts
// Multi-library composition context builder.
// Merges selected technique libraries into a unified system directive
// for scenes that must operate across multiple dimensions simultaneously.

import { buildCombatContext } from "@/lib/combat";
import { buildEmotionalContext } from "@/lib/emotional";
import { buildTensionContext } from "@/lib/tension";
import { buildAtmosphereContext } from "@/lib/atmosphere";

export type CompositionLayerType = "combat" | "emotional" | "tension" | "atmosphere";

export interface CompositionLayer {
  type: CompositionLayerType;
  param: string; // style name, emotion name, tension type, or environment name
}

// ── Presets ───────────────────────────────────────────────────────────────────

export const COMPOSITION_PRESETS: {
  name: string;
  description: string;
  layers: CompositionLayer[];
}[] = [
  {
    name: "Dark Romance",
    description: "Intimacy grounded in longing, with paranoia underneath",
    layers: [
      { type: "emotional", param: "Intimacy" },
      { type: "tension",   param: "Paranoia" },
    ],
  },
  {
    name: "Cosmic Horror",
    description: "Decayed atmosphere + pervasive dread + fear at the body level",
    layers: [
      { type: "atmosphere", param: "Abandoned" },
      { type: "tension",    param: "Dread" },
      { type: "emotional",  param: "Fear" },
    ],
  },
  {
    name: "Combat + Rage",
    description: "Fight scene with rage physiology woven into every exchange",
    layers: [
      { type: "combat",    param: "Muay Thai" },
      { type: "emotional", param: "Rage" },
    ],
  },
  {
    name: "Grief Aftermath",
    description: "Liminal space + grief recession — the scene after",
    layers: [
      { type: "atmosphere", param: "Liminal" },
      { type: "emotional",  param: "Grief" },
    ],
  },
  {
    name: "Countdown",
    description: "Urban pressure cooker + countdown tension + sustained fear",
    layers: [
      { type: "atmosphere", param: "Urban" },
      { type: "tension",    param: "Countdown" },
      { type: "emotional",  param: "Fear" },
    ],
  },
  {
    name: "Shame Spiral",
    description: "Confined space + curiosity structure + shame physiology",
    layers: [
      { type: "atmosphere", param: "Confined" },
      { type: "tension",    param: "Curiosity" },
      { type: "emotional",  param: "Shame" },
    ],
  },
];

// ── Available options per layer type ─────────────────────────────────────────

export const LAYER_OPTIONS: Record<CompositionLayerType, string[]> = {
  combat:    [
    "Muay Thai", "Boxing", "Brazilian Jiu-Jitsu", "Krav Maga", "Judo",
    "Kalari Payattu", "Silambam", "Thang-Ta", "Gatka", "Capoeira",
    "Pankration", "Bartitsu", "HEMA Longsword", "Naginatajutsu",
    "Kushti", "Street Fighting",
  ],
  emotional: ["Grief", "Rage", "Fear", "Shame", "Joy", "Intimacy", "Despair"],
  tension:   ["Suspense", "Curiosity", "Dread", "Paranoia", "Countdown"],
  atmosphere: ["Natural", "Urban", "Confined", "Liminal", "Abandoned"],
};

export const LAYER_LABELS: Record<CompositionLayerType, string> = {
  combat:    "Combat Style",
  emotional: "Emotion",
  tension:   "Tension Type",
  atmosphere: "Atmosphere",
};

export const LAYER_COLORS: Record<CompositionLayerType, { bg: string; text: string }> = {
  combat:    { bg: "#fef3c7", text: "#92400e" },
  emotional: { bg: "#fdf2f8", text: "#701a75" },
  tension:   { bg: "#fef2f2", text: "#991b1b" },
  atmosphere: { bg: "#f0fdf4", text: "#14532d" },
};

// ── Compatibility matrix ──────────────────────────────────────────────────────

// Checks whether two generation modes can be combined (primary + modifier).
// Returns false if: same mode, or the combination is semantically nonsensical.
const INCOMPATIBLE_PAIRS = new Set([
  "atmosphere:combat",  // serene/liminal atmosphere can't take combat as a modifier
]);

export function isCompatible(primary: string, modifier: string): boolean {
  if (primary === modifier) return false;
  return !INCOMPATIBLE_PAIRS.has(`${primary}:${modifier}`);
}

// ── Context builder ───────────────────────────────────────────────────────────

export function buildCompositionContext(layers: CompositionLayer[]): string {
  if (!layers.length) return "";

  const layerLabels = layers.map(l => `${LAYER_LABELS[l.type]}(${l.param})`).join(" + ");

  const blocks: string[] = [];
  blocks.push("COMPOSITION MODE — MULTI-LIBRARY ACTIVE");
  blocks.push(`Active layers: ${layerLabels}`);
  blocks.push(
    "DIRECTIVE: All active library constraints apply simultaneously. " +
    "The scene must operate across all active dimensions at once — not sequentially. " +
    "A paragraph that contains elements from only one layer has failed. " +
    "Find the intersections: the moment where the combat technique reveals the somatic signature, " +
    "where the atmospheric pressure deepens the tension structure, " +
    "where the emotion's FACS signal appears mid-action. Write the intersection, not the sum."
  );
  blocks.push("---");

  for (const layer of layers) {
    let ctx = "";
    switch (layer.type) {
      case "combat":
        ctx = buildCombatContext(layer.param, "");
        break;
      case "emotional":
        ctx = buildEmotionalContext(layer.param);
        break;
      case "tension":
        ctx = buildTensionContext(layer.param);
        break;
      case "atmosphere":
        ctx = buildAtmosphereContext(layer.param);
        break;
    }
    if (ctx) blocks.push(ctx);
  }

  if (layers.length >= 2) {
    blocks.push(buildIntersectionDirectives(layers));
  }

  return blocks.join("\n\n");
}

function buildIntersectionDirectives(layers: CompositionLayer[]): string {
  const names = layers.map(l => `${l.param} (${LAYER_LABELS[l.type]})`).join(" + ");
  const directives = [
    "COMPOSITION INTERSECTION DIRECTIVES:",
    `Writing task: a scene where ${names} operate simultaneously.`,
    "Every paragraph must contain at least two active layer elements.",
    "Specific intersection requirements:",
  ];

  const hasCombat    = layers.some(l => l.type === "combat");
  const hasEmotional = layers.some(l => l.type === "emotional");
  const hasTension   = layers.some(l => l.type === "tension");
  const hasAtmosphere = layers.some(l => l.type === "atmosphere");

  if (hasCombat && hasEmotional) {
    directives.push("• COMBAT × EMOTION: The fighter's somatic state (heart rate, muscle tension, breathing) must reflect the emotional library's physiology. The FACS signals appear in the fighter's face between exchanges — not in cutaways, but mid-action.");
  }
  if (hasCombat && hasTension) {
    directives.push("• COMBAT × TENSION: The information gap is spatial. What the POV fighter cannot see is the structural tension engine. Withhold the opponent's next move. Short sentences as the threat approaches.");
  }
  if (hasCombat && hasAtmosphere) {
    directives.push("• COMBAT × ATMOSPHERE: The environment is not backdrop. It constrains movement, affects footing, carries smell and sound that register in the body before the fighter consciously processes them.");
  }
  if (hasEmotional && hasTension) {
    directives.push("• EMOTION × TENSION: The emotion's somatic state (somatic markers) creates or sustains the information gap. The suppressed display is itself a form of information withheld from the other character.");
  }
  if (hasEmotional && hasAtmosphere) {
    directives.push("• EMOTION × ATMOSPHERE: The olfactory layer of the atmosphere directly activates the amygdala — it triggers the emotional onset sequence (body first, then awareness). Write this connection.");
  }
  if (hasTension && hasAtmosphere) {
    directives.push("• TENSION × ATMOSPHERE: The environment's psychological effect (Ulrich SRT / Kaplan ART) must amplify or counterpoint the tension structure. A restorative natural environment creates tension by contrast — the threat feels wrong here.");
  }

  directives.push("The composition succeeds when a reader who knows only ONE active layer still notices the others are operating.");

  return directives.join("\n");
}
