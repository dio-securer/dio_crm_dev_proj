/** H02 acceptance against the built UI and real loopback HQ HTTP server. */
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHqServer } from './server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.join(root, 'docs/hq-standard/implementation/evidence');
const ko = JSON.parse(await readFile(path.join(root, 'frontend/src/i18n/locales/ko-KR/common.json'), 'utf8'));
const names = [
  'Desktop explicit HQ boot and account rendering',
  'Mock bootstrap precedes login; transport uses only HQ credentials',
  'Account search reads the HQ dataset',
  'Existing account saves through the UI and HTTP API',
  'Reload preserves saved data, HQ session and scenario',
  'Sales persona has scoped data and cannot reset',
  'Viewer reset is denied by UI and server',
  'Administrator switch restores reset permission',
  'Reset preview and cancellation preserve current data',
  'Confirmed reset restores seed and advances generation',
  'HQ reset preserves GLOBAL, normal-token and sandbox storage',
  'API failure is visible without local sandbox fallback',
  'Missing MOCK response marker cannot populate the screen',
  '390px mobile boot and horizontal layout',
  '390px persona permission and reset dialog',
  'Explicit GLOBAL selection remains available and preserves data',
  'HQ off clears only the HQ session token',
  'No browser exceptions, external requests or adapter errors'
];
const report = {
  stage: 'H02', kind: 'real-browser-http', startedAt: new Date().toISOString(),
  viewports: [{ width: 1440, height: 1000 }, { width: 390, height: 844 }],
  checks: names.map((name, index) => ({ id: `H02-B${String(index + 1).padStart(2, '0')}`, name, status: 'NOT_RUN' })),
  screenshots: [], pageErrors: [], externalRequests: [], requests: [], responses: []
};
const storageSeed = {
  dio_crm_locale: 'ko-KR',
  dio_crm_access_token: 'BROWSER_REAL_TOKEN_SENTINEL',
  dio_crm_demo_mode: 'global-executive',
  dio_crm_demo_accounts_v1: '[]',
  dio_crm_demo_conversions_v2: '[]',
  dio_crm_test_accounts_v2: JSON.stringify([{ public_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', account_name: 'BROWSER_SANDBOX_GUARD', account_status: 'ACTIVE', owner_user_id: 1, use_yn: '1' }])
};
const protectedKeys = Object.keys(storageSeed).filter(key => key !== 'dio_crm_locale');
let runtime, browser, page, mobile, storageDir, fatal;
let sequence = 0;
const controls = target => target.locator('.hq-mock-controls');
const actorSelect = target => controls(target).locator('select').nth(0);
const scenarioSelect = target => controls(target).locator('select').nth(1);
const resetButton = target => controls(target).getByRole('button', { name: ko.hqMock.reset, exact: true });
const account = (target, name) => target.getByText(name, { exact: true });
const seedName = '본사 승인 치과';
const changedName = 'H02 browser persisted account';

async function screenshot(target, filename) {
  await target.screenshot({ path: path.join(evidence, filename), fullPage: true });
  report.screenshots.push(filename);
}
async function check(number, action) {
  const item = report.checks[number - 1];
  const started = Date.now();
  try {
    const details = await action();
    item.status = 'PASS';
    if (details !== undefined) item.details = details;
    console.log(`[${item.id}] PASS ${item.name}`);
  } catch (error) {
    item.status = 'FAIL';
    item.error = error instanceof Error ? error.stack : String(error);
    if (page && !page.isClosed()) {
      try { await screenshot(page, `h02-failure-${item.id.toLowerCase()}.png`); } catch { /* Preserve the original failure. */ }
    }
    if (mobile && !mobile.isClosed()) {
      try { await screenshot(mobile, `h02-failure-mobile-${item.id.toLowerCase()}.png`); } catch { /* Preserve the original failure. */ }
    }
    throw error;
  } finally { item.durationMs = Date.now() - started; }
}
async function ready(target, loginId = 'hq-admin') {
  await controls(target).waitFor({ state: 'visible' });
  await target.waitForFunction(value => document.querySelector('.hq-mock-controls select')?.value === value, loginId);
  assert.equal(await controls(target).locator('.hq-mock-badge').textContent(), 'MOCK');
}
async function switchActor(target, loginId) {
  await actorSelect(target).selectOption(loginId);
  await ready(target, loginId);
}
async function requestInPage(target, pathname, method = 'GET', body) {
  return target.evaluate(async ({ pathname, method, body }) => {
    const response = await fetch(pathname, {
      method, credentials: 'omit', redirect: 'error',
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem('dio_crm_hq_access_token')}`,
        'Content-Type': 'application/json', 'X-HQ-Mode': 'HQ_HTTP_MOCK',
        'X-HQ-Scenario': sessionStorage.getItem('dio_crm_hq_scenario') || 'SUCCESS'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, mock: response.headers.get('X-HQ-Mock'), body: await response.json() };
  }, { pathname, method, body });
}
async function session(target) {
  const result = await requestInPage(target, '/api/hq/session');
  assert.equal(result.status, 200); assert.equal(result.mock, 'true');
  return result.body;
}
async function protectedStorage(target) {
  return target.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), protectedKeys);
}
async function previewReset(target) {
  const responsePromise = target.waitForResponse(response => new URL(response.url()).pathname === '/api/hq/reset/preview' && response.request().method() === 'POST');
  await resetButton(target).click();
  const response = await responsePromise;
  assert.equal(response.status(), 200);
  const result = await response.json();
  assert.ok(result.confirmationToken); assert.equal(result.datasetId, 'HQ_DEMO');
  await target.locator('.hq-mock-reset-dialog').waitFor({ state: 'visible' });
  return result;
}
async function newPage(viewport, label) {
  const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  await context.addInitScript(({ origin, seed }) => {
    if (location.origin !== origin || localStorage.getItem('hq_browser_storage_initialized')) return;
    for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
    localStorage.setItem('hq_browser_storage_initialized', 'true');
  }, { origin: runtime.url, seed: storageSeed });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== runtime.url) {
      report.externalRequests.push({ viewport: label, origin: url.origin, pathname: url.pathname });
      await route.abort('blockedbyclient');
    } else await route.continue();
  });
  const target = await context.newPage();
  target.setDefaultTimeout(15000);
  target.setDefaultNavigationTimeout(30000);
  target.on('pageerror', error => report.pageErrors.push({ viewport: label, message: error.message }));
  target.on('request', request => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return;
    const headers = request.headers();
    report.requests.push({ sequence: ++sequence, viewport: label, origin: url.origin, pathname: url.pathname, method: request.method(),
      mode: headers['x-hq-mode'] ?? null, authorization: !headers.authorization ? 'NONE' : headers.authorization.startsWith('Bearer hq_') ? 'HQ' : 'OTHER' });
  });
  target.on('response', response => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/')) report.responses.push({ sequence: ++sequence, viewport: label, pathname: url.pathname, status: response.status(), mock: response.headers()['x-hq-mock'] ?? null });
  });
  return target;
}
async function noHorizontalOverflow(target, selector) {
  const geometry = await target.locator(selector).evaluate(element => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, width: box.width, viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  assert.ok(geometry.left >= -1 && geometry.right <= geometry.viewport + 1, JSON.stringify(geometry));
  assert.ok(geometry.scrollWidth <= geometry.viewport + 1, JSON.stringify(geometry));
  return geometry;
}

await mkdir(evidence, { recursive: true });
try {
  await access(path.join(root, 'frontend/dist/index.html'));
  storageDir = await mkdtemp(path.join(tmpdir(), 'dio-h02-browser-'));
  runtime = await startHqServer({ port: 0, storageDir });
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ headless: true });
  report.browserVersion = browser.version();
  page = await newPage(report.viewports[0], 'PC');
  let tokenBeforeReload, preview, generationBeforeReset;

  await check(1, async () => {
    await page.goto(`${runtime.url}/accounts?hq=1`);
    await ready(page);
    await account(page, seedName).waitFor({ state: 'visible' });
    assert.equal(await page.locator('.account-desktop').count(), 1);
    assert.equal(await page.locator('.demo-standard-banner').count(), 0);
    assert.equal((await session(page)).dataset.storageLifetime, 'FILE');
    await screenshot(page, 'h02-pc-accounts.png');
  });
  await check(2, async () => {
    const bootstrap = report.responses.find(row => row.pathname === '/api/hq/bootstrap' && row.status === 200 && row.mock === 'true');
    const login = report.requests.find(row => row.pathname === '/api/hq/session' && row.method === 'POST');
    assert.ok(bootstrap && login && bootstrap.sequence < login.sequence);
    assert.ok(report.requests.every(row => row.origin === runtime.url && row.authorization !== 'OTHER'));
    tokenBeforeReload = await page.evaluate(() => sessionStorage.getItem('dio_crm_hq_access_token'));
    assert.match(tokenBeforeReload, /^hq_/);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('dio_crm_hq_mode')), 'on');
  });
  await check(3, async () => {
    const search = page.getByPlaceholder(ko.account.search, { exact: true });
    await search.fill(seedName);
    await account(page, seedName).waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelectorAll('.account-desktop tbody tr strong').length === 1);
    await search.fill('');
    await account(page, '다른 담당 치과').waitFor({ state: 'visible' });
    assert.equal(await account(page, 'BROWSER_SANDBOX_GUARD').count(), 0);
    const mine = page.waitForResponse(response => new URL(response.url()).pathname === '/api/accounts' && new URL(response.url()).searchParams.get('scope') === 'mine');
    await page.locator('.pc-filter-row').getByRole('button', { name: ko.account.filters.mine, exact: true }).click();
    assert.equal((await mine).status(), 200);
    await page.locator('.account-desktop').getByText(ko.common.noData, { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await page.locator('.account-desktop tbody tr strong').count(), 0);
    await page.locator('.pc-filter-row').getByRole('button', { name: ko.account.filters.managed, exact: true }).click();
    await account(page, seedName).waitFor({ state: 'visible' });
  });
  await check(4, async () => {
    await account(page, seedName).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(ko.account.name, { exact: true }).fill(changedName);
    const saved = page.waitForResponse(response => new URL(response.url()).pathname.startsWith('/api/accounts/') && response.request().method() === 'PATCH');
    await dialog.getByRole('button', { name: ko.common.save, exact: true }).click();
    assert.equal((await saved).status(), 200);
    await account(page, changedName).waitFor({ state: 'visible' });
    const file = JSON.parse(await readFile(path.join(storageDir, 'HQ_DEMO.json'), 'utf8'));
    assert.ok(file.collections.accounts.some(row => row.account_name === changedName));
  });
  await check(5, async () => {
    await scenarioSelect(page).selectOption('DELAY');
    await page.reload(); await ready(page);
    await account(page, changedName).waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => sessionStorage.getItem('dio_crm_hq_access_token')), tokenBeforeReload);
    assert.equal(await scenarioSelect(page).inputValue(), 'DELAY');
    await scenarioSelect(page).selectOption('SUCCESS');
  });
  await check(6, async () => {
    await switchActor(page, 'hq-sales');
    await account(page, changedName).waitFor({ state: 'visible' });
    assert.equal(await resetButton(page).isDisabled(), true);
    assert.equal(await account(page, '다른 담당 치과').count(), 0);
    assert.equal((await session(page)).user.scope, 'SELF');
  });
  await check(7, async () => {
    await switchActor(page, 'hq-viewer');
    assert.equal(await resetButton(page).isDisabled(), true);
    const denied = await requestInPage(page, '/api/hq/reset/preview', 'POST', {});
    assert.equal(denied.status, 403);
    assert.equal(denied.mock, 'true');
    await screenshot(page, 'h02-pc-viewer-permission.png');
  });
  await check(8, async () => {
    await switchActor(page, 'hq-admin');
    await account(page, '다른 담당 치과').waitFor({ state: 'visible' });
    assert.equal(await resetButton(page).isEnabled(), true);
    assert.ok((await session(page)).user.permissions.includes('HQ.RESET'));
  });
  await check(9, async () => {
    generationBeforeReset = (await session(page)).dataset.generation;
    preview = await previewReset(page);
    assert.equal(preview.generation, generationBeforeReset);
    assert.ok(preview.counts.accounts > 0);
    assert.equal(await page.locator('.hq-reset-counts tbody tr').count(), Object.keys(preview.counts).length);
    await screenshot(page, 'h02-pc-reset-preview.png');
    await page.getByRole('dialog').getByRole('button', { name: ko.hqMock.cancel, exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await account(page, changedName).waitFor({ state: 'visible' });
    assert.equal((await session(page)).dataset.generation, generationBeforeReset);
  });
  await check(10, async () => {
    await previewReset(page);
    const resetResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/hq/reset' && response.request().method() === 'POST');
    await page.getByRole('dialog').getByRole('button', { name: ko.hqMock.confirmReset, exact: true }).click();
    assert.equal((await resetResponse).status(), 200);
    await ready(page); await account(page, seedName).waitFor({ state: 'visible' });
    assert.equal(await account(page, changedName).count(), 0);
    assert.equal((await session(page)).dataset.generation, generationBeforeReset + 1);
    await screenshot(page, 'h02-pc-reset-complete.png');
  });
  await check(11, async () => {
    assert.deepEqual(await protectedStorage(page), Object.fromEntries(protectedKeys.map(key => [key, storageSeed[key]])));
  });
  let fault = 'API_FAILURE';
  const faultRoute = async route => {
    if (new URL(route.request().url()).pathname !== '/api/accounts' || route.request().method() !== 'GET') return route.continue();
    await route.fulfill(fault === 'API_FAILURE'
      ? { status: 503, contentType: 'application/json', headers: { 'X-HQ-Mock': 'true' }, body: JSON.stringify({ statusCode: 503, error: 'BROWSER_TEST_FAILURE', message: 'BROWSER_INJECTED_API_FAILURE' }) }
      : { status: 200, contentType: 'application/json', body: JSON.stringify([{ public_id: 'untrusted', account_name: 'UNTRUSTED_SERVER_ROW', account_status: 'ACTIVE' }]) });
  };
  await page.route('**/api/accounts**', faultRoute);
  await check(12, async () => {
    await page.reload(); await ready(page);
    await page.getByRole('alert').filter({ hasText: 'BROWSER_INJECTED_API_FAILURE' }).waitFor({ state: 'visible' });
    assert.equal(await page.getByText(ko.account.localMode, { exact: true }).count(), 0);
    assert.equal(await account(page, 'BROWSER_SANDBOX_GUARD').count(), 0);
    assert.equal(await page.locator('.account-desktop tbody tr strong').count(), 0);
    await screenshot(page, 'h02-pc-api-failure.png');
  });
  await check(13, async () => {
    fault = 'MISSING_MARKER';
    await page.reload(); await ready(page);
    await page.getByRole('alert').filter({ hasText: 'HQ mock server was not confirmed' }).waitFor({ state: 'visible' });
    assert.equal(await account(page, 'UNTRUSTED_SERVER_ROW').count(), 0);
    assert.equal(await account(page, 'BROWSER_SANDBOX_GUARD').count(), 0);
    assert.deepEqual(await protectedStorage(page), Object.fromEntries(protectedKeys.map(key => [key, storageSeed[key]])));
  });
  await page.unroute('**/api/accounts**', faultRoute);

  await check(14, async () => {
    mobile = await newPage(report.viewports[1], 'MOBILE_390');
    await mobile.goto(`${runtime.url}/accounts?hq=1`); await ready(mobile);
    await account(mobile, seedName).waitFor({ state: 'visible' });
    assert.equal(await mobile.locator('.account-mobile').count(), 1);
    const geometry = await noHorizontalOverflow(mobile, '.hq-mock-controls');
    await screenshot(mobile, 'h02-mobile-390-accounts.png');
    return geometry;
  });
  await check(15, async () => {
    await switchActor(mobile, 'hq-viewer'); assert.equal(await resetButton(mobile).isDisabled(), true);
    await switchActor(mobile, 'hq-admin'); assert.equal(await resetButton(mobile).isEnabled(), true);
    await previewReset(mobile);
    await noHorizontalOverflow(mobile, '.hq-mock-reset-dialog');
    await screenshot(mobile, 'h02-mobile-390-reset-preview.png');
    await mobile.getByRole('dialog').getByRole('button', { name: ko.hqMock.cancel, exact: true }).click();
    await mobile.getByRole('dialog').waitFor({ state: 'hidden' });
  });
  await check(16, async () => {
    const before = report.requests.length;
    await page.goto(`${runtime.url}/?demo=global`);
    await page.locator('.demo-standard-banner').waitFor({ state: 'visible' });
    assert.equal(await controls(page).count(), 0);
    assert.equal(report.requests.slice(before).some(row => row.pathname.startsWith('/api/hq/')), false);
    assert.deepEqual(await protectedStorage(page), Object.fromEntries(protectedKeys.map(key => [key, storageSeed[key]])));
    await screenshot(page, 'h02-global-preserved.png');
  });
  await check(17, async () => {
    await page.goto(`${runtime.url}/?hq=off`);
    await page.locator('.demo-standard-banner').waitFor({ state: 'visible' });
    assert.equal(await controls(page).count(), 0);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('dio_crm_hq_access_token')), null);
    assert.deepEqual(await protectedStorage(page), Object.fromEntries(protectedKeys.map(key => [key, storageSeed[key]])));
  });
  await check(18, async () => {
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.externalRequests, []);
    assert.deepEqual(runtime.errors, []);
    assert.equal(runtime.app.status(runtime.app.repository('HQ_DEMO')).outboundCalls, 0);
    assert.equal(report.requests.some(row => row.authorization === 'OTHER'), false);
  });
} catch (error) {
  fatal = error instanceof Error ? error.stack : String(error);
  console.error(fatal);
} finally {
  for (const cleanup of [() => browser?.close(), () => runtime?.close(), () => storageDir && rm(storageDir, { recursive: true, force: true })]) {
    try { await cleanup(); } catch (error) { fatal ??= String(error); }
  }
  report.finishedAt = new Date().toISOString();
  report.summary = {
    total: report.checks.length,
    passed: report.checks.filter(check => check.status === 'PASS').length,
    failed: report.checks.filter(check => check.status === 'FAIL').length,
    notRun: report.checks.filter(check => check.status === 'NOT_RUN').length
  };
  report.status = !fatal && report.summary.passed === report.summary.total ? 'PASS' : 'FAIL';
  if (fatal) report.fatal = fatal;
  await writeFile(path.join(evidence, 'h02-browser-results.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`H02 browser: ${report.status} ${report.summary.passed}/${report.summary.total}; failed=${report.summary.failed}; notRun=${report.summary.notRun}`);
  if (report.status !== 'PASS') process.exitCode = 1;
}
