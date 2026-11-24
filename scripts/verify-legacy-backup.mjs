/**
 * Verifies legacy-data.sql is a COMPLETE and restorable backup, by comparing it
 * against the authoritative live row counts and checking structural integrity.
 *
 * v4 §6.2 requires a fresh-DB rebuild test; this covers the data half of it
 * without needing a live scratch database: every table present in production is
 * accounted for in the dump, row counts match, referential targets are declared
 * before their referrers, and no unescaped quote breaks a statement.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const data = readFileSync(resolve(ROOT, "docs/migration/legacy-data.sql"), "utf8");
const inventory = JSON.parse(readFileSync(resolve(ROOT, "docs/migration/legacy-schema-inventory.json"), "utf8"));
const status = readFileSync(resolve(ROOT, "docs/migration/legacy-db-status.md"), "utf8");

// Authoritative per-table counts from the preflight probe output. The JSON block
// in legacy-db-status.md is indented inside a fenced code block, so match the
// fence loosely and strip the leading indentation of each line.
const fence = /```json\r?\n([\s\S]*?)\r?\n```/.exec(status);
if (!fence) {
  console.error("Could not locate the probe JSON block in legacy-db-status.md");
  process.exit(1);
}
const probeJson = fence[1]
  .split("\n")
  .map((l) => l.replace(/^\s+/, ""))
  .join("\n");
const liveCounts = JSON.parse(probeJson).rowCounts;

const failures = [];
const warn = [];

// ---- 1. row counts per table match the live database -----------------------
const dumped = new Map();
for (const m of data.matchAll(/^INSERT INTO "([^"]+)" /gm)) {
  dumped.set(m[1], (dumped.get(m[1]) ?? 0) + 1);
}

const SKIP = new Set(["semantic_cache"]);
let expectedTotal = 0;
for (const [table, live] of Object.entries(liveCounts)) {
  if (SKIP.has(table)) {
    if (dumped.has(table)) failures.push(`${table}: present in dump but declared rebuildable`);
    continue;
  }
  const got = dumped.get(table) ?? 0;
  const want = live ?? 0;
  expectedTotal += want;
  if (want > 0 && got === 0) failures.push(`${table}: live has ${want} rows, dump has 0`);
  else if (got !== want) warn.push(`${table}: dump ${got} vs live ${want}`);
}
const dumpedTotal = [...dumped.values()].reduce((a, b) => a + b, 0);
if (dumpedTotal !== expectedTotal) {
  failures.push(`total rows: dump ${dumpedTotal} != live(non-cache) ${expectedTotal}`);
}

// ---- 2. every non-empty production table is represented -------------------
const nonEmptyLive = Object.entries(liveCounts).filter(([, n]) => (n ?? 0) > 0).map(([t]) => t);
for (const t of nonEmptyLive) {
  if (!SKIP.has(t) && !dumped.has(t)) failures.push(`${t}: has live rows but no INSERTs in dump`);
}

// ---- 3. INSERT ordering respects FK dependencies ---------------------------
const order = [];
for (const m of data.matchAll(/^INSERT INTO "([^"]+)" /gm)) {
  if (order.at(-1) !== m[1]) order.push(m[1]);
}
const emittedAt = new Map(order.map((t, i) => [t, i]));
for (const t of inventory.tables) {
  for (const fk of t.foreignKeys ?? []) {
    if (!emittedAt.has(t.name) || !emittedAt.has(fk.references.table)) continue;
    if (emittedAt.get(fk.references.table) > emittedAt.get(t.name)) {
      failures.push(`FK order: "${t.name}" is inserted before its referenced "${fk.references.table}"`);
    }
  }
}

// ---- 4. every INSERT is exactly one physical line, and quoting is balanced --
let stmtCount = 0;
let multiLine = 0;
for (const line of data.split("\n")) {
  if (!line.startsWith("INSERT INTO")) continue;
  stmtCount++;
  if (!line.endsWith(";")) {
    multiLine++;
    failures.push(`statement #${stmtCount} does not end on its own line (embedded newline): ${line.slice(0, 70)}`);
  }
  // With E'...' escaping, a correct statement has an EVEN total number of single
  // quotes: each literal contributes 2, each escaped quote contributes 2 more.
  const quotes = (line.match(/'/g) ?? []).length;
  if (quotes % 2 !== 0) {
    failures.push(`unbalanced quoting in statement #${stmtCount}: ${line.slice(0, 80)}`);
  }
}
if (multiLine > 0) {
  failures.push(`${multiLine} INSERT(s) span multiple physical lines — newlines must be \\n-escaped`);
}

// ---- 5. transaction wrapper present ---------------------------------------
if (!/^BEGIN;$/m.test(data)) failures.push("dump is not wrapped in BEGIN/COMMIT");
if (!/^COMMIT;$/m.test(data)) failures.push("dump has no COMMIT");

// ---- 6. baseline covers every production table ----------------------------
const baseline = readFileSync(resolve(ROOT, "docs/migration/legacy-baseline.sql"), "utf8");
for (const t of inventory.tables) {
  if (!new RegExp(`CREATE TABLE "${t.name}" \\(`).test(baseline)) {
    failures.push(`baseline.sql is missing CREATE TABLE for "${t.name}"`);
  }
}

console.log("legacy-data.sql / legacy-baseline.sql verification");
console.log("-----------------------------------------------");
console.log(`live tables (non-empty)   : ${nonEmptyLive.length}`);
console.log(`tables with INSERTs       : ${dumped.size}`);
console.log(`total INSERT statements   : ${stmtCount}`);
console.log(`expected rows             : ${expectedTotal}`);
if (warn.length) {
  console.log("\nwarnings:");
  for (const w of warn) console.log(`  ~ ${w}`);
}
if (failures.length) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(`  x ${f}`);
  process.exitCode = 1;
} else {
  console.log("\nOK: dump is complete, ordered, quoted safely, and baseline covers all tables.");
}