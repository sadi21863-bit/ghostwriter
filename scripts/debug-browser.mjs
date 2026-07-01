// Launches Playwright's own Chromium with a remote-debugging port open, then
// stays alive so an external tool (e.g. the chrome-devtools-mcp MCP server via
// --browserUrl) can attach to the SAME browser session Playwright would use.
// This is the bridge between the two: Playwright drives/asserts test scenarios,
// chrome-devtools-mcp inspects the live session (console, network, performance,
// screenshots) without needing its own separate Chrome launch.
//
// Run: node scripts/debug-browser.mjs [url]
// Default url: http://localhost:3000 (assumes `npm run dev` is running separately)
//
// Then point chrome-devtools-mcp at the printed port, e.g.:
//   npx chrome-devtools-mcp@latest --browserUrl http://127.0.0.1:9222
// (already configured as the `chrome-devtools` MCP server — pass --browserUrl
// via its args if you want it to attach here instead of launching its own Chrome.)
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "http://localhost:3000";
const port = process.env.DEBUG_PORT ?? "9222";

const browser = await chromium.launch({
  headless: false,
  args: [`--remote-debugging-port=${port}`],
});

const page = await browser.newPage();
await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {
  console.error(`Could not reach ${url} — is \`npm run dev\` running?`);
});

console.log(`Debuggable Chromium running.`);
console.log(`  Page: ${url}`);
console.log(`  Remote debugging: http://127.0.0.1:${port}`);
console.log(`  Attach chrome-devtools-mcp with: --browserUrl http://127.0.0.1:${port}`);
console.log(`Press Ctrl+C to close.`);

// Keep the process (and browser) alive until interrupted.
await new Promise(() => {});
