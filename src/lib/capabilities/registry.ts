import type { FeatureGate, SubscriptionTier } from "@/types/subscription";
import { MODE_REGISTRY, type ModeVisibility } from "@/lib/modes/registry";
import { canAccessFeature } from "@/lib/subscription";
import { isCreatorFormat } from "@/lib/formats";
import type { CapabilityRole, CapabilityStage, CapabilityProvider } from "./types";

export type { CapabilityRole, CapabilityStage, CapabilityProvider } from "./types";

export interface Capability {
  id: string;
  label: string;
  kind: "mode" | "tool";
  role: CapabilityRole;
  stage: CapabilityStage;
  provider: CapabilityProvider;
  gate: FeatureGate | null;
  visibility: ModeVisibility;
  endpoint?: string;
  experimental?: boolean;
}

function modeToCapability(id: string, cfg: typeof MODE_REGISTRY[keyof typeof MODE_REGISTRY]): Capability {
  return {
    id,
    label: cfg.label,
    kind: "mode",
    role: cfg.role,
    stage: cfg.stage,
    provider: "anthropic",
    gate: cfg.gate,
    visibility: cfg.visibility,
  };
}

// Standalone (non-mode) tools. Endpoints with [dynamic] segments are not
// route-checked by the drift guard but must still be real.
export const TOOL_REGISTRY: Capability[] = [
  { id: "prose_fix",             label: "Fix Weakness",         kind: "tool", role: "editor",   stage: "write",    provider: "anthropic", gate: null,                     visibility: "story_and_creator", endpoint: "/api/ai/prose-fix" },
  { id: "surgical_edit",         label: "Find & Edit",          kind: "tool", role: "editor",   stage: "write",    provider: "anthropic", gate: null,                     visibility: "story_and_creator", endpoint: "/api/ai/surgical-edit" },
  { id: "refine",                label: "Refine (critic pass)", kind: "tool", role: "editor",   stage: "write",    provider: "anthropic", gate: null,                     visibility: "story_and_creator", endpoint: "/api/ai/refine" },
  { id: "editor_review",         label: "Editor Review",        kind: "tool", role: "editor",   stage: "produce",  provider: "anthropic", gate: null,                     visibility: "story_and_creator", endpoint: "/api/projects/[projectId]/editor-notes" },
  { id: "knowledge_audit",       label: "Knowledge Audit",      kind: "tool", role: "editor",   stage: "produce",  provider: "anthropic", gate: null,                     visibility: "story_only",        endpoint: "/api/projects/[projectId]/knowledge-audit" },
  { id: "transportation_check",  label: "Transportation Check", kind: "tool", role: "editor",   stage: "produce",  provider: "anthropic", gate: null,                     visibility: "story_only",        endpoint: "/api/projects/[projectId]/transportation-check" },
  { id: "tension_curve",         label: "Tension Curve",        kind: "tool", role: "director", stage: "shape",    provider: "anthropic", gate: null,                     visibility: "story_only",        endpoint: "/api/projects/[projectId]/tension-curve" },
  { id: "arc_heatmap",           label: "Arc Heat Map",         kind: "tool", role: "director", stage: "shape",    provider: "anthropic", gate: null,                     visibility: "story_only",        endpoint: "/api/projects/[projectId]/arc-heatmap" },
  { id: "villain_pov",           label: "Villain POV",          kind: "tool", role: "director", stage: "shape",    provider: "anthropic", gate: null,                     visibility: "story_only",        endpoint: "/api/projects/[projectId]/villain-pov" },
  { id: "series_plan",           label: "Series Plan",          kind: "tool", role: "director", stage: "discover", provider: "anthropic", gate: null,                     visibility: "story_only",        endpoint: "/api/ai/series-plan" },
  { id: "research_scaffold",     label: "Research Scaffold",    kind: "tool", role: "director", stage: "discover", provider: "anthropic", gate: null,                     visibility: "story_and_creator", endpoint: "/api/ai/research-scaffold" },
  { id: "generate_package",      label: "Production Package",   kind: "tool", role: "director", stage: "produce",  provider: "anthropic", gate: null,                     visibility: "story_only",        endpoint: "/api/projects/[projectId]/production/generate-package" },
  { id: "scene_to_video_prompt", label: "Scene → Video Prompt", kind: "tool", role: "director", stage: "produce",  provider: "anthropic", gate: null,                     visibility: "story_only",        endpoint: "/api/ai/scene-to-video-prompt" },
  { id: "comic_generate",        label: "Comic Studio",         kind: "tool", role: "director", stage: "produce",  provider: "segmind",   gate: "comic_studio",           visibility: "story_only",        endpoint: "/api/projects/[projectId]/comics" },
  { id: "production_video",      label: "Scene Video",          kind: "tool", role: "writer",   stage: "produce",  provider: "segmind",   gate: null,                     visibility: "story_only",        endpoint: "/api/projects/[projectId]/production/scenes/[sceneNumber]/generate-video" },
  { id: "audio_generate",        label: "Audio Novel",          kind: "tool", role: "writer",   stage: "produce",  provider: "openai",    gate: "audio_novel",            visibility: "story_only",        endpoint: "/api/audio/generate" },
  { id: "trend_youtube",         label: "YouTube Trends",       kind: "tool", role: "director", stage: "discover", provider: "anthropic", gate: "creator_tools_advanced", visibility: "story_and_creator", endpoint: "/api/ai/trend-youtube" },
  { id: "trend_instagram",       label: "Instagram Trends",     kind: "tool", role: "director", stage: "discover", provider: "anthropic", gate: "creator_tools_advanced", visibility: "story_and_creator", endpoint: "/api/ai/trend-instagram" },
  { id: "trend_niche",           label: "Niche Trends",         kind: "tool", role: "director", stage: "discover", provider: "anthropic", gate: "creator_tools_advanced", visibility: "story_and_creator", endpoint: "/api/ai/trend-niche" },
  { id: "trend_angles",          label: "Trend Angles",         kind: "tool", role: "director", stage: "discover", provider: "anthropic", gate: null,                     visibility: "story_and_creator", endpoint: "/api/ai/trend-angles" },
  { id: "creator_research",      label: "Creator Research",     kind: "tool", role: "director", stage: "discover", provider: "anthropic", gate: "creator_tools_advanced", visibility: "story_and_creator", endpoint: "/api/ai/creator-research" },
  { id: "dissect_video",         label: "Video Dissection",     kind: "tool", role: "director", stage: "discover", provider: "internal",  gate: "creator_tools_advanced", visibility: "story_and_creator", endpoint: "/api/ai/dissect-video" },
  { id: "hook_ab",               label: "Hook A/B",             kind: "tool", role: "editor",   stage: "shape",    provider: "anthropic", gate: null,                     visibility: "story_and_creator", endpoint: "/api/ai/hook-ab" },
  { id: "score_hook",            label: "Hook Score",           kind: "tool", role: "editor",   stage: "shape",    provider: "anthropic", gate: null,                     visibility: "story_and_creator", endpoint: "/api/ai/score-hook" },
  { id: "retention_edit",        label: "Retention Edit",       kind: "tool", role: "editor",   stage: "produce",  provider: "anthropic", gate: "creator_tools_advanced", visibility: "story_and_creator", endpoint: "/api/ai/retention-edit" },
  { id: "virality_predict",      label: "Virality Predict",     kind: "tool", role: "editor",   stage: "produce",  provider: "anthropic", gate: "virality_predict",       visibility: "story_and_creator", endpoint: "/api/ai/virality-predict" },
];

