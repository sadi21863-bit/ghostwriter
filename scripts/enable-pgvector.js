// Run before drizzle-kit push: enables pgvector extension on Neon
const { neon } = require("@neondatabase/serverless");
require("dotenv").config({ path: ".env" });

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log("pgvector extension enabled.");
  } catch (e) {
    if (e.message?.includes("already exists")) {
      console.log("pgvector already enabled.");
    } else {
      console.error("Failed:", e.message);
      process.exit(1);
    }
  }
}
main();
