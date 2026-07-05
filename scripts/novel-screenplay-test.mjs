/**
 * Real-content test: outline + chapters + Director/Editor tools, for both
 * Novel and Screenplay formats, same premise, using the disposable
 * ghostwriter-test-runner account. Saves every raw response so quality can be
 * assessed by reading actual output, not by assuming success from HTTP 200s.
 * Usage: node scripts/novel-screenplay-test.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const OUT_DIR = join(process.cwd(), "outputtestresults", "novel-screenplay-test");
mkdirSync(OUT_DIR, { recursive: true });

let cookies = "";
function captureCookies(res) {
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const pair = c.split(";")[0];
    const name = pair.split("=")[0];
    cookies = cookies.split("; ").filter(kv => !kv.startsWith(name + "=")).concat(pair).filter(Boolean).join("; ");
  }
}
async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(cookies ? { Cookie: cookies } : {}), ...(opts.headers || {}) },
  });
  captureCookies(res);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

function save(name, data) {
  writeFileSync(join(OUT_DIR, name), typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
}

const PREMISE = `A forensic accountant named Priya Nair discovers that the shell companies she's been auditing for a routine compliance job are laundering money for the city council member who's about to become her sister's father-in-law. She has three days before the wedding to decide whether to expose it.`;

async function generateProject(format) {
  console.log(`\n=== ${format} ===`);

  // 1. Create project
  const { json: project } = await req("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: `The Ledger (${format})`, format }),
  });
  console.log("project:", project.id);

  // 2. Outline
  const outlinePrompt = `Premise: ${PREMISE}\n\nOutline the first act.`;
  const { json: outlineRes } = await req("/api/ai/generate", {
    method: "POST",
    body: JSON.stringify({ mode: "outline", prompt: outlinePrompt, context: "", format, projectId: project.id }),
  });
  save(`${format}-outline.json`, outlineRes);
  console.log("outline generated:", outlineRes.text?.length ?? 0, "chars");

  // 3. Three chapters, each continuing from the last
  let priorContent = "";
  const chapterIds = [];
  for (let i = 1; i <= 3; i++) {
    const { json: chapter } = await req(`/api/projects/${project.id}/chapters`, {
      method: "POST",
      body: JSON.stringify({ title: `Chapter ${i}` }),
    });
    chapterIds.push(chapter.id);

    const prompt = i === 1
      ? `Premise: ${PREMISE}\n\nOutline so far:\n${outlineRes.text}\n\nWrite chapter 1: open on Priya at work, discovering the first anomaly in the shell company records.`
      : `Continue the story. Previous chapter ended:\n${priorContent.slice(-1500)}\n\nWrite chapter ${i}, advancing the plot.`;

    const { json: writeRes } = await req("/api/ai/generate", {
      method: "POST",
      body: JSON.stringify({ mode: "write", prompt, context: "", format, projectId: project.id, chapterId: chapter.id }),
    });
    save(`${format}-chapter${i}.json`, writeRes);
    priorContent = writeRes.text ?? "";
    console.log(`chapter ${i} generated:`, priorContent.length, "chars");

    await req(`/api/projects/${project.id}/chapters/${chapter.id}`, {
      method: "PATCH",
      body: JSON.stringify({ content: priorContent }),
    });
  }

  // 4. Director tool: villain-pov (needs a character)
  const { json: character } = await req(`/api/projects/${project.id}/characters`, {
    method: "POST",
    body: JSON.stringify({ name: "Councilman Reyes", role: "antagonist", antagonistType: "Machiavellian" }),
  });
  const { json: villainRes } = await req(`/api/projects/${project.id}/villain-pov`, {
    method: "POST",
    body: JSON.stringify({ characterId: character.id, sceneDescription: "Reyes learns Priya has found the shell company records, the night before the wedding." }),
  });
  save(`${format}-villain-pov.json`, villainRes);
  console.log("villain-pov generated:", villainRes.text?.length ?? 0, "chars");

  // 5. Director tool: tension-curve (needs 2+ chapters with content, already have 3)
  const { json: tensionRes } = await req(`/api/projects/${project.id}/tension-curve`, { method: "POST" });
  save(`${format}-tension-curve.json`, tensionRes);
  console.log("tension-curve:", tensionRes.scores ? `${tensionRes.scores.length} chapters scored` : JSON.stringify(tensionRes).slice(0, 200));

  // 6. Editor tool: refine, on chapter 1
  const { json: refineRes } = await req("/api/ai/refine", {
    method: "POST",
    body: JSON.stringify({ text: (await req(`/api/projects/${project.id}/chapters/${chapterIds[0]}`)).json?.content ?? "", format, projectId: project.id, chapterId: chapterIds[0] }),
  });
  save(`${format}-refine.json`, refineRes);
  console.log("refine generated:", refineRes.text?.length ?? 0, "chars");

  return { projectId: project.id };
}

async function main() {
  // Sign in
  const { json: csrf } = await req("/api/auth/csrf");
  const signIn = await fetch(BASE + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...(cookies ? { Cookie: cookies } : {}) },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: EMAIL, password: PASSWORD, redirect: "false", callbackUrl: "/dashboard", json: "true" }),
    redirect: "manual",
  });
  captureCookies(signIn);
  console.log("sign-in status:", signIn.status);

  const novelResult = await generateProject("Novel");
  const screenplayResult = await generateProject("Screenplay");

  save("summary.json", { novel: novelResult, screenplay: screenplayResult, premise: PREMISE });
  console.log("\nAll output saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
