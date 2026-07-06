#!/usr/bin/env node
// Read-only query runner against this project's live Neon Postgres DB.
// Adapted from the read-only-postgres pattern (jawwadfirdousi/agent-skills) for
// this project's actual stack: uses the @neondatabase/serverless HTTP driver
// already a dependency here (no new package, no persistent connection), reading
// DATABASE_URL the same way src/db/index.ts does — rather than that reference
// implementation's psycopg2 + a separate connections.json (this project has one
// database, not several, so that indirection isn't needed).
//
// Usage:
//   node query.mjs --query "SELECT id, email FROM users LIMIT 5"
//   node query.mjs --tables
//   node query.mjs --schema users
'use strict';

const MAX_ROWS = 500;
const COLUMN_WIDTH_CAP = 120;
const TIMEOUT_MS = 20_000;

function fail(msg) {
  console.error(`[read-only-postgres] ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { query: null, tables: false, schema: null, limit: MAX_ROWS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--query') args.query = argv[++i];
    else if (a === '--tables') args.tables = true;
    else if (a === '--schema') args.schema = argv[++i] || '';
    else if (a === '--limit') args.limit = Math.max(1, Math.min(MAX_ROWS, parseInt(argv[++i], 10) || MAX_ROWS));
  }
  return args;
}

// Strip SQL comments (-- line, /* block */) before validating statement shape —
// mirrors the reference skill's "comments and literals stripped" safety step.
function stripComments(sql) {
  return sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

const DENYLIST = /\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|comment|vacuum|copy|call|do|merge|lock|reindex|refresh|listen|notify)\b/i;
const ALLOWLIST_START = /^\s*(select|show|explain|with)\b/i;
const SELECT_INTO = /\bselect\b[\s\S]*\binto\b/i;

function validateReadOnly(rawSql) {
  const sql = stripComments(rawSql).trim();
  if (!sql) fail('Empty query.');
  // Reject multiple statements: strip one optional trailing semicolon, then
  // anything left containing a semicolon is a second statement.
  const single = sql.replace(/;\s*$/, '');
  if (single.includes(';')) fail('Only a single statement is allowed (no `;`-separated batches).');
  if (!ALLOWLIST_START.test(single)) fail('Only SELECT, SHOW, EXPLAIN, or WITH statements are allowed.');
  if (DENYLIST.test(single)) fail('Statement contains a disallowed keyword (DDL/DML). This connection is read-only.');
  if (SELECT_INTO.test(single)) fail('SELECT ... INTO is disallowed (it creates a table).');
  return single;
}

function truncateCell(v) {
  if (v === null || v === undefined) return v;
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > COLUMN_WIDTH_CAP ? s.slice(0, COLUMN_WIDTH_CAP) + '…' : s;
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail('DATABASE_URL is not set in this environment.');

  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(databaseUrl);

  const args = parseArgs(process.argv.slice(2));

  let queryText;
  if (args.tables) {
    queryText = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  } else if (args.schema !== null) {
    if (!/^[a-zA-Z0-9_]*$/.test(args.schema)) fail('Invalid table name for --schema.');
    queryText = args.schema
      ? `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name = '${args.schema}' ORDER BY ordinal_position`
      : `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`;
  } else if (args.query) {
    queryText = validateReadOnly(args.query);
  } else {
    fail('Provide --query "<SQL>", or use --tables / --schema [table].');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let rows;
  try {
    rows = await sql.query(queryText, [], { fetchOptions: { signal: controller.signal } });
  } catch (e) {
    if (controller.signal.aborted) fail(`Query timed out after ${TIMEOUT_MS}ms.`);
    fail(`Query failed: ${e.message || e}`);
    return;
  } finally {
    clearTimeout(timer);
  }

  const capped = rows.slice(0, args.limit);
  const out = capped.map((row) => {
    const clean = {};
    for (const [k, v] of Object.entries(row)) clean[k] = truncateCell(v);
    return clean;
  });

  console.log(JSON.stringify({
    rowCount: rows.length,
    returned: out.length,
    truncated: rows.length > out.length,
    rows: out,
  }, null, 2));
}

run();
