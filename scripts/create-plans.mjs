/**
 * Creates 6 Razorpay plans and updates .env.local with the new plan IDs.
 * Usage: node scripts/create-plans.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, "../.env.local");

const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}

const KEY_ID = env.RAZORPAY_KEY_ID;
const KEY_SECRET = env.RAZORPAY_KEY_SECRET;
const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");

async function createPlan(name, amount, period) {
  const res = await fetch("https://api.razorpay.com/v1/plans", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      period,
      interval: 1,
      item: { name, amount, currency: "INR" },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Failed to create plan "${name}": ${JSON.stringify(data)}`);
  console.log(`✅ ${name}: ${data.id}`);
  return data.id;
}

// amounts in paise (1 INR = 100 paise)
// Annual = 10 months price (2 months free)
const plans = {
  RAZORPAY_STORY_PRO_MONTHLY_PLAN_ID:   await createPlan("Story Pro Monthly",     150000, "monthly"),
  RAZORPAY_STORY_PRO_ANNUAL_PLAN_ID:    await createPlan("Story Pro Annual",      1500000, "yearly"),
  RAZORPAY_CREATOR_PRO_MONTHLY_PLAN_ID: await createPlan("Creator Pro Monthly",   100000, "monthly"),
  RAZORPAY_CREATOR_PRO_ANNUAL_PLAN_ID:  await createPlan("Creator Pro Annual",    1000000, "yearly"),
  RAZORPAY_ALL_ACCESS_MONTHLY_PLAN_ID:  await createPlan("All Access Monthly",    250000, "monthly"),
  RAZORPAY_ALL_ACCESS_ANNUAL_PLAN_ID:   await createPlan("All Access Annual",     2500000, "yearly"),
};

// Update .env.local with new plan IDs
let envContent = readFileSync(envPath, "utf8");
for (const [key, value] of Object.entries(plans)) {
  envContent = envContent.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`);
}
writeFileSync(envPath, envContent);
console.log("\n✅ .env.local updated with new plan IDs.");
