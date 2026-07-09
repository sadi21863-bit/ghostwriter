/**
 * Test Higgsfield's real trained motion presets (motion_id, from the free
 * /v1/motions catalog - 121 real presets) against the same keyframes already
 * used, to compare against our own text-injection CAMERA_PRESETS approach.
 * "Bullet Time" and "Crash Zoom In" directly match presets we already have
 * as prompt text (src/lib/higgsfield/presets.ts) - same shot, real preset
 * vs. our text-injected version, for a fair comparison.
 *
 * Usage: node scripts/higgsfield-motion-preset-test.mjs
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

const TESTS = [
  { shotLabel: "shot1-burstin", motionId: "22d7c60a-b76f-4082-9928-d2a42357759a", motionName: "Bullet Time" },
  { shotLabel: "shot3-pipedestroy", motionId: "3ec247ed-063d-476d-8266-48829c2eced6", motionName: "Crash Zoom In" },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pollHiggsfield(statusUrl) {
  const start = Date.now();
  let json;
  while (Date.now() - start < 200_000) {
    await sleep(8000);
    const r = await fetch(statusUrl, { headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET } });
    json = await r.json();
    if (json.status === "completed" || json.status === "failed" || json.status === "error") return json;
  }
  return json ?? { status: "timeout" };
}

async function main() {
  const results = [];
  for (const test of TESTS) {
    const kf = keyframes.find(k => k.label === test.shotLabel);
    console.log(`\n--- ${test.motionName} on ${test.shotLabel} ---`);
    const res = await fetch("https://platform.higgsfield.ai/higgsfield-ai/dop/standard", {
      method: "POST",
      headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: kf.imageUrl, prompt: kf.motion, duration: 5, motion_id: test.motionId }),
    });
    const text = await res.text();
    console.log("  submit:", res.status, text.slice(0, 300));
    let json;
    try { json = JSON.parse(text); } catch { results.push({ ...test, error: text }); continue; }
    if (res.status !== 200) { results.push({ ...test, error: json }); continue; }
    const final = await pollHiggsfield(json.status_url);
    console.log("  final:", final.status, final.video?.url ?? final.error ?? "");
    results.push({ ...test, final });
    writeFileSync(`${OUT_DIR}/motion-preset-results.json`, JSON.stringify(results, null, 2), "utf8");
    await sleep(15000); // avoid the rate limit hit earlier
  }
  console.log("\n=== MOTION PRESET RESULTS ===");
  for (const r of results) console.log(`${r.motionName} / ${r.shotLabel}: ${r.final?.status ?? "FAILED"} ${r.final?.video?.url ?? ""}`);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
