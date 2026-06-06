require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id)',
  'CREATE INDEX IF NOT EXISTS chapters_project_id_idx ON chapters(project_id)',
  'CREATE INDEX IF NOT EXISTS characters_project_id_idx ON characters(project_id)',
  'CREATE INDEX IF NOT EXISTS story_memories_project_id_idx ON story_memories(project_id)',
  'CREATE INDEX IF NOT EXISTS generations_project_id_idx ON generations(project_id)',
  'CREATE INDEX IF NOT EXISTS platform_events_created_idx ON platform_events(created_at)',
  'CREATE INDEX IF NOT EXISTS platform_events_event_idx ON platform_events(event)',
  'CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON referrals(referrer_id)',
  'CREATE INDEX IF NOT EXISTS pwd_reset_tokens_token_idx ON password_reset_tokens(token)',
  'CREATE INDEX IF NOT EXISTS semantic_cache_type_idx ON semantic_cache(cache_type)',
];

async function run() {
  let ok = 0, fail = 0;
  for (const idx of INDEXES) {
    try {
      await sql.query(idx);
      console.log('✓', idx.match(/INDEX \w+/)[0]);
      ok++;
    } catch (e) {
      console.error('✗ FAILED:', idx);
      console.error('  Error:', e.message);
      fail++;
    }
  }
  console.log(`\nDone: ${ok} created, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

run();
