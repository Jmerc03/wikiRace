import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= new URL("../.local/browsers", import.meta.url).pathname;
const source = new URL("../docs/store/assets/promo-small.svg", import.meta.url);
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>html,body{margin:0}svg{display:block}</style>${await readFile(source, "utf8")}`);
  await page.screenshot({ path: "docs/store/assets/promo-small.png" });
} finally { await browser.close(); }
