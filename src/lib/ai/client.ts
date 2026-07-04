import Anthropic from "@anthropic-ai/sdk";

// Lazy singleton — the SDK client is constructed only on first access (inside
// a request handler), never at module-import time. This prevents Vercel's
// build-time page-data collection from crashing when ANTHROPIC_API_KEY is a
// placeholder, mirroring the same pattern used for the DB client (src/db/index.ts).
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _client;
}

export const anthropic = new Proxy({} as Anthropic, {
  get(_t, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
