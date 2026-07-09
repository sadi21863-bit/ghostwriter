/**
 * Run Higgsfield's exclusive DoP model (higgsfield-ai/dop/standard, camera-craft
 * motion model, not available via Segmind at all) on all 8 anime keyframes
 * already generated, for a full comparison against the Hailuo results.
 *
 * Usage: node scripts/higgsfield-dop-full-run.mjs
 */
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
  console.log("Submitting 8 DoP calls...");
  const jobs = [];
  for (const kf of keyframes) {
    try {
      const res = await fetch("https://platform.higgsfield.ai/higgsfield-ai/dop/standard", {
        method: "POST",
        headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: kf.imageUrl, prompt: kf.motion, duration: 5 }),
      });
      const json = await res.json();
      console.log(`  ${kf.label}: ${res.status} ${json.status}`);
      jobs.push({ label: kf.label, statusUrl: json.status_url, initial: json });
    } catch (e) {
      jobs.push({ label: kf.label, error: String(e) });
    }
  }

  console.log("\nPolling all 8 DoP jobs...");
  const results = [];
  for (const job of jobs) {
    if (job.error || !job.statusUrl) { results.push({ ...job, final: { status: "submit_failed" } }); continue; }
    console.log(`  polling ${job.label}...`);
    const final = await pollHiggsfield(job.statusUrl);
    console.log(`    -> ${final.status} ${final.video?.url ?? ""}`);
    results.push({ ...job, final });
    writeFileSync(`${OUT_DIR}/dop-results.json`, JSON.stringify(results, null, 2), "utf8");
  }

  console.log("\n=== DoP FINAL RESULTS ===");
  for (const r of results) console.log(`${r.label}: ${r.final?.status} ${r.final?.video?.url ?? ""}`);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
