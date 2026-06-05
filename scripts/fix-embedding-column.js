require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function run() {
  const sql = neon(process.env.DATABASE_URL);
  // Drop and re-add the embedding column with correct dimension
  // Safe because all embedding values are NULL at this point
  await sql`ALTER TABLE work_packets DROP COLUMN IF EXISTS embedding`;
  await sql`ALTER TABLE work_packets ADD COLUMN embedding vector(1536)`;
  // Same for work_patterns if it exists
  await sql`ALTER TABLE work_patterns DROP COLUMN IF EXISTS embedding`;
  await sql`ALTER TABLE work_patterns ADD COLUMN embedding vector(1536)`;
  console.log('embedding columns fixed to vector(1536)');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
