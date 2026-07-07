import { chromium } from "@playwright/test";

const urls = [
  "https://docs.higgsfield.ai/docs/help/faq.md",
  "https://docs.higgsfield.ai/docs/how-to/introduction.md",
];

const browser = await chromium.launch({ headless: true });
try {
  for (const url of urls) {
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1500);
      const bodyText = await page.locator("body").innerText();
      console.log(`\n===== ${url} =====`);
      console.log(bodyText.slice(0, 6000));
    } catch (e) {
      console.log(`\n===== ${url} (FAILED: ${e.message}) =====`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
