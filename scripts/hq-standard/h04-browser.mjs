/** H04 PC/390px browser acceptance against the isolated HQ HTTP mock. */
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHqServer } from './server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.join(root, 'docs/hq-standard/implementation/evidence');
const ko = JSON.parse(await readFile(path.join(root, 'frontend/src/i18n/locales/ko-KR/common.json'), 'utf8'));
const names = ['PC H04 activity plan and day view', 'Monthly calendar and activity detail', 'Mock GPS IN, consultation and OUT',
  'Report prepare and request use the same account, owner and date', 'Approval queue opens detail before a decision',
  'Branch comment-only save preserves requested state', 'Branch and division decisions complete the report',
  'Direct-work list and detail show synchronized ERP state', '390px activity and report layout has no horizontal overflow',
  'No browser exception or external request'];
const report = { stage: 'H04', kind: 'real-browser-http', startedAt: new Date().toISOString(), viewports: [process.env.HQ_MOBILE_TEST ? { width: 390, height: 844 } : process.env.HQ_TABLET_TEST ? { width: 834, height: 1194 } : { width: 1440, height: 1000 }, { width: 390, height: 844 }],
  checks: names.map((name, index) => ({ id: `H04-B${String(index + 1).padStart(2, '0')}`, name, status: 'NOT_RUN' })), screenshots: [], pageErrors: [], externalRequests: [] };
