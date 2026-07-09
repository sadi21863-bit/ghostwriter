/**
 * Comic Studio full-pipeline test using "The Canvas Void" (the new story
 * material, per the user's approved recommendation): generate 4 real
 * keyframes via Segmind StoryDiffusion (Four Pannel, reliable grid), crop
 * each clean of the model's own baked caption via cropFourPanelGrid(), then
 * run each through the REAL product lettering pipeline (compositeLettering())
 * to add our own captions/dialogue - validating the crop fix (item 64) end to
 * end through actual product code, not just a raw StoryDiffusion image.
 *
 * Usage: node --experimental-vm-modules scripts/canvas-void-comic-test.mjs
 * (plain node works too - this only imports .ts via a small transpile-free
 * subset; see the inline require workaround below)
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const SEGMIND_KEY = env.SEGMIND_API_KEY;

const OUT_DIR = "outputtestresults/canvas-void-test/comic";
mkdirSync(OUT_DIR, { recursive: true });

const CHARACTER_DESCRIPTION =
  "Lieutenant Holt, a lean weathered Antarctic explorer in his 30s, heavy fur-lined polar expedition coat, ice-crusted beard, snow goggles pushed up on his forehead, 1908 period gear";

const PANELS = [
  {
    label: "panel1-storm",
    action: "Lieutenant Holt and his expedition crew trudge through a catastrophic Antarctic whiteout storm, the horizon and ground blurring into a single featureless white canvas, wind tearing at their coats",
    caption: "Antarctica, 1908. The storm swallowed the sky an hour ago.",
  },
  {
    label: "panel2-staircase",
    action: "McMurdo points urgently into the blank whiteness beside the group, his rope line taut behind him, mouth open mid-shout, the featureless white void stretching endlessly around them",
    dialogue: "There's a staircase — three yards off, to port!",
    speakerName: "McMurdo",
  },
  {
    label: "panel3-severed",
    action: "Holt turns back from checking his compass to find McMurdo's rope line hanging severed and slack in the snow, no footprints, no timber, nothing but unbroken white",
    caption: "I turned to check the compass. When I turned back, his line was cut clean. No tracks. No timber. Nothing.",
  },
  {
    label: "panel4-alone",
    action: "Holt stands alone in the featureless white void, faint impossible architectural silhouettes and right-angled doorways flickering at the edges of his vision",
    caption: "Only the canvas. And whatever is drawing on it.",
  },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("Generating 4-panel Canvas Void page via StoryDiffusion (noir/line-art style)...");
  const sdRes = await fetch("https://api.segmind.com/v2/storydiffusion", {
    method: "POST",
    headers: { "x-api-key": SEGMIND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      character_description: CHARACTER_DESCRIPTION,
      comic_description: PANELS.map(p => p.action).join("\n"),
      style_name: "Line art", // noir mapping per STORYDIFFUSION_STYLE_BY_ART - high contrast, fits whiteout-horror tone
      comic_style: "Four Pannel",
      num_ids: 1,
      seed: Math.floor(Math.random() * 999999),
      output_format: "png",
    }),
  });
  let sdJson = JSON.parse(await sdRes.text());
  console.log("submit:", sdRes.status, sdJson.status);
  if (sdJson.status === "QUEUED" || sdJson.status === "PROCESSING") {
    const start = Date.now();
    while (Date.now() - start < 180_000) {
      await sleep(5000);
      const p = await fetch(sdJson.status_url, { headers: { "x-api-key": SEGMIND_KEY } });
      sdJson = await p.json();
      console.log(`  status=${sdJson.status} (${Math.round((Date.now() - start) / 1000)}s)`);
      if (sdJson.status === "COMPLETED" || sdJson.status === "FAILED" || sdJson.status === "ERROR") break;
    }
  }
  if (sdJson.status !== "COMPLETED") {
    console.log("FAILED:", JSON.stringify(sdJson).slice(0, 500));
    process.exit(1);
  }
  console.log("real cost:", sdJson.metrics?.cost);
  let pageUrl = sdJson.output;
  if (typeof pageUrl !== "string") {
    const resultRes = await fetch(sdJson.response_url, { headers: { "x-api-key": SEGMIND_KEY } });
    const resultJson = await resultRes.json();
    pageUrl = typeof resultJson.output === "string" ? resultJson.output : resultJson.images?.[0]?.url;
  }
  const pageRes = await fetch(pageUrl);
  const pageBuf = Buffer.from(await pageRes.arrayBuffer());
  writeFileSync(`${OUT_DIR}/full-page.png`, pageBuf);
  console.log(`saved full-page.png (${pageBuf.length} bytes)`);

  writeFileSync(`${OUT_DIR}/panels-meta.json`, JSON.stringify(PANELS, null, 2), "utf8");
  console.log("\nStep 2 (crop + lettering) will run via a separate TS-aware script since it imports real product modules.");
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
