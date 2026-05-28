// src/types/subscription.ts
// Subscription tier types, feature gates, and constants.

export type SubscriptionTier = "free" | "story_pro" | "creator_pro" | "all_access";
export type SubscriptionStatus = "active" | "cancelled" | "past_due" | "trialing";

export interface UserSubscription {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
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
  | "virality_predict";

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
};

// ── Which AI modes require which gate ─────────────────────────────────────

export const GATED_MODES: Record<string, FeatureGate> = {
  dialogue:    "story_modes_advanced",
  combat:      "story_modes_advanced",
  emotional:   "story_modes_advanced",
  atmosphere:  "story_modes_advanced",
  tension:     "story_modes_advanced",
  composition: "composition_layer",
  horror:      "story_modes_advanced",
  comedy:      "story_modes_advanced",
  mystery:     "story_modes_advanced",
  romance:     "story_modes_advanced",
  action:      "story_modes_advanced",
};

// ── Stripe price IDs (replace with real IDs from Stripe dashboard) ─────────

export const STRIPE_PRICES = {
  story_pro:    process.env.STRIPE_STORY_PRO_PRICE_ID    ?? "",
  creator_pro:  process.env.STRIPE_CREATOR_PRO_PRICE_ID  ?? "",
  all_access:   process.env.STRIPE_ALL_ACCESS_PRICE_ID   ?? "",
} as const;

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

// ── Upgrade prompt copy ────────────────────────────────────────────────────

export const UPGRADE_COPY: Record<FeatureGate, { title: string; description: string; cta: string }> = {
  story_modes_advanced: {
    title: "Unlock Advanced Writing Modes",
    description: "Dialogue, Combat, Emotional, Atmosphere, and Tension modes are available on Story Pro. Each is grounded in academic research — FACS, Polyvagal Theory, Brewer & Lichtenstein SAT.",
    cta: "Upgrade to Story Pro — ₹799/month",
  },
  composition_layer: {
    title: "Unlock Composition Mode",
    description: "Mix multiple libraries in one generation. Combat + Dread + Rage. Dark Romance. Cosmic Horror. The only tool where genre mixing is systematic and academically grounded.",
    cta: "Upgrade to Story Pro — ₹799/month",
  },
  creator_tools_advanced: {
    title: "Unlock Creator Pro Tools",
    description: "Video Dissection, Trend Intelligence, Retention Editor, and Guest Intel. Reverse-engineer why videos go viral, then make yours.",
    cta: "Upgrade to Creator Pro — ₹399/month",
  },
  style_dna: {
    title: "Unlock Style DNA",
    description: "Analyse your favourite books or scripts and teach GhostWriter your style across 6 dimensions. Every generation then inherits that voice.",
    cta: "Upgrade to Story Pro — ₹799/month",
  },
  story_memories: {
    title: "Unlock Story Memory Engine",
    description: "Automatically extract and track facts across your story. The AI never contradicts what already happened.",
    cta: "Upgrade to Story Pro — ₹799/month",
  },
  character_evolution: {
    title: "Unlock Character Evolution",
    description: "Characters change based on what happens to them. Track how each character evolves across chapters.",
    cta: "Upgrade to Story Pro — ₹799/month",
  },
  ai_suggestion_active: {
    title: "Unlock AI Story Review",
    description: "One-click check for continuity errors, character voice drift, world rule violations, and pacing issues.",
    cta: "Upgrade to Story Pro — ₹799/month",
  },
  export: {
    title: "Unlock Export",
    description: "Export your completed story as PDF, DOCX, or Final Draft format.",
    cta: "Upgrade to Story Pro — ₹799/month",
  },
  comic_studio: {
    title: "Unlock Comic Studio",
    description: "Generate panels with consistent character visual profiles. 30 panels/month on Story Pro.",
    cta: "Upgrade to Story Pro — ₹799/month",
  },
  unlimited_generations: {
    title: "Daily Limit Reached",
    description: "Free tier includes 10 AI generations per day. Upgrade for unlimited generations.",
    cta: "Upgrade to Story Pro — ₹799/month",
  },
  virality_predict: {
    title: "Unlock Virality Predictor",
    description: "Predict engagement scores, hook strength, and retention risk before you publish. Get AI-powered improvement suggestions.",
    cta: "Upgrade to Creator Pro — ₹399/month",
  },
};
