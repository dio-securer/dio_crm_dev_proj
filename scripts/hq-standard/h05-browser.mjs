/** H05 PC and 390px browser acceptance against the isolated HQ HTTP mock. */
import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHqServer } from './server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.join(root, 'docs/hq-standard/implementation/evidence');
const report = { stage: 'H05', kind: 'real-browser-http', startedAt: new Date().toISOString(), viewports: [process.env.HQ_MOBILE_TEST ? { width: 390, height: 844 } : process.env.HQ_TABLET_TEST ? { width: 834, height: 1194 } : { width: 1440, height: 1000 }, { width: 390, height: 844 }], checks: [], screenshots: [], pageErrors: [], externalRequests: [] };
let runtime, browser;
async function check(name, work) { const item = { name, status: 'NOT_RUN' }; report.checks.push(item); try { item.detail = await work(); item.status = 'PASS'; console.log(`PASS ${name}`); } catch (error) { item.status = 'FAIL'; item.error = error instanceof Error ? error.stack : String(error); throw error; } }
const shot = async (page, name) => { await page.screenshot({ path: path.join(evidence, name), fullPage: true }); report.screenshots.push(name); };
const saved = async (page, pathname, method, click) => { const pending = page.waitForResponse(response => new URL(response.url()).pathname === pathname && response.request().method() === method); await click(); const response = await pending; const body = await response.json(); assert.equal(response.status(), 200, JSON.stringify(body)); return body; };
const ready = async (page, pathname) => { await page.goto(runtime.url + pathname); await page.locator('.hq-mock-controls').waitFor(); await page.locator('.hq-sales-page').waitFor(); };
async function newPage(viewport, label) { const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block' }); const page = await context.newPage(); page.on('pageerror', error => report.pageErrors.push(`${label}: ${error.message}`)); page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:')) report.externalRequests.push(`${label}: ${request.url()}`); }); return page; }
try {
  await access(path.join(root, 'frontend/dist/index.html')); await mkdir(evidence, { recursive: true });
  runtime = await startHqServer({ port: 0, storageDir: false, autoAdvance: true });
  const { chromium } = await import('playwright'); browser = await chromium.launch({ headless: true, ...(process.env.HQ_BROWSER_CHANNEL ? { channel: process.env.HQ_BROWSER_CHANNEL } : {}) }); report.browserVersion = browser.version();
  const page = await newPage(report.viewports[0], 'PC'); await ready(page, '/opportunities');
  let opportunityId, contractId;
  await check('PC creates and prices an opportunity', async () => {
    await page.getByRole('button', { name: '기회 등록' }).click();
    const form = page.locator('form').first();
    await form.getByLabel('거래처').selectOption({ label: '본사 승인 치과' });
    await form.getByLabel('기회명').fill('H05 브라우저 기회');
    await form.getByLabel('예상 마감일').fill('2026-12-31');
    const opp = await saved(page, '/api/opportunities', 'POST', () => form.getByRole('button', { name: '생성' }).click()); opportunityId = opp.public_id;
    const products = page.locator('.hq-sales-card').filter({ has: page.getByRole('heading', { name: '제안 제품' }) });
    await products.locator('form select').first().selectOption({ index: 1 });
    await products.getByLabel('수량').last().fill('2'); await products.getByLabel('제안 단가').last().fill('500000');
    await saved(page, `/api/opportunities/${opportunityId}/products`, 'POST', () => products.getByRole('button', { name: '제품 추가' }).click());
    await page.getByText('₩1,000,000').first().waitFor(); await shot(page, 'h05-pc-opportunity.png'); return { opportunityId };
  });
  await check('PC wins and creates a contract using the same opportunity', async () => {
    const stage = page.locator('.hq-sales-stage'); await stage.getByLabel('목표 단계').selectOption('CLOSED_WON');
    await saved(page, `/api/opportunities/${opportunityId}/stage`, 'POST', () => stage.getByRole('button', { name: '단계 저장' }).click());
    await ready(page, '/contracts');
    await page.getByRole('button', { name: '계약 등록', exact: true }).click();
    const form = page.locator('form').first(); await form.getByLabel('승인 거래처의 수주 기회').selectOption(opportunityId);
    await form.getByRole('button', { name: '계약 생성' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '취소' }).click();
    await form.getByRole('button', { name: '계약 생성' }).click();
    const con = await saved(page, '/api/contracts', 'POST', () => page.getByRole('dialog').getByRole('button', { name: '생성 확인' }).click()); contractId = con.public_id;
    await page.getByRole('heading', { name: '계약 상세' }).waitFor(); return { contractId };
  });
  await check('PC saves first plan and sees ERP result', async () => {
    await page.getByRole('button', { name: '최초 수금계획 편집' }).click();
    const card = page.getByRole('dialog');
    await card.getByLabel('방법').first().selectOption({ index: 1 });
    await saved(page, `/api/contracts/${contractId}/collection-plans`, 'POST', () => card.getByRole('button', { name: '최초 계획 저장' }).click());
    await saved(page, `/api/contracts/${contractId}/erp-request`, 'POST', () => page.getByRole('button', { name: 'ERP 계약 등록 요청' }).click());
    await page.locator('.hq-sales-card').filter({ has: page.getByRole('heading', { name: '계약 상세' }) }).getByText('ERP_APPROVED', { exact: false }).first().waitFor(); await shot(page, 'h05-pc-contract.png'); return { contractId };
  });
  const mobile = await newPage(report.viewports[1], '390px'); await ready(mobile, '/contracts');
  await check('390px contract and opportunity layouts stay within viewport', async () => {
    await mobile.locator('.hq-sales-page').waitFor(); const contractOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await shot(mobile, 'h05-mobile-contract.png'); await ready(mobile, '/opportunities');
    const opportunityOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await shot(mobile, 'h05-mobile-opportunity.png'); assert.ok(contractOverflow <= 1 && opportunityOverflow <= 1, JSON.stringify({ contractOverflow, opportunityOverflow }));
    return { contractOverflow, opportunityOverflow };
  });
  await check('No browser exception or external request', async () => { assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.externalRequests, []); return true; });
} catch (error) { report.fatal = error instanceof Error ? error.stack : String(error); process.exitCode = 1; }
finally {
  report.finishedAt = new Date().toISOString(); report.passed = report.checks.filter(x => x.status === 'PASS').length; report.failed = report.checks.filter(x => x.status === 'FAIL').length;
  let browserCloseTimedOut = false;
  if (browser) { let timer; browserCloseTimedOut = await Promise.race([browser.close().then(() => false, () => true), new Promise(resolve => { timer = setTimeout(() => resolve(true), 10000); })]); clearTimeout(timer); }
  if (runtime) { runtime.server.closeAllConnections(); await runtime.close(); }
  if (browserCloseTimedOut) report.cleanupWarning = 'System Chrome did not close within 10 seconds; test assertions completed.';
  await writeFile(path.join(evidence, 'h05-browser-report.json'), JSON.stringify(report, null, 2));
  console.log(`H05 browser: ${report.passed}/${report.checks.length} PASS`);
  process.exit(report.failed || report.fatal ? 1 : 0);
}
