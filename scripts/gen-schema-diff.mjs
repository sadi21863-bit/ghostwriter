/**
 * Generates docs/migration/schema-diff.md (v4 §6.2).
 *
 * Classifies every divergence between three sources of truth:
 *   A. OBSERVED production  — legacy-schema-inventory.json (authoritative)
 *   B. src/db/schema.ts     — the application model
 *   C. drizzle/*.sql        — migration history (known to be incomplete)
 *
 * Per v4 §6.3 this RECORDS drift; it never repairs it.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inventory = JSON.parse(readFileSync(resolve(ROOT, "docs/migration/legacy-schema-inventory.json"), "utf8"));
const schemaSrc = readFileSync(resolve(ROOT, "src/db/schema.ts"), "utf8");
const drizzleDir = resolve(ROOT, "drizzle");

// ---------------------------------------------------- B. parse src/db/schema.ts
const codeTables = new Map();
{
  // Split on each pgTable declaration; capture the SQL table name and every
  // `jsField: type("sql_column")` pair inside that block.
  const decls = [...schemaSrc.matchAll(/export const (\w+)\s*=\s*pgTable\(\s*["']([a-z0-9_]+)["']/g)];
  for (let i = 0; i < decls.length; i++) {
    const start = decls[i].index + decls[i][0].length;
    const end = i + 1 < decls.length ? decls[i + 1].index : schemaSrc.length;
    const block = schemaSrc.slice(start, end);
    const cols = new Set([...block.matchAll(/(\w+)\s*:\s*\w+\(\s*["']([a-z0-9_]+)["']/g)].map((m) => m[2]));
    codeTables.set(decls[i][2], { exportName: decls[i][1], columns: cols });
  }
}

// ------------------------------------------------------------ C. drizzle files
const sqlFiles = readdirSync(drizzleDir).filter((f) => f.endsWith(".sql")).sort();
const migrationText = sqlFiles.map((f) => readFileSync(resolve(drizzleDir, f), "utf8")).join("\n");
const migrationTables = new Set(
  [...migrationText.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"?([a-z0-9_]+)"?/gi)].map((m) => m[1].toLowerCase())
);
const journal = JSON.parse(readFileSync(resolve(drizzleDir, "meta/_journal.json"), "utf8"));
const journalTags = new Set((journal.entries ?? []).map((e) => e.tag));

/**
 * Per-table column sets declared in migration history. A table having a
 * CREATE TABLE is NOT sufficient — many were created early and then extended
 * only via `db:push`, which writes no migration. This is the real coverage gap.
 */
const migrationColumns = new Map();
for (const m of migrationText.matchAll(
  /CREATE TABLE (?:IF NOT EXISTS )?"?([a-z0-9_]+)"?\s*\(([\s\S]*?)\n\);/gi
)) {
  const table = m[1].toLowerCase();
  const cols = new Set(
    [...m[2].matchAll(/"?([a-z0-9_]+)"?\s+(?:uuid|text|varchar|integer|bigint|boolean|timestamp|jsonb|real|double|vector|date|numeric|smallint)\b/gi)].map(
      (x) => x[1].toLowerCase()
    )
  );
  // ALTER TABLE ... ADD COLUMN contributes too.
  for (const a of migrationText.matchAll(
    new RegExp(`ALTER TABLE "?${table}"?[\\s\\S]{0,120}?ADD COLUMN(?: IF NOT EXISTS)? "?([a-z0-9_]+)"?`, "gi")
  )) {
    cols.add(a[1].toLowerCase());
  }
  migrationColumns.set(table, cols);
}

const columnGaps = [];
for (const t of inventory.tables) {
  const declared = migrationColumns.get(t.name);
  const live = t.columns.map((c) => c.name);
  if (!declared) {
    columnGaps.push({ table: t.name, missing: live.sort(), noCreateTable: true });
    continue;
  }
  const missing = live.filter((c) => !declared.has(c)).sort();
  if (missing.length) columnGaps.push({ table: t.name, missing, noCreateTable: false });
}
const fullyCoveredTables = inventory.tables.length - columnGaps.length;
const totalMissingColumns = columnGaps.reduce((a, g) => a + g.missing.length, 0);

