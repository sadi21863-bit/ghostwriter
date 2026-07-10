/**
 * Small, cheap real-money test of the 4th untouched "Narrative Gaps" premise:
 * "The Suburbs of Drift" (horror - emotionally-reactive non-Euclidean
 * suburban architecture). Only 2 real Soul images (not a full capability
 * round - remaining Segmind balance is tight after the StoryDiffusion
 * wiring verification + lipsync retry) depicting the concept's two most
 * visually distinctive beats, to confirm the pipeline handles genuinely
 * fresh, previously-unused story material well.
 *
 * Usage: node scripts/suburbs-of-drift-test.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const SEGMIND_KEY = env.SEGMIND_API_KEY;

const OUT_DIR = "outputtestresults/output-test-2/suburbs-of-drift";
mkdirSync(OUT_DIR, { recursive: true });

const SHOTS = [
  {
    label: "shot-1-elongating-hallway",
    prompt: "Soul 2.0: Interior of an ordinary suburban house hallway that stretches impossibly into the distance, doorframes repeating and shrinking toward a vanishing point far beyond normal architectural scale, a single bedroom door barely visible at the very end, dim household lighting giving way to unnatural shadow the further the hallway extends, dust hanging static in the air, cinematic wide shot emphasizing scale wrongness, unsettling quiet atmosphere, photorealistic.",
  },
  {
    label: "shot-2-stretched-street",
    prompt: "Soul 2.0: A quiet suburban street at dusk where the asphalt between two houses has visibly stretched far beyond normal distance, telephone poles multiplying unnaturally to bridge the gap, a warped illegible street sign in the foreground, the two houses now distant silhouettes at the far ends of the impossibly long gap between them, eerie stillness, cinematic wide establishing shot, photorealistic, muted evening color palette.",
  },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pollSegmindV2(statusUrl, maxMs = 180_000) {
  const start = Date.now();
  let json;
  while (Date.now() - start < maxMs) {
    await sleep(7000);
    try {
      const r = await fetch(statusUrl, { headers: { "x-api-key": SEGMIND_KEY } });
      json = JSON.parse(await r.text());
    } catch (e) {
      console.log(`    [poll error, retrying] ${e.message}`);
      continue;
    }
    if (json.status === "COMPLETED" || json.status === "FAILED" || json.status === "ERROR") return json;
    console.log(`    status=${json.status} (${Math.round((Date.now() - start) / 1000)}s)`);
  }
  return json ?? { status: "timeout" };
}

async function main() {
  for (const shot of SHOTS) {
    console.log(`\n--- ${shot.label} ---`);
    const res = await fetch("https://api.segmind.com/v2/higgsfield-text2image-soul", {
      method: "POST",
      headers: { "x-api-key": SEGMIND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: shot.prompt,
        seed: Math.floor(Math.random() * 999999),
        enhance_prompt: false,
        negative_prompt: "blurry, deformed, low quality, cartoonish",
      }),
    });
    let json = JSON.parse(await res.text());
    console.log("  submit:", res.status, json.status);
    if (json.status === "QUEUED" || json.status === "PROCESSING") json = await pollSegmindV2(json.status_url);
    if (json.status !== "COMPLETED") { console.log("  FAILED:", JSON.stringify(json).slice(0, 400)); continue; }
    let imageUrl = json.output;
    if (typeof imageUrl !== "string") {
      const r2 = await fetch(json.response_url, { headers: { "x-api-key": SEGMIND_KEY } });
      const j2 = await r2.json();
      imageUrl = typeof j2.output === "string" ? j2.output : j2.images?.[0]?.url;
    }
    const imgRes = await fetch(imageUrl);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    writeFileSync(`${OUT_DIR}/${shot.label}.png`, buf);
    console.log(`  saved (${buf.length} bytes)`);
  }
  console.log("\nDone. All output saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
