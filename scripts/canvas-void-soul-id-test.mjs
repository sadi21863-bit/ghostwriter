/**
 * Real Soul ID pipeline test using Lieutenant Holt (Canvas Void protagonist):
 * generate 3 real photoreal reference portraits via Soul standard, train a
 * real Soul ID from them (/v1/custom-references, the same endpoint this
 * codebase's trainSoulId() already uses for the Segmind-proxied comic/video
 * character-consistency path), then generate 2 more images via Soul's real
 * "character" mode referencing the trained ID, to check face/outfit
 * consistency end to end.
 *
 * Usage: node scripts/canvas-void-soul-id-test.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const HF_KEY = env.HIGGSFIELD_API_KEY;
const HF_SECRET = env.HIGGSFIELD_API_SECRET;

const OUT_DIR = "outputtestresults/canvas-void-test/soul-id";
mkdirSync(OUT_DIR, { recursive: true });

const BASE_PROMPT =
  "Lieutenant Holt, a lean weathered Antarctic explorer in his 30s, heavy fur-lined polar expedition coat, ice-crusted beard, snow goggles pushed up on his forehead, 1908 period gear, photorealistic portrait";

const REFERENCE_ANGLES = [
  `${BASE_PROMPT}, front-facing close-up, neutral expression, even lighting`,
  `${BASE_PROMPT}, three-quarter angle, looking slightly to the left, cold overcast light`,
  `${BASE_PROMPT}, profile view, wind blowing across his face, snow in the air`,
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pollHiggsfield(statusUrl) {
  const start = Date.now();
  let json;
  while (Date.now() - start < 180_000) {
    await sleep(6000);
    const r = await fetch(statusUrl, { headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET } });
    json = await r.json();
    if (json.status === "completed" || json.status === "failed" || json.status === "error") return json;
  }
  return json ?? { status: "timeout" };
}

async function generateSoulImage(prompt, label) {
  console.log(`\n--- ${label} ---`);
  const res = await fetch("https://platform.higgsfield.ai/higgsfield-ai/soul/standard", {
    method: "POST",
    headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, aspect_ratio: "1:1", resolution: "720p" }),
  });
  let json = JSON.parse(await res.text());
  console.log("  submit:", res.status, json.status);
  if (json.status === "queued" || json.status === "processing") json = await pollHiggsfield(json.status_url);
  console.log("  final:", json.status);
  const imageUrl = json.image?.url ?? json.images?.[0]?.url ?? json.url;
  if (!imageUrl) { console.log("  no URL:", JSON.stringify(json).slice(0, 400)); return null; }
  const imgRes = await fetch(imageUrl);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  writeFileSync(`${OUT_DIR}/${label}.png`, buf);
  console.log(`  saved ${label}.png`);
  return imageUrl;
}

async function main() {
  console.log("Step 1: generating 3 real reference portraits...");
  const refUrls = [];
  for (let i = 0; i < REFERENCE_ANGLES.length; i++) {
    const url = await generateSoulImage(REFERENCE_ANGLES[i], `ref-${i + 1}`);
    if (url) refUrls.push(url);
  }
  writeFileSync(`${OUT_DIR}/reference-urls.json`, JSON.stringify(refUrls, null, 2), "utf8");
  console.log(`\n${refUrls.length}/3 reference portraits generated.`);
  if (refUrls.length < 3) { console.log("Not enough references to train a Soul ID."); process.exit(1); }

  console.log("\nStep 2: training a real Soul ID from these 3 references...");
  const trainRes = await fetch("https://platform.higgsfield.ai/v1/custom-references", {
    method: "POST",
    headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Lieutenant Holt",
      input_images: refUrls.map(url => ({ type: "image_url", image_url: url })),
    }),
  });
  const trainText = await trainRes.text();
  console.log("  submit:", trainRes.status, trainText.slice(0, 300));
  if (trainRes.status !== 200 && trainRes.status !== 201) { console.log("Training submit FAILED"); process.exit(1); }
  const trainJson = JSON.parse(trainText);
  const jobId = trainJson.id;

  console.log("  polling training job...");
  let soulId = null;
  const start = Date.now();
  while (Date.now() - start < 180_000) {
    await sleep(6000);
    const r = await fetch(`https://platform.higgsfield.ai/v1/custom-references/${jobId}`, { headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET } });
    const j = await r.json();
    console.log(`    status=${j.status} (${Math.round((Date.now() - start) / 1000)}s)`);
    if (j.status === "completed") { soulId = j.id; break; }
    if (j.status === "failed") { console.log("Training FAILED:", JSON.stringify(j)); process.exit(1); }
  }
  if (!soulId) { console.log("Training timed out."); process.exit(1); }
  console.log("  trained Soul ID:", soulId);
  writeFileSync(`${OUT_DIR}/soul-id.json`, JSON.stringify({ soulId }, null, 2), "utf8");

  console.log("\nStep 3: generating 2 new images via character mode referencing this Soul ID...");
  const scenes = [
    "standing on the deck of an expedition ship, gripping the railing, staring into an approaching wall of white storm",
    "kneeling beside a fallen crewmate's severed rope line in the snow, face full of dawning horror",
  ];
  for (let i = 0; i < scenes.length; i++) {
    console.log(`\n--- character-mode-${i + 1} ---`);
    const res = await fetch("https://platform.higgsfield.ai/higgsfield-ai/soul/character", {
      method: "POST",
      headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: `Lieutenant Holt, ${scenes[i]}, photorealistic, cinematic`, character_id: soulId, aspect_ratio: "16:9", resolution: "720p" }),
    });
    const text = await res.text();
    console.log("  submit:", res.status, text.slice(0, 300));
    let json;
    try { json = JSON.parse(text); } catch { continue; }
    if (json.status === "queued" || json.status === "processing") json = await pollHiggsfield(json.status_url);
    console.log("  final:", json.status);
    const imageUrl = json.image?.url ?? json.images?.[0]?.url ?? json.url;
    if (imageUrl) {
      const imgRes = await fetch(imageUrl);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      writeFileSync(`${OUT_DIR}/character-mode-${i + 1}.png`, buf);
      console.log(`  saved character-mode-${i + 1}.png`);
    } else {
      console.log("  no URL:", JSON.stringify(json).slice(0, 400));
    }
  }

  console.log("\nDone. All output saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
