import { chromium } from "@playwright/test";

const urls = [
  "https://www.segmind.com/models/all/text-to-speech-models",
  "https://www.segmind.com/models/chatterbox-tts/pricing",
  "https://www.segmind.com/models/dia/pricing",
  "https://www.segmind.com/models/tts-eleven-labs/pricing",
  "https://www.segmind.com/models/grok-tts/pricing",
];

const browser = await chromium.launch({ headless: true });
try {
  for (const url of urls) {
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1500);
      const bodyText = await page.locator("body").innerText();
      console.log(`\n===== ${url} =====`);
      console.log(bodyText.slice(0, 4000));
    } catch (e) {
      console.log(`\n===== ${url} (FAILED: ${e.message}) =====`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
