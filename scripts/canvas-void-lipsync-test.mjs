/**
 * Real Lipsync comparison: Higgsfield native (higgsfield-ai/speak, confirmed
 * reachable via a free validation-error probe - real required fields
 * image_url/audio_url/prompt) vs. this codebase's existing production
 * Segmind/Hallo pipeline (POST /hallo, input_image/input_audio). Same
 * portrait (Lieutenant Holt's reference photo) and same real TTS audio line
 * on both, for a fair comparison.
 *
 * Usage: node scripts/canvas-void-lipsync-test.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
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

const OUT_DIR = "outputtestresults/canvas-void-test/lipsync";
mkdirSync(OUT_DIR, { recursive: true });

const LINE = "The sky is gone. The snow is gone. There is only the blankness.";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("Step 1: generating real TTS audio (Segmind Grok TTS)...");
  const ttsRes = await fetch("https://api.segmind.com/v1/grok-tts", {
    method: "POST",
    headers: { "x-api-key": SEGMIND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text: LINE, voice_id: "rex", language: "en", codec: "mp3", speed: 1 }),
  });
  console.log("  TTS status:", ttsRes.status, ttsRes.headers.get("content-type"));
  if (!ttsRes.ok) { console.log(await ttsRes.text()); process.exit(1); }
  const audioBuf = Buffer.from(await ttsRes.arrayBuffer());
  writeFileSync(`${OUT_DIR}/holt-line.mp3`, audioBuf);
  console.log(`  saved holt-line.mp3 (${audioBuf.length} bytes)`);

  console.log("\nStep 2: uploading audio + portrait to Blob for public URLs...");
  const audioBlob = await put(`canvas-void-test/holt-line-${Date.now()}.mp3`, audioBuf, { access: "public", contentType: "audio/mpeg" });
  const portraitBuf = readFileSync("outputtestresults/canvas-void-test/soul-id/ref-1.png");
  const portraitBlob = await put(`canvas-void-test/holt-portrait-${Date.now()}.png`, portraitBuf, { access: "public", contentType: "image/png" });
  console.log("  audio:", audioBlob.url);
  console.log("  portrait:", portraitBlob.url);

  // ── Higgsfield native (higgsfield-ai/speak) ─────────────────────────────
  console.log("\nStep 3a: Higgsfield native lipsync (higgsfield-ai/speak)...");
  try {
    const res = await fetch("https://platform.higgsfield.ai/higgsfield-ai/speak", {
      method: "POST",
      headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: portraitBlob.url, audio_url: audioBlob.url, prompt: "Lieutenant Holt speaks the line, weary and afraid, staring into the storm" }),
    });
    const text = await res.text();
    console.log("  submit:", res.status, text.slice(0, 300));
    let json = JSON.parse(text);
    if (json.status === "queued" || json.status === "processing") {
      const start = Date.now();
      while (Date.now() - start < 240_000) {
        await sleep(8000);
        const r = await fetch(json.status_url, { headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET } });
        json = await r.json();
        console.log(`    status=${json.status} (${Math.round((Date.now() - start) / 1000)}s)`);
        if (json.status === "completed" || json.status === "failed") break;
      }
    }
    console.log("  final:", json.status, json.video?.url ?? "");
    writeFileSync(`${OUT_DIR}/higgsfield-speak-result.json`, JSON.stringify(json, null, 2), "utf8");
    if (json.video?.url) {
      const vid = await fetch(json.video.url);
      writeFileSync(`${OUT_DIR}/higgsfield-lipsync.mp4`, Buffer.from(await vid.arrayBuffer()));
      console.log("  saved higgsfield-lipsync.mp4");
    }
  } catch (e) {
    console.log("  FAILED:", String(e));
  }

  // ── Segmind Hallo (existing production pipeline) ────────────────────────
  console.log("\nStep 3b: Segmind Hallo (existing production pipeline)...");
  try {
    const res = await fetch("https://api.segmind.com/v2/hallo", {
      method: "POST",
      headers: { "x-api-key": SEGMIND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ input_image: portraitBlob.url, input_audio: audioBlob.url }),
    });
    let text = await res.text();
    console.log("  submit:", res.status, text.slice(0, 300));
    let json = JSON.parse(text);
    if (json.status === "QUEUED" || json.status === "PROCESSING") {
      const start = Date.now();
      while (Date.now() - start < 300_000) {
        await sleep(8000);
        const r = await fetch(json.status_url, { headers: { "x-api-key": SEGMIND_KEY } });
        json = await r.json();
        console.log(`    status=${json.status} (${Math.round((Date.now() - start) / 1000)}s)`);
        if (json.status === "COMPLETED" || json.status === "FAILED" || json.status === "ERROR") break;
      }
    }
    console.log("  final:", json.status);
    writeFileSync(`${OUT_DIR}/segmind-hallo-result.json`, JSON.stringify(json, null, 2), "utf8");
    const videoUrl = json.video?.url ?? json.output;
    if (videoUrl) {
      const vid = await fetch(videoUrl);
      writeFileSync(`${OUT_DIR}/segmind-lipsync.mp4`, Buffer.from(await vid.arrayBuffer()));
      console.log("  saved segmind-lipsync.mp4");
    }
  } catch (e) {
    console.log("  FAILED:", String(e));
  }

  console.log("\nDone. All output saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
