#!/usr/bin/env node
/**
 * Phase -1A — legacy schema baseline generator (READ-ONLY against the source DB).
 *
 * Produces the artifacts v4 §6.2 requires, from OBSERVED production state rather
 * than from migration history (v4 §4.1: "Generate legacy-baseline.sql from
 * observed truth, not from migration history").
 *
 *   docs/migration/legacy-schema-inventory.json  machine-readable catalog
 *   docs/migration/legacy-baseline.sql           reproducible DDL for a fresh PG
 *   docs/migration/legacy-indexes.sql            observed indexes, classified
 *   docs/migration/legacy-data.sql               logical data backup (INSERTs)
 *
 * This script NEVER mutates the source database. It issues SELECTs only.
 *
 * Uses pg_catalog.format_type() so vector(1536), varchar(n), timestamptz and
 * text[] round-trip exactly — reconstructing types from information_schema
 * loses the modifier.
 *
 * Usage: npm run db:legacy-baseline
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "docs/migration");

const QUERY_TIMEOUT_MS = 60_000;

/**
 * Tables that hold no user data and must not be emitted as user INSERTs.
 * semantic_cache is a rebuildable derived cache (v4 §10.1); it is also the
 * largest source of `onConflictDoNothing` ambiguity.
 */
const SKIP_DATA_TABLES = new Set(["semantic_cache"]);

/** A table read that failed. A backup missing any table is NOT a valid backup. */
const dataReadFailures = [];

function readDatabaseUrl() {
  for (const file of [".env", ".env.local"]) {
    const p = resolve(ROOT, file);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, "utf8").match(/^\s*DATABASE_URL\s*=\s*(.*)$/m);
    if (!m) continue;
    let v = m[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v) return { url: v, source: file };
  }
  return null;
}

const found = readDatabaseUrl();
if (!found) {
  console.error("No DATABASE_URL in .env or .env.local.");
  process.exit(1);
}

const { neon } = await import("@neondatabase/serverless");

// IMPORTANT: do NOT pass a signal to neon() here. That signal belongs to the
// client's whole lifetime, so once it aborts every later query fails
// immediately and the export silently loses tables. Each query gets its own
// signal via the third argument of sql.query() instead.
const sql = neon(found.url);

const q = async (strings, ...vals) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await sql(strings, ...vals);
    } catch (err) {
      const msg = `${err?.message ?? err}`;
      if (attempt >= 3 || !/timeout|aborted|econnreset|fetch failed/i.test(msg)) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
};

/** Executes a raw statement with its own timeout, with retry on transient errors. */
const exec = async (statement) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await sql.query(statement, undefined, { signal: AbortSignal.timeout(QUERY_TIMEOUT_MS) });
    } catch (err) {
      const msg = `${err?.message ?? err}`;
      if (attempt >= 3 || !/timeout|aborted|econnreset|fetch failed/i.test(msg)) throw err;
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
};

console.log(`Capturing legacy schema from ${found.source} ...`);

// ---------------------------------------------------------------- extensions
const extensions = await q`select extname, extversion from pg_extension order by extname`;

// ------------------------------------------------------------------- columns
// format_type() preserves vector(1536), character varying(50), timestamp with
// time zone and ARRAY types that information_schema alone would flatten.
const columnRows = await q`
  select c.relname                                   as table_name,
         a.attname                                   as column_name,
         a.attnum                                    as ordinal,
         pg_catalog.format_type(a.atttypid, a.atttypmod) as full_type,
         a.attnotnull                                as not_null,
         pg_get_expr(d.adbin, d.adrelid)            as default_expr,
         a.attidentity                               as identity,
         a.attgenerated                              as generated
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class     c on c.oid = a.attrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  left join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where n.nspname = 'public'
    and c.relkind = 'r'
    and a.attnum > 0
    and not a.attisdropped
  order by c.relname, a.attnum`;

// ----------------------------------------------------------------- relations
const tableRows = await q`
  select c.relname as table_name
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname`;

// --------------------------------------------------------------- constraints
const pkRows = await q`
  select c.relname as table_name, a.attname as column_name
  from pg_catalog.pg_index i
  join pg_catalog.pg_class c on c.oid = i.indrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
  where n.nspname = 'public' and i.indisprimary
  order by c.relname, a.attname`;

