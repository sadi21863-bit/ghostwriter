import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

// Lazy singleton — neon() is called only on first DB access (inside a request
// handler), never at module-import time. This prevents Vercel's build-time
// page-data collection from crashing when DATABASE_URL is a placeholder.
let _db: DrizzleDb | null = null;
function getDb(): DrizzleDb {
  if (!_db) {
    _db = drizzle(neon(process.env.DATABASE_URL!), { schema });
  }
  return _db;
}

export const db = new Proxy({} as DrizzleDb, {
  get(_t, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});