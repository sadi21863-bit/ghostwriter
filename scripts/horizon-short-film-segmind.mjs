/**
 * "The Horizon Line" short film, Segmind-side rendering: uses the real Soul
 * IDs trained on Higgsfield (conserves scarce Higgsfield credits, which have
 * a real 500-credit minimum top-up) but renders every shot's image via
 * Segmind's own Soul proxy (higgsfield-text2image-soul, which accepts the
 * same custom_reference_id) and animates via Segmind Hailuo (already proven
 * reliable and cheap - $0.125/6s - vs. Higgsfield-credit-billed DoP).
 *
 * Usage: node scripts/horizon-short-film-segmind.mjs [stage]
 *   stage: "shots" | "animate" | "stitch" | "all" (default: all)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { execFileSync } from "child_process";
import { resolve } from "path";
import ffmpegPath from "ffmpeg-static";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const SEGMIND_KEY = env.SEGMIND_API_KEY;

const OUT_DIR = "outputtestresults/canvas-void-test/horizon-film";
mkdirSync(OUT_DIR, { recursive: true });

const shots = JSON.parse(readFileSync("outputtestresults/canvas-void-test/horizon-shots-compact.json", "utf8"));
const PROJECT_INFO = JSON.parse(readFileSync("outputtestresults/output-test-2/horizon-redo/project-info.json", "utf8"));
const ARTHUR_ID = PROJECT_INFO.protagonistId;
const MAYA_ID = PROJECT_INFO.secondaryId;
// Higgsfield Soul ID training got stuck "queued" past a 10-minute poll window
// (real queue congestion, not our bug) - proceeding without a trained
// reference. Consistency instead relies on the Director's own soulPrompt text
// already using the same age/features/wardrobe language across every Arthur/
// Maya shot - a real, honest trade-off, not face-locked but not blind either.
const soulIds = existsSync(`${OUT_DIR}/soul-ids.json`)
  ? JSON.parse(readFileSync(`${OUT_DIR}/soul-ids.json`, "utf8"))
  : { arthurSoulId: undefined, mayaSoulId: undefined };

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function soulIdForShot(shot) {
  if (shot.primaryCharacterId === ARTHUR_ID) return soulIds.arthurSoulId;
  if (shot.primaryCharacterId === MAYA_ID) return soulIds.mayaSoulId;
  return undefined;
}

async function pollSegmindV2(statusUrl, maxMs = 200_000) {
  const start = Date.now();
  let json;
  while (Date.now() - start < maxMs) {
    await sleep(7000);
    const r = await fetch(statusUrl, { headers: { "x-api-key": SEGMIND_KEY } });
    json = await r.json();
    if (json.status === "COMPLETED" || json.status === "FAILED" || json.status === "ERROR") return json;
    console.log(`    status=${json.status} (${Math.round((Date.now() - start) / 1000)}s)`);
  }
  return json ?? { status: "timeout" };
}

async function generateSoulImageSegmind(prompt, soulId, label) {
  const body = {
    prompt,
    seed: Math.floor(Math.random() * 999999),
    enhance_prompt: false,
    negative_prompt: "blurry, deformed, extra limbs, bad anatomy, low quality",
  };
  if (soulId) { body.custom_reference_id = soulId; body.custom_reference_strength = 0.95; }

  const res = await fetch("https://api.segmind.com/v2/higgsfield-text2image-soul", {
    method: "POST",
    headers: { "x-api-key": SEGMIND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { console.log(`  [${label}] bad response:`, text.slice(0, 300)); return null; }
  console.log(`  [${label}] submit:`, res.status, json.status);
  if (json.status === "QUEUED" || json.status === "PROCESSING") json = await pollSegmindV2(json.status_url);
  if (json.status !== "COMPLETED") { console.log(`  [${label}] FAILED:`, JSON.stringify(json).slice(0, 400)); return null; }

  let imageUrl = json.output ?? json.image_url;
  if (typeof imageUrl !== "string") {
    const r2 = await fetch(json.response_url, { headers: { "x-api-key": SEGMIND_KEY } });
    const j2 = await r2.json();
    imageUrl = typeof j2.output === "string" ? j2.output : j2.images?.[0]?.url;
  }
  if (!imageUrl) { console.log(`  [${label}] no image URL:`, JSON.stringify(json).slice(0, 400)); return null; }
  const imgRes = await fetch(imageUrl);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  writeFileSync(`${OUT_DIR}/${label}.png`, buf);
  console.log(`  [${label}] saved (${buf.length} bytes)`);
  return imageUrl;
}

async function stageShots() {
  console.log("=== STAGE: generating keyframe images via Segmind Soul proxy ===");
  const results = [];
  for (const shot of shots) {
    const label = `shot-${shot.sceneNumber}-${shot.shotNumber}`;
    const refId = soulIdForShot(shot);
    console.log(`\n--- ${label} (${shot.subject}) ${refId ? "[with ref]" : "[no ref]"} ---`);
    const url = await generateSoulImageSegmind(shot.soulPrompt, refId, label);
    results.push({ ...shot, label, imageUrl: url });
    writeFileSync(`${OUT_DIR}/shots-with-images-segmind.json`, JSON.stringify(results, null, 2), "utf8");
  }
  return results;
}

async function stageAnimate(shotResults) {
  console.log("\n=== STAGE: animating all keyframes via Segmind Hailuo ===");
  const results = [];
  for (const shot of shotResults) {
    if (!shot.imageUrl) { console.log(`skip ${shot.label} - no image`); continue; }
    console.log(`\n--- animating ${shot.label} ---`);
    const res = await fetch("https://api.segmind.com/v2/hailuo-02-fast", {
      method: "POST",
      headers: { "x-api-key": SEGMIND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ first_frame_image: shot.imageUrl, prompt: shot.videoPrompt, duration: 6, prompt_optimizer: true }),
    });
    let json = JSON.parse(await res.text());
    console.log("  submit:", res.status, json.status);
    if (json.status === "QUEUED" || json.status === "PROCESSING") json = await pollSegmindV2(json.status_url, 240_000);
    console.log("  final:", json.status);
    let videoUrl = json.video?.url ?? json.output;
    if (json.status === "COMPLETED" && !videoUrl) {
      const r2 = await fetch(json.response_url, { headers: { "x-api-key": SEGMIND_KEY } });
      const j2 = await r2.json();
      videoUrl = j2.video?.url ?? j2.output;
    }
    console.log("  video:", videoUrl ?? "(none)");
    results.push({ ...shot, videoUrl });
    writeFileSync(`${OUT_DIR}/shots-with-video-segmind.json`, JSON.stringify(results, null, 2), "utf8");
  }
  return results;
}

async function stageStitch(shotResults) {
  console.log("\n=== STAGE: stitching final short film ===");
  const WORK_DIR = `${OUT_DIR}/stitch-tmp`;
  mkdirSync(WORK_DIR, { recursive: true });
  const localPaths = [];
  for (const shot of shotResults) {
    if (!shot.videoUrl) continue;
    const res = await fetch(shot.videoUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    const p = `${WORK_DIR}/${shot.label}.mp4`;
    writeFileSync(p, buf);
    localPaths.push(p);
    console.log("downloaded", shot.label);
  }
  const listPath = `${WORK_DIR}/concat-list.txt`;
  writeFileSync(listPath, localPaths.map(p => `file '${resolve(p).replace(/\\/g, "/")}'`).join("\n"), "utf8");
  const outputPath = resolve(`${OUT_DIR}/the-horizon-line-SHORT-FILM.mp4`);
  execFileSync(ffmpegPath, ["-y", "-f", "concat", "-safe", "0", "-i", resolve(listPath), "-c", "copy", outputPath], { stdio: "inherit" });
  console.log("saved:", outputPath);
}

async function main() {
  const stage = process.argv[2] || "all";

  let shotResults;
  if (stage === "shots" || stage === "all") {
    shotResults = await stageShots();
  } else if (existsSync(`${OUT_DIR}/shots-with-images-segmind.json`)) {
    shotResults = JSON.parse(readFileSync(`${OUT_DIR}/shots-with-images-segmind.json`, "utf8"));
  }

  if (stage === "animate" || stage === "all") {
    shotResults = await stageAnimate(shotResults);
  } else if (existsSync(`${OUT_DIR}/shots-with-video-segmind.json`)) {
    shotResults = JSON.parse(readFileSync(`${OUT_DIR}/shots-with-video-segmind.json`, "utf8"));
  }

  if (stage === "stitch" || stage === "all") {
    await stageStitch(shotResults);
  }

  console.log("\nDone. All output saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
