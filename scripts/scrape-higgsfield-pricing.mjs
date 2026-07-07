import { chromium } from "@playwright/test";

const urls = [
  "https://higgsfield.ai/pricing",
  "https://docs.higgsfield.ai/docs/llms.txt",
  "https://platform.higgsfield.ai",
];

const browser = await chromium.launch({ headless: true });
try {
  for (const url of urls) {
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(3000);
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
