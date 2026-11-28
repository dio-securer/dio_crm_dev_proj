import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';

// Isolated in-memory fixture; navigation and rendering only, no ERP submissions.
const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
const browser = await chromium.launch({ headless: true });
const routes = ['/leads', '/accounts', '/activities', '/activity-reports', '/direct-work', '/opportunities', '/pipeline', '/contracts', '/collection-plans', '/orders', '/fulfillment', '/ledger-statements', '/account360', '/analytics', '/ops', '/'];
const devices = [{ name: 'PC', width: 1440, height: 900 }, { name: 'tablet', width: 834, height: 1194 }, { name: 'mobile', width: 390, height: 844 }];
const failures = [];
try {
  for (const device of devices) {
    const context = await browser.newContext({ viewport: device, locale: 'ko-KR', serviceWorkers: 'block' });
    const page = await context.newPage();
    for (const route of routes) {
      try {
        const response = await page.goto(server.url + route, { waitUntil: 'domcontentloaded' });
        if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`);
        await page.locator('main').waitFor();
        await page.waitForTimeout(200);
        const measurement = await page.evaluate(() => ({ title: document.title, width: document.documentElement.scrollWidth, viewport: innerWidth }));
        if (measurement.width > measurement.viewport + 1) throw new Error(`horizontal overflow ${measurement.width - measurement.viewport}px`);
        console.log(`PASS ${device.name} ${route}`);
      } catch (error) { failures.push(`${device.name} ${route}: ${error.message}`); console.log(`FAIL ${failures.at(-1)}`); }
    }
    await context.close();
  }
} finally { await browser.close(); server.server.closeAllConnections(); await server.close(); }
console.log(JSON.stringify({ checked: routes.length * devices.length, failures }));
if (failures.length) process.exitCode = 1;
