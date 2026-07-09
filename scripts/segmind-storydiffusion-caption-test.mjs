/**
 * Segmind-only test: generate 4 real anime-style comic keyframes via
 * StoryDiffusion (real confirmed cost ~$0.01/page) to check whether the
 * previously-found caption/watermark-baking problem lands in a predictable,
 * croppable location - the real blocker on the comic StoryDiffusion swap
 * (see docs/2026-06-25-competitor-and-model-research-comic-video-quality.md
 * section 6). Uses the same restaged (blunt-weapon, non-lethal) combat beats
 * that already cleared content moderation on Kling, for later reuse as a
 * same-content comparison against Higgsfield's equivalent models.
 *
 * Usage: node scripts/segmind-storydiffusion-caption-test.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const SEGMIND_KEY = env.SEGMIND_API_KEY;
if (!SEGMIND_KEY) throw new Error("SEGMIND_API_KEY not found in .env.local");

const OUT_DIR = "outputtestresults/output-test-2/dealer-redo/segmind-storydiffusion-test";
mkdirSync(OUT_DIR, { recursive: true });

const CHARACTER_DESCRIPTION =
  "The Dealer, a lean man in a black suit with no tie, silent and controlled, holding a fanned deck of playing cards";

const COMIC_DESCRIPTION = [
  "The Dealer bursts through a fire door low to the ground into a concrete corridor, cards fanned in hand, facing an enforcer who raises a heavy steel pipe overhead",
  "A wide sheet of paper cards explodes off the Dealer's snapped wrist and sweeps an enforcer off his feet, who crashes backward onto the concrete, stunned",
  "The Dealer snaps a rapid volley of cards at a steel pipe held by an enforcer, sparks flying off the metal as it bends and clatters from his grip",
  "The Dealer stands in the center of a corridor as a wide fan of cards spins around him in a sweeping ring, batting away two more enforcers who stumble back stunned",
].join("\n");

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("Generating 4 anime-style keyframes via Segmind StoryDiffusion...");
  const sdRes = await fetch("https://api.segmind.com/v2/storydiffusion", {
    method: "POST",
    headers: { "x-api-key": SEGMIND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      character_description: CHARACTER_DESCRIPTION,
      comic_description: COMIC_DESCRIPTION,
      style_name: "Japanese Anime",
      comic_style: "Four Pannel",
      num_ids: 1,
      seed: Math.floor(Math.random() * 999999),
      output_format: "png",
    }),
  });
  console.log("submit status:", sdRes.status);
  let sdJson = JSON.parse(await sdRes.text());
  if (!sdRes.ok) { console.log(JSON.stringify(sdJson).slice(0, 1000)); process.exit(1); }

  if (sdJson.status === "QUEUED" || sdJson.status === "PROCESSING") {
    console.log("queued, polling", sdJson.status_url, "...");
    const start = Date.now();
    while (Date.now() - start < 180_000) {
      await sleep(5000);
      const pollRes = await fetch(sdJson.status_url, { headers: { "x-api-key": SEGMIND_KEY } });
      const pollJson = await pollRes.json();
      console.log(`  status=${pollJson.status} (${Math.round((Date.now() - start) / 1000)}s)`);
      if (pollJson.status === "COMPLETED") { sdJson = pollJson; break; }
      if (pollJson.status === "FAILED" || pollJson.status === "ERROR") {
        console.log("FAILED:", JSON.stringify(pollJson).slice(0, 500));
        process.exit(1);
      }
    }
  }

  writeFileSync(`${OUT_DIR}/storydiffusion-result.json`, JSON.stringify(sdJson, null, 2), "utf8");
  console.log("real cost (metrics.cost):", sdJson.metrics?.cost ?? "not present in response");

  let imageUrl = typeof sdJson.output === "string"
    ? sdJson.output
    : (sdJson.image_url ?? sdJson.output?.image_url ?? sdJson.output?.media_url?.[0]);

  if (typeof imageUrl !== "string") {
    console.log("Could not find image URL, response keys:", Object.keys(sdJson));
    console.log(JSON.stringify(sdJson).slice(0, 800));
    process.exit(1);
  }
  console.log("keyframe page image:", imageUrl);

  if (imageUrl.startsWith("http")) {
    const imgRes = await fetch(imageUrl);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    writeFileSync(`${OUT_DIR}/keyframe-page.png`, buf);
    console.log(`saved keyframe-page.png (${buf.length} bytes)`);
  } else if (imageUrl.startsWith("data:")) {
    const base64 = imageUrl.split(",")[1];
    writeFileSync(`${OUT_DIR}/keyframe-page.png`, Buffer.from(base64, "base64"));
    console.log("saved keyframe-page.png (from base64)");
  }

  console.log("\nDone. Inspect", `${OUT_DIR}/keyframe-page.png`, "for caption/watermark placement.");
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
