/**
 * "The Horizon Line" short film: full pipeline using the real AI Director's
 * shot list (generate-package, item 66's streaming fix), Higgsfield Soul/Soul
 * Cinema for photoreal keyframes (with trained Soul ID references for Arthur
 * and Maya, custom_reference_id - the real field, item 66), and DoP for
 * animation. Runs in checkpointed stages so a failure partway doesn't lose
 * earlier real spend.
 *
 * Usage: node scripts/horizon-short-film.mjs [stage]
 *   stage: "refs" | "shots" | "animate" | "all" (default: all)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const HF_KEY = env.HIGGSFIELD_API_KEY;
const HF_SECRET = env.HIGGSFIELD_API_SECRET;

const OUT_DIR = "outputtestresults/canvas-void-test/horizon-film";
mkdirSync(OUT_DIR, { recursive: true });

const shots = JSON.parse(readFileSync("outputtestresults/canvas-void-test/horizon-shots-compact.json", "utf8"));
const PROJECT_INFO = JSON.parse(readFileSync("outputtestresults/output-test-2/horizon-redo/project-info.json", "utf8"));
const ARTHUR_ID = PROJECT_INFO.protagonistId;
const MAYA_ID = PROJECT_INFO.secondaryId;

const ARTHUR_REF_PROMPTS = [
  "Soul 2.0: Arthur, early forties, tired hazel eyes, dark hair with fast-arriving gray at temples and crown, lean tense build, wedding band on left hand, neutral standing portrait, even studio light, front-facing, photorealistic.",
  "Soul 2.0: Arthur, early forties, tired hazel eyes, dark hair with gray at temples, three-quarter angle, looking slightly down, cold blue-gray light, wedding band visible, photorealistic.",
  "Soul 2.0: Arthur, early forties, dark hair with gray, wedding band on left hand, profile view, dim amber light, weary expression, photorealistic.",
];
const MAYA_REF_PROMPTS = [
  "Soul 2.0: Maya, late thirties, sharp dark eyes, black hair in a low bun coming loose, taupe utility jacket, neutral standing portrait, even studio light, front-facing, photorealistic.",
  "Soul 2.0: Maya, late thirties, sharp dark eyes, black hair in a low bun, taupe jacket, three-quarter angle, dim amber emergency lighting, photorealistic.",
  "Soul 2.0: Maya, late thirties, black hair in a low bun, taupe jacket, profile view, phone flashlight glow on her face, photorealistic.",
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pollHiggsfield(statusUrl, maxMs = 200_000) {
  const start = Date.now();
  let json;
  while (Date.now() - start < maxMs) {
    await sleep(7000);
    const r = await fetch(statusUrl, { headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET } });
    json = await r.json();
    if (json.status === "completed" || json.status === "failed" || json.status === "error") return json;
  }
  return json ?? { status: "timeout" };
}

async function generateSoulImage(prompt, label, customReferenceId) {
  const body = { prompt, aspect_ratio: "16:9", resolution: "720p" };
  if (customReferenceId) { body.custom_reference_id = customReferenceId; body.custom_reference_strength = 1; }
  const res = await fetch("https://platform.higgsfield.ai/higgsfield-ai/soul/standard", {
    method: "POST",
    headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json = JSON.parse(await res.text());
  console.log(`  [${label}] submit:`, res.status, json.status);
  if (json.status === "queued" || json.status === "processing") json = await pollHiggsfield(json.status_url);
  console.log(`  [${label}] final:`, json.status);
  const imageUrl = json.image?.url ?? json.images?.[0]?.url ?? json.url;
  if (!imageUrl) { console.log(`  [${label}] no URL:`, JSON.stringify(json).slice(0, 300)); return null; }
  const imgRes = await fetch(imageUrl);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  writeFileSync(`${OUT_DIR}/${label}.png`, buf);
  return imageUrl;
}

async function trainSoulId(name, refUrls) {
  const res = await fetch("https://platform.higgsfield.ai/v1/custom-references", {
    method: "POST",
    headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
    body: JSON.stringify({ name, input_images: refUrls.map(url => ({ type: "image_url", image_url: url })) }),
  });
  const json = JSON.parse(await res.text());
  console.log(`  training submit (${name}):`, res.status, json.status);
  const jobId = json.id;
  const start = Date.now();
  while (Date.now() - start < 600_000) {
    await sleep(10000);
    const r = await fetch(`https://platform.higgsfield.ai/v1/custom-references/${jobId}`, { headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET } });
    const j = await r.json();
    console.log(`    (${name}) status=${j.status} (${Math.round((Date.now() - start) / 1000)}s)`);
    if (j.status === "completed") return j.id;
    if (j.status === "failed") throw new Error(`Training failed for ${name}: ${JSON.stringify(j)}`);
  }
  throw new Error(`Training timed out for ${name}`);
}

async function stageRefs() {
  console.log("=== STAGE: training Soul IDs for Arthur and Maya ===");
  const arthurRefs = [];
  for (let i = 0; i < ARTHUR_REF_PROMPTS.length; i++) {
    const url = await generateSoulImage(ARTHUR_REF_PROMPTS[i], `arthur-ref-${i + 1}`);
    if (url) arthurRefs.push(url);
  }
  const mayaRefs = [];
  for (let i = 0; i < MAYA_REF_PROMPTS.length; i++) {
    const url = await generateSoulImage(MAYA_REF_PROMPTS[i], `maya-ref-${i + 1}`);
    if (url) mayaRefs.push(url);
  }
  const arthurSoulId = await trainSoulId("Arthur (Horizon Line)", arthurRefs);
  const mayaSoulId = await trainSoulId("Maya (Horizon Line)", mayaRefs);
  writeFileSync(`${OUT_DIR}/soul-ids.json`, JSON.stringify({ arthurSoulId, mayaSoulId }, null, 2), "utf8");
  console.log("Arthur Soul ID:", arthurSoulId, "| Maya Soul ID:", mayaSoulId);
  return { arthurSoulId, mayaSoulId };
}

function soulIdForShot(shot, soulIds) {
  if (shot.primaryCharacterId === ARTHUR_ID) return soulIds.arthurSoulId;
  if (shot.primaryCharacterId === MAYA_ID) return soulIds.mayaSoulId;
  return undefined;
}

async function stageShots(soulIds, only) {
  console.log("\n=== STAGE: generating keyframe images for all shots ===");
  const targets = only ? shots.filter(s => only.includes(`${s.sceneNumber}.${s.shotNumber}`)) : shots;
  const results = [];
  for (const shot of targets) {
    const label = `shot-${shot.sceneNumber}-${shot.shotNumber}`;
    const refId = soulIdForShot(shot, soulIds);
    console.log(`\n--- ${label} (${shot.subject}) ${refId ? "[with ref]" : "[no ref]"} ---`);
    const url = await generateSoulImage(shot.soulPrompt, label, refId);
    results.push({ ...shot, label, imageUrl: url });
    writeFileSync(`${OUT_DIR}/shots-with-images.json`, JSON.stringify(results, null, 2), "utf8");
  }
  return results;
}

async function stageAnimate(shotResults) {
  console.log("\n=== STAGE: animating all keyframes via DoP ===");
  const results = [];
  for (const shot of shotResults) {
    if (!shot.imageUrl) { console.log(`skip ${shot.label} - no image`); continue; }
    console.log(`\n--- animating ${shot.label} ---`);
    const res = await fetch("https://platform.higgsfield.ai/higgsfield-ai/dop/standard", {
      method: "POST",
      headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: shot.imageUrl, prompt: shot.videoPrompt, duration: 5 }),
    });
    let json = JSON.parse(await res.text());
    console.log("  submit:", res.status, json.status);
    if (json.status === "queued" || json.status === "processing") json = await pollHiggsfield(json.status_url, 240_000);
    console.log("  final:", json.status, json.video?.url ?? "");
    results.push({ ...shot, videoResult: json });
    writeFileSync(`${OUT_DIR}/shots-with-video.json`, JSON.stringify(results, null, 2), "utf8");
    await sleep(15000); // avoid the DoP rate limit found earlier
  }
  return results;
}

async function main() {
  const stage = process.argv[2] || "all";

  let soulIds;
  if (stage === "refs" || stage === "all") {
    soulIds = await stageRefs();
  } else if (existsSync(`${OUT_DIR}/soul-ids.json`)) {
    soulIds = JSON.parse(readFileSync(`${OUT_DIR}/soul-ids.json`, "utf8"));
  }

  let shotResults;
  if (stage === "shots" || stage === "all") {
    shotResults = await stageShots(soulIds);
  } else if (existsSync(`${OUT_DIR}/shots-with-images.json`)) {
    shotResults = JSON.parse(readFileSync(`${OUT_DIR}/shots-with-images.json`, "utf8"));
  }

  if (stage === "animate" || stage === "all") {
    await stageAnimate(shotResults);
  }

  console.log("\nDone. All output saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
