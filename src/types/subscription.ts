// src/types/subscription.ts
// Subscription tier types, feature gates, and constants.

import { MODE_REGISTRY } from "@/lib/modes/registry";

export type SubscriptionTier = "free" | "story_pro" | "creator_pro" | "all_access";
export type SubscriptionStatus = "active" | "cancelled" | "past_due" | "trialing";

export interface UserSubscription {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
}

// ── Feature gate keys ──────────────────────────────────────────────────────

export type FeatureGate =
  | "story_modes_advanced"    // dialogue, combat, emotional, atmosphere, tension, composition
  | "style_dna"
  | "story_memories"
  | "character_evolution"
  | "ai_suggestion_active"
  | "export"
  | "comic_studio"
  | "creator_tools_advanced"  // trend intel, video dissection, guest intel, retention editor
  | "composition_layer"
  | "unlimited_generations"
  | "virality_predict"
  | "audio_novel";

// ── Which tiers unlock which features ─────────────────────────────────────

export const FEATURE_ACCESS: Record<FeatureGate, SubscriptionTier[]> = {
  story_modes_advanced: ["story_pro", "all_access"],
  style_dna:            ["story_pro", "all_access"],
  story_memories:       ["story_pro", "all_access"],
  character_evolution:  ["story_pro", "all_access"],
  ai_suggestion_active: ["story_pro", "all_access"],
  export:               ["story_pro", "all_access"],
  comic_studio:         ["story_pro", "all_access"],
  composition_layer:    ["story_pro", "all_access"],
  creator_tools_advanced: ["creator_pro", "all_access"],
  unlimited_generations:  ["story_pro", "creator_pro", "all_access"],
  virality_predict:       ["creator_pro", "all_access"],
  audio_novel:            ["story_pro", "all_access"],
};

// ── Which AI modes require which gate ─────────────────────────────────────
// Derived from MODE_REGISTRY (src/lib/modes/registry.ts) — add new gated modes there, not here.

export const GATED_MODES: Record<string, FeatureGate> = Object.fromEntries(
  Object.entries(MODE_REGISTRY)
    .filter(([, cfg]) => cfg.gate !== null)
    .map(([mode, cfg]) => [mode, cfg.gate as FeatureGate])
);

// ── Razorpay plan IDs (created manually in Razorpay dashboard) ─────────────

export const RAZORPAY_PLANS: Record<string, Record<string, string>> = {
  story_pro: {
    monthly: process.env.RAZORPAY_STORY_PRO_MONTHLY_PLAN_ID ?? '',
    annual:  process.env.RAZORPAY_STORY_PRO_ANNUAL_PLAN_ID  ?? '',
  },
  creator_pro: {
    monthly: process.env.RAZORPAY_CREATOR_PRO_MONTHLY_PLAN_ID ?? '',
    annual:  process.env.RAZORPAY_CREATOR_PRO_ANNUAL_PLAN_ID  ?? '',
  },
  all_access: {
    monthly: process.env.RAZORPAY_ALL_ACCESS_MONTHLY_PLAN_ID ?? '',
    annual:  process.env.RAZORPAY_ALL_ACCESS_ANNUAL_PLAN_ID  ?? '',
  },
};

// ── Free tier limits ───────────────────────────────────────────────────────

export const FREE_TIER_LIMITS = {
  generations_per_day:   10,
  projects:              1,
  chapters:              3,
  characters:            3,
  locations:             2,
  plot_threads:          2,
  title_hooks_per_day:   5,
  outlines_per_day:      3,
} as const;

// ── Tier to purchase for each feature gate's upgrade CTA ───────────────────
// Must match the tier named in UPGRADE_COPY[feature].cta — e.g. "creator_tools_advanced"
// and "virality_predict" advertise Creator Pro, so they map to "creator_pro" here.

export const UPGRADE_TIER: Record<FeatureGate, SubscriptionTier> = {
  story_modes_advanced: "story_pro",
  style_dna:            "story_pro",
  story_memories:       "story_pro",
  character_evolution:  "story_pro",
  ai_suggestion_active: "story_pro",
  export:               "story_pro",
  comic_studio:         "story_pro",
  composition_layer:    "story_pro",
  unlimited_generations: "story_pro",
  audio_novel:            "story_pro",
  creator_tools_advanced: "creator_pro",
  virality_predict:       "creator_pro",
};

// ── Upgrade prompt copy ────────────────────────────────────────────────────

export const UPGRADE_COPY: Record<FeatureGate, { title: string; description: string; cta: string }> = {
  story_modes_advanced: {
    title: "Unlock Advanced Writing Modes",
    description: "Dialogue, Combat, Emotional, Atmosphere, and Tension modes are available on Story Pro. Each is grounded in academic research — FACS, Polyvagal Theory, Brewer & Lichtenstein SAT.",
    cta: "Upgrade to Story Pro — ₹1,500/month",
  },
  composition_layer: {
    title: "Unlock Composition Mode",
    description: "Mix multiple libraries in one generation. Combat + Dread + Rage. Dark Romance. Cosmic Horror. The only tool where genre mixing is systematic and academically grounded.",
    cta: "Upgrade to Story Pro — ₹1,500/month",
  },
  creator_tools_advanced: {
    title: "Unlock Creator Pro Tools",
    description: "Video Dissection, Trend Intelligence, Retention Editor, and Guest Intel. Reverse-engineer why videos go viral, then make yours.",
    cta: "Upgrade to Creator Pro — ₹1,000/month",
  },
  style_dna: {
    title: "Unlock Style DNA",
    description: "Analyse your favourite books or scripts and teach GhostWriter your style across 6 dimensions. Every generation then inherits that voice.",
    cta: "Upgrade to Story Pro — ₹1,500/month",
  },
  story_memories: {
    title: "Unlock Story Memory Engine",
    description: "Automatically extract and track facts across your story. The AI never contradicts what already happened.",
    cta: "Upgrade to Story Pro — ₹1,500/month",
  },
  character_evolution: {
    title: "Unlock Character Evolution",
    description: "Characters change based on what happens to them. Track how each character evolves across chapters.",
    cta: "Upgrade to Story Pro — ₹1,500/month",
  },
  ai_suggestion_active: {
    title: "Unlock AI Story Review",
    description: "One-click check for continuity errors, character voice drift, world rule violations, and pacing issues.",
    cta: "Upgrade to Story Pro — ₹1,500/month",
  },
  export: {
    title: "Unlock Export",
    description: "Export your completed story as PDF, DOCX, or Final Draft format.",
    cta: "Upgrade to Story Pro — ₹1,500/month",
  },
  comic_studio: {
    title: "Unlock Comic Studio",
    description: "Generate panels with consistent character visual profiles. 30 panels/month on Story Pro.",
    cta: "Upgrade to Story Pro — ₹1,500/month",
  },
  unlimited_generations: {
    title: "Monthly Limit Reached",
    description: "Free tier includes 10 AI generations per month. Upgrade for unlimited generations.",
    cta: "Upgrade to Story Pro — ₹1,500/month",
  },
  virality_predict: {
    title: "Unlock Virality Predictor",
    description: "Predict engagement scores, hook strength, and retention risk before you publish. Get AI-powered improvement suggestions.",
    cta: "Upgrade to Creator Pro — ₹1,000/month",
  },
  audio_novel: {
    title: "Audio Novel — Add-on",
    description: "Convert your chapters to audio with character-specific voices. ₹299 per chapter export.",
    cta: "Purchase Audio Export — ₹299",
  },
};
