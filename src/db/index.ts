import * as schema from "./schema";

// Driver-aware drizzle factory.
// - Local dev (USE_LOCAL_PG=true): node-postgres over TCP to a local Postgres.
// - Production / Vercel: Neon serverless HTTP driver (original behaviour).
// Queries are identical across both drivers (drizzle abstracts them).
type AnyDrizzle = any;

export function createRawDrizzle(): AnyDrizzle {
  if (process.env.USE_LOCAL_PG === "true") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { drizzle } = require("drizzle-orm/node-postgres");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return drizzle(pool, { schema });
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { neon } = require("@neondatabase/serverless");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { drizzle } = require("drizzle-orm/neon-http");
  return drizzle(neon(process.env.DATABASE_URL!), { schema });
}

// Lazy singleton — the driver is constructed only on first DB access (inside a
// request handler), never at module-import time. This keeps build-time page-data
// collection from crashing when DATABASE_URL is a placeholder.
let _db: AnyDrizzle | null = null;
function getDb(): AnyDrizzle {
  if (!_db) _db = createRawDrizzle();
  return _db;
}

export const db = new Proxy({} as AnyDrizzle, {
  get(_t, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
