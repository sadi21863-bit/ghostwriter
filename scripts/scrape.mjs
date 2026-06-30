// Standalone Playwright automation/scraping script.
// Run: node scripts/scrape.mjs <url>
// Uses the chromium that ships with @playwright/test (already installed).
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "https://example.com";
const headless = process.env.HEADLESS !== "false";

const browser = await chromium.launch({ headless });
try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // --- customize below: this is the part you edit per target ---
  const data = {
    url,
    title: await page.title(),
    // Example: pull all top-level headings.
    headings: await page.locator("h1, h2").allInnerTexts(),
  };
  // -------------------------------------------------------------

  console.log(JSON.stringify(data, null, 2));
} finally {
  await browser.close();
}
