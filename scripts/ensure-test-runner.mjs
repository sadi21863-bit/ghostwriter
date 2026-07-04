/**
 * Upserts the disposable ghostwriter-test-runner@example.com account with a
 * known password, verifies its email, and bumps its subscription to
 * all_access so gated Director tools (villain-pov, tension-curve) are
 * reachable. Combines what bump-test-tier.mjs / verify-test-email.mjs do
 * separately, plus password provisioning (neither existing script sets one).
 * Usage: node scripts/ensure-test-runner.mjs
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
const bcrypt = (await import("bcryptjs")).default;
const sql = neon(env.DATABASE_URL);

const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const hashed = await bcrypt.hash(PASSWORD, 12);

const existing = await sql`SELECT id FROM users WHERE email = ${EMAIL}`;
let userId;
if (existing.length === 0) {
  const [row] = await sql`
    INSERT INTO users (email, hashed_password, name, email_verified)
    VALUES (${EMAIL}, ${hashed}, 'GhostWriter Test Runner', NOW())
    RETURNING id
  `;
  userId = row.id;
  console.log("Created test-runner user:", userId);
} else {
  userId = existing[0].id;
  await sql`UPDATE users SET hashed_password = ${hashed}, email_verified = NOW() WHERE id = ${userId}`;
  console.log("Updated existing test-runner user:", userId);
}

const subExisting = await sql`SELECT id FROM subscriptions WHERE user_id = ${userId}`;
if (subExisting.length === 0) {
  await sql`
    INSERT INTO subscriptions (user_id, tier, status, updated_at)
    VALUES (${userId}, 'all_access', 'active', NOW())
  `;
  console.log("Created all_access subscription");
} else {
  await sql`UPDATE subscriptions SET tier = 'all_access', status = 'active', updated_at = NOW() WHERE user_id = ${userId}`;
  console.log("Bumped subscription to all_access");
}

console.log("\nTest runner ready:");
console.log("  email:", EMAIL);
console.log("  password:", PASSWORD);
