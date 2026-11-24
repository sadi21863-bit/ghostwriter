#!/usr/bin/env node
/**
 * Preflight 0 — legacy Neon reachability + identity probe.
 *
 * READ-ONLY BY CONSTRUCTION. This script issues SELECT-only queries against
 * information_schema / pg_catalog and never mutates schema or data.
 *
 * Purpose (v4 §2): determine whether the legacy production database still
 * exists, and — critically — whether the database we reached is actually the
 * one the plan assumes. A probe that returns "reachable" for the WRONG
 * database would send Phase -1 down the -1A archaeology branch and build a
 * canonical baseline from the wrong source. That failure is silent, so the
 * probe asserts identity rather than just connectivity.
 *
 * Branch decision is recorded in docs/migration/legacy-db-status.md.
 *
 * Usage: npm run db:legacy-check
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const TIMEOUT_MS = 8000;
// Per-count timeout is separate: Neon throttles bursts, and a single tight
// global timeout produced a partially-failed 41-query sweep on the first run.
const COUNT_TIMEOUT_MS = 20000;

/** Minimal .env reader — avoids a dotenv dependency for a single variable. */
function readDatabaseUrl() {
  // .env takes precedence, matching the documented drizzle-kit workflow
  // (Copy-Item .env.local .env -Force on Windows).
  for (const file of [".env", ".env.local"]) {
    const p = resolve(ROOT, file);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, "utf8").match(/^\s*DATABASE_URL\s*=\s*(.*)$/m);
    if (!m) continue;
    let v = m[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (v) return { url: v, source: file };
  }
  return null;
}

/**
 * Parse table names out of src/db/schema.ts so we can diff code vs production.
 * The EXPORT name is camelCase (plotThreads) while the SQL table name is
 * snake_case (plot_threads) — we must compare the SQL name, or every
 * multi-word table appears falsely "missing".
 */
