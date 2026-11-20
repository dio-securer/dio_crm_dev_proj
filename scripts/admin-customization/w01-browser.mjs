import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHqServer } from '../hq-standard/server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'docs/admin-platform/customization/evidence/w01');
await fs.mkdir(out, { recursive: true });
const result = { kind: 'W01 rendered screen inventory', source: 'current frontend/dist', viewports: {}, failures: [], screenshots: [] };
let runtime, browser;
try {
  runtime = await startHqServer({ port: 0, storageDir: false });
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ headless: true, ...(process.env.HQ_BROWSER_CHANNEL ? { channel: process.env.HQ_BROWSER_CHANNEL } : {}) });
  result.browserVersion = browser.version();
  for (const [name, viewport] of [['pc', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
    await context.route('**/*', route => new URL(route.request().url()).origin === runtime.url ? route.continue() : route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', error => result.failures.push(`${name}: ${error.message}`));
    const states = {};
    async function shot(label) {
      const filename = `${name}-${label}.png`;
      states[label] = await page.evaluate(() => ({
        title: document.title,
        tabs: [...document.querySelectorAll('[role="tab"]')].map(el => ({ key: el.getAttribute('data-tab-key'), selected: el.getAttribute('aria-selected') })),
        fields: [...document.querySelectorAll('[data-field-key]')].map(el => el.getAttribute('data-field-key')),
        apiFields: [...document.querySelectorAll('[data-hq-api-field]')].map(el => el.getAttribute('data-hq-api-field')),
        configAnchors: document.querySelectorAll('[data-config-id]').length,
        dialogs: [...document.querySelectorAll('dialog[open]')].map(el => el.querySelector('h2')?.textContent ?? ''),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      }));
      await page.screenshot({ path: path.join(out, filename) });
      result.screenshots.push(filename);
    }
    await page.goto(`${runtime.url}/leads?hq=1`);
    await page.locator('.hq-lead-list').waitFor();
    await shot('lead-list');
    await page.locator('.hq-lead-list [data-lead-id]').first().click();
    await page.locator('.hq-lead-detail').waitFor();
    await shot('lead-detail');
    for (const key of ['keyman', 'hospital', 'exclusions', 'marketing', 'history', 'activities']) {
      await page.locator(`[data-tab-key="${key}"]`).click();
      await shot(`lead-${key}`);
    }
    await page.locator('[data-tab-key="hira"]').click();
    await shot('lead-hira');
    if (await page.locator('.hq-lead-detail .page-actions button').count()) {
      await page.locator('.hq-lead-detail .page-actions button').first().click();
      await page.locator('dialog.hq-customer-modal[open]').waitFor();
      await shot('lead-owner-popup');
      await page.locator('dialog.hq-customer-modal[open]').getByRole('button', { name: '닫기' }).first().click().catch(async () => { await page.keyboard.press('Escape'); });
    }
    if (await page.locator('.hq-lead-detail .page-actions .button-primary').count()) {
      await page.locator('.hq-lead-detail .page-actions .button-primary').click();
      await page.locator('dialog.hq-customer-modal[open]').waitFor();
      await shot('lead-convert-popup');
    }
    await page.goto(`${runtime.url}/leads?hq=1`);
    await page.locator('.hq-lead-list').waitFor();
    await page.locator('.hq-lead-list .button-primary').first().click();
    await page.locator('dialog.hq-customer-modal[open]').waitFor();
    await shot('lead-create');
    await page.goto(`${runtime.url}/accounts?hq=1`);
    await page.locator(name === 'pc' ? '.account-desktop' : '.account-mobile').waitFor();
    await page.locator(name === 'pc' ? '.pc-table-card tbody tr' : '.mob-account-row').first().waitFor();
    await shot('account-list');
    await page.getByTestId('open-account-ledger').click();
    await page.locator('dialog.hq-customer-modal[open]').waitFor();
    await shot('account-bulk-popup');
    await page.keyboard.press('Escape');
    await page.getByTestId('open-account-merge').click();
    await page.locator('dialog.hq-customer-modal[open]').waitFor();
    await shot('account-merge-popup');
    await page.keyboard.press('Escape');
    await page.locator(name === 'pc' ? '.account-desktop .page-actions .button-primary' : '.mob-new').click();
    await page.locator(name === 'pc' ? '.pc-window-form' : '.mob-edit-form').waitFor();
    await shot('account-create');
    await page.goto(`${runtime.url}/accounts?hq=1`);
    await page.locator(name === 'pc' ? '.account-desktop' : '.account-mobile').waitFor();
    await page.locator(name === 'pc' ? '.pc-table-card tbody tr' : '.mob-account-row').first().click();
    await page.locator('.hq-account-workspace').waitFor();
    await shot('account-detail-basic');
    for (const key of ['erp', 'hospital', 'contacts', 'sales', 'order', 'service', 'timeline', 'analytics']) {
      await page.locator(`[data-tab-key="${key}"]`).click();
      await shot(`account-${key}`);
    }
    await page.locator('[data-tab-key="contacts"]').click();
    const accountId = await page.locator('.hq-account-workspace').getAttribute('data-account-id');
    if (await page.locator('[data-contact-id]').count()) {
      await page.locator('[data-contact-id]').first().click();
      await page.locator('dialog.hq-customer-modal[open]').waitFor();
      await shot('account-contact-edit-popup');
      await page.goto(`${runtime.url}/accounts?hq=1&record=${accountId}&tab=contacts`);
      await page.getByTestId('new-contact').waitFor();
    }
    if (await page.getByTestId('new-contact').count()) {
      await page.getByTestId('new-contact').click();
      await page.locator('dialog.hq-customer-modal[open]').waitFor();
      await shot('account-contact-popup');
    }
    result.viewports[name] = states;
    await context.close();
  }
} catch (error) {
  result.failures.push(error instanceof Error ? error.stack : String(error));
} finally {
  if (browser) await browser.close();
  if (runtime) await runtime.close();
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ viewports: Object.keys(result.viewports), screenshots: result.screenshots.length, failures: result.failures }, null, 2));
}
if (result.failures.length) process.exitCode = 1;
