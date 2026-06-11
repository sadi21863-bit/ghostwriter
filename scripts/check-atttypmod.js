require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function run() {
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT a.attname, a.atttypmod, t.typname
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE c.relname = 'work_packets' AND a.attname = 'embedding'
  `;
  console.log(JSON.stringify(rows, null, 2));
}

run().catch(e => { console.error(e.message); process.exit(1); });
