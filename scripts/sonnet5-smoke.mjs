import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

// Minimal .env.local loader (no dotenv dependency needed for a one-off script)
const envPath = process.argv[2] ?? ".env.local";
const envText = fs.readFileSync(envPath, "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-5";

// A system block long enough to be cacheable (Anthropic's minimum is 1024 tokens
// for Sonnet-class models) so the second call can demonstrate a real cache hit,
// not just a syntactically-accepted cache_control field.
const longSystemText =
  "You are a terse assistant for a smoke test. Reply with exactly one short sentence confirming you received the instructions. " +
  "Context filler for cache-eligibility (repeated on purpose): " +
  "The quick brown fox jumps over the lazy dog. ".repeat(150);

async function call(label) {
  const start = Date.now();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 50,
    system: [{ type: "text", text: longSystemText, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: "Reply with one short sentence." }],
  });
  const ms = Date.now() - start;
  const text = msg.content.filter(b => b.type === "text").map(b => b.text).join("");
  console.log(`\n--- ${label} (${ms}ms) ---`);
  console.log("model echoed:", msg.model);
  console.log("stop_reason:", msg.stop_reason);
  console.log("text:", JSON.stringify(text));
  console.log("usage:", JSON.stringify(msg.usage));
  return msg.usage;
}

try {
  const u1 = await call("call 1 (cache write expected)");
  const u2 = await call("call 2 (cache read expected)");

  console.log("\n=== SUMMARY ===");
  console.log("call1 cache_creation_input_tokens:", u1.cache_creation_input_tokens ?? 0);
  console.log("call2 cache_read_input_tokens:", u2.cache_read_input_tokens ?? 0);
  if ((u2.cache_read_input_tokens ?? 0) > 0) {
    console.log("PASS: cache hit confirmed on call 2 for model", MODEL);
  } else {
    console.log("WARN: no cache_read_input_tokens on call 2 - cache did not hit.");
  }
} catch (err) {
  console.error("\n=== SMOKE TEST FAILED ===");
  console.error("status:", err?.status);
  console.error("message:", err?.message);
  console.error(err);
  process.exit(1);
}
