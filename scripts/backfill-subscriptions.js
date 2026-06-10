require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function backfill() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not found in .env.local');
    process.exit(1);
  }
  const sql = neon(dbUrl);

  const usersWithoutSub = await sql`
    SELECT u.id, u.email
    FROM users u
    LEFT JOIN subscriptions s ON s.user_id = u.id
    WHERE s.id IS NULL
  `;

  console.log(`Found ${usersWithoutSub.length} user(s) without a subscriptions row.`);

  let inserted = 0;
  for (const user of usersWithoutSub) {
    await sql`
      INSERT INTO subscriptions (user_id, tier, status)
      VALUES (${user.id}, 'free', 'active')
      ON CONFLICT (user_id) DO NOTHING
    `;
    console.log(`INSERT: ${user.email} (${user.id})`);
    inserted++;
  }

  console.log(`\nDone. Inserted ${inserted} subscription row(s), 0 skipped.`);
}

backfill().catch(err => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
