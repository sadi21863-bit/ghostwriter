/**
 * The missing "AI Editor" pass for the Horizon Line short film. Prior stage
 * (horizon-short-film-segmind.mjs) went straight from Writer/Director-generated
 * shots to a raw ffmpeg concat with zero review - not actually exercising the
 * Director/Writer/Editor combination the user asked for. This runs the REAL
 * product Editor logic (critiqueShot/scoreShot/nextLoopAction from
 * src/lib/production/vision-critic.ts + self-eval.ts - the same code a real
 * user's Production Studio self-eval loop would use) against all 18 real
 * generated keyframes: prompt adherence, continuity with the previous shot,
 * technical quality, etc. Produces a real editorial report BEFORE stitching -
 * flags weak/discontinuous shots instead of blindly concatenating everything.
 *
 * Usage: npx tsx scripts/horizon-short-film-editor-review.ts
 */
import { readFileSync, writeFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}

import { critiqueShot } from "../src/lib/production/vision-critic";
import { scoreShot, nextLoopAction, type ShotScore } from "../src/lib/production/self-eval";

const OUT_DIR = "outputtestresults/canvas-void-test/horizon-film";

interface ShotWithVideo {
  sceneNumber: number;
  shotNumber: number;
  subject: string;
  soulPrompt: string;
  videoPrompt: string;
  label: string;
  imageUrl: string;
  videoUrl: string | null;
}

async function main() {
  const shots: ShotWithVideo[] = JSON.parse(
    readFileSync(`${OUT_DIR}/shots-with-video-segmind.json`, "utf8")
  );
  // Sort into real story order (scene, then shot) - the JSON is in completion
  // order (resume-skipped shots first), not narrative order.
  shots.sort((a, b) => a.sceneNumber - b.sceneNumber || a.shotNumber - b.shotNumber);

  console.log(`=== EDITOR REVIEW: ${shots.length} shots ===\n`);

  const reviews: Array<{ label: string; subject: string; score: ShotScore; action: string }> = [];
  let prevImageUrl: string | undefined;

  for (const shot of shots) {
    if (!shot.imageUrl) {
      console.log(`--- ${shot.label} (${shot.subject}) --- SKIPPED (no image)`);
      prevImageUrl = undefined;
      continue;
    }
    console.log(`--- ${shot.label} (${shot.subject}) ---`);
    const raw = await critiqueShot({
      imageUrl: shot.imageUrl,
      prompt: `${shot.soulPrompt}\n\nIntended motion for the animated clip: ${shot.videoPrompt}`,
      previousShotImageUrl: prevImageUrl,
    });
    const score = scoreShot(raw);
    const action = nextLoopAction(score, 1, { threshold: 0.7, maxAttempts: 1 }); // 1 attempt budget = we're not re-rendering, just flagging
    reviews.push({ label: shot.label, subject: shot.subject, score, action });
    console.log(
      `  overall=${score.overall.toFixed(2)} weakest=${score.weakest}(${score.dims[score.weakest].toFixed(2)}) -> ${action}`
    );
    console.log(`  dims: ${JSON.stringify(score.dims)}`);
    prevImageUrl = shot.imageUrl;
  }

  const flagged = reviews.filter(r => r.action !== "accept");
  const avgOverall = reviews.reduce((s, r) => s + r.score.overall, 0) / reviews.length;

  console.log(`\n=== EDITOR'S CUT REPORT ===`);
  console.log(`Average shot score: ${avgOverall.toFixed(2)}`);
  console.log(`Shots below 0.7 threshold: ${flagged.length}/${reviews.length}`);
  for (const f of flagged) {
    console.log(`  FLAGGED ${f.label} (${f.subject}): overall=${f.score.overall.toFixed(2)}, weakest=${f.score.weakest}`);
  }

  writeFileSync(
    `${OUT_DIR}/editor-review.json`,
    JSON.stringify({ reviews, avgOverall, flaggedCount: flagged.length }, null, 2),
    "utf8"
  );
  console.log(`\nSaved: ${OUT_DIR}/editor-review.json`);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
