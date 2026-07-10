/**
 * "The Horizon Line: The Ride Never Ends" — a fresh CINE-LOCK short built
 * from the user's own premise (amusement-park time-loop bookend), spending
 * the full remaining real-money balance on the actual shipped pipeline
 * from item 68/69: forensic verbatim character/location lock, Soul ID
 * training for cross-shot face consistency, shot-intent/scene-turn
 * discipline, and the real post-production crossfade stitch tool.
 *
 * Calls the real product functions directly (generateSoulImage,
 * trainSoulId/pollSoulIdTraining, generateTextVideo, pollJob) — no HTTP,
 * no dev server, matching the working pattern from test-multishot-direct.mts.
 *
 * Stages: bootstrap (soul id kickoff) -> images (7 keyframes) ->
 * poll (upgrade to soulId if ready) -> videos (animate, budget-aware,
 * stops cleanly on a real insufficient-balance error) -> stitch (real
 * crossfade tool) -> done.
 *
 * Usage: npx tsx scripts/horizon-loop-cinelock.mts <stage>
 *   stage: bootstrap | images | videos | stitch | all  (default: all)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve as resolvePath } from "path";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const { generateSoulImage, generateTextVideo, pollJob, trainSoulId, pollSoulIdTraining } = await import("../src/lib/higgsfield/client");
const { decrypt } = await import("../src/lib/crypto");
const { db } = await import("../src/db");
const { users, projects } = await import("../src/db/schema");
const { eq } = await import("drizzle-orm");
const { concatVideosWithCrossfade } = await import("../src/lib/video/concat");

// Reuses the real, already-confirmed-working Horizon Line project owner
// (same account used in test-multishot-direct.mts) rather than guessing an
// email — this is the account that actually holds the real API keys.
const KEY_OWNER_PROJECT_ID = "4a365d59-e102-4b13-aeea-f570b8758a06";

const OUT_DIR = "outputtestresults/output-test-2/horizon-line-loop";
mkdirSync(OUT_DIR, { recursive: true });

const CHARACTER_LOCK_YOUNG =
  "A wiry young man in his mid-twenties with tousled brown hair, an open blue windbreaker over a white t-shirt, faded jeans, and sneakers, an easy unguarded smile, carrying a small park map in one hand.";
const CHARACTER_LOCK_AGED =
  "The same wiry young man, mid-twenties, tousled brown hair now longer and unkempt with a full ragged beard, the same blue windbreaker and white t-shirt now faded and weathered, faded jeans, sneakers, hollow eyes, no map in his empty hands.";
const LOCATION_LOCK =
  "A wrought-iron amusement park entrance arch strung with unlit string lights, above it a weathered wooden signboard painted in faded carnival red and gold reading WELCOME TO THE HORIZON LINE - THE RIDE NEVER ENDS, a cloudless pale morning sky behind it.";

type Shot = {
  id: string;
  imagePrompt: string;
  videoPrompt: string;
  duration: number;
  usesCharacter: "young" | "aged" | "none";
  priority: number; // 1 = animate first (most important), higher = later
};

const SHOTS: Shot[] = [
  {
    id: "shot-1-hook",
    imagePrompt: `${LOCATION_LOCK} ${CHARACTER_LOCK_YOUNG} He stands just inside the gate looking straight up at the sign, sunlight catching his face, breaking into a delighted grin. Wide low-angle shot looking up.`,
    videoPrompt: "Static wide low-angle shot looking up at the sign, he tilts his head back and his grin widens, sunlight flaring off the wrought iron, no camera movement.",
    duration: 5, usesCharacter: "young", priority: 1,
  },
  {
    id: "shot-2-transition",
    imagePrompt: `${CHARACTER_LOCK_YOUNG} He weaves eagerly through a thin, cheerful morning crowd along a sun-bleached midway lined with striped ticket booths, eyes fixed ahead on a towering wooden roller coaster. Medium-wide tracking shot from the side.`,
    videoPrompt: "Medium-wide tracking shot, he strides forward eagerly through the crowd, camera tracks alongside him, midway banners fluttering, energetic morning light.",
    duration: 4, usesCharacter: "young", priority: 5,
  },
  {
    id: "shot-3-reveal",
    imagePrompt: `The coaster's first steep lift hill, sun flaring off old sun-bleached wooden track, an empty car clattering up in the distance against a pale sky. No human figure in frame. Medium close-up, low angle.`,
    videoPrompt: "Medium close-up, low angle, the empty car clatters up the lift hill, chain mechanism grinding, sun flare crossing the frame, no camera movement.",
    duration: 4, usesCharacter: "none", priority: 6,
  },
  {
    id: "shot-4-escalation",
    imagePrompt: `${CHARACTER_LOCK_YOUNG.replace("carrying a small park map in one hand", "hands now empty, gripping the restraint bar")} A restraint bar locks over his lap with a metallic clunk, his grin widening, knuckles pale with excitement. Close-up.`,
    videoPrompt: "Close-up, the restraint bar clunks down and locks, his hands grip it tight, grin widening, the car lurches forward and begins to climb, subtle vibration.",
    duration: 4, usesCharacter: "young", priority: 4,
  },
  {
    id: "shot-5-turn",
    imagePrompt: `An elevated god's-eye view of a wooden roller coaster looping an unbroken circuit through dense park trees, dawn light. Extreme wide aerial shot.`,
    videoPrompt: "Extreme wide elevated god's-eye shot, the coaster loops its circuit continuously as the sky cycles rapidly from day to night to day in accelerating pulses, the surrounding trees bleed from green to gold to bare to green again in the same accelerated rhythm, the same small car never leaving the track, time-lapse motion, no cuts.",
    duration: 6, usesCharacter: "none", priority: 2,
  },
  {
    id: "shot-6-payoff",
    imagePrompt: `${CHARACTER_LOCK_AGED} The restraint bar has just snapped open with a shudder, he stumbles out of the car onto the wooden platform, gasping, mid-stride into a run. Medium shot, low angle.`,
    videoPrompt: "Medium low-angle shot, he stumbles off the platform and breaks into a desperate run toward camera, ragged breathing, weathered clothes catching the light, handheld urgency.",
    duration: 5, usesCharacter: "aged", priority: 3,
  },
  {
    id: "shot-7-bookend",
    imagePrompt: `${LOCATION_LOCK} ${CHARACTER_LOCK_AGED} He stands just inside the same gate looking straight up at the same sign, his face collapsing into horror. Wide low-angle shot looking up, identical framing to the opening shot.`,
    videoPrompt: "Static wide low-angle shot looking up at the sign, identical framing to the opening shot, his face collapses from relief into dawning horror as he realizes he never left, he does not move, hold.",
    duration: 5, usesCharacter: "aged", priority: 1,
  },
];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function statePath(name: string) { return `${OUT_DIR}/${name}.json`; }
function loadState(name: string): any { return existsSync(statePath(name)) ? JSON.parse(readFileSync(statePath(name), "utf8")) : null; }
function saveState(name: string, data: any) { writeFileSync(statePath(name), JSON.stringify(data, null, 2), "utf8"); }

async function getOwnerUser() {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, KEY_OWNER_PROJECT_ID) });
  if (!project) throw new Error("key-owner project not found");
  const user = await db.query.users.findFirst({ where: eq(users.id, project.userId) });
  if (!user) throw new Error("key-owner user not found");
  return user;
}
async function getSegmindKey() {
  const user = await getOwnerUser();
  const key = decrypt(user?.segmindApiKey ?? "");
  if (!key) throw new Error("no segmind key on project owner");
  return key;
}
async function getHiggsfieldKeys() {
  const user = await getOwnerUser();
  return { apiKey: decrypt(user?.higgsfieldApiKey ?? ""), apiSecret: decrypt(user?.higgsfieldApiSecret ?? "") };
}

async function stageBootstrap() {
  console.log("=== BOOTSTRAP: 3 Soul ID training reference images + kickoff training ===");
  const segmindKey = await getSegmindKey();
  const refPrompts = [
    `${CHARACTER_LOCK_YOUNG} Studio-clean portrait, front-facing, neutral background, clear even lighting on the face.`,
    `${CHARACTER_LOCK_YOUNG} Three-quarter angle portrait, neutral background, clear even lighting on the face.`,
    `${CHARACTER_LOCK_YOUNG} Profile portrait, neutral background, clear even lighting on the face.`,
  ];
  const refUrls: string[] = [];
  for (const [i, p] of refPrompts.entries()) {
    console.log(`  ref image ${i + 1}...`);
    const url = await generateSoulImage({ apiKey: segmindKey, prompt: p });
    console.log("   ", url);
    refUrls.push(url);
  }
  saveState("bootstrap-refs", { refUrls });

  const { apiKey: hfKey, apiSecret: hfSecret } = await getHiggsfieldKeys();
  if (!hfKey || !hfSecret) {
    console.log("  no higgsfield native keys on test account - skipping Soul ID training, will use text-lock + reference_image_url continuity only.");
    saveState("soul-id", { jobId: null, soulId: null });
    return;
  }
  try {
    const { jobId } = await trainSoulId({ apiKey: hfKey, apiSecret: hfSecret, characterName: "Horizon Loop - Young Man", referenceImageUrls: refUrls });
    console.log("  training kicked off:", jobId);
    saveState("soul-id", { jobId, soulId: null });
  } catch (e: any) {
    console.log("  Soul ID training failed to start (non-fatal, fail-open):", e.message);
    saveState("soul-id", { jobId: null, soulId: null });
  }
}

async function pollSoulIdIfPending() {
  const state = loadState("soul-id");
  if (!state?.jobId || state.soulId) return state?.soulId ?? null;
  const { apiKey: hfKey, apiSecret: hfSecret } = await getHiggsfieldKeys();
  console.log("  polling Soul ID training...");
  for (let i = 0; i < 8; i++) {
    const result = await pollSoulIdTraining({ apiKey: hfKey, apiSecret: hfSecret, jobId: state.jobId });
    console.log(`    ${result.status}`);
    if (result.status === "completed" && result.soulId) {
      saveState("soul-id", { jobId: state.jobId, soulId: result.soulId });
      return result.soulId;
    }
    if (result.status === "failed") { saveState("soul-id", { jobId: state.jobId, soulId: null, failed: true }); return null; }
    await sleep(15000);
  }
  console.log("  Soul ID still training after ~2min, proceeding with text-lock only (fail-open).");
  return null;
}

async function stageImages() {
  console.log("=== STAGE: generating 7 keyframe images ===");
  const segmindKey = await getSegmindKey();
  const soulId = await pollSoulIdIfPending();
  const bootstrap = loadState("bootstrap-refs");
  const referenceImageUrl = !soulId && bootstrap?.refUrls?.[0] ? bootstrap.refUrls[0] : undefined;

  const results: any[] = [];
  for (const shot of SHOTS) {
    console.log(`\n--- ${shot.id} (character: ${shot.usesCharacter}) ---`);
    const params: any = { apiKey: segmindKey, prompt: shot.imagePrompt };
    if (shot.usesCharacter !== "none") {
      if (soulId) params.soulId = soulId;
      else if (referenceImageUrl) params.referenceImageUrl = referenceImageUrl;
    }
    try {
      const url = await generateSoulImage(params);
      console.log("  image:", url);
      results.push({ ...shot, imageUrl: url });
    } catch (e: any) {
      console.log("  FAILED:", e.message);
      results.push({ ...shot, imageUrl: null, imageError: e.message });
    }
    saveState("shots-with-images", results);
  }
  return results;
}

async function stageVideos() {
  console.log("\n=== STAGE: animating shots (priority order, budget-aware) ===");
  const segmindKey = await getSegmindKey();
  let shots = loadState("shots-with-images");
  if (!shots) throw new Error("run 'images' stage first");

  const ordered = [...shots].sort((a, b) => a.priority - b.priority);
  const results = [...shots];

  for (const shot of ordered) {
    const idx = results.findIndex(s => s.id === shot.id);
    if (!shot.imageUrl) { console.log(`skip ${shot.id} - no image`); continue; }
    console.log(`\n--- animating ${shot.id} (priority ${shot.priority}) ---`);
    try {
      const { requestId, pollingUrl, mediaUrl: immediateUrl } = await generateTextVideo({
        apiKey: segmindKey,
        model: "hailuo",
        prompt: shot.videoPrompt,
        imageUrl: shot.imageUrl,
        duration: shot.duration,
      });
      let mediaUrl = immediateUrl;
      if (!mediaUrl && pollingUrl) {
        const start = Date.now();
        while (Date.now() - start < 240_000) {
          await sleep(7000);
          const poll = await pollJob({ apiKey: segmindKey, pollingUrl });
          console.log(`  poll: ${poll.status} (${Math.round((Date.now() - start) / 1000)}s)`);
          if (poll.status === "COMPLETED") { mediaUrl = poll.mediaUrl; break; }
          if (poll.status === "FAILED" || poll.status === "ERROR") throw new Error(poll.error ?? "generation failed");
        }
      }
      if (!mediaUrl) throw new Error("did not complete in time");
      results[idx] = { ...shot, videoUrl: mediaUrl };
      console.log("  video:", mediaUrl);

      const res = await fetch(mediaUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(`${OUT_DIR}/${shot.id}.mp4`, buf);
      console.log(`  saved ${buf.length} bytes`);
    } catch (e: any) {
      console.log(`  FAILED (${shot.id}):`, e.message);
      results[idx] = { ...shot, videoError: e.message };
      if (/insufficient|balance|credit|payment/i.test(e.message)) {
        console.log("\n*** BALANCE EXHAUSTED — stopping remaining shots, proceeding to stitch what we have. ***");
        saveState("shots-with-video", results);
        return results;
      }
    }
    saveState("shots-with-video", results);
    await sleep(3000);
  }
  return results;
}

async function stageStitch() {
  console.log("\n=== STAGE: stitching (real crossfade tool) ===");
  const shots = loadState("shots-with-video");
  if (!shots) throw new Error("run 'videos' stage first");
  // Original narrative order (not priority order) for the final cut.
  const ordered = SHOTS.map(s => shots.find((r: any) => r.id === s.id)).filter((s: any) => s?.videoUrl);
  console.log(`${ordered.length}/${SHOTS.length} shots have video, stitching those in narrative order:`, ordered.map((s: any) => s.id));
  if (ordered.length < 2) { console.log("fewer than 2 clips - nothing to crossfade, skipping stitch."); return; }

  const localPaths = ordered.map((s: any) => resolvePath(`${OUT_DIR}/${s.id}.mp4`));
  const outputPath = resolvePath(`${OUT_DIR}/horizon-line-loop-FINAL.mp4`);
  await concatVideosWithCrossfade(localPaths, outputPath, 0.4);
  console.log("saved:", outputPath);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const stage = process.argv[2] || "all";
  if (stage === "bootstrap" || stage === "all") await stageBootstrap();
  if (stage === "images" || stage === "all") await stageImages();
  if (stage === "videos" || stage === "all") await stageVideos();
  if (stage === "stitch" || stage === "all") await stageStitch();
  console.log("\nDone.", OUT_DIR);
}
main().then(() => process.exit(0)).catch(e => { console.error("FAILED:", e); process.exit(1); });
