import { chromium } from "@playwright/test";

const url = "https://www.segmind.com/models/storydiffusion/pricing";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  const bodyText = await page.locator("body").innerText();
  console.log(bodyText);
} finally {
  await browser.close();
}