// ------------------------------------------------------------------ divergence
const prodTables = inventory.tables.map((t) => t.name);
const rows = [];
const missingInCode = [];
const missingInMigrations = [];
const extraInProd = [];

for (const t of inventory.tables) {
  const prodCols = new Set(t.columns.map((c) => c.name));
  const code = codeTables.get(t.name);
  if (!code) {
    extraInProd.push(t.name);
    continue;
  }
  if (!migrationTables.has(t.name)) missingInMigrations.push(t.name);

  const inProdNotCode = [...prodCols].filter((c) => !code.columns.has(c)).sort();
  const inCodeNotProd = [...code.columns].filter((c) => !prodCols.has(c)).sort();
  if (inProdNotCode.length || inCodeNotProd.length) {
    rows.push({ table: t.name, inProdNotCode, inCodeNotProd });
  }
}
const codeOnlyTables = [...codeTables.keys()].filter((t) => !prodTables.includes(t));

// duplicate migration detection (documented, not deleted — v4 §6.3)
const bySize = new Map();
for (const f of sqlFiles) {
  const body = readFileSync(resolve(drizzleDir, f), "utf8");
  const key = `${body.length}`;
  if (!bySize.has(key)) bySize.set(key, []);
  bySize.get(key).push(f);
}
const duplicateGroups = [...bySize.values()].filter((g) => g.length > 1);

// ------------------------------------------------------------------- rendering
const pct = (n, d) => (d === 0 ? "100%" : `${Math.round((n / d) * 100)}%`);
const backtick = (s) => (s.length ? s.map((c) => `\`${c}\``).join(", ") : "—");

const md = [];
md.push(`# Legacy schema diff (Phase -1A)`);
md.push("");
md.push(`Generated from \`legacy-schema-inventory.json\` (observed production) vs \`src/db/schema.ts\` vs \`drizzle/*.sql\`.`);
md.push("");
md.push(`- **Captured:** ${inventory.generatedAt}`);
md.push(`- **Source:** ${inventory.source.host} (read-only introspection)`);
md.push(`- **PostgreSQL:** extensions ${inventory.extensions.map((e) => e.name).join(", ")}`);
md.push("");
md.push(`## Verdict`);
md.push("");
md.push(`| Metric | Count |`);
md.push(`|---|---|`);
md.push(`| Tables in production | ${prodTables.length} |`);
md.push(`| Tables declared in \`schema.ts\` | ${codeTables.size} |`);
md.push(`| Tables with a \`CREATE TABLE\` migration | ${migrationTables.size} |`);
md.push(`| Tables whose columns are **fully** covered by migration history | ${fullyCoveredTables} |`);
md.push(`| Tables with column gaps | ${columnGaps.length} |`);
md.push(`| Columns never captured in any migration | ${totalMissingColumns} |`);
md.push(`| Total columns (production) | ${inventory.tables.reduce((a, t) => a + t.columns.length, 0)} |`);
md.push(`| Foreign keys | ${inventory.tables.reduce((a, t) => a + (t.foreignKeys?.length ?? 0), 0)} |`);
md.push(`| Indexes | ${inventory.indexes.length} |`);
md.push("");
md.push(`> ### The migration history is table-complete but column-incomplete.`);
md.push(`>`);
md.push(`> All but one table have a \`CREATE TABLE\` migration, which makes the history *look* authoritative. It is not: **${columnGaps.length} tables are missing ${totalMissingColumns} columns** that exist in production, because those columns were added with \`drizzle-kit push\` (which writes no migration file).`);
md.push(`>`);
md.push(`> This is more dangerous than missing tables. A fresh \`drizzle-kit migrate\` produces every table but omits columns like \`projects.density_level\`, \`characters.embedding\`, \`production_shots.quality_score\` and all of \`showcases\`. Those failures surface as runtime "column does not exist" errors deep inside a route, not as an obvious schema error at deploy time.`);
md.push("");
md.push(`> **Correction to earlier audit notes.** An earlier pass reported "30 of 41 tables have no migration". That was wrong — it compared Drizzle *export* names (\`plotThreads\`) against SQL table names (\`plot_threads\`) and so counted every multi-word table as missing. Table coverage is ${migrationTables.size}/${prodTables.length}, not 11/${prodTables.length}. The column-level gap above is the accurate finding.`);
md.push("");
md.push(`## Column coverage of migration history`);
md.push("");
md.push(`${fullyCoveredTables} of ${prodTables.length} tables are fully covered by their migration. The remaining ${columnGaps.length} would be created **with missing columns** by \`drizzle-kit migrate\`.`);
md.push("");
md.push(`| Table | Missing columns | Count |`);
md.push(`|---|---|---|`);
for (const g of columnGaps.sort((a, b) => b.missing.length - a.missing.length)) {
  const label = g.noCreateTable ? `**${g.table}** (no CREATE TABLE)` : g.table;
  md.push(`| \`${label}\` | ${backtick(g.missing)} | ${g.missing.length} |`);
}
md.push("");
md.push(`Every column in the "Missing" column above exists in production and is exercised by application code. \`legacy-baseline.sql\` is generated from the live catalog and therefore contains all of them.`);
md.push("");
md.push(`## Table presence`);
md.push("");
md.push(`### In production but with no migration file (${missingInMigrations.length})`);
md.push("");
if (missingInMigrations.length === 0) {
  md.push(`None.`);
} else {
  md.push(`These exist in the live database and in \`schema.ts\`, but a fresh \`drizzle-kit migrate\` would not create them:`);
  md.push("");
  md.push(`${backtick(missingInMigrations.sort())}`);
}
md.push("");
if (codeOnlyTables.length) {
  md.push(`### Declared in \`schema.ts\` but absent from production (${codeOnlyTables.length})`);
  md.push("");
  md.push(`${backtick(codeOnlyTables.sort())}`);
  md.push("");
} else {
  md.push(`### Declared in \`schema.ts\` but absent from production`);
  md.push("");
  md.push(`None. The application model and the live schema agree on table membership.`);
  md.push("");
}
if (extraInProd.length) {
  md.push(`### In production but not declared in \`schema.ts\` (${extraInProd.length})`);
  md.push("");
  md.push(`${backtick(extraInProd)}`);
  md.push("");
}

