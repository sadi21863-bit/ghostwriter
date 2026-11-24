/**
 * Round-trip fidelity check for legacy-data.sql.
 *
 * Re-reads the hardest rows from the live database, renders them with the SAME
 * escaping the exporter uses, and asserts the exact statement appears in the
 * dump. This catches the failure modes that matter for a backup:
 *   - newlines not escaped (statement spans lines / truncates on restore)
 *   - apostrophes not doubled (statement breaks mid-value)
 *   - unicode mangled in transit
 *   - jsonb re-serialized differently than on write
 *   - backslashes misinterpreted (E-string escaping)
 *
 * Read-only against the source DB.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dump = readFileSync(resolve(ROOT, "docs/migration/legacy-data.sql"), "utf8");

function readDatabaseUrl() {
  for (const file of [".env", ".env.local"]) {
    const m = readFileSync(resolve(ROOT, file), "utf8").match(/^\s*DATABASE_URL\s*=\s*(.*)$/m);
    if (m) {
      let v = m[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (v) return v;
    }
  }
  return null;
}

const { neon } = await import("@neondatabase/serverless");
const sql = neon(readDatabaseUrl());

const qIdent = (n) => `"${String(n).replace(/"/g, '""')}"`;
const esc = (v) =>
  `E'${String(v)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "''")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, (c) =>
      "\\x" + c.charCodeAt(0).toString(16).padStart(2, "0")
    )}'`;

/**
 * Tables/columns worth proving round-trip, chosen for the escaping hazards they
 * contain rather than for size.
 */
const TARGETS = [
  { table: "chapters", limit: 8, why: "manuscript prose: newlines, apostrophes, unicode, backslashes" },
  { table: "projects", limit: 5, why: "jsonb arrays + long markdown outlines with newlines" },
  { table: "characters", limit: 5, why: "long jsonb psychology/language profiles" },
  { table: "generations", limit: 5, why: "model prompts with arbitrary punctuation" },
  { table: "story_memories", limit: 5, why: "jsonb structured memory" },
  { table: "universes", limit: 3, why: "jsonb rules incl. the known U+FFFD row" },
  { table: "work_packets", limit: 3, why: "craft library prose" },
  { table: "production_shots", limit: 3, why: "shot descriptions + numeric columns" },
];

let checked = 0;
let failed = 0;
const failures = [];

for (const { table, limit, why } of TARGETS) {
  let rows;
  try {
    rows = await sql.query(`select * from public."${table}" limit ${limit}`);
  } catch (err) {
    failures.push(`${table}: could not read (${(err?.message ?? err).slice(0, 80)})`);
    continue;
  }
  if (!rows?.length) {
    console.log(`  ${table.padEnd(18)} no rows`);
    continue;
  }
  const cols = Object.keys(rows[0]);
  let tableOk = 0;
  let tableBad = 0;

  for (const row of rows) {
    const values = cols.map((c) => {
      const v = row[c];
      if (v === null || v === undefined) return "NULL";
      if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
      if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
      return esc(typeof v === "object" ? JSON.stringify(v) : String(v));
    });
    const expected = `INSERT INTO ${qIdent(table)} (${cols.map(qIdent).join(", ")}) VALUES (${values.join(", ")});`;
    checked++;
    if (dump.includes(expected)) {
      tableOk++;
    } else {
      tableBad++;
      failed++;
      // Show the first divergence to make the failure actionable.
      let at = 0;
      while (at < expected.length && at < dump.length && expected[at] !== dump[at]) at++;
      failures.push(
        `${table}: row ${row.id ?? "(no id)"} not found verbatim in dump; first divergence at char ${at}\n` +
          `      expected: ${JSON.stringify(expected.slice(Math.max(0, at - 40), at + 40))}`
      );
    }
  }
  console.log(`  ${table.padEnd(18)} ${tableOk}/${rows.length} exact  (${why})`);
}

console.log("\nround-trip fidelity");
console.log("-------------------");
console.log(`statements verified : ${checked}`);
console.log(`exact matches       : ${checked - failed}`);
console.log(`mismatches          : ${failed}`);
if (failures.length) {
  console.log("\nFAILURES:");
  for (const f of failures.slice(0, 12)) console.log(`  x ${f}`);
  if (failures.length > 12) console.log(`  ... and ${failures.length - 12} more`);
  process.exitCode = 1;
} else {
  console.log("\nOK: every sampled row round-trips byte-exactly through the dump.");
}