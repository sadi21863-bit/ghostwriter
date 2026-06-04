const { Pool } = require("@neondatabase/serverless");
require("dotenv").config({ path: ".env" });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log("Total tables:", tables.rows.length);
  tables.rows.forEach(t => process.stdout.write(t.table_name + " "));
  console.log("");

  await pool.query("CREATE INDEX IF NOT EXISTS semantic_cache_type_idx ON semantic_cache(cache_type)");
  console.log("semantic_cache index ready.");

  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
