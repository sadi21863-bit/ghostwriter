/**
 * "The Horizon Line" redo — correcting the same class of mistake as the
 * Dealer redo: every prior Output Test 2 track used an invented "Dr. Elena
 * Marsh / The Warden" black-hole sci-fi premise instead of reading the real
 * source PDF ("Project Horizon_ Research and Story Adaptation.pdf"), which is
 * actually "The Ride Never Ends" — a horror adaptation of the "Mr. Bones'
 * Wild Ride" internet meme: a grieving widower (Arthur) boards a luxury
 * observation coaster that takes exactly 4 years to complete one circuit,
 * with no conductor, no brakes, and an "exit" corridor that loops directly
 * back into the boarding queue.
 *
 * Usage: node scripts/output-test-2-horizon-redo.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const OUT_DIR = join(process.cwd(), "outputtestresults", "output-test-2", "horizon-redo");
mkdirSync(join(OUT_DIR, "mode-sweep"), { recursive: true });

const PROTAGONIST = {
  name: "Arthur",
  role: "protagonist",
  personality: "quiet, grieving, retreats inward under pressure, methodical",
  desires: "wanted to disappear for a little while after his wife's death; now wants only to survive the track and reach the platform",
};
const SECONDARY = {
  name: "Maya",
  role: "supporting",
  personality: "sharp, analytical, keeps herself sane by measuring and tracking their reality",
  desires: "to understand the ride's exact mechanics — the track length, the timeline — as a way of keeping hope calculable rather than desperate",
};
const LOCATION = {
  name: "The Horizon Line",
  description: "A luxury ultra-long-distance observation coaster inside a concrete dome so massive it generates its own weather. Thirty velvet-upholstered cars carrying 300 passengers, each car with a rations pantry and water filtration unit. No conductor, no emergency brakes, elevated sixty feet above an artificial landscape of painted skies that never change. A cheerful synthesized voice speaks through track speakers.",
};

const STATIC_CONTEXT = [
  "CHARACTERS:",
  `- ${PROTAGONIST.name} (${PROTAGONIST.role}): ${PROTAGONIST.personality}. Wants: ${PROTAGONIST.desires}. His wife died a year before boarding.`,
  `- ${SECONDARY.name} (${SECONDARY.role}): ${SECONDARY.personality}. Wants: ${SECONDARY.desires}. Rides in Car 14 alongside Arthur; keeps a tally of days scratched into the velvet wall.`,
  "",
  "WORLD RULES:",
  `- ${LOCATION.name}: ${LOCATION.description}`,
  "- The ride moves at a gentle 9 miles per hour around a 9,000-meter circuit inside the dome — a fixed, calculable 4 years (1,460 days) per full loop, confirmed by track-length math, not guesswork.",
  "- Every midnight, a hatch in the car floor dispenses bland nutrient-dense protein blocks and distilled water. The ride does not want passengers to die — only to stay.",
  "- The intercom periodically announces: 'We hope you are enjoying your journey. Current guest satisfaction rating: Excellent.'",
  "- The twist: after 4 years, passengers reach the platform and disembark through a corridor lined with plastic skeleton props — which does not lead outside. It loops directly back into the boarding queue for the same train (Car 14, empty, waiting). A giant sign reads THE RIDE NEVER ENDS. An automated wall seals the exit corridor the instant the truth is visible.",
].join("\n");

const INTRO = "Arthur boarded The Horizon Line a year after his wife died, wanting only to disappear for an afternoon. The brochure promised a tranquil, scenic coaster ride through an engineered paradise. What he and 299 other passengers discover, car by car, is that the ride takes exactly four years to complete a single circuit — and that reaching the platform does not mean reaching the exit.";

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
  let json; try { json = JSON.parse(text); } catch { json = text.slice(0, 1000); }
  return { status: res.status, json };
}
function save(name, data) {
  writeFileSync(join(OUT_DIR, "mode-sweep", name), typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
}
async function generateWithConfirm(body) {
  const first = await req("/api/ai/generate", { method: "POST", body: JSON.stringify(body) });
  if (first.json?.requiresConfirmation) {
    console.log(`  [violation gate fired: ${first.json.violationType} — confirming through]`);
    return req("/api/ai/generate", { method: "POST", body: JSON.stringify({ ...body, bypassViolationCheck: true }) });
  }
  return first;
}

const MODES = [
  "brainstorm", "outline", "write", "dialogue", "combat", "emotional", "atmosphere", "tension",
  "composition", "horror", "comedy", "mystery", "romance", "action", "monologue", "voice",
  "thriller", "sports", "setting", "historical", "scitech", "ethics", "endings", "isekai",
  "interrogation", "chase",
];

async function main() {
  const { json: csrf } = await req("/api/auth/csrf");
  const signIn = await fetch(BASE + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...(cookies ? { Cookie: cookies } : {}) },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: EMAIL, password: PASSWORD, redirect: "false", callbackUrl: "/dashboard", json: "true" }),
    redirect: "manual",
  });
  captureCookies(signIn);
  console.log("sign-in status:", signIn.status);

  const { json: project } = await req("/api/projects", { method: "POST", body: JSON.stringify({ name: "The Horizon Line (corrected premise)", format: "Novel" }) });
  console.log("project:", project.id);

  const { json: protag } = await req(`/api/projects/${project.id}/characters`, { method: "POST", body: JSON.stringify(PROTAGONIST) });
  const { json: secondary } = await req(`/api/projects/${project.id}/characters`, { method: "POST", body: JSON.stringify(SECONDARY) });
  await req(`/api/projects/${project.id}/locations`, { method: "POST", body: JSON.stringify(LOCATION) });
  console.log("protagonist:", protag.id, "secondary:", secondary.id);

  writeFileSync(join(OUT_DIR, "project-info.json"), JSON.stringify({ projectId: project.id, protagonistId: protag.id, secondaryId: secondary.id }, null, 2), "utf8");

  let succeeded = 0, failed = [];
  let totalTokens = 0;
  for (const mode of MODES) {
    process.stdout.write(`  ${mode} ... `);
    const { json, status } = await generateWithConfirm({
      mode, prompt: `Premise: ${INTRO}\n\nWrite a scene in this story using this mode's specialty.`,
      context: "", staticContext: STATIC_CONTEXT, dynamicContext: "", format: "Novel", projectId: project.id,
    });
    if (status === 200 && json.text) {
      succeeded++;
      totalTokens += json.tokensUsed ?? 0;
      save(`the-horizon-redo-${mode}.json`, json);
      console.log(`status=200 chars=${json.text.length} tokens=${json.tokensUsed}`);
    } else {
      failed.push({ mode, status, error: JSON.stringify(json).slice(0, 200) });
      console.log(`status=${status} FAILED`);
    }
  }

  console.log(`\n${succeeded}/${MODES.length} succeeded, ${totalTokens} total tokens`);
  if (failed.length) console.log("FAILURES:", failed.map(f => `${f.mode}: ${f.status}`).join(", "));
  writeFileSync(join(OUT_DIR, "mode-sweep-SUMMARY.json"), JSON.stringify({ succeeded, total: MODES.length, totalTokens, failed }, null, 2), "utf8");
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