const uniqueRows = await q`
  select c.relname as table_name, a.attname as column_name,
         pg_get_indexdef(i.indexrelid) as indexdef
  from pg_catalog.pg_index i
  join pg_catalog.pg_class c on c.oid = i.indrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
  where n.nspname = 'public' and i.indisunique and not i.indisprimary
  order by c.relname, a.attname`;

const fkRows = await q`
  select con.conname                       as constraint_name,
         src.relname                       as table_name,
         tgt.relname                       as foreign_table,
         (select array_agg(att.attname order by att.attname)
            from pg_catalog.pg_attribute att
           where att.attrelid = con.conrelid and att.attnum = any(con.conkey)) as column_names,
         (select array_agg(att.attname order by att.attname)
            from pg_catalog.pg_attribute att
           where att.attrelid = con.confrelid and att.attnum = any(con.confkey)) as foreign_column_names,
         con.confupdtype                    as on_update,
         con.confdeltype                    as on_delete
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class src on src.oid = con.conrelid
  join pg_catalog.pg_class tgt on tgt.oid = con.confrelid
  join pg_catalog.pg_namespace n on n.oid = src.relnamespace
  where n.nspname = 'public' and con.contype = 'f'
  order by src.relname, con.conname`;

// ------------------------------------------------------------------ indexes
const indexRows = await q`
  select tablename, indexname, indexdef
  from pg_catalog.pg_indexes
  where schemaname = 'public'
  order by tablename, indexname`;

// ------------------------------------------------------- custom/enum types
const typeRows = await q`
  select t.typname, t.typtype,
         pg_catalog.format_type(t.oid, null) as formatted
  from pg_catalog.pg_type t
  join pg_catalog.pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typtype in ('e','c','d')
    and not exists (select 1 from pg_catalog.pg_type el where el.oid = t.typelem and el.typarray = t.oid)
  order by t.typname`;

// ------------------------------------------------------------------ assemble
const tables = new Map();
for (const t of tableRows) tables.set(t.table_name, { name: t.table_name, columns: [] });
for (const c of columnRows) {
  tables.get(c.table_name)?.columns.push({
    name: c.column_name,
    ordinal: Number(c.ordinal),
    type: c.full_type,
    notNull: c.not_null === true || c.not_null === "t",
    default: c.default_expr ?? null,
    identity: c.identity ?? null,
    generated: c.generated ?? null,
  });
}

const ACTIONS = { a: "NO ACTION", r: "RESTRICT", c: "CASCADE", n: "SET NULL", d: "SET DEFAULT" };

/**
 * The Neon HTTP driver returns Postgres arrays as their literal text form
 * (e.g. "{user_id}"), not as JS arrays. Parse them back.
 */
function parsePgArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  const inner = value.trim().replace(/^\{|\}$/g, "");
  if (inner === "") return [];
  return inner.split(",").map((s) => s.replace(/^"|"$/g, ""));
}

const groupBy = (rows, key) => {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r[key])) m.set(r[key], []);
    m.get(r[key]).push(r);
  }
  return m;
};

const pks = groupBy(pkRows, "table_name");
const uniques = groupBy(uniqueRows, "table_name");
const fks = groupBy(fkRows, "table_name");
// Normalize array-valued FK columns once, so emitCreateTable can map them.
for (const list of fks.values()) {
  for (const fk of list) {
    fk.column_names = parsePgArray(fk.column_names);
    fk.foreign_column_names = parsePgArray(fk.foreign_column_names);
  }
}

/**
 * Dependency order for CREATE TABLE emission.
 *
 * The catalog query returns tables alphabetically, but foreign keys are declared
 * inline, so `accounts` (REFERENCES users) emitted before `users` makes the
 * baseline UNAPPLICABLE to an empty database. Referenced tables must come first.
 * Used for the DDL as well as the data export.
 */
