/**
 * Real-money test B (other half of the multi-shot vs per-shot comparison):
 * same real Horizon Line Scene 1 shots, rendered via the per-shot CINE-LOCK
 * path (Soul image keyframe -> Hailuo image-to-video), calling the exact
 * real product functions from src/lib/higgsfield/client.ts directly.
 *
 * CORRECTION vs. the first draft of this script: everything in this codebase
 * except trainSoulId/pollSoulIdTraining (Soul ID training only) is proxied
 * through Segmind (api.segmind.com) using the Segmind API key, NOT native
 * platform.higgsfield.ai with hf-api-key/hf-secret — confirmed by reading
 * client.ts directly (SEGMIND_BASE constant, every generateSoulImage/
 * generateTextVideo/generateDoPVideo call target it). The original script's
 * "https://platform.higgsfield.ai/higgsfield-ai/soul/cinema" and
 * ".../minimax/hailuo-02" endpoints do not exist for generation and were
 * never going to work. This means test A and test B both draw from the SAME
 * Segmind balance — there is no separate "Higgsfield credits" pool for
 * actual video generation in this codebase (Higgsfield credits only cover
 * Soul ID training, which this test doesn't use).
 *
 * Usage: npx tsx scripts/test-pershot-direct.mts
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const { generateSoulImage, generateTextVideo, pollJob } = await import("../src/lib/higgsfield/client");
const { decrypt } = await import("../src/lib/crypto");
const { db } = await import("../src/db");
const { users, projects, productionShots } = await import("../src/db/schema");
const { eq, and } = await import("drizzle-orm");

const PROJECT_ID = "4a365d59-e102-4b13-aeea-f570b8758a06";
const SCENE_NUMBER = 1;
const OUT_DIR = "outputtestresults/output-test-2/horizon-multishot-comparison/pershot-direct";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function pollUntilDone(apiKey: string, pollingUrl: string, maxMs = 240_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await sleep(7000);
    const poll = await pollJob({ apiKey, pollingUrl });
    console.log(`    poll: ${poll.status} (${Math.round((Date.now() - start) / 1000)}s)`);
    if (poll.status === "COMPLETED") return poll.mediaUrl;
    if (poll.status === "FAILED" || poll.status === "ERROR") throw new Error(poll.error ?? "generation failed");
  }
  throw new Error("timed out");
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const project = await db.query.projects.findFirst({ where: eq(projects.id, PROJECT_ID) });
  if (!project) throw new Error("project not found");
  const user = await db.query.users.findFirst({ where: eq(users.id, project.userId) });
  const segmindKey = decrypt(user?.segmindApiKey ?? "");
  if (!segmindKey) throw new Error("no segmind key");

  const sceneShots = await db.query.productionShots.findMany({
    where: and(eq(productionShots.projectId, PROJECT_ID), eq(productionShots.sceneNumber, SCENE_NUMBER)),
    orderBy: (sh, { asc }) => [asc(sh.sortOrder), asc(sh.shotNumber)],
  });
  console.log(`Found ${sceneShots.length} real shots`);

  const results: any[] = [];
  for (const [i, shot] of sceneShots.entries()) {
    console.log(`\n--- shot ${i + 1}: ${(shot.soulPrompt || "").slice(0, 80)}...`);

    console.log("  generating keyframe image (Soul)...");
    const imageUrl = await generateSoulImage({ apiKey: segmindKey, prompt: shot.soulPrompt || "" });
    console.log("  image:", imageUrl);

    console.log("  animating (Hailuo image-to-video)...");
    const { pollingUrl, mediaUrl: immediateUrl } = await generateTextVideo({
      apiKey: segmindKey,
      model: "hailuo",
      prompt: shot.videoPrompt || shot.soulPrompt || "",
      imageUrl,
      duration: 6,
    });
    let videoUrl = immediateUrl;
    if (!videoUrl && pollingUrl) videoUrl = await pollUntilDone(segmindKey, pollingUrl);
    console.log("  video:", videoUrl);

    results.push({ shotNumber: shot.shotNumber, imageUrl, videoUrl });
    writeFileSync(`${OUT_DIR}/results.json`, JSON.stringify(results, null, 2), "utf8");

    if (videoUrl) {
      const res = await fetch(videoUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(`${OUT_DIR}/shot-${shot.shotNumber}.mp4`, buf);
      console.log(`  saved ${buf.length} bytes`);
    }
  }

  console.log("\nDone.", OUT_DIR);
}

main().then(() => process.exit(0)).catch(e => { console.error("FAILED:", e); process.exit(1); });