let runtime, browser, page, mobile, storageDir, fatal;
let activityId, reportId, directWorkId;
async function check(number, action) {
  const item = report.checks[number - 1];
  try { item.detail = await action(); item.status = 'PASS'; console.log(`[${item.id}] PASS ${item.name}`); }
  catch (error) { item.status = 'FAIL'; item.error = error instanceof Error ? error.stack : String(error); throw error; }
}
async function shot(target, name) { await target.screenshot({ path: path.join(evidence, name), fullPage: true }); report.screenshots.push(name); }
async function ready(target, actor = 'hq-admin') { await target.locator('.hq-mock-controls').waitFor(); await target.waitForFunction(value => document.querySelector('.hq-mock-controls select')?.value === value, actor); }
async function goto(target, pathname, loginId = 'hq-admin') { await target.goto(runtime.url + pathname); await ready(target, loginId); await target.locator('.hq-act-page').waitFor(); }
async function api(target, pathname) { return target.evaluate(async pathname => { const response = await fetch(pathname, { headers: { Authorization: `Bearer ${sessionStorage.getItem('dio_crm_hq_access_token')}` } }); return { status: response.status, data: await response.json() }; }, pathname); }
const response = (target, pathname, method) => target.waitForResponse(value => new URL(value.url()).pathname === pathname && value.request().method() === method);
async function saved(target, pathname, method, click) { const pending = response(target, pathname, method); await click(); const result = await pending; const value = await result.json(); assert.ok(result.status() < 300, JSON.stringify(value)); return value; }
async function actor(target, loginId) { await target.locator('.hq-mock-controls select').first().selectOption(loginId); await ready(target, loginId); }
async function newPage(viewport, label) {
  const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  const target = await context.newPage();
  target.on('pageerror', error => report.pageErrors.push(`${label}: ${error.message}`));
  target.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:')) report.externalRequests.push(`${label}: ${request.url()}`); });
  return target;
}
try {
  await access(path.join(root, 'frontend/dist/index.html')); await mkdir(evidence, { recursive: true });
  storageDir = await mkdtemp(path.join(tmpdir(), 'dio-h04-browser-')); runtime = await startHqServer({ port: 0, storageDir });
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ headless: true, ...(process.env.HQ_BROWSER_CHANNEL ? { channel: process.env.HQ_BROWSER_CHANNEL } : {}) });
  report.browserVersion = browser.version();
  page = await newPage(report.viewports[0], 'PC'); await goto(page, '/activities');
  await check(1, async () => {
    await page.getByRole('button', { name: ko.hqActivity.openRegistration }).click();
    const form = page.locator('.hq-act-card').first().locator('form');
    await form.getByLabel(ko.hqActivity.target).selectOption({ index: 1 });
    await form.getByLabel(ko.hqActivity.plannedAt).fill('2026-10-24T09:00');
    await form.getByLabel(ko.hqActivity.purpose).fill('H04 browser visit');
    await form.getByLabel(ko.hqActivity.directType).selectOption('DIRECT_WORK');
    await form.getByLabel(ko.hqActivity.reason).fill('H04 early visit');
    const created = await saved(page, '/api/activities/plans', 'POST', () => form.getByRole('button', { name: ko.activity.register }).click());
    activityId = created.activityPublicId; directWorkId = created.directWorkPublicId;
    await page.getByText(ko.hqActivity.planSaved).waitFor();
    return { activityId, directWorkId };
  });
  await check(2, async () => {
    await page.getByRole('tab', { name: ko.hqActivity.month }).click();
    await page.locator(`.hq-act-month-day[data-date="2026-10-24"] [data-activity-id="${activityId}"]`).click();
    assert.match(await page.locator('[data-hq-screen="SCR-ACT-002"]').innerText(), /IN/);
    await shot(page, 'h04-pc-month-detail.png');
  });
  await check(3, async () => {
    const detail = page.locator('[data-hq-screen="SCR-ACT-002"]');
    await saved(page, `/api/activities/${activityId}/check-in`, 'POST', () => detail.getByRole('button', { name: ko.hqActivity.mockLocation, exact: true }).click());
    await detail.getByLabel(ko.activity.consultation).fill('H04 consultation');
    await saved(page, `/api/activities/${activityId}`, 'PATCH', () => detail.getByRole('button', { name: ko.hqActivity.saveConsultation }).click());
    await saved(page, `/api/activities/${activityId}/check-out`, 'POST', () => detail.getByRole('button', { name: ko.hqActivity.mockLocationOut }).click());
    const row = await api(page, `/api/activities/${activityId}`); assert.equal(row.data.status, 'COMPLETED'); assert.equal(row.data.consultation_content, 'H04 consultation');
  });
  await check(4, async () => {
    await goto(page, '/activity-reports'); await page.getByLabel(ko.hqActivity.date).fill('2026-10-24');
    const row = await saved(page, '/api/activity-reports/prepare', 'POST', () => page.getByRole('button', { name: ko.report.prepare }).click());
    reportId = row.public_id; assert.equal(row.items[0].activity_public_id, activityId);
    await saved(page, `/api/activity-reports/${reportId}/request-approval`, 'POST', () => page.getByRole('button', { name: ko.report.request }).click());
    assert.equal((await api(page, `/api/activity-reports/${reportId}`)).data.status, 'REQUESTED');
  });
  await check(5, async () => {
    await actor(page, 'hq-branch'); await goto(page, '/activity-reports', 'hq-branch');
    const queue = page.locator('.hq-act-list-row').filter({ hasText: '2026-10-24' }).first();
    await queue.getByRole('button', { name: ko.hqActivity.openDetail }).click();
    await page.locator('[data-hq-screen="SCR-REP-003"]').waitFor(); await shot(page, 'h04-pc-report-approval.png');
  });
  await check(6, async () => {
    const detail = page.locator('[data-hq-screen="SCR-REP-003"]');
    await detail.getByLabel(ko.hqActivity.approvalComment).fill('Branch note');
    await saved(page, `/api/activity-reports/${reportId}/comment/branch`, 'POST', () => detail.getByRole('button', { name: ko.hqActivity.saveComment }).click());
    assert.equal((await api(page, `/api/activity-reports/${reportId}`)).data.status, 'REQUESTED');
  });
  await check(7, async () => {
    await saved(page, `/api/activity-reports/${reportId}/approve/branch`, 'POST', () => page.locator('[data-hq-screen="SCR-REP-003"]').getByRole('button', { name: ko.hqActivity.completeApproval }).click());
    await actor(page, 'hq-division'); await goto(page, '/activity-reports', 'hq-division');
    await page.locator('.hq-act-list-row').filter({ hasText: '2026-10-24' }).first().getByRole('button', { name: ko.hqActivity.openDetail }).click();
    await saved(page, `/api/activity-reports/${reportId}/approve/division`, 'POST', () => page.locator('[data-hq-screen="SCR-REP-003"]').getByRole('button', { name: ko.hqActivity.completeApproval }).click());
    assert.equal((await api(page, `/api/activity-reports/${reportId}`)).data.status, 'FINAL_APPROVED');
  });
  await check(8, async () => {
    await actor(page, 'hq-admin'); await goto(page, '/direct-work');
    await page.locator('.hq-act-list-row').filter({ hasText: '2026-10-24' }).first().getByRole('button', { name: ko.hqActivity.openDetail }).click();
    assert.match(await page.locator('[data-hq-screen="SCR-DW-002"]').innerText(), /NOT_REQUESTED/);
    assert.equal((await api(page, `/api/direct-work/${directWorkId}`)).data.activity_public_id, activityId);
    await shot(page, 'h04-pc-direct-work.png');
  });
  await check(9, async () => {
    mobile = await newPage(report.viewports[1], '390px'); await goto(mobile, '/activities');
    assert.equal(await mobile.locator('.hq-act-desktop').isVisible(), false);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await shot(mobile, 'h04-mobile-activity.png'); await goto(mobile, '/activity-reports');
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await shot(mobile, 'h04-mobile-report.png');
  });
  await check(10, async () => { assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.externalRequests, []); assert.deepEqual(runtime.errors, []); });
} catch (error) { fatal = error; console.error(error); }
finally {
  report.finishedAt = new Date().toISOString(); report.passed = report.checks.filter(row => row.status === 'PASS').length;
  report.failed = report.checks.filter(row => row.status === 'FAIL').length; report.notRun = report.checks.filter(row => row.status === 'NOT_RUN').length;
  let browserCloseTimedOut = false;
  if (browser) {
    let timer;
    browserCloseTimedOut = await Promise.race([browser.close().then(() => false, () => true), new Promise(resolve => { timer = setTimeout(() => resolve(true), 10000); })]);
    clearTimeout(timer);
  }
  if (runtime) { runtime.server.closeAllConnections(); await runtime.close(); }
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
  if (browserCloseTimedOut) report.cleanupWarning = 'System Chrome did not close within 10 seconds; test assertions completed.';
  await mkdir(evidence, { recursive: true }); await writeFile(path.join(evidence, 'h04-browser-report.json'), JSON.stringify(report, null, 2));
  console.log(`H04 browser: ${report.passed}/${report.checks.length} PASS; ${report.failed} FAIL; ${report.notRun} NOT_RUN`);
  if (browserCloseTimedOut) process.exit(report.failed || report.notRun || fatal ? 1 : 0);
}
if (fatal || report.failed || report.notRun) process.exitCode = 1;
