import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
// During Next.js static build Vercel injects a non-URL placeholder; fall back
// to a dummy so neon() doesn't throw at module load. Real queries fail fast
// with a clear error instead of crashing the build.
const url = process.env.DATABASE_URL ?? "";
const sql = neon(url.startsWith("postgres") ? url : "postgresql://localhost/placeholder");
export const db = drizzle(sql, { schema });