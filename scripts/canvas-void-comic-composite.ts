// Stage 2 of the Canvas Void comic test: crop the 4 real StoryDiffusion panels
// clean of the model's baked caption (cropFourPanelGrid, item 64's fix), then
// run each through the REAL product lettering pipeline (compositeLettering)
// to add our own captions/dialogue - validates the actual product code path,
// not a reimplementation.
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { cropFourPanelGrid } from "../src/lib/comic-gen/storydiffusion";
import { compositeLettering } from "../src/lib/comic-lettering/composite-panel";

const OUT_DIR = join(process.cwd(), "outputtestresults", "canvas-void-test", "comic");

interface PanelMeta {
  label: string;
  action: string;
  caption?: string;
  dialogue?: string;
  speakerName?: string;
}

async function main() {
  const pageBuf = readFileSync(join(OUT_DIR, "full-page.png"));
  const panels: PanelMeta[] = JSON.parse(readFileSync(join(OUT_DIR, "panels-meta.json"), "utf8"));

  for (let i = 0; i < panels.length; i++) {
    const p = panels[i];
    console.log(`\n--- ${p.label} ---`);
    const cropped = await cropFourPanelGrid(pageBuf, i as 0 | 1 | 2 | 3);
    writeFileSync(join(OUT_DIR, `${p.label}-cropped.png`), cropped);
    console.log(`  cropped, clean of baked caption`);

    const lettered = await compositeLettering({
      imageBuffer: cropped,
      caption: p.caption,
      dialogue: p.dialogue,
      speakerName: p.speakerName,
      bubbleType: "speech",
    });
    writeFileSync(join(OUT_DIR, `${p.label}-FINAL.png`), lettered);
    console.log(`  lettered via real compositeLettering() -> ${p.label}-FINAL.png`);
  }

  console.log("\nAll 4 panels composited via the real product pipeline.");
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
