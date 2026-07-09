/**
 * Stitch each platform's 8-shot sequence into its own continuous trailer clip,
 * for direct side-by-side comparison. Pure local ffmpeg concat, no spend.
 *
 * Usage: node scripts/stitch-comparison-trailers.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { execFileSync } from "child_process";
import { resolve } from "path";
import ffmpegPath from "ffmpeg-static";

const OUT_DIR = "outputtestresults/output-test-2/dealer-redo/full-animated-comparison";
const WORK_DIR = `${OUT_DIR}/stitch-tmp`;
mkdirSync(WORK_DIR, { recursive: true });

const results = JSON.parse(readFileSync(`${OUT_DIR}/results.json`, "utf8"));

async function fetchSegmindUrl(responseUrl, segmindKey) {
  const res = await fetch(responseUrl, { headers: { "x-api-key": segmindKey } });
  const json = await res.json();
  return json.video?.url || json.output;
}

async function stitchPlatform(label, urls) {
  console.log(`\n--- ${label} ---`);
  const localPaths = [];
  for (let i = 0; i < urls.length; i++) {
    console.log(`  downloading shot${i + 1}...`);
    const res = await fetch(urls[i]);
    const buf = Buffer.from(await res.arrayBuffer());
    const p = `${WORK_DIR}/${label}-shot${i + 1}.mp4`;
    writeFileSync(p, buf);
    localPaths.push(p);
  }
  const listPath = `${WORK_DIR}/${label}-concat-list.txt`;
  writeFileSync(listPath, localPaths.map(p => `file '${resolve(p).replace(/\\/g, "/")}'`).join("\n"), "utf8");
  const outputPath = resolve(`${OUT_DIR}/${label}-TRAILER.mp4`);
  execFileSync(ffmpegPath, ["-y", "-f", "concat", "-safe", "0", "-i", resolve(listPath), "-c", "copy", outputPath], { stdio: "inherit" });
  console.log(`  saved: ${outputPath}`);
}

async function main() {
  const env = {};
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }

  const segmindUrls = [];
  const higgsfieldUrls = [];
  for (const r of results) {
    if (r.platform === "segmind") {
      const url = await fetchSegmindUrl(r.final.response_url, env.SEGMIND_API_KEY);
      segmindUrls.push(url);
    } else {
      higgsfieldUrls.push(r.final.video?.url);
    }
  }

  await stitchPlatform("segmind", segmindUrls);
  await stitchPlatform("higgsfield", higgsfieldUrls);

  console.log("\nBoth trailers saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
