/**
 * Simulates a Razorpay subscription.activated webhook to localhost:3000.
 * Reads RAZORPAY_WEBHOOK_SECRET and DATABASE_URL from .env.local.
 * Usage: node scripts/test-webhook.mjs [event]
 *   event: subscription.activated (default) | subscription.cancelled
 */
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, "../.env.local");

// Parse .env.local
const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}

const webhookSecret = env.DATABASE_URL ? env.RAZORPAY_WEBHOOK_SECRET : null;
if (!env.RAZORPAY_WEBHOOK_SECRET) {
  console.error("RAZORPAY_WEBHOOK_SECRET not found in .env.local");
  process.exit(1);
}
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

// Look up userId by email using @neondatabase/serverless
const { neon } = await import("@neondatabase/serverless");
const sql = neon(env.DATABASE_URL);
const rows = await sql`SELECT id, email FROM users WHERE email = 'sadi21863@gmail.com' LIMIT 1`;
const user = rows[0];

if (!user) {
  console.error("User sadi21863@gmail.com not found in DB");
  process.exit(1);
}
console.log(`Found user: ${user.email} (${user.id})`);

const eventName = process.argv[2] ?? "subscription.activated";
const fakeSubId = "sub_test_" + Date.now();
const currentEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days from now

const payload = {
  event: eventName,
  payload: {
    subscription: {
      entity: {
        id: fakeSubId,
        status: eventName === "subscription.cancelled" ? "cancelled" : "active",
        current_end: currentEnd,
        notes: {
          userId: user.id,
          tier: "story_pro",
          billingPeriod: "monthly",
        },
      },
    },
  },
};

const body = JSON.stringify(payload);
const signature = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
  .update(body)
  .digest("hex");

console.log(`\nSending ${eventName} to http://localhost:3000/api/webhooks/razorpay ...`);

const res = await fetch("http://localhost:3000/api/webhooks/razorpay", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-razorpay-signature": signature,
  },
  body,
});

const text = await res.text();
console.log(`Response: ${res.status} ${res.statusText}`);
console.log(text);

if (res.ok) {
  console.log("\n✅ Webhook accepted — check your subscription tier in the app.");
} else {
  console.log("\n❌ Webhook rejected.");
}
