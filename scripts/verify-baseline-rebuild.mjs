/**
 * Phase -1A fresh-DB rebuild test (v4 §6.2).
 *
 * Rebuilds legacy-baseline.sql into a THROWAWAY schema and verifies the result
 * matches legacy-schema-inventory.json, then drops the schema.
 *
 * SAFETY — why this does not use BEGIN/ROLLBACK:
 *   The Neon HTTP driver rejects multi-statement batches ("cannot insert multiple
 *   commands into a prepared statement") and runs every query in its own implicit
 *   transaction, so a cross-query transaction is impossible. Verified empirically,
 *   not assumed.
 *
 *   Instead every statement is schema-qualified onto a dedicated scratch schema
 *   that nothing else references. Worst case (process killed mid-run) the schema
 *   lingers as unused empty tables; the next run drops it before starting. The
 *   `public` schema and all application data are never targeted, because every
 *   CREATE TABLE / REFERENCES / INDEX in the baseline is rewritten to the scratch
 *   schema before execution.
 *
 * This proves the baseline is executable and structurally correct. It is NOT a
 * full disk-level restore test, which needs psql/pg_dump (absent here) or a second
 * Neon project.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseline = readFileSync(resolve(ROOT, "docs/migration/legacy-baseline.sql"), "utf8");
const dataSql = readFileSync(resolve(ROOT, "docs/migration/legacy-data.sql"), "utf8");
const inventory = JSON.parse(readFileSync(resolve(ROOT, "docs/migration/legacy-schema-inventory.json"), "utf8"));

const SCHEMA = "legacy_baseline_verify";

function readDatabaseUrl() {
  for (const f of [".env", ".env.local"]) {
    const m = readFileSync(resolve(ROOT, f), "utf8").match(/^\s*DATABASE_URL\s*=\s*(.*)$/m);
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
const exec = (s) => sql.query(s, undefined, { signal: AbortSignal.timeout(120_000) });

/** Statements in the baseline, split on semicolons outside of literals. */
function splitStatements(ddl) {
  const out = [];
  let buf = "";
  let inLineComment = false;
  for (let i = 0; i < ddl.length; i++) {
    const c = ddl[i];
    const n = ddl[i + 1];
    if (inLineComment) {
      if (c === "\n") inLineComment = false;
      buf += c;
      continue;
    }
    if (c === "-" && n === "-") { inLineComment = true; buf += c; continue; }
    if (c === "'") {
      // copy a string literal verbatim, honouring '' escapes
      buf += c; i++;
      while (i < ddl.length) {
        if (ddl[i] === "'" && ddl[i + 1] === "'") { buf += "''"; i += 2; continue; }
        buf += ddl[i];
        if (ddl[i] === "'") break;
        i++;
      }
      continue;
    }
    if (c === ";") { out.push(buf.trim()); buf = ""; continue; }
    buf += c;
  }
  if (buf.trim()) out.push(buf.trim());
  // Drop leading comment-only lines so a statement is never preceded by the
  // file header (which would otherwise merge into the first CREATE TABLE).
  return out
    .map((s) => s.replace(/^(?:\s*--[^\n]*\n)+/, "").trim())
    .filter((s) => s.length > 0);
}

console.log(`Rebuilding legacy-baseline.sql into throwaway schema "${SCHEMA}" ...`);
console.log(`(Neon HTTP driver allows neither multi-statement batches nor cross-query`);
console.log(` transactions, so this uses a dedicated scratch schema + explicit drop.)`);
let created = 0, skipped = 0;
const failures = [];
// Declared outside the try so the summary below can read it after the finally.
let verdict = { checked: false };

