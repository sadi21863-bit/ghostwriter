import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(join(__dir, "../.env.local"), "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}

const { neon } = await import("@neondatabase/serverless");
const sql = neon(env.DATABASE_URL);

const result = await sql`
  SELECT id, name FROM characters WHERE project_id = '4a365d59-e102-4b13-aeea-f570b8758a06'
`;
console.log(JSON.stringify(result, null, 2));
