import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';

const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [768, 1024]) {
    const page = await browser.newPage({ viewport: { width, height: 1024 } });
    for (const route of ['/leads', '/accounts', '/activities', '/opportunities', '/contracts', '/collection-plans', '/orders', '/fulfillment', '/pipeline', '/analytics']) {
      const response = await page.goto(server.url + route);
      assert.equal(response.status(), 200, `${route}: page response`);
      await page.locator('.route-surface').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${width} ${route}: horizontal overflow`);
      const heading = page.locator('.route-surface :is(.hq-sales-page > header, .hq-act-page > header, .h06-page:not(.h06-embedded) > .dio-workspace-heading)').first();
      if (await heading.count()) assert.equal(await heading.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(16, 43, 93)', `${width} ${route}: tablet heading`);
      console.log(`${width} ${route} PASS`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.server.closeAllConnections();
  await server.close();
}