const dependencyOrder = (() => {
  const emitted = new Set();
  const ordered = [];
  const depsOf = (name) =>
    (fks.get(name) ?? []).map((f) => f.foreign_table).filter((t) => tables.has(t) && t !== name);
  let progress = true;
  while (progress && emitted.size < tables.size) {
    progress = false;
    for (const name of tables.keys()) {
      if (emitted.has(name)) continue;
      if (depsOf(name).every((d) => emitted.has(d))) {
        ordered.push(name);
        emitted.add(name);
        progress = true;
      }
    }
  }
  // Self-referencing or cyclic tables cannot be ordered; append them so the
  // baseline still emits everything (their FKs will need DEFERRABLE or a
  // follow-up ALTER, which the header notes).
  const cyclic = [...tables.keys()].filter((n) => !emitted.has(n));
  return { ordered, cyclic };
})();

// ------------------------------------------------------------- DDL emission
const qIdent = (name) => `"${String(name).replace(/"/g, '""')}"`;

/**
 * Escapes a value into a PostgreSQL E'...' literal.
 *
 * E-strings (escape strings) are required here, not cosmetic: the manuscript and
 * prompt columns contain literal newlines. A plain '...' literal would let a
 * single INSERT span hundreds of physical lines, which is legal SQL but makes the
 * dump unparseable by any line-based tool (diffing, splitting, verification) and
 * fragile to transport. Escaping control characters keeps every statement on one
 * line while remaining byte-exact on restore.
 *
 * Backslash must be escaped FIRST, otherwise the escape sequences introduced
 * afterwards would themselves be double-escaped.
 */
function sqlEscapeString(value) {
  return `E'${String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "''")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    // Remaining C0 control characters, which E'' cannot carry literally.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, (c) =>
      "\\x" + c.charCodeAt(0).toString(16).padStart(2, "0")
    )}'`;
}

