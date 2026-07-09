import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { execFileSync } from "child_process";
import { resolve } from "path";
import ffmpegPath from "ffmpeg-static";

const OUT_DIR = "outputtestresults/output-test-2/dealer-redo/full-animated-comparison";
const WORK_DIR = `${OUT_DIR}/stitch-tmp`;
mkdirSync(WORK_DIR, { recursive: true });

const results = JSON.parse(readFileSync(`${OUT_DIR}/dop-results.json`, "utf8"));
const order = ["shot1-burstin", "shot2-knockdown", "shot3-pipedestroy", "shot4-defensivering", "shot5-ricochet", "shot6-aftermath", "shot7-establishing", "shot8-closing"];

async function main() {
  const localPaths = [];
  for (const label of order) {
    const r = results.find(x => x.label === label);
    const url = r.final.video.url;
    console.log(`downloading ${label}...`);
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    const p = `${WORK_DIR}/dop-${label}.mp4`;
    writeFileSync(p, buf);
    localPaths.push(p);
  }
  const listPath = `${WORK_DIR}/dop-concat-list.txt`;
  writeFileSync(listPath, localPaths.map(p => `file '${resolve(p).replace(/\\/g, "/")}'`).join("\n"), "utf8");
  const outputPath = resolve(`${OUT_DIR}/higgsfield-dop-TRAILER.mp4`);
  execFileSync(ffmpegPath, ["-y", "-f", "concat", "-safe", "0", "-i", resolve(listPath), "-c", "copy", outputPath], { stdio: "inherit" });
  console.log("saved:", outputPath);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
