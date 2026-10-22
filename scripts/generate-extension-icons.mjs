import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= new URL("../.local/browsers", import.meta.url).pathname;
const svg = await readFile(new URL("../apps/extension/public/icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  for (const size of [16, 32, 48, 128]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await page.screenshot({ path: `apps/extension/public/icon-${size}.png`, omitBackground: true });
    await page.close();
  }
} finally { await browser.close(); }
