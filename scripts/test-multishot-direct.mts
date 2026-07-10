/**
 * Real-money test A (item 68/69's plan, Task 3 verification): calls the real
 * generateTextVideo() with multiShotPrompt directly (bypassing the flaky
 * Turbopack dev-server route layer, which is timing out/404ing on this
 * OneDrive-synced slow filesystem — confirmed via dev-server log showing
 * "Slow filesystem detected" + 3.6min Next.js-internal compile stalls).
 * Exercises the exact same real product function the route calls, just
 * without going through HTTP/Next routing.
 *
 * Horizon Line Scene 1, 3 real shots (from generate-package's actual Director
 * output, item 69's live verification). Segmind budget only.
 *
 * Usage: npx tsx scripts/test-multishot-direct.mts
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const { generateTextVideo, pollJob } = await import("../src/lib/higgsfield/client");
import { decrypt } from "../src/lib/crypto";
import { db } from "../src/db";
import { users, projects, productionShots } from "../src/db/schema";
import { eq, and } from "drizzle-orm";

const PROJECT_ID = "4a365d59-e102-4b13-aeea-f570b8758a06";
const SCENE_NUMBER = 1;
const OUT_DIR = "outputtestresults/output-test-2/horizon-multishot-comparison";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function buildMultiShotScript(sceneShots: any[]): string {
  return sceneShots
    .map((shot, i) => `Shot ${i + 1}: ${shot.videoPrompt || shot.soulPrompt || shot.action || ""}`)
    .join(" ");
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const project = await db.query.projects.findFirst({ where: eq(projects.id, PROJECT_ID) });
  if (!project) throw new Error("project not found");
  const user = await db.query.users.findFirst({ where: eq(users.id, project.userId) });
  const segmindKey = decrypt(user?.segmindApiKey ?? "");
  if (!segmindKey) throw new Error("no segmind key on project owner");

  const sceneShots = await db.query.productionShots.findMany({
    where: and(eq(productionShots.projectId, PROJECT_ID), eq(productionShots.sceneNumber, SCENE_NUMBER)),
    with: { primaryCharacter: true },
    orderBy: (sh, { asc }) => [asc(sh.sortOrder), asc(sh.shotNumber)],
  });
  console.log(`Found ${sceneShots.length} real shots in Scene ${SCENE_NUMBER}`);
  if (sceneShots.length === 0) throw new Error("no shots found");

  const sceneWideReferenceImages = Array.from(new Set(
    sceneShots.map((sh: any) => sh.primaryCharacter?.portraitUrl).filter((u: any): u is string => !!u)
  )).slice(0, 9) as string[];

  const multiShotPrompt = buildMultiShotScript(sceneShots);
  console.log("\n--- multiShotPrompt ---\n" + multiShotPrompt + "\n-----------------------\n");
  writeFileSync(`${OUT_DIR}/multishot-prompt-used.txt`, multiShotPrompt, "utf8");

  console.log("Submitting real Seedance multi-shot call...");
  const { requestId, pollingUrl, mediaUrl: immediateUrl } = await generateTextVideo({
    apiKey: segmindKey,
    model: "seedance",
    multiShotPrompt,
    referenceImages: sceneWideReferenceImages,
  });
  console.log("submit response:", { requestId, pollingUrl, immediateUrl });

  let mediaUrl = immediateUrl;
  if (!mediaUrl && pollingUrl) {
    const start = Date.now();
    while (Date.now() - start < 240_000) {
      await sleep(7000);
      const poll = await pollJob({ apiKey: segmindKey, pollingUrl });
      console.log(`  poll: ${poll.status} (${Math.round((Date.now() - start) / 1000)}s)`);
      if (poll.status === "COMPLETED") { mediaUrl = poll.mediaUrl; break; }
      if (poll.status === "FAILED" || poll.status === "ERROR") {
        throw new Error(`multi-shot generation failed: ${poll.error}`);
      }
    }
  }

  if (!mediaUrl) throw new Error("multi-shot generation did not complete in time");
  console.log("\nFINAL mediaUrl:", mediaUrl);
  writeFileSync(`${OUT_DIR}/multishot-result.json`, JSON.stringify({ mediaUrl, requestId }, null, 2), "utf8");

  const videoRes = await fetch(mediaUrl);
  const buf = Buffer.from(await videoRes.arrayBuffer());
  writeFileSync(`${OUT_DIR}/horizon-scene1-MULTISHOT-SEEDANCE.mp4`, buf);
  console.log(`Saved ${buf.length} bytes to ${OUT_DIR}/horizon-scene1-MULTISHOT-SEEDANCE.mp4`);
}

main().then(() => process.exit(0)).catch(e => { console.error("FAILED:", e); process.exit(1); });
