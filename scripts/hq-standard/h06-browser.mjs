import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHqServer } from './server.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.join(root, 'docs/hq-standard/implementation/evidence');
const report = { stage: 'H06', kind: 'real-browser-http', viewports: [{ width: 1440, height: 1000 }, { width: 390, height: 844 }], checks: [], screenshots: [], pageErrors: [], externalRequests: [] };
let runtime, browser, createdOrderId;
const check = async (name, work) => { const row = { name, status: 'NOT_RUN' }; report.checks.push(row); try { row.detail = await work(); row.status = 'PASS'; console.log(`PASS ${name}`); } catch (error) { row.status = 'FAIL'; row.error = String(error); throw error; } };
const shot = async (page, name) => { await page.screenshot({ path: path.join(evidence, name), fullPage: true }); report.screenshots.push(name); };
const ready = async (page, pathname) => { await page.goto(runtime.url + pathname); await page.locator('.hq-mock-controls').waitFor(); await page.locator('.h06-page').waitFor(); };
const adminRequest = async payload => {
  const login = await fetch(`${runtime.url}/api/hq/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ loginId: 'hq-admin', password: 'HQ-DEMO' }) });
  const session = await login.json();
  const response = await fetch(`${runtime.url}/api/hq/interfaces/request`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify({ interfaceCode: 'IF-ERP-010', entityType: 'ACCOUNT', entityPublicId: seedIDs.approvedAccount, idempotencyKey: 'h06-browser-sale', payload }) });
  assert.equal(response.status, 200, JSON.stringify(await response.json()));
};
try {
  await access(path.join(root, 'frontend/dist/index.html')); await mkdir(evidence, { recursive: true });
  runtime = await startHqServer({ port: 0, storageDir: false, autoAdvance: true });
  const { chromium } = await import('playwright'); browser = await chromium.launch({ headless: true, ...(process.env.HQ_BROWSER_CHANNEL ? { channel: process.env.HQ_BROWSER_CHANNEL } : {}) }); report.browserVersion = browser.version();
  for (const [index, viewport] of report.viewports.entries()) {
    const label = index ? '390px' : 'PC'; const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block' }); const page = await context.newPage();
    page.on('pageerror', error => report.pageErrors.push(`${label}: ${error.message}`)); page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:')) report.externalRequests.push(`${label}: ${request.url()}`); });
    for (const [route, title] of [['/orders', '주문'], ['/fulfillment', '납품'], ['/ledger-statements', '원장'], ['/analytics', '분석']]) {
      await check(`${label} ${title} page renders without horizontal overflow`, async () => {
        await page.goto(runtime.url + route); await page.locator('.hq-mock-controls').waitFor(); await page.locator('.h06-page').waitFor();
        await page.locator('.h06-page h1').waitFor();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 1, `${route}: ${overflow}px`);
        await shot(page, `h06-${index ? 'mobile' : 'pc'}-${route.slice(1)}.png`);
        return { route, overflow };
      });
    }
    if (!index) await check('PC creates an order and adds ERP catalog item', async () => {
      await page.goto(runtime.url + '/orders'); await page.locator('.h06-page').waitFor();
      await page.getByRole('button', { name: '새 주문', exact: true }).click();
      await page.getByLabel('승인 계약').selectOption(seedIDs.approvedContract);
      const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/orders' && r.request().method() === 'POST');
      await page.getByRole('button', { name: '주문 초안 만들기' }).click(); const created = await response; assert.equal(created.status(), 200); createdOrderId = (await created.json()).public_id;
      await page.getByLabel('품목 유형').selectOption('PRODUCT');
      await page.getByLabel('ERP 품목').selectOption(seedIDs.product);
      const item = page.waitForResponse(r => /\/api\/orders\/[^/]+\/items$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
      await page.getByRole('button', { name: '품목 추가' }).click(); assert.equal((await item).status(), 200);
      await page.getByText('100,000', { exact: false }).first().waitFor(); await shot(page, 'h06-pc-order-created.png'); return { orderId: createdOrderId };
    });
    if (index) {
      await check('390px continues the same order with a second item and ERP request', async () => {
        await ready(page, '/orders');
        const list = page.waitForResponse(r => new URL(r.url()).pathname === '/api/orders' && r.request().method() === 'GET');
        await page.reload(); const rows = await (await list).json(); assert.equal(rows.find(row => row.public_id === createdOrderId).order_amount, 100000);
        await page.locator('.h06-row').last().click();
        await page.getByLabel('품목 유형').selectOption('PACKAGE'); await page.getByLabel('ERP 품목').selectOption(seedIDs.packageProduct);
        const item = page.waitForResponse(r => new URL(r.url()).pathname === `/api/orders/${createdOrderId}/items` && r.request().method() === 'POST');
        await page.getByRole('button', { name: '품목 추가' }).click(); assert.equal((await item).status(), 200);
        await page.getByLabel('배송 방식').selectOption('DIRECT'); await page.getByLabel('배송지').fill('서울특별시 검수로 06');
        const delivery = page.waitForResponse(r => new URL(r.url()).pathname === `/api/orders/${createdOrderId}/delivery` && r.request().method() === 'PATCH');
        await page.getByRole('button', { name: '배송 저장' }).click(); assert.equal((await delivery).status(), 200);
        const submit = page.waitForResponse(r => new URL(r.url()).pathname === `/api/orders/${createdOrderId}/submit` && r.request().method() === 'POST');
        await page.getByRole('button', { name: 'ERP 주문 요청' }).click(); await page.getByRole('dialog').getByRole('button', { name: '확인 후 요청' }).click(); assert.equal((await submit).status(), 200);
        await page.getByText('ACCEPTED', { exact: true }).first().waitFor(); await shot(page, 'h06-mobile-order-submitted.png');
        return { orderId: createdOrderId, amount: 300000, status: 'ACCEPTED' };
      });
      await adminRequest({ accountPublicId: seedIDs.approvedAccount, rows: [{ erpSalesNo: 'H06-BROWSER-SALE', salesDate: '2026-10-23', amount: 300000,
        orderPublicId: createdOrderId, contractPublicId: seedIDs.approvedContract, itemCode: 'MOCK-P001', quantity: 3 }] });
      await check('390px PDF contains the filtered sale and Excel is PC only', async () => {
        await ready(page, '/ledger-statements');
        await page.getByLabel('거래처').selectOption(seedIDs.approvedAccount); await page.getByLabel('범위').selectOption(seedIDs.approvedContract);
        await page.getByLabel('시작일').fill('2026-10-01'); await page.getByLabel('종료일').fill('2026-10-31');
        await page.getByRole('button', { name: '조회' }).click(); await page.getByText('H06-BROWSER-SALE').first().waitFor();
        assert.equal(await page.getByRole('button', { name: 'Excel 내려받기' }).isVisible(), false);
        assert.equal(await page.locator('.h06-statement-select').first().isVisible(), false);
        const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'PDF 내려받기' }).click(); const download = await pending;
        const bytes = await readFile(await download.path()); assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
        await shot(page, 'h06-mobile-statement-result.png'); return { bytes: bytes.length, filename: download.suggestedFilename() };
      });
    }
    await context.close();
  }
  const pc = await browser.newContext({ viewport: report.viewports[0], locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block', acceptDownloads: true });
  const verify = await pc.newPage();
  await check('PC sees the same order ID, amount and status', async () => {
    await ready(verify, '/orders'); const pending = verify.waitForResponse(r => new URL(r.url()).pathname === '/api/orders' && r.request().method() === 'GET');
    await verify.reload(); const rows = await (await pending).json(); const row = rows.find(item => item.public_id === createdOrderId);
    assert.equal(row.order_amount, 300000); assert.equal(row.status, 'ACCEPTED'); assert.equal(row.items.length, 2);
    await verify.locator('.h06-row').last().click(); await shot(verify, 'h06-pc-order-synced.png'); return { orderId: row.public_id, amount: row.order_amount, status: row.status };
  });
  await check('PC downloads filtered Excel', async () => {
    await ready(verify, '/ledger-statements'); await verify.getByLabel('거래처').selectOption(seedIDs.approvedAccount); await verify.getByLabel('범위').selectOption(seedIDs.approvedContract);
    await verify.getByLabel('시작일').fill('2026-10-01'); await verify.getByLabel('종료일').fill('2026-10-31'); await verify.getByRole('button', { name: '조회' }).click();
    await verify.getByText('H06-BROWSER-SALE').first().waitFor(); const pending = verify.waitForEvent('download');
    await verify.getByRole('button', { name: 'Excel 내려받기' }).click(); const download = await pending; const bytes = await readFile(await download.path());
    assert.equal(bytes.subarray(0, 2).toString(), 'PK'); await shot(verify, 'h06-pc-ledger-result.png'); return { bytes: bytes.length, filename: download.suggestedFilename() };
  });
  await pc.close();
  await check('No browser exception or external request', async () => { assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.externalRequests, []); return true; });
} catch (error) { report.fatal = error instanceof Error ? error.stack : String(error); process.exitCode = 1; }
finally {
  report.passed = report.checks.filter(x => x.status === 'PASS').length; report.failed = report.checks.filter(x => x.status === 'FAIL').length;
  let closeTimedOut = false;
  if (browser) { let timer; closeTimedOut = await Promise.race([browser.close().then(() => false, () => true), new Promise(resolve => { timer = setTimeout(() => resolve(true), 10000); })]); clearTimeout(timer); }
  if (runtime) { runtime.server.closeAllConnections(); await runtime.close(); }
  if (closeTimedOut) report.cleanupWarning = 'System Chrome did not close within 10 seconds; assertions completed.';
  await writeFile(path.join(evidence, 'h06-browser-report.json'), JSON.stringify(report, null, 2));
  console.log(`H06 browser: ${report.passed}/${report.checks.length} PASS`); process.exit(report.failed || report.fatal ? 1 : 0);
}