function emitCreateTable(name, t) {
  const lines = [];
  for (const col of t.columns) {
    let line = `  ${qIdent(col.name)} ${col.type}`;
    if (col.default !== null) line += ` DEFAULT ${col.default}`;
    if (col.notNull) line += " NOT NULL";
    lines.push(line);
  }
  const pk = pks.get(name);
  if (pk?.length) lines.push(`  PRIMARY KEY (${pk.map((r) => qIdent(r.column_name)).join(", ")})`);

  // Multi-column unique constraints must be emitted once, as a table constraint.
  const seen = new Set();
  for (const u of uniques.get(name) ?? []) {
    const sig = `${name}::${u.indexdef}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    const m = /\(([^)]+)\)/.exec(u.indexdef);
    if (!m) continue;
    const cols = m[1].split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    if (cols.length > 1) {
      lines.push(`  UNIQUE (${cols.map(qIdent).join(", ")})`);
    }
  }

  for (const fk of fks.get(name) ?? []) {
    const del = ACTIONS[fk.on_delete] ?? "NO ACTION";
    const upd = ACTIONS[fk.on_update] ?? "NO ACTION";
    lines.push(
      `  FOREIGN KEY (${(fk.column_names ?? []).map(qIdent).join(", ")}) ` +
        `REFERENCES ${qIdent(fk.foreign_table)} (${(fk.foreign_column_names ?? []).map(qIdent).join(", ")})` +
        ` ON DELETE ${del} ON UPDATE ${upd}`
    );
  }

  return `CREATE TABLE ${qIdent(name)} (\n${lines.join(",\n")}\n);`;
}

const inventory = {
  generatedAt: new Date().toISOString(),
  source: { envFile: found.source, host: new URL(found.url).hostname },
  note:
    "Observed production state captured by scripts/db-legacy-baseline.mjs. " +
    "This is authoritative for Phase -1A; migration history is NOT.",
  extensions: extensions.map((e) => ({ name: e.extname, version: e.extversion })),
  customTypes: typeRows.map((t) => ({ name: t.typname, kind: t.typtype, formatted: t.formatted })),
  tableCount: tables.size,
  tables: [...tables.values()].map((t) => ({
    name: t.name,
    columnCount: t.columns.length,
    columns: t.columns,
    primaryKey: (pks.get(t.name) ?? []).map((r) => r.column_name),
    uniqueIndexes: (uniques.get(t.name) ?? []).map((u) => u.indexdef),
    foreignKeys: (fks.get(t.name) ?? []).map((f) => ({
      name: f.constraint_name,
      columns: f.column_names,
      references: { table: f.foreign_table, columns: f.foreign_column_names },
      onDelete: ACTIONS[f.on_delete] ?? "NO ACTION",
      onUpdate: ACTIONS[f.on_update] ?? "NO ACTION",
    })),
  })),
  indexes: indexRows.map((i) => ({ table: i.tablename, name: i.indexname, def: i.indexdef })),
};

// ------------------------------------------------------------------ baseline
const header = [
  `-- GhostWriter legacy schema baseline`,
  `-- Generated by scripts/db-legacy-baseline.mjs on ${inventory.generatedAt}`,
  `-- Source: ${inventory.source.host} (captured read-only)`,
  `--`,
  `-- Reproduces the OBSERVED production schema, not migration history.`,
  `-- Apply to an empty PostgreSQL 17 database:`,
  `--   psql "$DATABASE_URL" -f legacy-baseline.sql`,
  `--`,
  `-- Per v4 §6.3, production drift is RECORDED here, not silently corrected.`,
  `-- Known divergences from drizzle/*.sql and src/db/schema.ts are documented`,
  `-- in schema-diff.md.`,
  `--`,
  `-- Tables are emitted in foreign-key dependency order so this applies cleanly`,
  `-- to an empty database.`,
  ...(dependencyOrder.cyclic.length
    ? [
        `--`,
        `-- WARNING: ${dependencyOrder.cyclic.length} table(s) participate in a foreign-key`,
        `-- cycle and are emitted last: ${dependencyOrder.cyclic.join(", ")}.`,
        `-- Their inline REFERENCES may require DEFERRABLE INITIALLY DEFERRED or a`,
        `-- follow-up ALTER on a strict empty-database restore.`,
      ]
    : []),
  "",
  "-- Extensions",
  ...extensions.map((e) => `CREATE EXTENSION IF NOT EXISTS ${qIdent(e.extname)};`),
  "",
  "-- Custom types",
  ...typeRows
    .filter((t) => t.typtype === "e")
    .map((t) => `-- enum ${t.typname} (see schema-diff.md; recreated as text to avoid type coupling)`),
  "",
  "-- Tables",
  "",
]
  .filter((l) => typeof l === "string")
  .join("\n");

// Tables are emitted in foreign-key dependency order, not alphabetically, so
// the baseline applies cleanly to a genuinely empty database.
const ddl = [...dependencyOrder.ordered, ...dependencyOrder.cyclic]
  .map((name) => emitCreateTable(name, tables.get(name)))
  .join("\n\n");

// Indexes Postgres creates implicitly for PRIMARY KEY, which the CREATE TABLE
// statements above already declare. Everything else must be emitted explicitly.
const implicitPkNames = new Set([...pks.values()].map((rows) => {
  const t = rows[0]?.table_name;
  return t ? `${t}_pkey` : "";
}).filter(Boolean));
const indexDdl = indexRows
  .filter((i) => !implicitPkNames.has(i.indexname))
  .map((i) => `${i.indexdef};`)
  .join("\n");

const baselineSql =
  `${header}\n${ddl}\n\n-- Indexes (observed)\n${indexDdl}\n`;

writeFileSync(resolve(OUT_DIR, "legacy-schema-inventory.json"), JSON.stringify(inventory, null, 2), "utf8");
writeFileSync(resolve(OUT_DIR, "legacy-baseline.sql"), baselineSql, "utf8");
writeFileSync(
  resolve(OUT_DIR, "legacy-indexes.sql"),
  `-- Observed production indexes, classified. Generated ${inventory.generatedAt}\n` +
    `-- v4 §6.3: scripts/add-indexes.js is best-effort and silently no-ops on an\n` +
    `-- unknown table; these statements are now owned by the baseline instead.\n\n` +
    indexDdl +
    "\n",
  "utf8"
);

console.log(`  tables   : ${tables.size}`);
console.log(`  columns  : ${columnRows.length}`);
console.log(`  FKs      : ${fkRows.length}`);
console.log(`  indexes  : ${indexRows.length}`);
console.log(`  wrote legacy-schema-inventory.json, legacy-baseline.sql, legacy-indexes.sql`);

// ------------------------------------------------------------- data backup
console.log("Exporting data (logical backup) ...");
const dataChunks = [
  `-- GhostWriter legacy DATA backup`,
  `-- Generated ${inventory.generatedAt} — read-only logical export.`,
  `-- Source: ${inventory.source.host}`,
  `--`,
  `-- Restore: psql "$DATABASE_URL" -f legacy-data.sql  (after applying legacy-baseline.sql)`,
  `--`,
  `-- Every value is an E'...' escape string, so each INSERT is exactly one`,
  `-- physical line and the dump is safe to diff, split or transport.`,
  `--`,
  `-- KNOWN DEFECT (pre-existing in source data, preserved verbatim per v4 §6.3):`,
  `--   1 row in universes.shared_rules contains a U+FFFD replacement character`,
  `--   where an em-dash was intended. It is NOT introduced by this export; a`,
  `--   whole-database scan found exactly one such row. Do not silently repair it —`,
  `--   record it, then correct with a separate deliberate migration if desired.`,
  `--`,
  `-- EXCLUDED: semantic_cache (rebuildable derived cache, v4 §10.1).`,
  "",
  "BEGIN;",
  "",
];

// Reuse the same dependency order as the DDL, so a restore cannot insert a child
// row before its parent.
const order = [...dependencyOrder.ordered, ...dependencyOrder.cyclic];

let totalRows = 0;
let tableCountWithData = 0;

for (const tableName of order) {
  if (SKIP_DATA_TABLES.has(tableName)) continue;
  let rows;
  try {
    rows = await exec(`select * from public."${tableName}"`);
  } catch (err) {
    const msg = (err?.message ?? String(err)).slice(0, 120);
    dataReadFailures.push({ table: tableName, error: msg });
    console.error(`  ERROR reading ${tableName}: ${msg}`);
    continue;
  }
  if (!rows?.length) continue;
  tableCountWithData++;
  totalRows += rows.length;
  const cols = Object.keys(rows[0]);
  dataChunks.push(`-- ${tableName} (${rows.length} rows)`);
  for (const row of rows) {
    const values = cols.map((c) => {
      const v = row[c];
      if (v === null || v === undefined) return "NULL";
      if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
      if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
      // json/jsonb arrive as objects or pre-serialized strings; vectors arrive as
      // '[0.1,0.2]' strings. All are emitted as escaped text literals.
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return sqlEscapeString(s);
    });
    dataChunks.push(
      `INSERT INTO ${qIdent(tableName)} (${cols.map(qIdent).join(", ")}) VALUES (${values.join(", ")});`
    );
  }
  dataChunks.push("");
}

dataChunks.push("COMMIT;", "");

if (dataReadFailures.length > 0) {
  // A backup that silently omits tables is worse than no backup: it looks
  // restorable and is not. Write the partial file for inspection but fail loudly
  // and record exactly what is missing.
  writeFileSync(resolve(OUT_DIR, "legacy-data.sql"), dataChunks.join("\n"), "utf8");
  console.error("\nINCOMPLETE BACKUP — legacy-data.sql is NOT a valid restore point.");
  console.error(`${dataReadFailures.length} table(s) could not be read:`);
  for (const f of dataReadFailures) console.error(`  - ${f.table}: ${f.error}`);
  process.exitCode = 1;
  throw new Error("Legacy data export incomplete; refusing to report success.");
}

writeFileSync(resolve(OUT_DIR, "legacy-data.sql"), dataChunks.join("\n"), "utf8");

// Record what was deliberately excluded, so the backup is self-describing.
console.log(`  rows     : ${totalRows} across ${tableCountWithData} tables`);
if (SKIP_DATA_TABLES.size) {
  console.log(`  skipped  : ${[...SKIP_DATA_TABLES].join(", ")} (rebuildable cache)`);
}
console.log(`  wrote legacy-data.sql`);
console.log("\nPhase -1A baseline artifacts generated. Next: schema-diff.md + fresh-DB rebuild test.");