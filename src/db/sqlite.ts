import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { drizzle } from "drizzle-orm/sqlite-proxy";

import { SQLITE_DDL } from "./sqlite-ddl";
import * as schema from "./sqlite-schema";

// Local SQLite baseline for the pg->SQLite tracer (docs/migration/phase3-prep.md §4).
// Same drizzle query-builder API, different driver: node:sqlite (built into Node 24,
// SQLite 3.53.1) behind the drizzle-orm/sqlite-proxy adapter, so the query code the pg
// adapters use is written once and runs on both engines unchanged.

type DrizzleSqliteDb = ReturnType<typeof drizzle<typeof schema>>;

export type { DrizzleSqliteDb };

/**
 * Drizzle's sqlite-proxy contract is positional: the callback must return raw value
 * arrays, and for `get` the `rows` value is the single row itself (session.js's
 * mapGetResult treats it as one row; `undefined` maps to findFirst -> undefined).
 *
 * node:sqlite returns objects by default, which is UNSAFE here: SQLite object mode
 * MERGES duplicate column names (a 2-table join selects `id` twice; the object keeps
 * one `id` key, the other's value is silently lost). `stmt.setReturnArrays(true)`
 * makes get/all/iterate return native positional arrays instead — join-safe by
 * construction and exactly matching drizzle's contract, no conversion needed.
 */
function makeProxyCallback(sqlite: DatabaseSync) {
  return async (_sql: string, params: unknown[], method: "run" | "all" | "values" | "get") => {
    const stmt = sqlite.prepare(_sql);
    stmt.setReturnArrays(true);
    switch (method) {
      case "run": {
        stmt.run(...(params as never[]));
        return { rows: [] };
      }
      case "get": {
        return { rows: stmt.get(...(params as never[])) as unknown as never[] };
      }
      case "all":
      case "values": {
        return { rows: stmt.all(...(params as never[])) as unknown as never[][] };
      }
      default: {
        throw new Error(`sqlite-proxy: unsupported method ${method as string}`);
      }
    }
  };
}
function runBaselineDdl(sqlite: DatabaseSync): void {
  const tableCount = sqlite.prepare("SELECT count(*) AS c FROM sqlite_master").get() as {
    c: number;
  } | null;
  // DDL is a verbatim vendored baseline (no migration engine at tracer phase): only
  // run it against an empty database; an already-initialized file is opened as-is.
  if (!tableCount || tableCount.c === 0) {
    for (const statement of SQLITE_DDL.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) {
        sqlite.exec(trimmed);
      }
    }
  }
}

export interface SqliteDbHandle {
  sqlite: DatabaseSync;
  db: DrizzleSqliteDb;
}

export function createSqliteDb(location: string): SqliteDbHandle {
  if (location !== ":memory:") {
    mkdirSync(path.dirname(path.resolve(location)), { recursive: true });
  }
  const sqlite = new DatabaseSync(location);
  // Foreign keys are SQLite-per-connection (unlike pg, where they are server state);
  // every SQLite connection must opt in explicitly or cascades/violations are ignored.
  sqlite.exec("PRAGMA foreign_keys = ON;");
  if (location !== ":memory:") {
    sqlite.exec("PRAGMA journal_mode = WAL;");
  }
  runBaselineDdl(sqlite);
  const db = drizzle(makeProxyCallback(sqlite), { schema });
  return { sqlite, db };
}

// Lazy singleton — mirroring src/db/index.ts's neon pattern: nothing opens/initializes
// at module-import time; the proxy resolves on first property access. The file path is
// local-dev only (dormant until a local host slice wires it up); override via SQLITE_PATH.
const DEFAULT_SQLITE_PATH = process.env.SQLITE_PATH ?? "./data/ghostwriter.sqlite3";
let _default: SqliteDbHandle | null = null;
function getDefaultSqliteDb(): DrizzleSqliteDb {
  if (!_default) {
    _default = createSqliteDb(DEFAULT_SQLITE_PATH);
  }
  return _default.db;
}

export const sqliteDb = new Proxy({} as DrizzleSqliteDb, {
  get(_t, prop, receiver) {
    return Reflect.get(getDefaultSqliteDb(), prop, receiver);
  },
});
