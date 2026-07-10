/**
 * Editorial fix for shot-6-5, flagged by the real vision-critic review
 * (editor-review.json): coverage=0.15, promptAdherence=0.2 - the original
 * generation rendered a bright, medium-wide two-shot with both full faces
 * clearly lit, when the prompt called for a tight, dim, intimate insert on
 * Maya's forearm/hand with only partial faces in low amber emergency light.
 * Confirmed by direct visual inspection, not just the automated score.
 * Regenerates the keyframe with a tightened prompt, re-animates, and splices
 * the result back into shots-with-video-segmind.json.
 */
import { readFileSync, writeFileSync } from "fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const SEGMIND_KEY = env.SEGMIND_API_KEY;
const OUT_DIR = "outputtestresults/canvas-void-test/horizon-film";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pollSegmindV2(statusUrl, maxMs = 200_000) {
  const start = Date.now();
  let json;
  while (Date.now() - start < maxMs) {
    await sleep(7000);
    try {
      const r = await fetch(statusUrl, { headers: { "x-api-key": SEGMIND_KEY } });
      json = JSON.parse(await r.text());
    } catch (e) {
      console.log(`    [poll error, retrying] ${e.message}`);
      continue;
    }
    if (json.status === "COMPLETED" || json.status === "FAILED" || json.status === "ERROR") return json;
    console.log(`    status=${json.status} (${Math.round((Date.now() - start) / 1000)}s)`);
  }
  return json ?? { status: "timeout" };
}

const NEW_SOUL_PROMPT = "Soul 2.0: EXTREME close-up insert, tight crop dominated by Maya's forearm and hand pressed through a rusted mesh maintenance screen to a recessed bolt head - forearm and screen fill most of the frame. Only the very edges of Maya's and Arthur's faces are partially visible at the bottom corners, mostly in shadow. Single dim, low amber emergency strip light as the ONLY light source, deep underexposed shadows elsewhere, no bright fill light, grainy low-light cinematography, tense claustrophobic framing.";
const NEW_VIDEO_PROMPT = "Static extreme close-up on Maya's forearm and hand through the rusted mesh, fingers walking along the bolt head in dim amber light; very subtle rack focus toward the shadowed edge of her face at frame bottom, faces stay mostly obscured in low light throughout.";

async function generateSoulImageSegmind(prompt, label) {
  const body = { prompt, seed: Math.floor(Math.random() * 999999), enhance_prompt: false, negative_prompt: "blurry, deformed, extra limbs, bad anatomy, low quality, bright even lighting, wide shot" };
  const res = await fetch("https://api.segmind.com/v2/higgsfield-text2image-soul", {
    method: "POST", headers: { "x-api-key": SEGMIND_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  let json = JSON.parse(await res.text());
  console.log(`  [${label}] submit:`, res.status, json.status);
  if (json.status === "QUEUED" || json.status === "PROCESSING") json = await pollSegmindV2(json.status_url);
  if (json.status !== "COMPLETED") { console.log(`  [${label}] FAILED:`, JSON.stringify(json).slice(0, 400)); return null; }
  let imageUrl = json.output ?? json.image_url;
  if (typeof imageUrl !== "string") {
    const r2 = await fetch(json.response_url, { headers: { "x-api-key": SEGMIND_KEY } });
    const j2 = await r2.json();
    imageUrl = typeof j2.output === "string" ? j2.output : j2.images?.[0]?.url;
  }
  const imgRes = await fetch(imageUrl);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  writeFileSync(`${OUT_DIR}/${label}.png`, buf);
  console.log(`  [${label}] saved (${buf.length} bytes)`);
  return imageUrl;
}

async function animateShot(imageUrl, prompt, label) {
  const res = await fetch("https://api.segmind.com/v2/hailuo-02-fast", {
    method: "POST", headers: { "x-api-key": SEGMIND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ first_frame_image: imageUrl, prompt, duration: 6, prompt_optimizer: true }),
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
  return videoUrl;
}

async function main() {
  console.log("--- regenerating shot-6-5 keyframe (tightened prompt) ---");
  const imageUrl = await generateSoulImageSegmind(NEW_SOUL_PROMPT, "shot-6-5");
  if (!imageUrl) throw new Error("image regen failed");

  console.log("--- animating shot-6-5 ---");
  const videoUrl = await animateShot(imageUrl, NEW_VIDEO_PROMPT, "shot-6-5");
  if (!videoUrl) throw new Error("animate failed");

  const shots = JSON.parse(readFileSync(`${OUT_DIR}/shots-with-video-segmind.json`, "utf8"));
  const idx = shots.findIndex(s => s.label === "shot-6-5");
  shots[idx] = { ...shots[idx], soulPrompt: NEW_SOUL_PROMPT, videoPrompt: NEW_VIDEO_PROMPT, imageUrl, videoUrl };
  writeFileSync(`${OUT_DIR}/shots-with-video-segmind.json`, JSON.stringify(shots, null, 2), "utf8");
  console.log("\nUpdated shots-with-video-segmind.json with fixed shot-6-5.");
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