function schemaTsTables() {
  const p = resolve(ROOT, "src/db/schema.ts");
  if (!existsSync(p)) return null;
  const src = readFileSync(p, "utf8");
  const names = new Set();
  for (const m of src.matchAll(/export const \w+\s*=\s*pgTable\(\s*["']([a-z0-9_]+)["']/g)) {
    names.add(m[1]);
  }
  return names.size ? names : null;
}

const ID_RE = /^[a-z_][a-z0-9_]*$/; // guard before interpolating catalog values

function classifyError(err) {
  const raw = `${err?.cause?.message ?? ""} ${err?.message ?? ""}`.toLowerCase();
  const hint = {
    kind: "unknown",
    // Distinguish the branches v4 §2.2 cares about.
    detail:
      "Could not classify. Record the raw error text in legacy-db-status.md before choosing a branch.",
  };
  if (/enotfound|eai_again|getaddrinfo|dns/.test(raw)) {
    return { kind: "dns-or-project-deleted", detail: "Host does not resolve — Neon project likely deleted or endpoint removed." };
  }
  if (/password authentication failed|authentication|401|unauthorized|invalid token|jwt/.test(raw)) {
    return { kind: "auth", detail: "Endpoint resolved but credentials rejected — DB likely still exists; password may have been rotated." };
  }
  if (/suspend|inactive|provision/.test(raw)) {
    return { kind: "suspended", detail: "Neon reports the project as suspended/inactive — restorable from the console." };
  }
  if (/timeout|etimedout|aborted|econnreset|socket hang up/.test(raw)) {
    return { kind: "timeout-or-network", detail: "Timed out or the socket dropped — may be a cold start or a network issue. Retry before concluding." };
  }
  if (/econnrefused/.test(raw)) return { kind: "refused", detail: "Connection refused." };
  void hint;
  return hint;
}

async function countTable(sql, table) {
  // Per-query timeout + one retry. Neon cold-starts and throttles bursts, so a
  // single global timeout can fail partway through 41 sequential queries and
  // silently produce an incomplete measurement.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const scoped = neonScoped(sql, table);
    try {
      const rows = await scoped();
      return rows?.[0]?.n ?? null;
    } catch (err) {
      const msg = `${err?.message ?? String(err)}`;
      const transient = /timeout|aborted|econnreset|socket hang up|fetch failed/i.test(msg);
      if (!transient || attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  return null;
}

// Builds a callable that executes the count with its own generous timeout.
function neonScoped(baseSql, table) {
  return () =>
    baseSql.query(`select count(*)::int as n from public."${table}"`, undefined, {
      signal: AbortSignal.timeout(COUNT_TIMEOUT_MS),
    });
}

async function main() {
  const report = {
    probedAt: new Date().toISOString(),
    timeoutMs: TIMEOUT_MS,
    status: "unknown",
    envSource: null,
    target: null,
    identity: null,
    tables: null,
    driftMarkers: null,
    rowCounts: null,
    error: null,
    branch: null,
  };

  const found = readDatabaseUrl();
  if (!found) {
    report.status = "no-database-url";
    report.error = "No DATABASE_URL found in .env or .env.local.";
    report.branch = "UNDECIDED — supply DATABASE_URL, then re-run.";
    emit(report);
    return;
  }
  report.envSource = found.source;

  let host = "(unparseable)";
  let dbName = "(unknown)";
  let isPlaceholder = false;
  try {
    const u = new URL(found.url);
    host = u.hostname;
    dbName = u.pathname.replace(/^\//, "") || "(default)";
    const pw = u.password ? decodeURIComponent(u.password) : "";
    isPlaceholder = /password|xxxx|change[-_]?me|your|placeholder|example/i.test(pw) || host === "host";
  } catch {
    isPlaceholder = true;
  }
  report.target = { host, database: dbName, looksLikePlaceholder: isPlaceholder };
  // NOTE: credentials are intentionally never echoed.

  if (isPlaceholder) {
    report.status = "placeholder-credentials";
    report.error = "DATABASE_URL resolves to a placeholder/example value — cannot probe.";
    report.branch = "UNDECIDED — supply a real DATABASE_URL, then re-run.";
    emit(report);
    return;
  }

  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(found.url, { fetchOptions: { signal: AbortSignal.timeout(TIMEOUT_MS) } });

  try {
    // 1. Connectivity + server identity.
    const [conn] = await sql`
      select current_database()   as db,
             current_user         as usr,
             version()            as version,
             inet_server_addr()::text as server_addr,
             now()                as now
    `;
    report.identity = {
      database: conn.db,
      user: conn.usr,
      serverAddr: conn.server_addr,
      version: String(conn.version).split(" on ")[0],
      serverTime: conn.now,
    };

    // 2. Table inventory (user tables only).
    const tRows = await sql`
      select table_name, table_type
      from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `;
    const live = new Set(
      tRows.filter((r) => r.table_type === "BASE TABLE").map((r) => r.table_name.toLowerCase())
    );

    const codeTables = schemaTsTables();
    const codeSet = codeTables ? new Set([...codeTables].map((t) => t.toLowerCase())) : null;

    report.tables = {
      inProduction: live.size,
      inSchemaTs: codeSet ? codeSet.size : null,
      inProductionNotInSchema: codeSet ? [...live].filter((t) => !codeSet.has(t)) : null,
      inSchemaNotInProduction: codeSet ? [...codeSet].filter((t) => !live.has(t)) : null,
    };

    // 3. Drift markers specific to this codebase's known history.
    const exts = await sql`select extname from pg_extension order by extname`;
    const idx = await sql`
      select indexname, tablename
      from pg_indexes
      where schemaname = 'public'
      order by tablename, indexname
    `;
    const idxNames = idx.map((r) => r.indexname.toLowerCase());
    report.driftMarkers = {
      extensions: exts.map((r) => r.extname),
      pgvectorEnabled: exts.some((e) => e.extname === "vector"),
      publicIndexCount: idx.length,
      // v4 §4.1: the add-indexes.js typo — index references a table that does not exist.
      passwordResetTokenIndexExists: idxNames.some((n) => n.includes("pwd_reset_tokens")),
      correctPasswordResetIndexExists: idxNames.some((n) => n.includes("password_reset_tokens")),
      // v4 §4.3: semantic_cache needs a unique constraint for onConflictDoNothing to dedupe.
      semanticCacheUniqueConstraints: idxNames.filter((n) => n.includes("semantic_cache")),
      subscriptionsUniqueOnUserId: idxNames.some(
        (n) => n.includes("subscriptions") && (n.includes("user_id") || n.includes("userid"))
      ),
    };

    // 4. Exact row counts — the evidence that decides whether any real data survived.
    // NOTE: the Neon HTTP driver only accepts tagged-template calls (sql`...`), never
    // sql("..."). Calling it conventionally throws, so every count below must go
    // through the tagged form. Table names come from the catalog and are
    // regex-validated above, so interpolation here cannot inject.
    const counts = {};
    const countFailures = [];
    for (const t of live) {
      if (!ID_RE.test(t)) continue;
      try {
        counts[t] = await countTable(sql, t);
      } catch (err) {
        counts[t] = null;
        countFailures.push(`${t}: ${(err?.message ?? String(err)).slice(0, 120)}`);
      }
    }
    report.rowCounts = counts;
    report.rowCountFailures = countFailures;
    const counted = Object.values(counts).filter((n) => typeof n === "number");
    const unmeasured = Object.values(counts).filter((n) => n === null).length;
    const totalRows = counted.reduce((a, b) => a + b, 0);
    const nonEmpty = Object.entries(counts).filter(([, n]) => (n ?? 0) > 0);

    // 6. Branch decision.
    report.status = "reachable";
    const identityOk =
      report.tables.inSchemaNotInProduction === null ||
      report.tables.inSchemaNotInProduction.length === 0;
    report.identity.tablesMatchSchemaTs = identityOk;

    if (unmeasured > 0) {
      // Never conclude "empty" from a partial measurement — that was a real bug
      // in the first run of this probe, where every count silently failed.
      report.branch =
        `INCOMPLETE MEASUREMENT — ${unmeasured} of ${Object.keys(counts).length} table counts failed. ` +
        "The emptiness conclusion is NOT yet supported. Fix the count query before choosing a branch.";
    } else if (report.tables.inSchemaNotInProduction?.length > 0) {
      report.branch =
        "REACHABLE BUT SCHEMA MISMATCH — this is NOT the database the plan assumes. " +
        `Code expects ${report.tables.inSchemaNotInProduction.length} table(s) absent here: ` +
        report.tables.inSchemaNotInProduction.slice(0, 10).join(", ") +
        ". Do NOT start Phase -1A. Confirm which project this endpoint points at.";
    } else if (totalRows === 0) {
      report.branch = "REACHABLE AND EMPTY — schema present, no rows. Phase -1A for structure; treat migration as synthetic fixtures, not data migration.";
    } else {
      report.branch = `REACHABLE AND POPULATED (${totalRows} rows across ${nonEmpty.length} tables) — Phase -1A archaeology against observed production.`;
    }
    report.dataSummary = { totalRows, nonEmptyTableCount: nonEmpty.length, unmeasuredTables: unmeasured };
  } catch (err) {
    const c = classifyError(err);
    report.status = `unreachable:${c.kind}`;
    report.error = c.detail;
    report.branch =
      c.kind === "auth"
        ? "UNREACHABLE (auth) — DB likely still exists. Recover credentials from the Neon console, then re-run. Phase -1A remains viable."
        : c.kind === "suspended"
          ? "UNREACHABLE (suspended) — restorable from the Neon console, then Phase -1A. Do not spend days on this."
          : "UNREACHABLE — do not assume archaeology is possible. Proceed with Phase -1B reconstruction and record the raw error.";
    report.rawErrorText = `${err?.cause?.message ?? ""} ${err?.message ?? ""}`.slice(0, 400);
  }

  emit(report);
  writeStatusDoc(report);
}

function emit(report) {
  console.log("\n=== Legacy DB Preflight ===");
  console.log(`probedAt   : ${report.probedAt}`);
  console.log(`envSource  : ${report.envSource}`);
  console.log(`target     : ${report.target ? `${report.target.host} / ${report.target.database}` : "-"}`);
  console.log(`status     : ${report.status}`);
  if (report.identity) {
    console.log(`identity   : db=${report.identity.database} user=${report.identity.user} server=${report.identity.serverAddr}`);
    console.log(`             version=${report.identity.version}`);
  }
  if (report.tables) {
    console.log(`tables     : production=${report.tables.inProduction} schemaTs=${report.tables.inSchemaTs}`);
    if (report.tables.inProductionNotInSchema?.length)
      console.log(`             extra in prod : ${report.tables.inProductionNotInSchema.join(", ")}`);
    if (report.tables.inSchemaNotInProduction?.length)
      console.log(`             MISSING in prod: ${report.tables.inSchemaNotInProduction.join(", ")}`);
  }
  if (report.driftMarkers) {
    const d = report.driftMarkers;
    console.log(`extensions : ${d.extensions.join(", ") || "(none)"}  pgvector=${d.pgvectorEnabled}`);
    console.log(`indexes    : ${d.publicIndexCount} public`);
    console.log(`  password_reset_tokens index present : ${d.correctPasswordResetIndexExists} (typo'd variant: ${d.passwordResetTokenIndexExists})`);
    console.log(`  semantic_cache uniques             : ${d.semanticCacheUniqueConstraints.join(", ") || "NONE"}`);
    console.log(`  subscriptions UNIQUE(user_id)      : ${d.subscriptionsUniqueOnUserId}`);
  }
  if (report.rowCounts) {
    const vals = Object.values(report.rowCounts);
    const counted = vals.filter((n) => typeof n === "number");
    const unmeasured = vals.filter((n) => n === null).length;
    if (unmeasured > 0) {
      console.log(`rows       : INCOMPLETE — ${unmeasured}/${vals.length} table counts failed (not "empty")`);
      if (report.rowCountFailures?.length) console.log(`             first failure: ${report.rowCountFailures[0]}`);
    } else {
      const total = counted.reduce((a, b) => a + b, 0);
      console.log(`rows       : ${total} total across ${counted.filter((n) => n > 0).length} non-empty tables`);
      console.log("");
      console.log("  populated tables (row counts, descending):");
      const populated = Object.entries(report.rowCounts)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1]);
      for (const [t, n] of populated) console.log(`    ${t.padEnd(30)} ${n}`);
      const empty = Object.entries(report.rowCounts)
        .filter(([, n]) => n === 0)
        .map(([t]) => t);
      if (empty.length) {
        console.log("");
        console.log(`  empty tables (${empty.length}): ${empty.join(", ")}`);
      }
    }
  }
  if (report.error) console.log(`error      : ${report.error}`);
  if (report.rawErrorText) console.log(`raw        : ${report.rawErrorText}`);
  console.log(`\nBRANCH     : ${report.branch}\n`);
}

function writeStatusDoc(report) {
  const dir = resolve(ROOT, "docs/migration");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const out = resolve(dir, "legacy-db-status.md");
  const payload = JSON.stringify(report, null, 2);

  writeFileSync(
    out,
    `# Legacy DB status (Preflight 0)

Generated by \`npm run db:legacy-check\`. Read-only probe. Regenerate rather than edit.

- **Probed:** ${report.probedAt}
- **Env source:** ${report.envSource}
- **Target:** ${report.target ? `${report.target.host} / ${report.target.database}` : "-"}
- **Status:** ${report.status}
- **BRANCH DECISION:** ${report.branch}

## Interpretation

${
  report.status === "reachable"
    ? "The endpoint resolved and answered queries. Phase -1A applies **only if** the identity assertion passed — i.e. the live schema contains every table \`src/db/schema.ts\` declares. A reachable-but-mismatched endpoint means the wrong database was probed and archaeology must not begin."
    : "The endpoint did not answer queries. Per v4 §2.1, do not spend days attempting to resurrect an irrecoverable instance; record the classification and continue with Phase -1B reconstruction."
}

## Drift markers observed

${
  report.driftMarkers
    ? [
        `- Extensions: ${report.driftMarkers.extensions.join(", ") || "(none)"}`,
        `- pgvector enabled: ${report.driftMarkers.pgvectorEnabled}`,
        `- Public indexes: ${report.driftMarkers.publicIndexCount}`,
        `- \`password_reset_tokens\` index present: ${report.driftMarkers.correctPasswordResetIndexExists}`,
        `- \`pwd_reset_tokens\` (typo'd variant from add-indexes.js) present: ${report.driftMarkers.passwordResetTokenIndexExists}`,
        `- \`semantic_cache\` unique constraints: ${report.driftMarkers.semanticCacheUniqueConstraints.join(", ") || "**NONE**"}`,
        `- \`subscriptions\` UNIQUE(user_id): ${report.driftMarkers.subscriptionsUniqueOnUserId}`,
      ].join("\n")
    : "- (probe did not reach catalog stage)"
}

## Machine-readable probe output

\`\`\`json
${payload}
\`\`\`
`,
    "utf8"
  );
  console.log(`Wrote ${out}`);
}

await main();