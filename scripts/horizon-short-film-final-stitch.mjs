/**
 * Final stitch for the Horizon Line short film, after the real editorial
 * review pass (horizon-short-film-editor-review.ts, fixed vision-critic
 * safeParseScores bug) flagged 3/18 shots and two of those got real fixes:
 * shot-3-1 (local ffmpeg crop - tightened an overly-wide "hands and face
 * insert" that had the actual content but bad framing) and shot-6-5 (full
 * regeneration - the crop-only attempt lost the actual bolt/forearm content
 * and got too dark, so it needed a real re-render with a corrected prompt).
 * shot-5-1 was a critic false-negative (no face in an intentional macro
 * insert tanked characterConsistency to 0) and needed no fix at all.
 *
 * Assembles all 18 shots in real narrative (scene, shot) order - NOT
 * completion order, which is what shots-with-video-segmind.json is sorted in.
 *
 * Usage: node scripts/horizon-short-film-final-stitch.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { execFileSync } from "child_process";
import { resolve } from "path";
import ffmpegPath from "ffmpeg-static";

const OUT_DIR = "outputtestresults/canvas-void-test/horizon-film";
const WORK_DIR = `${OUT_DIR}/final-stitch-tmp`;
mkdirSync(WORK_DIR, { recursive: true });

async function main() {
  const shots = JSON.parse(readFileSync(`${OUT_DIR}/shots-with-video-segmind.json`, "utf8"));
  shots.sort((a, b) => a.sceneNumber - b.sceneNumber || a.shotNumber - b.shotNumber);

  const localPaths = [];
  for (const shot of shots) {
    const localFixed = `${OUT_DIR}/${shot.label}-fixed.mp4`;
    if (existsSync(localFixed)) {
      console.log(`${shot.label}: using local edited fix`);
      localPaths.push(localFixed);
      continue;
    }
    if (!shot.videoUrl) {
      console.log(`${shot.label}: SKIPPED (no video)`);
      continue;
    }
    const res = await fetch(shot.videoUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    const p = `${WORK_DIR}/${shot.label}.mp4`;
    writeFileSync(p, buf);
    localPaths.push(p);
    console.log(`${shot.label}: downloaded`);
  }

  const listPath = `${WORK_DIR}/concat-list.txt`;
  writeFileSync(listPath, localPaths.map(p => `file '${resolve(p).replace(/\\/g, "/")}'`).join("\n"), "utf8");

  const outputPath = resolve(`${OUT_DIR}/the-horizon-line-SHORT-FILM.mp4`);
  // Re-encode (not stream copy) since shot-3-1's locally re-encoded clip has
  // different codec parameters than the raw Segmind Hailuo output - concat
  // demuxer's -c copy path isn't safe to mix across differently-encoded
  // sources, so this trades a little time for a guaranteed-correct file.
  execFileSync(ffmpegPath, [
    "-y", "-f", "concat", "-safe", "0", "-i", resolve(listPath),
    "-c:v", "libx264", "-crf", "20", "-preset", "medium",
    "-c:a", "aac",
    outputPath,
  ], { stdio: "inherit" });

  console.log(`\nSaved final cut: ${outputPath} (${localPaths.length} shots)`);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
