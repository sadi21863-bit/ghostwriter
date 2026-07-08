/**
 * Output Test 2: "The Dealer" redo using the REAL source premise from
 * outputtestresults/output-test-1/test stories material/Midwest Armaments_
 * Story Bible & Creative Concept V2.pdf -- the original Track A/B/C work used
 * an invented, unrelated arms-dealer-family premise (Mara Voss vs Kessler)
 * because the actual source material was never read before this redo.
 *
 * Real premise: Weapon Clans bonded via Kinetic Bonding/The Resonance to one
 * weapon class each. The protagonist ("The Dealer") is the sole survivor of
 * the annihilated Colt Clan (guns) branch family, psychologically blocked
 * from firearms ("The Trigger Phantom"), who channels his kinetic gift into
 * playing cards instead -- a Soft Deck (paper, for misdirection/slicing) and
 * a Hard Deck (tungsten/titanium alloy, for piercing). Real documented
 * biomechanics: laminar zero-drag airflow via kinetic aura, 15,000+ RPM
 * gyroscopic spin, a grounding-whip-terminal-release kinetic chain via a
 * "Thurston Grip", 400+ m/s velocities. Named trick shots: Ricochet Cascade,
 * Iron Shield, Deck Flash, Card Splitter, Boomerang Loop. Antagonist: Roland
 * Colt, the Colt Clan Patriarch who betrayed the branch family ("The King of
 * Spades" in the Dead Man's Hand target structure).
 *
 * Runs Track A's 26-mode sweep against this corrected premise only (Horizon
 * Line is untouched -- its premise was never in question).
 *
 * Usage: node scripts/output-test-2-dealer-redo.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const OUT_DIR = join(process.cwd(), "outputtestresults", "output-test-2", "dealer-redo");
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(join(OUT_DIR, "mode-sweep"), { recursive: true });

const STATIC_CONTEXT = [
  "CHARACTERS:",
  "- The Dealer (protagonist): sole survivor of the Colt Clan's annihilated branch family. Silent, controlled, methodical. Suffers from the Trigger Phantom -- a psychological/mystical block that paralyzes him if he tries to hold a firearm, born from witnessing his family's massacre. Channels his inherited Kinetic Bonding gift (The Resonance) into playing cards instead of guns: a Soft Deck (ordinary paper cards, kinetically stiffened to diamond-hardness in flight, reverting to paper on impact -- used for misdirection, blinding, slicing soft tissue) and a Hard Deck (custom tungsten-carbide/titanium alloy cards -- heavy artillery, piercing concrete and armor, or spun into a defensive orbital shield). Wants: systematic vengeance against everyone responsible for his family's annihilation, following a self-imposed 'Dead Man's Hand' structure -- each target assigned a card rank (Jacks = the four executioners, Queens = political conspirators, Kings = Clan Patriarchs), left physically on the body.",
  "- Roland Colt (antagonist), card designation 'The King of Spades': Patriarch of the main Colt Clan (the gun lineage). Controlled, self-preserving, politically ruthless. Orchestrated the betrayal of the branch family to a coalition of rival clans to protect his own position, then was immediately double-crossed by that same coalition, which wiped out the whole lineage anyway. Wants: to keep his role in the massacre buried and his remaining power intact.",
  "",
  "WORLD RULES:",
  "- Governance in this Midwest belongs to secretive Weapon Clans, each biologically/mystically bonded via Kinetic Bonding (an internal energy called The Resonance) to a single weapon class, ignoring normal physical constraints like drag, friction, and structural integrity.",
  "- The Colt Clan (firearms) mastered Inertial Amplification -- externally accelerating a bullet's kinetic energy without more gunpowder -- a runaway evolutionary leap that made rival clans annihilate the branch family that discovered it.",
  "- The Dealer's card-throwing is a documented, precise biomechanical system, not vague magic: kinetic aura forces a perfectly laminar, zero-drag boundary layer around the card in flight; a customized grip imparts 15,000+ RPM gyroscopic spin, producing gyroscopic stiffness that locks the card's trajectory and, on impact with a metal card, an intense mechanical sawing action; the throw itself is a full kinetic chain -- grounding through the calves and hips, a shoulder-anchored elbow whip, and a wrist-driven terminal release using a modified Thurston Grip -- reaching muzzle velocities exceeding 400 meters per second.",
  "- Named trick shots in his repertoire: the Ricochet Cascade (a Hard Deck card bounced off multiple steel surfaces to bypass cover), the Iron Shield (up to six Hard Deck cards held in a high-speed defensive orbit around his torso), the Deck Flash (an entire 52-card Soft Deck released at once in a shotgun-spread arc), the Card Splitter (a Hard Deck card fractures armor a microsecond before a Soft Deck card follows the same path through the crack), and the Boomerang Loop (a steep-arc throw that clears an obstacle, strikes from behind, and loops back into his sleeve, erasing the throw's origin).",
].join("\n");

const INTRO = "The Dealer -- the last of the Colt Clan's annihilated branch family, unable to touch a firearm since the night his family died -- has spent years hunting down everyone responsible, marking each target with a card from a self-assigned Dead Man's Hand. Roland Colt, the King of Spades, the Patriarch who sold out the branch family and was betrayed in turn by the coalition he sold them to, is the last King left on the list.";

const MODE_PROMPTS = {
  brainstorm: "Brainstorm three different directions the next scene could take.",
  outline: "Outline the next three story beats.",
  write: "Write the next scene, continuing directly from where the story left off.",
  dialogue: "Write a tense dialogue exchange between The Dealer and Roland Colt.",
  combat: "Write a scene where The Dealer uses his card-throwing techniques against a group of Roland Colt's enforcers.",
  emotional: "Write a scene where The Dealer confronts a memory of the night his family was annihilated.",
  atmosphere: "Describe an abandoned Detroit auto factory in vivid, multi-sensory detail as The Dealer moves through it.",
  tension: "Write a suspenseful scene where The Dealer realizes Roland Colt's people are already waiting for him.",
  composition: "Write a scene where dread and the abandoned factory's atmosphere operate together as The Dealer stalks a target alone at night.",
  horror: "Write a scene where The Dealer realizes something about the massacre of his family was worse than he understood.",
  comedy: "Write a comedic beat of dry, deadpan banter between The Dealer and an underground contact.",
  mystery: "Write a scene where The Dealer discovers a clue that reframes who really orchestrated his family's annihilation.",
  romance: "Write a moment of unexpected, guarded connection between The Dealer and someone who doesn't know who he really is.",
  action: "Write a high-stakes chase scene through the Chicago Industrial Corridor as The Dealer evades a Weapon Clan patrol.",
  monologue: "Write The Dealer's internal monologue as he prepares to mark another card for the Dead Man's Hand.",
  voice: "Write an opening paragraph that establishes The Dealer's distinct, watchful narrative voice.",
  thriller: "Write a scene where The Dealer realizes Roland Colt knows he is being hunted and has already moved.",
  sports: "Write a scene involving a tense, competitive card game The Dealer uses as cover in an underground casino.",
  setting: "Describe the Chicago Industrial Corridor as The Dealer first arrives there.",
  historical: "Write a scene that incorporates a real historical detail about American Rust Belt industrial decline relevant to this world.",
  scitech: "Write a scene explaining the aerodynamic and gyroscopic physics that let The Dealer's kinetically-charged cards fly true.",
  ethics: "Write a scene where The Dealer faces a genuine ethical dilemma about how far his vengeance should go.",
  endings: "Write a possible ending for this story.",
  isekai: "Write a scene where a character is unexpectedly transported into a wholly unfamiliar world.",
  interrogation: "Write an interrogation scene between The Dealer and one of Roland Colt's lieutenants.",
  chase: "Write a tense pursuit scene through the Colt Clan's industrial territory.",
};

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
function save(subdir, name, data) {
  writeFileSync(join(OUT_DIR, subdir, name), typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
}
async function generateWithConfirm(body) {
  const first = await req("/api/ai/generate", { method: "POST", body: JSON.stringify(body) });
  if (first.json?.requiresConfirmation) {
    console.log(`  [violation gate fired: ${first.json.violationType} -- confirming through]`);
    return req("/api/ai/generate", { method: "POST", body: JSON.stringify({ ...body, bypassViolationCheck: true }) });
  }
  return first;
}

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

  const { json: project } = await req("/api/projects", { method: "POST", body: JSON.stringify({ name: "The Dealer (corrected premise)", format: "Novel" }) });
  const projectId = project.id;
  console.log("project:", projectId);

  const { json: protagonist } = await req(`/api/projects/${projectId}/characters`, {
    method: "POST",
    body: JSON.stringify({ name: "The Dealer", role: "protagonist", personality: "silent, controlled, methodical, haunted by the Trigger Phantom", desires: "systematic vengeance against everyone responsible for his family's annihilation, following his own Dead Man's Hand structure" }),
  });
  const { json: antagonist } = await req(`/api/projects/${projectId}/characters`, {
    method: "POST",
    body: JSON.stringify({ name: "Roland Colt", role: "antagonist", personality: "controlled, self-preserving, politically ruthless", desires: "keep his role in the massacre buried and his remaining power intact" }),
  });
  await req(`/api/projects/${projectId}/locations`, {
    method: "POST",
    body: JSON.stringify({ name: "The Foundry", description: "An abandoned Detroit auto factory, rusted assembly lines and broken skylights, the Colt Clan's old muscle still using it as a meeting ground." }),
  });
  console.log("protagonist:", protagonist.id, "antagonist:", antagonist.id);
  save(".", "project-info.json", { projectId, protagonistId: protagonist.id, antagonistId: antagonist.id });

  const results = [];
  let totalTokens = 0;
  for (const [mode, prompt] of Object.entries(MODE_PROMPTS)) {
    process.stdout.write(`  ${mode} ... `);
    const { status, json } = await generateWithConfirm({
      mode, prompt: `Premise: ${INTRO}\n\n${prompt}`, context: "",
      staticContext: STATIC_CONTEXT, dynamicContext: "",
      format: "Novel", projectId,
    });
    save("mode-sweep", `the-dealer-redo-${mode}.json`, json);
    const tokens = json?.tokensUsed ?? 0;
    totalTokens += tokens;
    const textLen = json?.text?.length ?? 0;
    console.log(`status=${status} chars=${textLen} tokens=${tokens}`);
    results.push({ mode, status, textLen, tokens });
  }

  const failures = results.filter(r => r.status !== 200);
  save(".", "mode-sweep-SUMMARY.json", { projectId, totalTokens, results, failCount: failures.length });
  console.log(`\n${results.length - failures.length}/${results.length} succeeded, ${totalTokens} total tokens`);
  if (failures.length) console.log("FAILURES:", failures.map(f => `${f.mode}: ${f.status}`).join(", "));
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
