/**
 * Small mini-trailers for the 4 remaining unused "Narrative Gaps" premises
 * (Canvas Void was already used - see item 66), via Higgsfield's NATIVE
 * Soul Cinema (images) + native Hailuo (animation), per explicit user
 * instruction ("through higgsfield soul/soul cinema"). Same
 * generate->animate->stitch shape as the Horizon Line short film, scoped
 * down to 3 shots/premise (12 total) to fit the real 227-credit budget.
 *
 * Usage: node scripts/narrative-gaps-trailers.mjs [images|animate|stitch|all]
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
const HF_KEY = env.HIGGSFIELD_API_KEY;
const HF_SECRET = env.HIGGSFIELD_API_SECRET;

const OUT_DIR = "outputtestresults/output-test-2/narrative-gaps-trailers";
mkdirSync(OUT_DIR, { recursive: true });

const PREMISES = [
  {
    id: "memory-of-tomorrow",
    label: "The Memory of Tomorrow",
    shots: [
      {
        label: "mot-1-archive-bureau",
        soulPrompt: "The Archivist, a composed baseline human in his thirties in a plain office cardigan, sits at an old wooden desk inside a bureaucratic Archive Bureau, surrounded by filing cabinets and other clerks who move with quiet, resigned dread rather than urgency, cold institutional lighting, muted color grade, cinematic medium shot, contemplative unease.",
        videoPrompt: "Static medium shot on the Archivist at his desk; subtle ambient motion of clerks moving slowly and silently in the background, a faint uneasy stillness in the air.",
      },
      {
        label: "mot-2-wedding-like-funeral",
        soulPrompt: "A wedding ceremony where guests wear formal wedding attire but sit with the somber, hollow expressions of mourners at a funeral, the bride and groom's faces strained rather than joyful, muted pastel decor contrasted with grim atmosphere, cinematic wide shot, unsettling irony.",
        videoPrompt: "Static wide shot on the ceremony; minimal ambient motion, a slow subtle push-in emphasizing the mismatch between festive decor and grieving faces.",
      },
      {
        label: "mot-3-panic-at-counter",
        soulPrompt: "A civilian gripping the edge of the Archive Bureau's counter with both hands, eyes wide with dawning horror as their expression shifts from confusion to panic, the Archivist watching from behind the desk with growing concern, cold fluorescent office lighting, cinematic close-up, tense atmosphere.",
        videoPrompt: "Close-up on the civilian's face at the counter; slow creeping panic crossing their features, subtle hand tremor gripping the counter edge.",
      },
    ],
  },
  {
    id: "suburbs-of-drift",
    label: "The Suburbs of Drift",
    shots: [
      {
        label: "sod-1-elongating-hallway",
        soulPrompt: "Interior of an ordinary suburban house hallway stretching impossibly into the distance, doorframes repeating and shrinking toward a vanishing point far beyond normal architectural scale, a single bedroom door barely visible at the very end, dim household lighting giving way to unnatural shadow the further the hallway extends, cinematic wide shot emphasizing scale wrongness, unsettling quiet atmosphere.",
        videoPrompt: "Static wide shot down the hallway; extremely slow, subtle dolly-in that makes the far door feel to recede rather than approach, unsettling stillness.",
      },
      {
        label: "sod-2-stretched-street",
        soulPrompt: "A quiet suburban street at dusk where the asphalt between two houses has visibly stretched far beyond normal distance, telephone poles multiplying unnaturally to bridge the gap, a warped illegible street sign in the foreground, the two houses now distant silhouettes at the far ends of the impossibly long gap, eerie stillness, cinematic wide establishing shot, muted evening color palette.",
        videoPrompt: "Static wide establishing shot; minimal ambient motion, faint dusk light flickering on the multiplying telephone poles.",
      },
      {
        label: "sod-3-parents-trekking",
        soulPrompt: "Two exhausted parents trekking through a shifting, impossibly long drywall corridor carrying a food tray, the hallway walls silent and featureless around them, a bedroom door barely visible far in the distance, dim warm household light fading into cold shadow ahead, cinematic medium-wide shot, weary desperation.",
        videoPrompt: "Static medium-wide tracking shot alongside the parents walking; subtle handheld sway, exhausted steady pace forward.",
      },
    ],
  },
  {
    id: "the-premium",
    label: "The Premium",
    shots: [
      {
        label: "prem-1-analyst-late-night",
        soulPrompt: "A low-level compliance analyst alone at his desk late at night, face lit by the cold glow of a computer screen showing dense algorithmic code, faint occult geometric seals subtly woven into the data visualization on screen, dark empty office around him, cinematic close-up, tense discovery atmosphere.",
        videoPrompt: "Static close-up on the analyst's face lit by the screen; his eyes narrow slowly as he notices the pattern, minimal ambient motion.",
      },
      {
        label: "prem-2-sacrificial-altar-office",
        soulPrompt: "A sterile, oppressive corporate claims office at night, rows of identical desks and fluorescent light fixtures arranged with an unsettling, almost altar-like symmetry, harsh cold white lighting, empty of people, cinematic wide shot, institutional dread.",
        videoPrompt: "Static wide shot of the empty office; extremely slow, subtle push-in, fluorescent lights faintly flickering.",
      },
      {
        label: "prem-3-attorney-negotiation",
        soulPrompt: "The compliance analyst and a sharp, ruthless corporate defense attorney seated across a conference table covered in scattered legal documents, tense confrontational body language, cold boardroom lighting, cinematic medium shot, high-stakes negotiation atmosphere.",
        videoPrompt: "Static medium shot across the table; slow rack focus between the analyst and the attorney as the tension builds.",
      },
    ],
  },
  {
    id: "scent-of-lavender",
    label: "The Scent of Lavender",
    shots: [
      {
        label: "lav-1-euphoric-inhale",
        soulPrompt: "A person standing in a sunlit domestic room, eyes closed, head tilted back slightly, an expression of blissful euphoric calm as if smelling something deeply comforting, soft warm nostalgic lighting, cinematic close-up portrait, dreamlike serenity with a subtle undertone of unease.",
        videoPrompt: "Static close-up on the peaceful face; extremely slow, subtle breathing motion, warm light gently shifting.",
      },
      {
        label: "lav-2-shadow-transformation",
        soulPrompt: "A humanoid silhouette standing motionless in a dim doorway, backlit so only an outline is visible, faint delicate root-like tendrils suggested at the silhouette's edges catching the light, no explicit anatomy visible, purely suggestive shadow-based horror, cinematic wide shot, quiet dread, tasteful restraint.",
        videoPrompt: "Static wide shot on the silhouetted doorway; extremely subtle, slow shift of light suggesting faint movement within the shadow, unsettling stillness.",
      },
      {
        label: "lav-3-family-approaching",
        soulPrompt: "A warmly lit living room at dusk seen from behind a family member approaching a still, silent figure seated in an armchair by the window, faint wisps of pale mist drifting from the seated figure toward the approaching family member, cozy domestic setting undercut by quiet wrongness, cinematic medium-wide shot, tasteful restraint, no explicit anatomy.",
        videoPrompt: "Static medium-wide shot from behind the approaching family member; slow, steady walking motion toward the seated figure, faint mist drifting.",
      },
    ],
  },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pollHiggsfield(statusUrl, maxMs = 200_000) {
  const start = Date.now();
  let json;
  while (Date.now() - start < maxMs) {
    await sleep(7000);
    try {
      const r = await fetch(statusUrl, { headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET } });
      json = JSON.parse(await r.text());
    } catch (e) {
      console.log(`    [poll error, retrying] ${e.message}`);
      continue;
    }
    if (json.status === "completed" || json.status === "failed" || json.status === "error") return json;
    console.log(`    status=${json.status} (${Math.round((Date.now() - start) / 1000)}s)`);
  }
  return json ?? { status: "timeout" };
}

function allShots() {
  return PREMISES.flatMap(p => p.shots.map(s => ({ ...s, premiseId: p.id })));
}

async function stageImages() {
  console.log("=== STAGE: generating 12 keyframes via Higgsfield native Soul Cinema ===");
  const existing = existsSync(`${OUT_DIR}/shots-with-images.json`)
    ? JSON.parse(readFileSync(`${OUT_DIR}/shots-with-images.json`, "utf8"))
    : [];
  const done = new Map(existing.filter(s => s.imageUrl).map(s => [s.label, s]));
  const results = [...done.values()];

  for (const shot of allShots()) {
    if (done.has(shot.label)) { console.log(`skip ${shot.label} - already generated`); continue; }
    console.log(`\n--- ${shot.label} ---`);
    try {
      const res = await fetch("https://platform.higgsfield.ai/higgsfield-ai/soul/cinema", {
        method: "POST",
        headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: shot.soulPrompt, aspect_ratio: "9:16", resolution: "720p" }),
      });
      const text = await res.text();
      console.log("  submit:", res.status, text.slice(0, 200));
      let json = JSON.parse(text);
      if (json.status === "queued" || json.status === "processing") json = await pollHiggsfield(json.status_url);
      const imageUrl = json.image?.url ?? json.images?.[0]?.url ?? json.url;
      if (json.status !== "completed" || !imageUrl) { console.log("  FAILED:", JSON.stringify(json).slice(0, 300)); results.push({ ...shot, imageUrl: null }); continue; }
      const imgRes = await fetch(imageUrl);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      writeFileSync(`${OUT_DIR}/${shot.label}.png`, buf);
      console.log(`  saved (${buf.length} bytes)`);
      results.push({ ...shot, imageUrl });
    } catch (e) {
      console.log("  FAILED (exception):", e.message);
      results.push({ ...shot, imageUrl: null, error: e.message });
    }
    writeFileSync(`${OUT_DIR}/shots-with-images.json`, JSON.stringify(results, null, 2), "utf8");
  }
  return results;
}

async function stageAnimate(shots) {
  console.log("\n=== STAGE: animating via Higgsfield native Hailuo ===");
  const existing = existsSync(`${OUT_DIR}/shots-with-video.json`)
    ? JSON.parse(readFileSync(`${OUT_DIR}/shots-with-video.json`, "utf8"))
    : [];
  const done = new Map(existing.filter(s => s.videoUrl).map(s => [s.label, s]));
  const results = [...done.values()];

  for (const shot of shots) {
    if (!shot.imageUrl) { console.log(`skip ${shot.label} - no image`); continue; }
    if (done.has(shot.label)) { console.log(`skip ${shot.label} - already animated`); continue; }
    console.log(`\n--- animating ${shot.label} ---`);
    try {
      const res = await fetch("https://platform.higgsfield.ai/minimax/hailuo-02/pro/image-to-video", {
        method: "POST",
        headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: shot.imageUrl, prompt: shot.videoPrompt, duration: 6 }),
      });
      const text = await res.text();
      console.log("  submit:", res.status, text.slice(0, 200));
      let json = JSON.parse(text);
      if (json.status === "queued" || json.status === "processing") json = await pollHiggsfield(json.status_url, 240_000);
      const videoUrl = json.video?.url ?? json.url;
      console.log("  final:", json.status, videoUrl ?? "(none)");
      results.push({ ...shot, videoUrl: videoUrl ?? null });
    } catch (e) {
      console.log("  FAILED (exception):", e.message);
      results.push({ ...shot, videoUrl: null, error: e.message });
    }
    writeFileSync(`${OUT_DIR}/shots-with-video.json`, JSON.stringify(results, null, 2), "utf8");
    await sleep(4000); // small courtesy gap between native Higgsfield submissions
  }
  return results;
}

async function stageStitch(shots) {
  console.log("\n=== STAGE: stitching one trailer per premise ===");
  const WORK_DIR = `${OUT_DIR}/stitch-tmp`;
  mkdirSync(WORK_DIR, { recursive: true });

  for (const premise of PREMISES) {
    const premiseShots = premise.shots
      .map(s => shots.find(x => x.label === s.label))
      .filter(s => s?.videoUrl);
    if (premiseShots.length === 0) { console.log(`\n${premise.label}: no completed shots, skipping.`); continue; }

    console.log(`\n--- ${premise.label} (${premiseShots.length} shots) ---`);
    const localPaths = [];
    for (const shot of premiseShots) {
      const res = await fetch(shot.videoUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      const p = `${WORK_DIR}/${shot.label}.mp4`;
      writeFileSync(p, buf);
      localPaths.push(p);
      console.log(`  downloaded ${shot.label}`);
    }
    const listPath = `${WORK_DIR}/${premise.id}-concat-list.txt`;
    writeFileSync(listPath, localPaths.map(p => `file '${resolve(p).replace(/\\/g, "/")}'`).join("\n"), "utf8");
    const outputPath = resolve(`${OUT_DIR}/${premise.id}-TRAILER.mp4`);
    execFileSync(ffmpegPath, ["-y", "-f", "concat", "-safe", "0", "-i", resolve(listPath), "-c", "copy", outputPath], { stdio: "inherit" });
    console.log(`  saved: ${outputPath}`);
  }
}

async function main() {
  const stage = process.argv[2] || "all";
  let shots;
  if (stage === "images" || stage === "all") {
    shots = await stageImages();
  } else if (existsSync(`${OUT_DIR}/shots-with-images.json`)) {
    shots = JSON.parse(readFileSync(`${OUT_DIR}/shots-with-images.json`, "utf8"));
  }

  if (stage === "animate" || stage === "all") {
    shots = await stageAnimate(shots);
  } else if (existsSync(`${OUT_DIR}/shots-with-video.json`)) {
    shots = JSON.parse(readFileSync(`${OUT_DIR}/shots-with-video.json`, "utf8"));
  }

  if (stage === "stitch" || stage === "all") {
    await stageStitch(shots);
  }
  console.log("\nDone. All output saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
