require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function run() {
  const sql = neon(process.env.DATABASE_URL);
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log('pgvector extension enabled');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
