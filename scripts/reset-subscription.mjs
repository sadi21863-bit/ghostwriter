/**
 * Resets the test account subscription back to free tier for re-testing checkout.
 * Usage: node scripts/reset-subscription.mjs
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
  SET tier = 'free', status = 'active', razorpay_subscription_id = NULL, current_period_end = NULL, updated_at = NOW()
  WHERE user_id = (SELECT id FROM users WHERE email = 'sadi21863@gmail.com')
  RETURNING tier, status
`;

console.log("Reset result:", result[0]);
console.log("✅ Subscription reset to free — refresh the app to see the upgrade button.");
