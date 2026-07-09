/**
 * Real cross-platform comparison test: animate the same StoryDiffusion anime
 * keyframe (panel 1: the fire-door burst-in beat, cropped clean of the
 * caption band) via three real calls:
 *   1. Hailuo via Segmind (already-wired hailuo-02-fast) - baseline
 *   2. Hailuo via Higgsfield native (minimax/hailuo-02/pro/image-to-video,
 *      confirmed reachable via a free validation-error probe) - same model,
 *      different platform
 *   3. Higgsfield DoP (higgsfield-ai/dop/standard) - Higgsfield-exclusive
 *      camera-craft model, not available via Segmind at all
 *
 * Usage: node scripts/higgsfield-vs-segmind-hailuo-test.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import sharp from "sharp";
import { put } from "@vercel/blob";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const SEGMIND_KEY = env.SEGMIND_API_KEY;
const HF_KEY = env.HIGGSFIELD_API_KEY;
const HF_SECRET = env.HIGGSFIELD_API_SECRET;
process.env.BLOB_READ_WRITE_TOKEN = env.BLOB_READ_WRITE_TOKEN;

const OUT_DIR = "outputtestresults/output-test-2/dealer-redo/higgsfield-vs-segmind";
mkdirSync(OUT_DIR, { recursive: true });

const MOTION_PROMPT =
  "The Dealer bursts through the fire door, moving low and fast into the corridor, suit fabric snapping with the motion, eyes scanning quickly; camera pushes in tight as he settles into a low stance.";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("Step 1: cropping panel 1 (fire-door burst-in) clean of the caption band...");
  const full = sharp("outputtestresults/output-test-2/dealer-redo/segmind-storydiffusion-test/keyframe-page.png");
  const meta = await full.metadata();
  const panelSize = meta.width / 2; // 2x2 grid
  const artHeight = Math.round(panelSize * 0.75); // crop off bottom ~25% (caption band + margin)
  const croppedBuf = await sharp("outputtestresults/output-test-2/dealer-redo/segmind-storydiffusion-test/keyframe-page.png")
    .extract({ left: 0, top: 0, width: panelSize, height: artHeight })
    .png()
    .toBuffer();
  writeFileSync(`${OUT_DIR}/keyframe-cropped.png`, croppedBuf);
  console.log(`  cropped to ${panelSize}x${artHeight}, saved locally`);

  console.log("\nStep 2: uploading to Vercel Blob for a public URL...");
  const blob = await put(`higgsfield-test/keyframe-${Date.now()}.png`, croppedBuf, { access: "public", contentType: "image/png" });
  console.log("  uploaded:", blob.url);
  writeFileSync(`${OUT_DIR}/keyframe-url.txt`, blob.url, "utf8");

  const results = {};

  // ── 1. Hailuo via Segmind ──────────────────────────────────────────────
  console.log("\nStep 3a: Hailuo via Segmind (hailuo-02-fast)...");
  try {
    const res = await fetch("https://api.segmind.com/v2/hailuo-02-fast", {
      method: "POST",
      headers: { "x-api-key": SEGMIND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        first_frame_image: blob.url,
        last_frame_image: null,
        prompt: MOTION_PROMPT,
        duration: 6,
        prompt_optimizer: true,
      }),
    });
    let json = JSON.parse(await res.text());
    console.log("  submit:", res.status, JSON.stringify(json).slice(0, 200));
    if (json.status === "QUEUED" || json.status === "PROCESSING") {
      const start = Date.now();
      while (Date.now() - start < 240_000) {
        await sleep(8000);
        const p = await fetch(json.status_url, { headers: { "x-api-key": SEGMIND_KEY } });
        json = await p.json();
        console.log(`    status=${json.status} (${Math.round((Date.now() - start) / 1000)}s)`);
        if (json.status === "COMPLETED" || json.status === "FAILED" || json.status === "ERROR") break;
      }
    }
    results.segmind_hailuo = json;
  } catch (e) {
    results.segmind_hailuo = { error: String(e) };
  }
  writeFileSync(`${OUT_DIR}/segmind-hailuo-result.json`, JSON.stringify(results.segmind_hailuo, null, 2), "utf8");

  // ── 2. Hailuo via Higgsfield native ─────────────────────────────────────
  console.log("\nStep 3b: Hailuo via Higgsfield native (minimax/hailuo-02/pro/image-to-video)...");
  try {
    const res = await fetch("https://platform.higgsfield.ai/minimax/hailuo-02/pro/image-to-video", {
      method: "POST",
      headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: blob.url, prompt: MOTION_PROMPT, duration: 6 }),
    });
    const text = await res.text();
    console.log("  submit:", res.status, text.slice(0, 400));
    results.higgsfield_hailuo = { status: res.status, body: text };
  } catch (e) {
    results.higgsfield_hailuo = { error: String(e) };
  }
  writeFileSync(`${OUT_DIR}/higgsfield-hailuo-result.json`, JSON.stringify(results.higgsfield_hailuo, null, 2), "utf8");

  // ── 3. Higgsfield DoP (exclusive) ───────────────────────────────────────
  console.log("\nStep 3c: Higgsfield DoP standard (higgsfield-ai/dop/standard)...");
  try {
    const res = await fetch("https://platform.higgsfield.ai/higgsfield-ai/dop/standard", {
      method: "POST",
      headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: blob.url, prompt: MOTION_PROMPT, duration: 5 }),
    });
    const text = await res.text();
    console.log("  submit:", res.status, text.slice(0, 400));
    results.higgsfield_dop = { status: res.status, body: text };
  } catch (e) {
    results.higgsfield_dop = { error: String(e) };
  }
  writeFileSync(`${OUT_DIR}/higgsfield-dop-result.json`, JSON.stringify(results.higgsfield_dop, null, 2), "utf8");

  console.log("\nAll 3 submitted. Full results saved to", OUT_DIR);
  console.log(JSON.stringify(results, null, 2).slice(0, 2000));
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
