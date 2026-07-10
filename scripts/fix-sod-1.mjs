/**
 * Fixes sod-1-elongating-hallway: the original render lost the "ordinary
 * suburban house" grounding that makes the concept work, becoming an
 * abstract infinite door-frame tunnel with no domestic detail (carpet,
 * warm household light, actual doors). Regenerates with a prompt that
 * anchors the impossible geometry to recognizably mundane house details.
 */
import { readFileSync, writeFileSync } from "fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const HF_KEY = env.HIGGSFIELD_API_KEY;
const HF_SECRET = env.HIGGSFIELD_API_SECRET;

const OUT_DIR = "outputtestresults/output-test-2/narrative-gaps-trailers";

const NEW_SOUL_PROMPT = "A real suburban house hallway with beige carpet, a family photo frame on the wall, warm yellow household lamp light close to camera - but the hallway impossibly extends far beyond the house's real size, the same carpet and wallpaper repeating into a shrinking, elongating perspective toward a single distant bedroom door, the warm light giving way to cold shadow only in the far distance, cinematic wide shot, uncanny wrongness grounded in an otherwise completely ordinary home.";
const NEW_VIDEO_PROMPT = "Static wide shot down the ordinary-looking hallway; extremely slow, subtle dolly-in that makes the distant door recede rather than approach, warm lamp light steady in the foreground, unsettling stillness.";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pollHiggsfield(statusUrl, maxMs = 200_000) {
  const start = Date.now();
  let json;
  while (Date.now() - start < maxMs) {
    await sleep(7000);
    try {
      const r = await fetch(statusUrl, { headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET } });
      json = JSON.parse(await r.text());
    } catch (e) { console.log(`    [poll error, retrying] ${e.message}`); continue; }
    if (json.status === "completed" || json.status === "failed" || json.status === "error") return json;
    console.log(`    status=${json.status} (${Math.round((Date.now() - start) / 1000)}s)`);
  }
  return json ?? { status: "timeout" };
}

async function main() {
  console.log("--- regenerating sod-1 keyframe (domestic-grounded prompt) ---");
  const res = await fetch("https://platform.higgsfield.ai/higgsfield-ai/soul/cinema", {
    method: "POST",
    headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: NEW_SOUL_PROMPT, aspect_ratio: "9:16", resolution: "720p" }),
  });
  let json = JSON.parse(await res.text());
  console.log("  submit:", res.status, json.status);
  if (json.status === "queued" || json.status === "processing") json = await pollHiggsfield(json.status_url);
  const imageUrl = json.image?.url ?? json.images?.[0]?.url ?? json.url;
  if (json.status !== "completed" || !imageUrl) { console.log("FAILED:", JSON.stringify(json).slice(0, 400)); process.exit(1); }
  const imgRes = await fetch(imageUrl);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  writeFileSync(`${OUT_DIR}/sod-1-elongating-hallway.png`, buf);
  console.log(`  saved (${buf.length} bytes)`);

  console.log("--- animating sod-1 ---");
  const res2 = await fetch("https://platform.higgsfield.ai/minimax/hailuo-02/pro/image-to-video", {
    method: "POST",
    headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, prompt: NEW_VIDEO_PROMPT, duration: 6 }),
  });
  let json2 = JSON.parse(await res2.text());
  console.log("  submit:", res2.status, json2.status);
  if (json2.status === "queued" || json2.status === "processing") json2 = await pollHiggsfield(json2.status_url, 240_000);
  const videoUrl = json2.video?.url ?? json2.url;
  console.log("  final:", json2.status, videoUrl ?? "(none)");
  if (!videoUrl) { console.log("ANIMATE FAILED"); process.exit(1); }

  const shots = JSON.parse(readFileSync(`${OUT_DIR}/shots-with-images.json`, "utf8"));
  const idx1 = shots.findIndex(s => s.label === "sod-1-elongating-hallway");
  shots[idx1] = { ...shots[idx1], soulPrompt: NEW_SOUL_PROMPT, videoPrompt: NEW_VIDEO_PROMPT, imageUrl };
  writeFileSync(`${OUT_DIR}/shots-with-images.json`, JSON.stringify(shots, null, 2), "utf8");

  const videoShots = JSON.parse(readFileSync(`${OUT_DIR}/shots-with-video.json`, "utf8"));
  const idx2 = videoShots.findIndex(s => s.label === "sod-1-elongating-hallway");
  videoShots[idx2] = { ...videoShots[idx2], soulPrompt: NEW_SOUL_PROMPT, videoPrompt: NEW_VIDEO_PROMPT, imageUrl, videoUrl };
  writeFileSync(`${OUT_DIR}/shots-with-video.json`, JSON.stringify(videoShots, null, 2), "utf8");
  console.log("\nUpdated both shots-with-images.json and shots-with-video.json.");
}
main().catch(e => { console.error("FAILED:", e); process.exit(1); });
