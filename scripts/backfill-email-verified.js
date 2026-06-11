require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function backfill() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not found in .env.local');
    process.exit(1);
  }
  const sql = neon(dbUrl);

  const unverified = await sql`
    SELECT id, email, created_at
    FROM users
    WHERE email_verified IS NULL
  `;

  console.log(`Found ${unverified.length} user(s) without email_verified set.`);

  let updated = 0;
  for (const user of unverified) {
    await sql`
      UPDATE users SET email_verified = ${user.created_at} WHERE id = ${user.id}
    `;
    console.log(`VERIFIED (grandfathered): ${user.email} (${user.id})`);
    updated++;
  }

  console.log(`\nDone. Grandfathered ${updated} existing user(s) as email-verified.`);
}

backfill().catch(err => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
