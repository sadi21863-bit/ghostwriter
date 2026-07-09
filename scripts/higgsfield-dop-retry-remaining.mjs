import { readFileSync, writeFileSync } from "fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const HF_KEY = env.HIGGSFIELD_API_KEY;
const HF_SECRET = env.HIGGSFIELD_API_SECRET;

const OUT_DIR = "outputtestresults/output-test-2/dealer-redo/full-animated-comparison";
const keyframes = JSON.parse(readFileSync(`${OUT_DIR}/keyframes.json`, "utf8"));
const REMAINING = ["shot5-ricochet", "shot6-aftermath", "shot7-establishing", "shot8-closing"];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pollHiggsfield(statusUrl) {
  const start = Date.now();
  let json;
  while (Date.now() - start < 240_000) {
    await sleep(8000);
    const r = await fetch(statusUrl, { headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET } });
    json = await r.json();
    if (json.status === "completed" || json.status === "failed" || json.status === "error") return json;
  }
  return json ?? { status: "timeout" };
}

async function main() {
  const existing = JSON.parse(readFileSync(`${OUT_DIR}/dop-results.json`, "utf8"));
  const results = existing.filter(r => !REMAINING.includes(r.label));

  for (const label of REMAINING) {
    const kf = keyframes.find(k => k.label === label);
    console.log(`\n--- ${label} ---`);
    const res = await fetch("https://platform.higgsfield.ai/higgsfield-ai/dop/standard", {
      method: "POST",
      headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: kf.imageUrl, prompt: kf.motion, duration: 5 }),
    });
    const json = await res.json();
    console.log(`  submit: ${res.status} ${json.status}`);
    if (res.status !== 200) {
      console.log("  FAILED:", JSON.stringify(json));
      results.push({ label, error: JSON.stringify(json) });
    } else {
      const final = await pollHiggsfield(json.status_url);
      console.log(`  -> ${final.status} ${final.video?.url ?? ""}`);
      results.push({ label, statusUrl: json.status_url, initial: json, final });
    }
    writeFileSync(`${OUT_DIR}/dop-results.json`, JSON.stringify(results, null, 2), "utf8");
    // Space out submissions to avoid the rate limit hit earlier.
    await sleep(15000);
  }

  console.log("\n=== FULL DoP RESULTS ===");
  for (const r of results) console.log(`${r.label}: ${r.final?.status ?? r.error} ${r.final?.video?.url ?? ""}`);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
