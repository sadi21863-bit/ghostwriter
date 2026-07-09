// Cheap, read-only check to resolve a real discrepancy: this codebase's
// existing Soul ID code sends separate "hf-api-key"/"hf-secret" headers
// (sourced from the higgsfield-js SDK when it was written), but Higgsfield's
// own docs example shows a single "Authorization: Key {key}:{secret}" header.
// GET /v1/custom-references should be a free list call either way - this just
// confirms which auth format actually authenticates before spending any real
// credits on generation.
import { readFileSync } from "fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const apiKey = env.HIGGSFIELD_API_KEY;
const apiSecret = env.HIGGSFIELD_API_SECRET;
if (!apiKey || !apiSecret) throw new Error("HIGGSFIELD_API_KEY / HIGGSFIELD_API_SECRET not found in .env.local");

const BASE = "https://platform.higgsfield.ai";

// GET on the collection returned 405 for every auth shape (method not allowed,
// not auth-dependent) - use the single-resource GET instead (real route used by
// pollSoulIdTraining), with a dummy id: a 404 means auth passed and the id just
// doesn't exist; 401/403 means the auth header itself was rejected.
async function tryAuth(label, headers) {
  const res = await fetch(`${BASE}/v1/custom-references/00000000-0000-0000-0000-000000000000`, { headers });
  const text = await res.text();
  console.log(`${label}: ${res.status}`);
  console.log(`  ${text.slice(0, 300)}`);
}

await tryAuth("separate hf-api-key/hf-secret headers (existing code)", {
  "hf-api-key": apiKey,
  "hf-secret": apiSecret,
});

await tryAuth("single Authorization: Key {key}:{secret} header (docs example)", {
  "Authorization": `Key ${apiKey}:${apiSecret}`,
});

await tryAuth("Authorization: Bearer {key}:{secret}", {
  "Authorization": `Bearer ${apiKey}:${apiSecret}`,
});