export function getCapabilities(): Capability[] {
  const modeCaps = Object.entries(MODE_REGISTRY).map(([id, cfg]) => modeToCapability(id, cfg));
  return [...modeCaps, ...TOOL_REGISTRY];
}

export function getCapabilitiesByStage(stage: CapabilityStage): Capability[] {
  return getCapabilities().filter(c => c.stage === stage);
}

export function getCapabilitiesByRole(role: CapabilityRole): Capability[] {
  return getCapabilities().filter(c => c.role === role);
}

// ─── Availability / preflight ───────────────────────────────────────────────
export interface CapabilityContext {
  tier: SubscriptionTier;
  hasSegmindKey: boolean;
  hasOpenAIKey: boolean;
  format: string;
}

export interface CapabilityAvailability {
  available: boolean;
  reason?: "upgrade_required" | "missing_segmind_key" | "missing_openai_key" | "not_applicable_for_format";
}

export function isCapabilityAvailable(cap: Capability, ctx: CapabilityContext): CapabilityAvailability {
  // 1. Format applicability first — so an inapplicable tool never shows an upgrade/key nag.
  if (cap.visibility === "story_only" && isCreatorFormat(ctx.format))
    return { available: false, reason: "not_applicable_for_format" };

  // 2. Tier gate.
  if (cap.gate && !canAccessFeature(ctx.tier, cap.gate))
    return { available: false, reason: "upgrade_required" };

  // 3. Provider key (anthropic/internal are server-side — no user key needed).
  if (cap.provider === "segmind" && !ctx.hasSegmindKey)
    return { available: false, reason: "missing_segmind_key" };
  if (cap.provider === "openai" && !ctx.hasOpenAIKey)
    return { available: false, reason: "missing_openai_key" };

  return { available: true };
}

export interface SupportEnvelope {
  stages: Record<CapabilityStage, Record<CapabilityRole, Array<Capability & CapabilityAvailability>>>;
}

const STAGES: CapabilityStage[] = ["discover", "shape", "write", "produce"];
const ROLES: CapabilityRole[] = ["director", "writer", "editor"];

export function supportEnvelope(ctx: CapabilityContext): SupportEnvelope {
  const stages = {} as SupportEnvelope["stages"];
  for (const stage of STAGES) {
    stages[stage] = {} as Record<CapabilityRole, Array<Capability & CapabilityAvailability>>;
    for (const role of ROLES) stages[stage][role] = [];
  }
  for (const cap of getCapabilities()) {
    const availability = isCapabilityAvailable(cap, ctx);
    stages[cap.stage][cap.role].push({ ...cap, ...availability });
  }
  return { stages };
}
