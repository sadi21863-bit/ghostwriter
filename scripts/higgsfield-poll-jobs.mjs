import { readFileSync, writeFileSync } from "fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const HF_KEY = env.HIGGSFIELD_API_KEY;
const HF_SECRET = env.HIGGSFIELD_API_SECRET;
const OUT_DIR = "outputtestresults/output-test-2/dealer-redo/higgsfield-vs-segmind";

const JOBS = [
  { label: "higgsfield_hailuo", statusUrl: "https://platform.higgsfield.ai/requests/abe8a3d0-f5d2-4892-8606-92a1c6afff08/status" },
  { label: "higgsfield_dop", statusUrl: "https://platform.higgsfield.ai/requests/09c9748e-ba97-4f81-bb27-e10890dfd5dc/status" },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pollJob(job) {
  const start = Date.now();
  while (Date.now() - start < 300_000) {
    const res = await fetch(job.statusUrl, { headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET } });
    const json = await res.json();
    console.log(`  [${job.label}] status=${json.status} (${Math.round((Date.now() - start) / 1000)}s)`, JSON.stringify(json).slice(0, 200));
    if (json.status === "completed" || json.status === "failed" || json.status === "error") {
      return json;
    }
    await sleep(8000);
  }
  return { status: "timeout" };
}

async function main() {
  for (const job of JOBS) {
    console.log(`\n--- polling ${job.label} ---`);
    const result = await pollJob(job);
    writeFileSync(`${OUT_DIR}/${job.label}-final.json`, JSON.stringify(result, null, 2), "utf8");
  }
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
