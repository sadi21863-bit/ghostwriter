// Checked at runtime when features are used, not at build time.
// Returns null if the key is present, or an error message string.

export function checkGeminiKey(): string | null {
  if (!process.env.GEMINI_API_KEY) {
    return "GEMINI_API_KEY is not set. Video dissection is unavailable. Add it to your environment variables.";
  }
  return null;
}

export function checkAnthropicKey(): string | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "ANTHROPIC_API_KEY is not set. AI generation is unavailable.";
  }
  return null;
}

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'ANTHROPIC_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_STORY_PRO_PRICE_ID',
  'STRIPE_CREATOR_PRO_PRICE_ID',
  'STRIPE_ALL_ACCESS_PRICE_ID',
  'RESEND_API_KEY',
  'CRON_SECRET',
  'ADMIN_SECRET',
];

export function checkEnvVars(): { missing: string[]; ok: boolean } {
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
  return { missing, ok: missing.length === 0 };
}
