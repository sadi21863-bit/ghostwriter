/**
 * Stitch all 6 real generated shots (4 Kling + 2 Seedance) into one continuous
 * trailer clip, in story order. Pure local ffmpeg concat — no further Segmind
 * spend. Uses the same ffmpeg-static binary the product code bundles.
 *
 * Usage: node scripts/output-test-2-segmind-stitch.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { execFileSync } from "child_process";
import { resolve } from "path";
import ffmpegPath from "ffmpeg-static";

const OUT_DIR = "outputtestresults/output-test-2/dealer-redo/segmind-test";
const WORK_DIR = `${OUT_DIR}/stitch-tmp`;
mkdirSync(WORK_DIR, { recursive: true });

// Story order: shots 1-4 (Kling retry), then 5-6 (Seedance, already succeeded).
const SHOTS = [
  { label: "shot1", url: "https://yizd7xlijgyqvpoi.public.blob.vercel-storage.com/production/6900f595-13dc-4278-a4d8-827821073dfe/ea5742a0-e7ec-4eb3-bb84-a9b8128e1fea/final-1783538516740.mp4" },
  { label: "shot2", url: "https://yizd7xlijgyqvpoi.public.blob.vercel-storage.com/production/6900f595-13dc-4278-a4d8-827821073dfe/6d2bc727-cd36-4bb8-8127-dc6e12b2ccdc/final-1783538878595.mp4" },
  { label: "shot3", url: "https://yizd7xlijgyqvpoi.public.blob.vercel-storage.com/production/6900f595-13dc-4278-a4d8-827821073dfe/4348201b-3a4e-4071-99ac-c7a13f0aab49/final-1783539199991.mp4" },
  { label: "shot4", url: "https://yizd7xlijgyqvpoi.public.blob.vercel-storage.com/production/6900f595-13dc-4278-a4d8-827821073dfe/2341aabf-07bf-4710-afb0-bcc50c59fd74/final-1783539452744.mp4" },
  { label: "shot5", url: "https://yizd7xlijgyqvpoi.public.blob.vercel-storage.com/production/6900f595-13dc-4278-a4d8-827821073dfe/b678ebce-920e-46b1-9dba-cabc56102a45/final-1783531584812.mp4" },
  { label: "shot6", url: "https://yizd7xlijgyqvpoi.public.blob.vercel-storage.com/production/6900f595-13dc-4278-a4d8-827821073dfe/005f8f19-d980-4f30-ba18-a68c8a5f839d/final-1783531664965.mp4" },
];

async function main() {
  const localPaths = [];
  for (const shot of SHOTS) {
    console.log(`downloading ${shot.label}...`);
    const res = await fetch(shot.url);
    const buf = Buffer.from(await res.arrayBuffer());
    const path = `${WORK_DIR}/${shot.label}.mp4`;
    writeFileSync(path, buf);
    localPaths.push(path);
    console.log(`  ${buf.length} bytes`);
  }

  const listPath = `${WORK_DIR}/concat-list.txt`;
  // ffmpeg's concat demuxer resolves relative paths in the list file relative to
  // the list file's own directory, not the process cwd — absolute paths avoid
  // the doubled-path bug that causes otherwise.
  const listContent = localPaths.map(p => `file '${resolve(p).replace(/\\/g, "/")}'`).join("\n");
  writeFileSync(listPath, listContent, "utf8");

  const outputPath = resolve(`${OUT_DIR}/the-dealer-trailer-STITCHED.mp4`);
  console.log("\nstitching (stream-copy concat, no re-encode)...");
  execFileSync(ffmpegPath, ["-y", "-f", "concat", "-safe", "0", "-i", resolve(listPath), "-c", "copy", outputPath], { stdio: "inherit" });
  console.log("\nStitched trailer saved to", outputPath);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
