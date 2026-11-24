import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', timeout: 120000 });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(pathToFileURL(path.resolve('docs/crm-activity/activity-flow-review.html')).href);
  await page.locator('details').evaluateAll(nodes => nodes.forEach(node => { node.open = true; }));
  const images = await page.locator('img').evaluateAll(nodes => nodes.map(node => ({ loaded: node.complete && node.naturalWidth > 0, alt: node.alt })));
  assert.ok(images.length >= 8 && images.every(image => image.loaded));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.locator('details').evaluateAll(nodes => nodes.forEach(node => { node.open = false; }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'docs/crm-activity/evidence/W00/activity-flow-guide-preview.png' });
  console.log(JSON.stringify({ images: images.length, widths: [1440, 390], result: 'PASS' }));
} finally { await browser.close(); }
