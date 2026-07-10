/**
 * Disciplined CINE-LOCK test of "The Premium," built from real research
 * (Kandiga/ai-film-director-mega-skill's CINE-LOCK framework +
 * brandframe-studio-v2's forensic consistency-locking technique), not
 * guessing. Two things the prior 12-shot batch never did:
 *   1. Every shot gets an explicit narrative INTENT (hook/reveal/reaction/
 *      escalation/payoff) and a deliberate HANDOFF to the next shot
 *      (bookending shot 5 against shot 1: same location, dawn vs night).
 *   2. Character/environment get ONE exhaustive, itemized "forensic" lock
 *      description, repeated VERBATIM in every shot's prompt - not a loose
 *      one-sentence description freshly paraphrased per shot.
 *
 * Usage: node scripts/premium-cinelock-test.mjs [images|animate|stitch|all]
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

const OUT_DIR = "outputtestresults/output-test-2/premium-cinelock";
mkdirSync(OUT_DIR, { recursive: true });

// ── FORENSIC LOCK: character (repeated verbatim, never paraphrased) ────────
const CHARACTER_LOCK =
  "a lean, average-height man in his forties with short dark brown hair neatly combed with light gray at the temples, clean-shaven with an angular jaw and faint under-eye shadows, wearing a charcoal-gray button-up dress shirt with sleeves rolled to the forearm and no tie, dark navy trousers, a plain silver wedding band on his left hand, slightly hunched posture";

// ── FORENSIC LOCK: environment (repeated verbatim, never paraphrased) ──────
const OFFICE_LOCK =
  "a vast open-plan insurance claims office at night, rows of identical dark wood desks receding in perfect symmetry, concrete support pillars, cold blue-white fluorescent strip lights hanging in symmetric rows mostly switched off, near-monochrome cold blue-gray color palette";

const SHOTS = [
  {
    label: "cl-1-hook-empty-office",
    intent: "HOOK (establishing) - scale and oppressive world, no character yet",
    soulPrompt: `${OFFICE_LOCK}, deep shadow everywhere except one small warm amber glow of a monitor far in the back of the room where a lone figure works, symmetrical wide shot emphasizing the office's oppressive vastness, cinematic, deliberately unsettling stillness.`,
    videoPrompt: "Static wide shot of the dark office; extremely slow, subtle push-in toward the one lit desk in the distance, minimal ambient motion.",
  },
  {
    label: "cl-2-reveal-character",
    intent: "REVEAL (character intro) - ordinary, relatable human before the horror",
    soulPrompt: `${OFFICE_LOCK}, medium shot on ${CHARACTER_LOCK}, seated at his desk, face lit by the cold glow of a monitor, a small photo of two children taped to the corner of the screen, a half-full coffee mug beside his keyboard, focused expression, cinematic medium shot.`,
    videoPrompt: "Static medium shot on him at his desk; subtle typing motion, minimal ambient motion, screen glow flickering faintly on his face.",
  },
  {
    label: "cl-3-reaction-horror",
    intent: "REACTION - the discovery beat, dawning horror",
    soulPrompt: `Close-up on the face of ${CHARACTER_LOCK}, lit only by cold monitor glow, eyes narrowing with dawning horror as he leans slightly toward the screen, ${OFFICE_LOCK} blurred and dark behind him, cinematic close-up, tense discovery atmosphere.`,
    videoPrompt: "Static close-up on his face; slow, subtle widening of his eyes and tightening of his jaw as realization dawns, minimal ambient motion.",
  },
  {
    label: "cl-4-escalation-confrontation",
    intent: "ESCALATION - the confrontation, raised stakes",
    soulPrompt: `${CHARACTER_LOCK}, now standing, facing across a conference table toward a sharp corporate defense attorney in a dark suit, tense confrontational body language, documents scattered on the table between them, cold fluorescent boardroom lighting matching ${OFFICE_LOCK}'s cold blue-white palette, cinematic medium-wide shot, high-stakes atmosphere.`,
    videoPrompt: "Static medium-wide shot across the table; slow rack focus between the two men as the tension builds, minimal ambient motion.",
  },
  {
    label: "cl-5-payoff-bookend",
    intent: "PAYOFF (resolution) - deliberate bookend of shot 1: same empty office, now dawn light replacing night, powered-down instead of oppressively lit - visual rhyme signaling the ordeal is over but costly",
    soulPrompt: `${OFFICE_LOCK.replace("at night", "at dawn").replace("cold blue-white fluorescent strip lights hanging in symmetric rows mostly switched off", "fluorescent lights now fully switched off, pale gray dawn light coming through windows instead")}, ${CHARACTER_LOCK}, small and alone, walking slowly away down the center aisle between the desks toward the exit, exhausted posture, symmetrical wide shot deliberately matching the framing of the office's opening establishing shot, cinematic, quiet costly-victory atmosphere.`,
    videoPrompt: "Static wide shot matching the opening shot's framing; extremely slow, subtle motion as he walks away down the aisle, pale dawn light, minimal ambient motion.",
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
    } catch (e) { console.log(`    [poll error, retrying] ${e.message}`); continue; }
    if (json.status === "completed" || json.status === "failed" || json.status === "error") return json;
    console.log(`    status=${json.status} (${Math.round((Date.now() - start) / 1000)}s)`);
  }
  return json ?? { status: "timeout" };
}

async function stageImages() {
  console.log("=== STAGE: generating 5 CINE-LOCK keyframes ===");
  const existing = existsSync(`${OUT_DIR}/shots.json`) ? JSON.parse(readFileSync(`${OUT_DIR}/shots.json`, "utf8")) : [];
  const done = new Map(existing.filter(s => s.imageUrl).map(s => [s.label, s]));
  const results = [...done.values()];
  for (const shot of SHOTS) {
    if (done.has(shot.label)) { console.log(`skip ${shot.label} - already generated`); continue; }
    console.log(`\n--- ${shot.label} [${shot.intent}] ---`);
    try {
      const res = await fetch("https://platform.higgsfield.ai/higgsfield-ai/soul/cinema", {
        method: "POST",
        headers: { "hf-api-key": HF_KEY, "hf-secret": HF_SECRET, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: shot.soulPrompt, aspect_ratio: "9:16", resolution: "720p" }),
      });
      let json = JSON.parse(await res.text());
      console.log("  submit:", res.status, json.status);
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
    writeFileSync(`${OUT_DIR}/shots.json`, JSON.stringify(results, null, 2), "utf8");
  }
  return results;
}

async function stageAnimate(shots) {
  console.log("\n=== STAGE: animating via Higgsfield native Hailuo ===");
  const existing = existsSync(`${OUT_DIR}/shots-video.json`) ? JSON.parse(readFileSync(`${OUT_DIR}/shots-video.json`, "utf8")) : [];
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
      let json = JSON.parse(await res.text());
      console.log("  submit:", res.status, json.status);
      if (json.status === "queued" || json.status === "processing") json = await pollHiggsfield(json.status_url, 240_000);
      const videoUrl = json.video?.url ?? json.url;
      console.log("  final:", json.status, videoUrl ?? "(none)");
      results.push({ ...shot, videoUrl: videoUrl ?? null });
    } catch (e) {
      console.log("  FAILED (exception):", e.message);
      results.push({ ...shot, videoUrl: null, error: e.message });
    }
    writeFileSync(`${OUT_DIR}/shots-video.json`, JSON.stringify(results, null, 2), "utf8");
    await sleep(4000);
  }
  return results;
}

async function stageStitch(shots) {
  console.log("\n=== STAGE: stitching ===");
  const WORK_DIR = `${OUT_DIR}/stitch-tmp`;
  mkdirSync(WORK_DIR, { recursive: true });
  const ordered = SHOTS.map(s => shots.find(x => x.label === s.label)).filter(s => s?.videoUrl);
  const localPaths = [];
  for (const shot of ordered) {
    const res = await fetch(shot.videoUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    const p = `${WORK_DIR}/${shot.label}.mp4`;
    writeFileSync(p, buf);
    localPaths.push(p);
    console.log(`downloaded ${shot.label}`);
  }
  const listPath = `${WORK_DIR}/concat-list.txt`;
  writeFileSync(listPath, localPaths.map(p => `file '${resolve(p).replace(/\\/g, "/")}'`).join("\n"), "utf8");
  const outputPath = resolve(`${OUT_DIR}/the-premium-CINELOCK-TEST.mp4`);
  execFileSync(ffmpegPath, ["-y", "-f", "concat", "-safe", "0", "-i", resolve(listPath), "-c", "copy", outputPath], { stdio: "inherit" });
  console.log("saved:", outputPath);
}

async function main() {
  const stage = process.argv[2] || "all";
  let shots;
  if (stage === "images" || stage === "all") shots = await stageImages();
  else if (existsSync(`${OUT_DIR}/shots.json`)) shots = JSON.parse(readFileSync(`${OUT_DIR}/shots.json`, "utf8"));

  if (stage === "animate" || stage === "all") shots = await stageAnimate(shots);
  else if (existsSync(`${OUT_DIR}/shots-video.json`)) shots = JSON.parse(readFileSync(`${OUT_DIR}/shots-video.json`, "utf8"));

  if (stage === "stitch" || stage === "all") await stageStitch(shots);
  console.log("\nDone.", OUT_DIR);
}
main().catch(e => { console.error("FAILED:", e); process.exit(1); });
