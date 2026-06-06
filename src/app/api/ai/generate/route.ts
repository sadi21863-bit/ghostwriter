export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit, freeGenerationLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature, MONTHLY_GENERATION_LIMITS } from "@/lib/subscription";
import { GATED_MODES } from "@/types/subscription";
import { generate, MODELS } from "@/lib/ai/engine";
import { buildAiismsInstruction } from "@/lib/ai/aiisms";
import { db } from "@/db";
import { generations, projects, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { track } from "@/lib/analytics";

const VIOLATION_PATTERNS: Record<string, {
  detect: (prompt: string) => boolean;
  flagMessage: string;
  supportMode: string;
}> = {
  "op_protagonist": {
    detect: (p) => /overpowered|(?<!\w)OP(?!\w)|perfect.*protagonist|no.*weakness|always win|never fail/i.test(p),
    flagMessage: "This request appears to involve an overpowered/perfect protagonist. If intentional (power fantasy, isekai wish-fulfillment, parody), confirm below and I'll generate with full craft support for that specific mode. If unintentional, consider adding external constraints — who they care about, what they refuse to do, information gaps — to create tension without reducing their power.",
    supportMode: "The OP character's tension is external: stakes come from who they love, what they won't do, and costs to others. I'll write with this in mind.",
  },
  "villain_accent": {
    detect: (p) => /villain.*accent|evil.*accent|bad.*guy.*foreign/i.test(p),
    flagMessage: "Assigning a foreign/non-standard accent to a villain activates a documented harmful trope. If intentional (the story is explicitly about this bias, or you're subverting it), confirm. Otherwise, consider: what if the villain speaks with the prestige accent, and the most trustworthy character has the stigmatized accent?",
    supportMode: "Using accent subversion to challenge reader assumptions. The villain's prestige accent is their armor. I'll write this with full awareness.",
  },
  "supercrip_disability": {
    detect: (p) => /blind.*radar|deaf.*super|disability.*superpower|disability.*gift/i.test(p),
    flagMessage: "This appears to use a disability as a superpower source (the 'Supercrip' trope). If intentional subversion or genre-aware choice, confirm. Otherwise, consider: the disability is one dimension of a whole person, not the source of their extraordinary ability.",
    supportMode: "Writing disability with full human complexity. The superpower, if present, comes from something other than the disability itself.",
  },
};

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const { mode, prompt, context, staticContext, dynamicContext, format, projectId, chapterId, bypassViolationCheck, narrativeStructure, additionalContext } = await req.json();

  if (!prompt?.trim()) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  if (!mode) return NextResponse.json({ error: "Mode is required" }, { status: 400 });

  // Violation detection: check prompt against known harmful patterns
  if (!bypassViolationCheck && projectId) {
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
    });
    const confirmed = ((project as any)?.intentionalViolations || {}) as Record<string, any>;
    for (const [violationType, pattern] of Object.entries(VIOLATION_PATTERNS)) {
      if (pattern.detect(prompt) && !confirmed[violationType]?.confirmed) {
        return NextResponse.json({
          requiresConfirmation: true,
          violationType,
          flagMessage: pattern.flagMessage,
          supportMode: pattern.supportMode,
        });
      }
    }
  }

  // Tier check: mode-gated features (dialogue, combat, emotional, atmosphere, tension, composition)
  const tier = await getUserTier(session.user.id);
  const gatedFeature = GATED_MODES[mode as string];
  if (gatedFeature && !canAccessFeature(tier, gatedFeature)) {
    return NextResponse.json({ error: "upgrade_required", feature: gatedFeature, tier }, { status: 403 });
  }

  // Free tier: block all library modes
  const LIBRARY_MODES = new Set([
    'combat', 'emotional', 'atmosphere', 'tension', 'horror',
    'comedy', 'mystery', 'romance', 'action', 'monologue',
    'voice', 'thriller', 'sports', 'setting', 'historical',
    'scitech', 'ethics', 'endings', 'isekai', 'composition',
    'interrogation', 'chase',
  ]);
  if (tier === 'free' && LIBRARY_MODES.has(mode)) {
    return NextResponse.json({
      error: 'upgrade_required',
      feature: 'story_modes_advanced',
      message: 'Library modes require Story Pro. Upgrade for all 26 writing modes.',
    }, { status: 403 });
  }

  // Free tier: route to Haiku (4.5x cheaper, proves value, drives upgrades)
  const overrideModel = tier === 'free' ? MODELS.fast : undefined;

  // Daily limit: free tier gets 10 generations/day
  if (tier === "free" && freeGenerationLimit) {
    const { success } = await freeGenerationLimit.limit(session.user.id);
    if (!success) {
      return NextResponse.json({
        error: "upgrade_required",
        feature: "unlimited_generations",
        tier,
        message: "Free tier limit: 10 generations per day. Upgrade for unlimited.",
      }, { status: 429 });
    }
  }

  // Monthly generation cap
  const monthlyLimit = MONTHLY_GENERATION_LIMITS[tier] ?? 30;
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
      await db.update(users).set({
        monthlyGenerations: 0,
        monthlyGenerationsResetAt: now,
      }).where(eq(users.id, session.user.id));
    } else if ((user?.monthlyGenerations ?? 0) >= monthlyLimit) {
      const resetsAt = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      return NextResponse.json({
        error: "upgrade_required",
        feature: "monthly_limit",
        tier,
        message: `You've used your ${monthlyLimit} generations this month. Upgrade for more.`,
        resetsAt,
      }, { status: 403 });
    }
  }

  const totalLength = (context || "").length + (prompt || "").length;
  if (totalLength > 150000) {
    return NextResponse.json({ error: "Context too large. Try reducing your World Bible or clearing old memories." }, { status: 400 });
  }

  try {
    // Brainstorm mode: append 3-options directive
    let effectivePrompt = prompt;
    if (mode === 'brainstorm') {
      effectivePrompt = prompt + `\n\nReturn exactly 3 distinct structural approaches as options. Do not pick one.\nFormat strictly:\n\nOPTION A — [SHORT NAME]:\n[2-3 sentences describing the structural direction, opening, key tension]\n\nOPTION B — [SHORT NAME]:\n[2-3 sentences describing a different structural direction]\n\nOPTION C — [SHORT NAME]:\n[2-3 sentences describing a third structural direction]\n\n---\nEach option must represent a genuinely different creative direction, not variations of the same idea.\nOne option should subvert expectations.`;
    }

    // AIisms check (opt-in per project, Story Pro+ only)
    let aiismsNote = '';
    if (projectId && tier !== 'free') {
      const proj = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
      });
      if ((proj as any)?.aiismsCheck) {
        aiismsNote = '\n\n' + buildAiismsInstruction();
      }
    }

    const effectiveDynamic = [dynamicContext, additionalContext, aiismsNote].filter(Boolean).join('\n\n');
    const r = await generate({ mode, prompt: effectivePrompt, context, staticContext, dynamicContext: effectiveDynamic, format, narrativeStructure, overrideModel });
    await db.insert(generations).values({
      projectId, chapterId: chapterId || null, mode, prompt,
      output: r.text, model: r.model, tokensUsed: r.tokensUsed,
    });
    // Increment monthly generation counter
    if (monthlyLimit !== -1) {
      await db.update(users)
        .set({ monthlyGenerations: sql`${users.monthlyGenerations} + 1` })
        .where(eq(users.id, session.user.id));
    }
    await track(session.user.id, 'ai_generation', { mode, format: format ?? '' });
    return NextResponse.json(r);
  } catch (e: any) {
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Anthropic rate limit hit. Wait a moment and try again.", retryable: true }, { status: 429 });
    if (msg.includes("context_length") || msg.includes("too long"))
      return NextResponse.json({ error: "Context too long. Reduce World Bible detail or clear old memories." }, { status: 400 });
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });
  }
}
