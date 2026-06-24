/**
 * Bumps the disposable paid-test account to all_access (broadest feature gate)
 * for testing Comic Studio + Audio Novel, which require story_pro/all_access
 * specifically (creator_pro does not unlock them).
 * Usage: node scripts/bump-test-tier.mjs
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(join(__dir, "../.env.local"), "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}

const { neon } = await import("@neondatabase/serverless");
const sql = neon(env.DATABASE_URL);

const result = await sql`
  UPDATE subscriptions
  SET tier = 'all_access', status = 'active', updated_at = NOW()
  WHERE user_id = (SELECT id FROM users WHERE email = 'ghostwriter-test-runner@example.com')
  RETURNING tier, status
`;

console.log("Bump result:", result[0]);
