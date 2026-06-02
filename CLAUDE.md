# GhostWriter AI
AI ghostwriting platform.

## Stack
Next.js 14, Drizzle ORM, Neon PostgreSQL, NextAuth, Anthropic Claude, Tailwind, Vercel.

## Architecture
- Continuity engine: chapter summaries in AI context
- Style DNA: reference works to 6 attributes
- Modes: Brainstorm / Outline / Write / 20 library modes
- World Bible: characters, locations, plot threads
- Prompt caching: static/dynamic context split; static block cached (ephemeral)
- Model tiers: Haiku (summaries/grading), Sonnet-4-6 (generation), Opus-4-6 (write/library modes)
- Quality check: Tier 1 Haiku + Tier 2 Sonnet in parallel, non-blocking
- Toast system: src/lib/toast.ts + ToastContainer — no external state manager

## Commands
npm run dev (port 3001) / npm run db:push / npm run db:studio

## Schema migrations (Windows PowerShell)
Copy-Item .env.local .env -Force
npx drizzle-kit generate
npx drizzle-kit push

## Auth
Application-level ownership checks only. Never use Supabase RLS. Always call getRequiredSession() in protected routes.

## LSP false positives
"Props must be serializable" warnings for function props between 'use client' components are pre-existing false positives. tsc --noEmit exit 0 is ground truth.

## Required environment variables

| Variable | Purpose |
|---|---|
| DATABASE_URL | Neon PostgreSQL connection string |
| NEXTAUTH_SECRET | NextAuth JWT secret (random 32-char string) |
| NEXTAUTH_URL | Full public URL (e.g. https://ghostwriterai.com) |
| ANTHROPIC_API_KEY | Claude API key for all AI generation |
| STRIPE_SECRET_KEY | Stripe secret key for payment processing |
| STRIPE_WEBHOOK_SECRET | Stripe webhook signing secret |
| STRIPE_STORY_PRO_PRICE_ID | Story Pro monthly price ID (price_xxx) |
| STRIPE_CREATOR_PRO_PRICE_ID | Creator Pro monthly price ID |
| STRIPE_ALL_ACCESS_PRICE_ID | All Access monthly price ID |
| RESEND_API_KEY | Resend API key for transactional email |
| CRON_SECRET | Secret header for cron job routes |
| HIGGSFIELD_API_KEY | Higgsfield API key for video generation (optional) |
| GEMINI_API_KEY | Google Gemini key for video dissection (optional) |
| OPENAI_API_KEY | OpenAI key for embeddings only (text-embedding-3-small) |
| NEXT_PUBLIC_SENTRY_DSN | Sentry DSN for error monitoring (optional) |

## Pre-launch checklist
1. Set all env vars in Vercel dashboard
2. Enable pgvector extension on Neon
3. Run npx drizzle-kit push in production
4. Trigger embedding backfill: POST /api/work-packets/embed
5. Configure Resend domain + DNS
6. Create Stripe products and add price IDs to Vercel env vars