// ------------------------------------------------------------ column divergence
md.push(`## Column divergence between production and \`schema.ts\``);
md.push("");
if (rows.length === 0) {
  md.push(`None. Every production column is declared in \`schema.ts\` and vice versa.`);
} else {
  md.push(`| Table | In production, missing from \`schema.ts\` | In \`schema.ts\`, missing from production |`);
  md.push(`|---|---|---|`);
  for (const r of rows) {
    md.push(`| \`${r.table}\` | ${backtick(r.inProdNotCode)} | ${backtick(r.inCodeNotProd)} |`);
  }
}
md.push("");

// ------------------------------------------------------------ migration issues
md.push(`## Migration-history defects`);
md.push("");
md.push(`### Duplicate migration files`);
md.push("");
if (duplicateGroups.length === 0) {
  md.push(`None detected by content length.`);
} else {
  for (const g of duplicateGroups) {
    const inJournal = g.filter((f) => journalTags.has(f.replace(/\.sql$/, "")));
    const orphaned = g.filter((f) => !journalTags.has(f.replace(/\.sql$/, "")));
    md.push(`- ${g.map((f) => `\`${f}\``).join(" / ")} — identical byte length.`);
    if (orphaned.length) {
      md.push(`  - **Orphaned** (absent from \`_journal.json\`): ${backtick(orphaned)}`);
    }
    if (inJournal.length) {
      md.push(`  - Referenced by the journal: ${backtick(inJournal)}`);
    }
  }
  md.push("");
  md.push(`Per v4 §6.3 these are documented, not deleted. Removing the orphan requires confirming its checksum and journal status first.`);
}
md.push("");
md.push(`### Index ownership`);
md.push("");
md.push(`Production has ${inventory.indexes.length} public indexes. \`scripts/add-indexes.js\` creates only 10 and swallows failures in a try/catch, so it cannot be treated as the source of truth. \`legacy-indexes.sql\` now carries the observed set.`);
md.push("");
md.push(`One script statement references \`pwd_reset_tokens\` while the table is \`password_reset_tokens\`; it fails silently. The live database is correct — \`password_reset_tokens\` is indexed and no typo'd index exists.`);
md.push("");