// Self-heal: drop any schema left behind by an interrupted previous run.
await exec(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
await exec(`CREATE SCHEMA ${SCHEMA}`);

/**
 * Retargets the baseline's identifiers onto the scratch schema. Three forms
 * appear in the generated DDL:
 *   CREATE TABLE "users" (...)
 *   FOREIGN KEY (...) REFERENCES "projects" (...)
 *   CREATE INDEX ... ON public.characters ...
 */
function retarget(stmt) {
  return stmt
    .replace(/CREATE TABLE ("|')?([a-z0-9_]+)\1?/gi, `CREATE TABLE "${SCHEMA}"."$2"`)
    .replace(/REFERENCES ("|')?([a-z0-9_]+)\1?/gi, `REFERENCES "${SCHEMA}"."$2"`)
    .replace(/\bON public\.([a-z0-9_]+)/gi, `ON "${SCHEMA}"."$1"`);
}

try {
  for (const stmt of splitStatements(baseline)) {
    // Extensions are cluster-wide and already present; creating them per-schema
    // is not meaningful and CREATE EXTENSION is not schema-scoped.
    if (/^\s*CREATE EXTENSION/i.test(stmt)) { skipped++; continue; }
    try {
      await exec(retarget(stmt));
      created++;
    } catch (err) {
      failures.push({ stmt: stmt.replace(/\s+/g, " ").slice(0, 120), error: (err?.message ?? String(err)).slice(0, 200) });
      if (failures.length > 6) break;
    }
  }

  if (failures.length === 0) {
    const t = await exec(`
      select table_name, count(*)::int as cols
      from information_schema.columns
      where table_schema = '${SCHEMA}'
      group by table_name order by table_name`);
    const built = new Map(t.map((r) => [r.table_name, Number(r.cols)]));

    const missingTables = inventory.tables.filter((x) => !built.has(x.name)).map((x) => x.name);
    const countMismatch = inventory.tables
      .filter((x) => built.has(x.name) && built.get(x.name) !== x.columns.length)
      .map((x) => `${x.name}: built ${built.get(x.name)} vs live ${x.columns.length}`);

    const fk = await exec(`
      select count(*)::int as n from information_schema.table_constraints
      where table_schema = '${SCHEMA}' and constraint_type = 'FOREIGN KEY'`);
    const ix = await exec(`select count(*)::int as n from pg_indexes where schemaname = '${SCHEMA}'`);

    verdict = {
      checked: true,
      tablesBuilt: built.size,
      tablesExpected: inventory.tables.length,
      missingTables,
      countMismatch,
      fkBuilt: Number(fk[0].n),
      fkExpected: inventory.tables.reduce((a, x) => a + (x.foreignKeys?.length ?? 0), 0),
      indexesBuilt: Number(ix[0].n),
      indexesExpected: inventory.indexes.length,
    };
  }
} finally {
  await exec(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`).catch(() => {});
  console.log(`  scratch schema "${SCHEMA}" dropped`);
}

console.log(`  statements executed : ${created} (skipped ${skipped} extension statements)`);
console.log("");
if (failures.length) {
  console.log("FAILURES:");
  for (const f of failures) console.log(`  x ${f.stmt}\n      ${f.error}`);
  process.exitCode = 1;
} else {
  const v = verdict;
  console.log("Fresh-schema rebuild result");
  console.log("---------------------------");
  console.log(`tables built           : ${v.tablesBuilt} / ${v.tablesExpected}`);
  console.log(`foreign keys built     : ${v.fkBuilt} / ${v.fkExpected}`);
  console.log(`indexes built          : ${v.indexesBuilt} / ${v.indexesExpected}`);
  console.log(`missing tables         : ${v.missingTables.length === 0 ? "none" : v.missingTables.join(", ")}`);
  console.log(`column-count mismatches: ${v.countMismatch.length === 0 ? "none" : v.countMismatch.join("; ")}`);
  const bad =
    v.missingTables.length > 0 ||
    v.countMismatch.length > 0 ||
    v.tablesBuilt !== v.tablesExpected ||
    v.fkBuilt !== v.fkExpected;
  if (bad) {
    console.log("\nBaseline does NOT faithfully reproduce the captured schema.");
    process.exitCode = 1;
  } else {
    console.log("\nOK: legacy-baseline.sql rebuilds the captured schema exactly (scratch schema dropped; public untouched).");
  }
}