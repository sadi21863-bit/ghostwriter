// Launches a visible (headed) Chromium window with a persistent profile dir so
// you can log into your real Higgsfield account manually. The session (cookies)
// persists in .higgsfield-browser-profile/ so a follow-up script can reuse the
// same logged-in session headlessly to inspect pricing/API-keys pages without
// asking you to log in again.
//
// Run: node scripts/higgsfield-login-browser.mjs
// Then log in inside the opened window, and tell Claude once you're done.
import { chromium } from "@playwright/test";
import { resolve } from "path";

const PROFILE_DIR = resolve(process.cwd(), ".higgsfield-browser-profile");

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1280, height: 900 },
});

const page = context.pages()[0] ?? await context.newPage();
await page.goto("https://cloud.higgsfield.ai/", { waitUntil: "domcontentloaded" }).catch(() => {});

console.log("Browser window opened. Please log into your Higgsfield account in that window.");
console.log(`Session profile saved to: ${PROFILE_DIR}`);
console.log("Leave this process running until you've finished logging in, then let Claude know.");
console.log("Press Ctrl+C here to close the browser when done.");

// Keep alive until interrupted.
await new Promise(() => {});
