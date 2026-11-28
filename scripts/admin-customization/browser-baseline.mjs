// Non-destructive route smoke. Isolated in-memory data; no user's live dataset.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startHqServer } from '../hq-standard/server.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'docs/admin-platform/customization/evidence');
const baseline = JSON.parse(fs.readFileSync(path.join(out, 'baseline.json'), 'utf8'));
const ko = JSON.parse(fs.readFileSync(path.join(root, 'frontend/src/i18n/locales/ko-KR/common.json'), 'utf8'));
const report = { stage: 'C00', scope: 'HQ admin persona; route render + one popup open/close + English observations; NOT exhaustive field/action testing',
  startedAtUtc: new Date().toISOString(), checks: [], pageErrors: [], externalRequests: [], observations: [], screenshots: [] };
let runtime, browser;
async function check(name, fn) {
  const row = { name, status: 'NOT_RUN' }; report.checks.push(row);
  try { row.detail = await fn(); row.status = 'PASS'; } catch (e) { row.status = 'FAIL'; row.error = String(e); }
  console.log(`${row.status} ${name}`);
}
try {
  runtime = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  report.browserVersion = browser.version();
  const dist = path.join(root, 'frontend/dist/assets');
  report.bundleHashes = fs.readdirSync(dist).map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(dist, file))).digest('hex') }));
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', e => report.pageErrors.push({ width, error: e.message }));
    page.on('request', r => { if (!r.url().startsWith(runtime.url)) report.externalRequests.push(r.url()); });
    for (const screen of baseline.standard.screens) await check(`${width} ${screen.screenKey} ${screen.path}`, async () => {
      await page.goto(runtime.url + screen.path);
      await page.locator('.hq-mock-controls').waitFor();
      await page.waitForLoadState('networkidle');
      const headings = await page.locator('.route-surface h1, .route-surface h2').allTextContents();
      assert.ok(headings.length > 0, 'No screen heading');
      const alerts = await page.locator('.route-surface [role="alert"]').allTextContents();
      assert.ok(!alerts.some(x => /SCREEN_ACCESS_DENIED|SCREEN_NOT_REGISTERED/.test(x)), alerts.join(';'));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 1, `Horizontal overflow ${overflow}`);
      if (['HQ_LEAD', 'HQ_ACCOUNT', 'HQ_ADMIN_PERMISSIONS'].includes(screen.screenKey)) {
        const file = `c00-${width}-${screen.screenKey}.png`;
        await page.screenshot({ path: path.join(out, file), fullPage: true }); report.screenshots.push(file);
      }
      return { headings, alerts, overflow };
    });
    await check(`${width} lead create popup open and close`, async () => {
      await page.goto(runtime.url + '/leads'); await page.locator('.hq-mock-controls').waitFor();
      await page.getByRole('button', { name: ko.hqCustomer.newLead, exact: true }).click();
      await page.getByRole('dialog').waitFor();
      const inputs = await page.getByRole('dialog').locator('input, select, textarea').count();
      assert.ok(inputs > 0); await page.getByRole('dialog').getByRole('button', { name: ko.app.close, exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' }); return { inputs, scope: 'Open/close only; no save or validation claim' };
    });
    await page.goto(runtime.url + '/orders'); await page.locator('.hq-mock-controls').waitFor();
    if (await page.locator('.locale-select select:visible').count() === 0) await page.locator('.mobile-more-button').click();
    await page.locator('.locale-select select:visible').first().selectOption('en-US');
    await page.waitForFunction(() => document.documentElement.lang === 'en-US');
    if (await page.locator('.mobile-drawer-header .icon-button:visible').count()) await page.locator('.mobile-drawer-header .icon-button').click();
    report.observations.push({ width, selectedLanguage: 'en-US', orderHeadings: await page.locator('.route-surface h1,.route-surface h2').allTextContents(),
      nav: await page.locator('.sidebar-nav a').allTextContents(), topbar: await page.locator('.topbar-title h1').textContent() });
    const file = `c00-${width}-orders-en.png`; await page.screenshot({ path: path.join(out, file), fullPage: true }); report.screenshots.push(file);
    await context.close();
  }
  await check('No page errors or external requests', () => { assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.externalRequests, []); return true; });
} catch (e) { report.fatal = String(e.stack ?? e); }
finally {
  if (browser) { let timer; const clean = await Promise.race([browser.close().then(() => true, () => false), new Promise(resolve => { timer = setTimeout(() => resolve(false), 10000); })]); clearTimeout(timer); if (!clean) report.cleanupWarning = 'Browser close exceeded timeout'; }
  if (runtime) { runtime.server.closeAllConnections(); await runtime.close(); }
  report.finishedAtUtc = new Date().toISOString(); report.passed = report.checks.filter(x => x.status === 'PASS').length; report.failed = report.checks.filter(x => x.status === 'FAIL').length;
  fs.writeFileSync(path.join(out, 'browser-baseline.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, fatal: report.fatal }));
  process.exit(report.fatal || report.failed ? 1 : 0);
}
