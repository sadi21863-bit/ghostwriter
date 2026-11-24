/**
 * Verifies src/lib/ai/library-handlers.ts renders byte-identical strings to the
 * wrappers it replaced in useGeneration.ts (read from git HEAD). Run with:
 *   npx tsx scripts/verify-library-handlers.mts
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { LIBRARY_HANDLERS } from "../src/lib/ai/library-handlers";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const orig = execSync("git show HEAD:src/hooks/useGeneration.ts", { cwd: ROOT, encoding: "utf8" });

const VALUES: Record<string, string> = {
  archetypeName: "SlowDread",
  styleA: "Boxing",
  styleB: "Krav Maga",
  environmentName: "Rain",
  emotionName: "Grief",
  tensionType: "SlowBurn",
  profileName: "Detective",
};

/** Render an original template by evaluating its expressions against VALUES. */
function renderOriginal(t: string): string {
  return t.replace(/\$\{([^}]+)\}/g, (_m, expr: string) => {
    const lower = expr.match(/^([A-Za-z_$][\w$]*)\.toLowerCase\(\)$/);
    if (lower) return VALUES[lower[1]!]!.toLowerCase();
    const named = expr.match(/^([A-Za-z_$][\w$]*)\.name$/);
    if (named) return VALUES[`${named[1]!}.name`]!;
    if (VALUES[expr] === undefined) throw new Error(`unmapped variable in template: ${expr}`);
    return VALUES[expr]!;
  });
}

/**
 * The single argument a mode uses is named differently per mode, so rendering the
 * original and the registry requires feeding each mode ITS variable, not a
 * blanket archetypeName.
 */
const ARG_BY_MODE: Record<string, string> = {
  combat: "styleA",
  emotional: "emotionName",
  atmosphere: "environmentName",
  tension: "tensionType",
  voice: "profileName",
};
const argFor = (mode: string) => VALUES[ARG_BY_MODE[mode] ?? "archetypeName"]!;

const origTemplates = [...orig.matchAll(/defaultPrompt:\s*`([^`]*)`/g)].map((m) => renderOriginal(m[1]!));
const origUnique = new Set(origTemplates);

const registry = new Set(
  Object.entries(LIBRARY_HANDLERS).map(([mode, h]) => {
    const args = h.argCount === 2 ? [VALUES.styleA!, VALUES.styleB!] : [argFor(mode)];
    return h.defaultPrompt(args);
  }),
);

const missing = [...registry].filter((s) => !origUnique.has(s));
const extra = [...origUnique].filter((s) => !registry.has(s));

console.log("Library-handler string equivalence");
console.log("==================================");
console.log(`  original templates : ${origUnique.size}`);
console.log(`  registry renders   : ${registry.size}`);
console.log(`  in registry but not original : ${missing.length}`);
for (const s of missing) console.log(`    MISSING: ${s}`);
console.log(`  in original but not registry : ${extra.length}`);
for (const s of extra) console.log(`    UNMATCHED: ${s}`);

// Same treatment for the two per-mode toasts. The "missing argument" toast is a
// direct `toast.error("...")`; the failure toast is passed to runLibraryGeneration
// as an `errorMessage:` property, so both forms must be scanned.
const origToasts = new Set([
  ...[...orig.matchAll(/toast\.error\(\s*"([^"]+)"/g)].map((m) => m[1]!),
  ...[...orig.matchAll(/errorMessage:\s*"([^"]+)"/g)].map((m) => m[1]!),
]);
let toastProblems = 0;
for (const h of Object.values(LIBRARY_HANDLERS)) {
  for (const t of [h.missingArgsMessage, h.errorMessage]) {
    if (!origToasts.has(t)) {
      console.log(`    TOAST NOT IN ORIGINAL: ${t}`);
      toastProblems++;
    }
  }
}
console.log(`  toast strings not present in original : ${toastProblems}`);

const ok = missing.length === 0 && extra.length === 0 && toastProblems === 0;

// ---------------------------------------------------------------- scene modes
// The dialogue/interrogation/chase trio was collapsed the same way. Their prompts
// interpolate resolved character NAMES rather than a style argument, so they need
// their own comparison against the original source.
const { SCENE_HANDLERS } = await import("../src/lib/ai/scene-handlers");

const ALICE = { id: "c1", name: "Mara" };
const BOB = { id: "c2", name: "Kessler" };

// Scene modes interpolate resolved character NAMES. Note the roles: in `chase`
// the FIRST character is the pursued and the SECOND is the pursuer, which is why
// the prompt reads "Kessler pursues Mara" while the ids are (pursued, pursuer).
VALUES["charA.name"] = ALICE.name;
VALUES["charB.name"] = BOB.name;
VALUES["interrogator.name"] = ALICE.name;
VALUES["subject.name"] = BOB.name;
VALUES["pursued.name"] = ALICE.name;
VALUES["pursuer.name"] = BOB.name;

console.log("\nScene-handler string equivalence");
console.log("===============================");

let sceneProblems = 0;
// Feed the handler the SAME archetype value renderOriginal uses, otherwise the
// two sides differ by the substituted value rather than by any real divergence.
const REST = [VALUES.archetypeName!, "capture"];
for (const mode of ["dialogue", "interrogation", "chase"]) {
  const handler = SCENE_HANDLERS[mode]!;
  const plan = await handler.plan(ALICE as never, BOB as never, REST);

  // The original's `prompt: X || \`...\`` means the template is the FALLBACK.
  // Render every original prompt template and require an exact match.
  const rendered = new Set(
    [...orig.matchAll(/prompt:\s*\w+\s*\|\|\s*`([^`]*)`/g)].map((m) => renderOriginal(m[1]!)),
  );
  if (!rendered.has(plan.defaultPrompt)) {
    console.log(`  DEFAULT PROMPT NOT IN ORIGINAL: ${plan.defaultPrompt}`);
    sceneProblems++;
  }
  for (const toastText of [handler.missingCharactersMessage, handler.errorMessage]) {
    if (!origToasts.has(toastText)) {
      console.log(`  TOAST NOT IN ORIGINAL: ${toastText}`);
      sceneProblems++;
    }
  }
  if (handler.mode !== mode) {
    console.log(`  MODE MISMATCH for ${mode}: got ${handler.mode}`);
    sceneProblems++;
  }
}
console.log(`  scene handler problems : ${sceneProblems}`);
console.log(`  defaults verified      : ${["dialogue", "interrogation", "chase"].length}`);

const allOk = ok && sceneProblems === 0;
console.log(allOk ? "\nRESULT: identical" : "\nRESULT: DIVERGED");
process.exitCode = allOk ? 0 : 1;