require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function run() {
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT table_name, column_name, udt_name, data_type
    FROM information_schema.columns
    WHERE table_name IN ('work_packets', 'work_patterns')
      AND column_name = 'embedding'
  `;
  console.log(JSON.stringify(rows, null, 2));
}

run().catch(e => { console.error(e.message); process.exit(1); });