// ------------------------------------------------------------- constraint gaps
md.push(`## Constraint findings requiring a decision (v4 §6.3)`);
md.push("");
const semCache = inventory.indexes.filter((i) => i.table === "semantic_cache");
md.push(`### \`semantic_cache\` has no uniqueness guarantee`);
md.push("");
md.push(`Observed indexes: ${semCache.map((i) => `\`${i.name}\``).join(", ") || "none"}.`);
md.push("");
md.push(`\`semantic-cache.ts\` and \`headroom-summarize.ts\` both call \`.onConflictDoNothing()\` with no conflict target. Without a unique constraint on \`(cache_type, input_key)\` that clause cannot dedupe, so concurrent identical writes insert duplicate rows. **Decision required:** add the unique constraint, or drop the dedupe assumption.`);
md.push("");
const softRefs = [];
for (const t of inventory.tables) {
  const uuidCols = t.columns.filter((c) => c.type === "uuid");
  const fkCols = new Set((t.foreignKeys ?? []).flatMap((f) => f.columns ?? []));
  for (const c of uuidCols) {
    if (!fkCols.has(c.name)) softRefs.push({ table: t.name, column: c.name });
  }
}
md.push(`### Soft UUID references (${softRefs.length} columns)`);
md.push("");
md.push(`These are \`uuid\` columns with no foreign key. Per v4 §6.3 each must be declared either an FK with defined delete semantics or a documented soft reference with validation:`);
md.push("");
md.push(`| Table | Column |`);
md.push(`|---|---|`);
for (const s of softRefs) md.push(`| \`${s.table}\` | \`${s.column}\` |`);
md.push("");

// --------------------------------------------------------------- data coverage
md.push(`## Data coverage of the backup`);
md.push("");
const statusDoc = readFileSync(resolve(ROOT, "docs/migration/legacy-db-status.md"), "utf8");
const fence = /```json\r?\n([\s\S]*?)\r?\n```/.exec(statusDoc);
const counts = fence
  ? JSON.parse(fence[1].split("\n").map((l) => l.replace(/^\s+/, "")).join("\n")).rowCounts
  : {};
const storyTables = [
  "projects","chapters","characters","locations","plot_threads","world_entities",
  "story_memories","story_threads","story_promises","story_plans","story_checkpoints",
  "character_relationships","editor_notes","reference_works","universes","series_bibles",
];
md.push(`| Table | Rows | In backup |`);
md.push(`|---|---|---|`);
for (const t of storyTables) {
  const n = counts[t];
  md.push(`| \`${t}\` | ${n ?? "?"} | ${(n ?? 0) > 0 ? "yes" : "**empty in production**"} |`);
}
md.push("");
md.push(`Story-domain tables that are **empty in production** cannot be validated by a real-data migration. \`world_entities\`, \`story_threads\`, \`story_promises\`, \`story_plans\`, \`story_checkpoints\` and \`editor_notes\` have never held a row, so the Story Transactions, Promise Tracker and Story Doctor code paths have no production precedent. Their migration paths must be proven against purpose-built fixtures.`);
md.push("");
md.push(`## Known data defect (preserved, not repaired)`);
md.push("");
md.push(`Exactly one row in the entire database — \`universes.shared_rules\` — contains a U+FFFD replacement character where an em-dash was intended. A whole-database scan across every text/jsonb column found no others. It is preserved verbatim in \`legacy-data.sql\`; per v4 §6.3 it is recorded here rather than silently corrected.`);
md.push("");

writeFileSync(resolve(ROOT, "docs/migration/schema-diff.md"), md.join("\n"), "utf8");

console.log("wrote docs/migration/schema-diff.md");
console.log(`  migration-covered tables : ${migrationTables.size}/${prodTables.length}`);
console.log(`  column-divergent tables : ${rows.length}`);
console.log(`  soft uuid references    : ${softRefs.length}`);
console.log(`  duplicate sql files      : ${duplicateGroups.length} group(s)`);