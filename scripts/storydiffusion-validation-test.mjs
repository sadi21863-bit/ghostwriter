// Real-money validation call for Segmind's storydiffusion model, per
// docs/2026-06-25-competitor-and-model-research-comic-video-quality.md's
// "validate cost on 1-2 real calls before committing" gate.
// Deliberately minimal: "Four Pannel" (4 frames, the cheaper option vs the
// 8-frame "Classic Comic Style" default) and 2 short panel actions, to keep
// this first call small against a $1.57 account balance.
// Usage: node scripts/storydiffusion-validation-test.mjs
import { readFileSync } from "fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const apiKey = env.SEGMIND_API_KEY;
if (!apiKey) throw new Error("SEGMIND_API_KEY not found in .env.local");

const body = {
  character_description: "a grizzled detective in a grey trench coat, sharp jaw, tired eyes",
  comic_description: [
    "the detective stands in a rain-soaked alley, looking up at a neon sign",
    "the detective examines a torn photograph under a flickering streetlamp",
  ].join("\n"),
  style_name: "Comic book",
  comic_style: "Four Pannel",
  num_ids: 1,
  seed: 424242,
  negative_prompt: "blurry, deformed, extra limbs, bad anatomy, watermark",
  output_format: "png",
};

console.log("Submitting storydiffusion request...");
console.log(JSON.stringify(body, null, 2));
const start = Date.now();

const submitRes = await fetch("https://api.segmind.com/v2/storydiffusion", {
  method: "POST",
  headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

if (!submitRes.ok) {
  console.error(`SUBMIT FAILED (${submitRes.status}):`, await submitRes.text());
  process.exit(1);
}
const submitJson = await submitRes.json();
console.log("Submit response:", JSON.stringify(submitJson, null, 2));

function extractMediaUrl(data) {
  return data?.image ?? data?.output?.[0] ?? data?.output ?? data?.url ?? data?.result?.url ?? null;
}

let mediaUrl = extractMediaUrl(submitJson);
const pollingUrl = submitJson.status_url ?? (submitJson.request_id ? `https://api.segmind.com/v2/requests/${submitJson.request_id}/status` : null);

if (!mediaUrl && pollingUrl) {
  console.log("Polling:", pollingUrl);
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const pollRes = await fetch(pollingUrl, { headers: { "x-api-key": apiKey } });
    const pollJson = await pollRes.json();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[${elapsed}s] status:`, pollJson.status);
    if (pollJson.status === "COMPLETED") {
      mediaUrl = extractMediaUrl(pollJson);
      if (!mediaUrl && pollJson.response_url) {
        const resultRes = await fetch(pollJson.response_url, { headers: { "x-api-key": apiKey } });
        const resultJson = await resultRes.json();
        mediaUrl = extractMediaUrl(resultJson);
      }
      break;
    }
    if (pollJson.status === "FAILED" || pollJson.status === "ERROR") {
      console.error("Job failed:", JSON.stringify(pollJson, null, 2));
      process.exit(1);
    }
  }
}

const totalSeconds = (Date.now() - start) / 1000;
console.log("\n=== RESULT ===");
console.log("mediaUrl:", mediaUrl);
console.log("Total wall-clock time:", totalSeconds.toFixed(1), "s");
console.log("(Actual billed GPU-seconds may differ from wall-clock — check Segmind dashboard balance for the real charge.)");
