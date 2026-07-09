/**
 * Full animated combat-trailer comparison: one real StoryDiffusion call
 * generates 8 consistent anime keyframes (the 6 restaged non-lethal combat
 * beats + 2 new atmosphere/closing beats), each panel is cropped clean of
 * the caption band and animated via BOTH Segmind Hailuo and Higgsfield-
 * native Hailuo (same model, both platforms) for a real side-by-side.
 *
 * Usage: node scripts/full-animated-trailer-comparison.mjs
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

const OUT_DIR = "outputtestresults/output-test-2/dealer-redo/full-animated-comparison";
mkdirSync(OUT_DIR, { recursive: true });

const CHARACTER_DESCRIPTION =
  "The Dealer, a lean man in a black suit with no tie, silent and controlled, holding a fanned deck of playing cards";

const BEATS = [
  { label: "shot1-burstin", action: "The Dealer bursts through a fire door low to the ground into a concrete corridor, cards fanned in hand, facing an enforcer who raises a heavy steel pipe overhead", motion: "The Dealer bursts through the fire door, moving low and fast into the corridor, suit fabric snapping with the motion, eyes scanning quickly; camera pushes in tight as he settles into a low stance." },
  { label: "shot2-knockdown", action: "A wide sheet of paper cards explodes off the Dealer's snapped wrist and sweeps an enforcer off his feet, who crashes backward onto the concrete, stunned", motion: "A wide fan of paper cards bursts outward from the Dealer's snapped wrist in a rippling sheet, sweeping across the frame and knocking an enforcer backward off his feet; camera whip-pans to follow the sheet's arc." },
  { label: "shot3-pipedestroy", action: "The Dealer snaps a rapid volley of cards at a steel pipe held by an enforcer, sparks flying off the metal as it bends and clatters from his grip", motion: "The Dealer snaps a rapid volley of cards forward one after another, each striking a raised steel pipe with a spark and a ring; the pipe visibly bends and clatters out of the enforcer's grip; camera holds low and steady." },
  { label: "shot4-defensivering", action: "The Dealer stands in the center of a corridor as a wide fan of cards spins around him in a sweeping ring, batting away two more enforcers who stumble back stunned", motion: "A wide fan of cards spins into a sweeping defensive ring around the Dealer, batting aside two approaching enforcers who stumble back stunned; camera orbits slowly around him." },
  { label: "shot5-ricochet", action: "A thrown card ricochets off a steel barrier, off a brass surround, off a far wall, and loops back into the Dealer's open palm as the last enforcer ducks for cover, unharmed", motion: "A single card ricochets in a fast continuous arc off a steel barrier, off a brass surround, off a far wall, then curves back and lands in the Dealer's open palm; camera whip-tracks alongside the card's path the whole way." },
  { label: "shot6-aftermath", action: "The Dealer stands alone in the corridor as several stunned enforcers sit against the walls around him; one man backs toward the elevator with hands raised while the Dealer straightens his cuffs", motion: "Static wide shot holding on the corridor as stunned enforcers sit against the walls; the Dealer straightens his cuffs, unhurried, while one man backs away toward the elevator with hands raised; camera slowly pushes in on the Dealer's face." },
  { label: "shot7-establishing", action: "A wide establishing shot of the corridor's aftermath, dust settling through fluorescent light, scattered playing cards littering the concrete floor", motion: "Static wide shot of the corridor, dust drifting slowly through flickering fluorescent light, scattered cards on the floor catching the light; camera holds still, then drifts forward almost imperceptibly." },
  { label: "shot8-closing", action: "A close-up on the Dealer's hands squaring a deck of cards and sliding it into his coat, cuffs straightened, before he turns and walks toward the elevator", motion: "Close-up on the Dealer's hands squaring the deck with a sharp tap against his palm before sliding it into his coat; he straightens his cuffs and turns away from camera, walking toward the elevator doors." },
];

const COMIC_DESCRIPTION = BEATS.map(b => b.action).join("\n");

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pollSegmind(statusUrl) {
  const start = Date.now();
  let json;
  while (Date.now() - start < 240_000) {
    await sleep(8000);
    const r = await fetch(statusUrl, { headers: { "x-api-key": SEGMIND_KEY } });
    json = await r.json();
    if (json.status === "COMPLETED" || json.status === "FAILED" || json.status === "ERROR") return json;
  }
  return json ?? { status: "timeout" };
}

async function pollHiggsfield(statusUrl) {
  const start = Date.now();
  let json;
  while (Date.now() - start < 240_000) {
    await sleep(8000);
    const r = await fetch(statusUrl, { headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET } });
    json = await r.json();
    if (json.status === "completed" || json.status === "failed" || json.status === "error") return json;
  }
  return json ?? { status: "timeout" };
}

async function generateFourPanelPage(beats, seed, pageLabel) {
  const sdRes = await fetch("https://api.segmind.com/v2/storydiffusion", {
    method: "POST",
    headers: { "x-api-key": SEGMIND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      character_description: CHARACTER_DESCRIPTION,
      comic_description: beats.map(b => b.action).join("\n"),
      style_name: "Japanese Anime",
      comic_style: "Four Pannel", // confirmed clean 2x2 grid, unlike Classic Comic Style's irregular layout
      num_ids: 1,
      seed,
      output_format: "png",
    }),
  });
  let sdJson = JSON.parse(await sdRes.text());
  console.log(`  [${pageLabel}] submit:`, sdRes.status, sdJson.status);
  if (sdJson.status === "QUEUED" || sdJson.status === "PROCESSING") {
    const start = Date.now();
    while (Date.now() - start < 180_000) {
      await sleep(5000);
      const p = await fetch(sdJson.status_url, { headers: { "x-api-key": SEGMIND_KEY } });
      sdJson = await p.json();
      console.log(`  [${pageLabel}] status=${sdJson.status} (${Math.round((Date.now() - start) / 1000)}s)`);
      if (sdJson.status === "COMPLETED" || sdJson.status === "FAILED" || sdJson.status === "ERROR") break;
    }
  }
  if (sdJson.status !== "COMPLETED") {
    console.log(`  [${pageLabel}] FAILED:`, JSON.stringify(sdJson).slice(0, 500));
    process.exit(1);
  }
  console.log(`  [${pageLabel}] real cost:`, sdJson.metrics?.cost);
  let pageUrl = sdJson.output;
  if (typeof pageUrl !== "string") {
    const resultRes = await fetch(sdJson.response_url, { headers: { "x-api-key": SEGMIND_KEY } });
    const resultJson = await resultRes.json();
    pageUrl = typeof resultJson.output === "string" ? resultJson.output : resultJson.images?.[0]?.url;
  }
  if (typeof pageUrl !== "string") {
    console.log(`  [${pageLabel}] Could not find page image URL:`, JSON.stringify(sdJson).slice(0, 500));
    process.exit(1);
  }
  const pageRes = await fetch(pageUrl);
  const pageBuf = Buffer.from(await pageRes.arrayBuffer());
  writeFileSync(`${OUT_DIR}/${pageLabel}.png`, pageBuf);
  console.log(`  [${pageLabel}] saved (${pageBuf.length} bytes)`);
  return pageBuf;
}

async function main() {
  console.log("Step 1: generating 2x Four-Pannel anime pages (4 beats each, clean 2x2 grid)...");
  const page1Buf = await generateFourPanelPage(BEATS.slice(0, 4), Math.floor(Math.random() * 999999), "page1");
  const page2Buf = await generateFourPanelPage(BEATS.slice(4, 8), Math.floor(Math.random() * 999999), "page2");

  console.log("\nStep 2: cropping 8 panels (clean 2x2 grids, clean of caption band) + uploading...");
  const keyframes = [];
  for (const [pageBuf, beatSlice] of [[page1Buf, BEATS.slice(0, 4)], [page2Buf, BEATS.slice(4, 8)]]) {
    const meta = await sharp(pageBuf).metadata();
    const panelSize = Math.floor(meta.width / 2);
    const artH = Math.round(panelSize * 0.75);
    for (let i = 0; i < beatSlice.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const buf = await sharp(pageBuf)
        .extract({ left: col * panelSize, top: row * panelSize, width: panelSize, height: artH })
        .png()
        .toBuffer();
      const blob = await put(`higgsfield-test/${beatSlice[i].label}-${Date.now()}.png`, buf, { access: "public", contentType: "image/png" });
      keyframes.push({ ...beatSlice[i], imageUrl: blob.url });
      console.log(`  ${beatSlice[i].label}: ${blob.url}`);
    }
  }
  writeFileSync(`${OUT_DIR}/keyframes.json`, JSON.stringify(keyframes, null, 2), "utf8");

  console.log("\nStep 3: submitting all 16 video calls (8 shots x 2 platforms)...");
  const jobs = [];
  for (const kf of keyframes) {
    // Segmind Hailuo
    try {
      const res = await fetch("https://api.segmind.com/v2/hailuo-02-fast", {
        method: "POST",
        headers: { "x-api-key": SEGMIND_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ first_frame_image: kf.imageUrl, prompt: kf.motion, duration: 6, prompt_optimizer: true }),
      });
      const json = JSON.parse(await res.text());
      console.log(`  [segmind] ${kf.label}: ${res.status} ${json.status}`);
      jobs.push({ label: kf.label, platform: "segmind", statusUrl: json.status_url, initial: json });
    } catch (e) {
      jobs.push({ label: kf.label, platform: "segmind", error: String(e) });
    }
    // Higgsfield native Hailuo
    try {
      const res = await fetch("https://platform.higgsfield.ai/minimax/hailuo-02/pro/image-to-video", {
        method: "POST",
        headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: kf.imageUrl, prompt: kf.motion, duration: 6 }),
      });
      const json = JSON.parse(await res.text());
      console.log(`  [higgsfield] ${kf.label}: ${res.status} ${json.status}`);
      jobs.push({ label: kf.label, platform: "higgsfield", statusUrl: json.status_url, initial: json });
    } catch (e) {
      jobs.push({ label: kf.label, platform: "higgsfield", error: String(e) });
    }
  }
  writeFileSync(`${OUT_DIR}/jobs-submitted.json`, JSON.stringify(jobs, null, 2), "utf8");

  console.log("\nStep 4: polling all 16 jobs to completion...");
  const results = [];
  for (const job of jobs) {
    if (job.error || !job.statusUrl) { results.push({ ...job, final: { status: "submit_failed" } }); continue; }
    console.log(`  polling ${job.platform}/${job.label}...`);
    const final = job.platform === "segmind" ? await pollSegmind(job.statusUrl) : await pollHiggsfield(job.statusUrl);
    console.log(`    -> ${final.status}`);
    results.push({ ...job, final });
    writeFileSync(`${OUT_DIR}/results.json`, JSON.stringify(results, null, 2), "utf8");
  }

  console.log("\n=== FINAL RESULTS ===");
  for (const r of results) {
    const url = r.final?.video?.url ?? r.final?.output ?? r.final?.video?.url;
    console.log(`${r.platform}/${r.label}: ${r.final?.status} ${url ?? ""}`);
  }
  console.log("\nAll output saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
