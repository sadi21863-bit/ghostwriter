/**
 * Test Higgsfield's native Soul (standard) vs Soul Cinema (higgsfield-ai/soul/cinema,
 * confirmed real via a free validation-error probe) on the same photoreal Dealer
 * character prompt, to compare quality/prompt-handling and extract concrete
 * lessons for GhostWriter's own Director/Writer/Editor prompt-building.
 *
 * Usage: node scripts/higgsfield-soul-test.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const HF_KEY = env.HIGGSFIELD_API_KEY;
const HF_SECRET = env.HIGGSFIELD_API_SECRET;

const OUT_DIR = "outputtestresults/output-test-2/dealer-redo/higgsfield-soul-test";
mkdirSync(OUT_DIR, { recursive: true });

const PROMPT =
  "The Dealer: a lean, controlled man in his late 30s, black suit with no tie, sleeves buttoned even in heat, standing in a narrow concrete corridor under flickering fluorescent light, a fanned deck of playing cards held loosely in one hand, expression unreadable, eyes watchful, cinematic photorealistic portrait, sharp focus on the face, cold industrial color grade.";

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

async function generate(modelPath, label, extraBody = {}) {
  console.log(`\n--- ${label} (${modelPath}) ---`);
  const res = await fetch(`https://platform.higgsfield.ai/${modelPath}`, {
    method: "POST",
    headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: PROMPT, aspect_ratio: "16:9", resolution: "720p", ...extraBody }),
  });
  const text = await res.text();
  console.log("  submit:", res.status, text.slice(0, 300));
  let json;
  try { json = JSON.parse(text); } catch { console.log("  non-JSON response"); return null; }
  if (json.status === "queued" || json.status === "processing") {
    json = await pollHiggsfield(json.status_url);
  }
  console.log("  final status:", json.status);
  const imageUrl = json.image?.url ?? json.images?.[0]?.url ?? json.url;
  if (imageUrl) {
    const imgRes = await fetch(imageUrl);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    writeFileSync(`${OUT_DIR}/${label}.png`, buf);
    console.log(`  saved ${label}.png (${buf.length} bytes)`);
  } else {
    console.log("  no image URL found, full response:", JSON.stringify(json).slice(0, 500));
  }
  writeFileSync(`${OUT_DIR}/${label}-result.json`, JSON.stringify(json, null, 2), "utf8");
  return json;
}

async function main() {
  await generate("higgsfield-ai/soul/standard", "soul-standard");
  await generate("higgsfield-ai/soul/cinema", "soul-cinema");
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
