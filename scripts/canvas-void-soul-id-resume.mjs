import { readFileSync, writeFileSync } from "fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const HF_KEY = env.HIGGSFIELD_API_KEY;
const HF_SECRET = env.HIGGSFIELD_API_SECRET;
const OUT_DIR = "outputtestresults/canvas-void-test/soul-id";
const jobId = "2a43e780-427a-44a2-965b-6c212ee29277";

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

async function main() {
  console.log("resuming poll for training job", jobId);
  let soulId = null;
  const start = Date.now();
  while (Date.now() - start < 600_000) {
    await sleep(10000);
    const r = await fetch(`https://platform.higgsfield.ai/v1/custom-references/${jobId}`, { headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET } });
    const j = await r.json();
    console.log(`  status=${j.status} (${Math.round((Date.now() - start) / 1000)}s)`);
    if (j.status === "completed") { soulId = j.id; break; }
    if (j.status === "failed") { console.log("Training FAILED:", JSON.stringify(j)); process.exit(1); }
  }
  if (!soulId) { console.log("Training still not ready after 600s - training may take longer, retry again."); process.exit(1); }
  console.log("trained Soul ID:", soulId);
  writeFileSync(`${OUT_DIR}/soul-id.json`, JSON.stringify({ soulId }, null, 2), "utf8");

  console.log("\nGenerating 2 new images via character mode referencing this Soul ID...");
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
  console.log("\nDone.");
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
