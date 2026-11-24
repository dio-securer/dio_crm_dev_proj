import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';

const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
console.log('isolated in-memory server', server.url);
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', timeout: 120000 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  const page = await context.newPage();
  await page.goto(`${server.url}/activities`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('.hq-act-page').waitFor({ timeout: 120000 });
  await page.screenshot({ path: 'docs/crm-activity/evidence/W00/activity-before-list-pc.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/crm-activity/evidence/W00/activity-before-list-mobile.png', fullPage: true });
  console.log('captured PC and mobile current built HQ screen');
} finally {
  if (browser) await browser.close();
  await server.close();
}
