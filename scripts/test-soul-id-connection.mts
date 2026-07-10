/**
 * Real connectivity test for native Higgsfield Soul ID training
 * (platform.higgsfield.ai, hf-api-key/hf-secret) — the one genuinely
 * Higgsfield-native path in this codebase, everything else is Segmind.
 *
 * Reads HIGGSFIELD_API_KEY/HIGGSFIELD_API_SECRET directly from .env.local
 * (NOT the DB per-user encrypted columns the real product code uses -
 * those are still empty on the test account; this is a standalone
 * connectivity check, not a product code path).
 *
 * Reuses the 3 reference images already generated earlier this session
 * (item 70's bootstrap, still live on Vercel Blob) instead of spending any
 * more of the exhausted Segmind balance on fresh ones - this only spends
 * Higgsfield credits.
 *
 * Usage: npx tsx scripts/test-soul-id-connection.mts [existingJobId]
 *   (pass a jobId from a prior run to resume polling instead of submitting a
 *   fresh training job — real training was observed taking longer than one
 *   script invocation's own poll window)
 */
import { readFileSync } from "fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const { trainSoulId, pollSoulIdTraining } = await import("../src/lib/higgsfield/client");

const apiKey = process.env.HIGGSFIELD_API_KEY!;
const apiSecret = process.env.HIGGSFIELD_API_SECRET!;

const REFERENCE_IMAGES = [
  "https://yizd7xlijgyqvpoi.public.blob.vercel-storage.com/soul-images/1783691775547-ir42zztmmuq.png",
  "https://yizd7xlijgyqvpoi.public.blob.vercel-storage.com/soul-images/1783691814175-7wg7ci8u8a7.png",
  "https://yizd7xlijgyqvpoi.public.blob.vercel-storage.com/soul-images/1783691877981-r0te00n2hhq.png",
];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("apiKey present:", !!apiKey, "| apiSecret present:", !!apiSecret);

  let jobId = process.argv[2];
  if (jobId) {
    console.log("Resuming poll on existing job:", jobId);
  } else {
    console.log("Submitting real trainSoulId() call to platform.higgsfield.ai...");
    ({ jobId } = await trainSoulId({
      apiKey, apiSecret,
      characterName: "Connectivity Test - Horizon Loop Young Man",
      referenceImageUrls: REFERENCE_IMAGES,
    }));
    console.log("SUCCESS - training job created:", jobId);
  }

  console.log("\nPolling for completion (up to ~10 min - real training was observed taking ~6-7min end to end)...");
  for (let i = 0; i < 40; i++) {
    const result = await pollSoulIdTraining({ apiKey, apiSecret, jobId });
    console.log(`  [${i}] status: ${result.status}${result.soulId ? ` soulId: ${result.soulId}` : ""}`);
    if (result.status === "completed") {
      console.log("\nTRAINING COMPLETE. Real soulId:", result.soulId);
      return;
    }
    if (result.status === "failed") {
      console.log("\nTraining reported FAILED by Higgsfield.");
      return;
    }
    await sleep(15000);
  }
  console.log(`\nStill processing after extended wait - connection and submission both confirmed working; resume with: npx tsx scripts/test-soul-id-connection.mts ${jobId}`);
}

main().then(() => process.exit(0)).catch(e => { console.error("CONNECTION TEST FAILED:", e); process.exit(1); });
