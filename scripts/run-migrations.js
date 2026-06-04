// Applies all drizzle migration SQL files directly to Neon via serverless driver
// Usage: node scripts/run-migrations.js
const { neon, Pool } = require("@neondatabase/serverless");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env" });

const MIGRATIONS_DIR = path.join(__dirname, "..", "drizzle");

function splitStatements(sql) {
  return sql
    .split("--> statement-breakpoint")
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Enable pgvector first (idempotent)
  console.log("Enabling pgvector...");
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
  console.log("pgvector ready.");

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith(".sql"))
    .sort();

  let total = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    const statements = splitStatements(content);
    console.log(`\n[${file}] — ${statements.length} statements`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;
      try {
        await pool.query(stmt);
        total++;
        process.stdout.write(".");
      } catch (e) {
        const already = ["42P07", "42710", "42701", "42P16"].includes(e.code) || e.message?.includes("already exists");
        if (already) {
          skipped++;
          process.stdout.write("s");
        } else {
          failed++;
          console.error(`\n  ✗ stmt ${i + 1} [${e.code}]: ${e.message?.slice(0, 150) || JSON.stringify(e).slice(0, 150)}`);
        }
      }
    }
  }

  await pool.end();
  console.log(`\n\nDone. applied=${total} already-existed=${skipped} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
