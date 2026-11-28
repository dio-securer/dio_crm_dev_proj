import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHqServer } from '../hq-standard/server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'docs/admin-platform/customization/evidence/w05');
await fs.mkdir(out, { recursive: true });
const artifact = JSON.parse(await fs.readFile(path.join(root, 'packages/contracts/catalogs/hq-customization-baseline.json'), 'utf8'));
const html = await fs.readFile(path.join(root, 'frontend/dist/index.html'), 'utf8');
const companyA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', companyB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const createDraft = companyId => ({ id: companyId === companyA ? 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' : 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', revision: 1, state: 'DRAFT', config: { companyId, baseStandardReleaseId: artifact.catalog.standardReleaseId, patches: [], activeLocales: ['ko-KR', 'en-US'], defaultLocale: 'ko-KR', translations: {} } });
const drafts = new Map([[companyA, createDraft(companyA)], [companyB, createDraft(companyB)]]);
const denySave = new Set(), staleSave = new Set(), failOnce = new Set();
const result = { kind: 'W05 same draft and instant isolated preview', checks: [], writes: [], businessRequests: [], externalRequests: [], downloads: [], failures: [] };
let runtime, browser;
try {
  runtime = await startHqServer({ port: 0, storageDir: false });
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ headless: true, ...(process.env.HQ_BROWSER_CHANNEL ? { channel: process.env.HQ_BROWSER_CHANNEL } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(() => { try { localStorage.setItem('dio_crm_access_token', 'W05_SYNTHETIC_ADMIN'); } catch { /* Opaque preview frame has no storage. */ } });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => result.failures.push(`page error: ${error.message}`));
  page.on('download', download => result.downloads.push(download.suggestedFilename()));
  page.on('request', request => { const url = new URL(request.url()); if (url.origin !== runtime.url && url.protocol !== 'about:') result.externalRequests.push(request.url()); });
  await page.route('**/admin/customization', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), body = req.postDataJSON();
    const answer = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname === '/api/admin/companies') return answer({ items: [{ id: companyA, name: 'Fixture A' }, { id: companyB, name: 'Fixture B' }], nextCursor: null });
    if (url.pathname === '/api/admin/catalogs') return answer(artifact);
    if (url.pathname === '/api/admin/config/drafts' && req.method() === 'GET') return answer({ activeReleaseId: null, capabilities: { edit: true, preview: true, publish: true }, drafts: [drafts.get(url.searchParams.get('scopeKey'))].filter(Boolean), releases: [] });
    if (url.pathname.startsWith('/api/admin/config/drafts/') && req.method() === 'PATCH') {
      const draft = [...drafts.values()].find(item => item.id === url.pathname.split('/').at(-1));
      if (!draft) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"NOT_FOUND"}' });
      result.writes.push({ method: req.method(), path: url.pathname, headers: req.headers(), body });
      if (denySave.has(draft.config.companyId)) return route.fulfill({ status: 403, contentType: 'application/json', body: '{"code":"CONFIG_EDIT_DENIED"}' });
      if (staleSave.has(draft.config.companyId)) return route.fulfill({ status: 409, contentType: 'application/json', body: '{"code":"REVISION_CONFLICT"}' });
      if (failOnce.delete(draft.config.companyId)) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"TEMPORARY_FAILURE"}' });
      if (req.headers()['if-match'] !== `"${draft.revision}"`) return route.fulfill({ status: 409, contentType: 'application/json', body: '{"code":"REVISION_CONFLICT"}' });
      const updated = { ...draft, revision: draft.revision + 1, config: { ...draft.config, ...body } };
      drafts.set(draft.config.companyId, updated);
      return answer(updated);
    }
    result.businessRequests.push(`${req.method()} ${url.pathname}`);
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"UNEXPECTED_REQUEST"}' });
  });
  await page.goto(runtime.url + '/admin/customization');
  await page.getByRole('heading', { name: '법인 CRM 설정' }).waitFor();
  await page.getByLabel('법인', { exact: true }).selectOption(companyA);
  await page.getByText('저장된 작업본', { exact: false }).waitFor();
  const frame = page.frameLocator('iframe[title*="격리 미리보기"]');
  await page.locator('.visual-preview-controls select').nth(1).selectOption('create');
  await page.locator('.visual-preview-status').filter({ hasText: /fixture/ }).waitFor();
  const phone = frame.locator('dialog[data-config-id="POP.LEAD.CREATE"] [data-config-id="lead.phone"]').first();
  await phone.click();
  await page.getByTestId('visual-property-visible').uncheck();
  await phone.waitFor({ state: 'hidden' });
  if (!await frame.locator('[data-config-id="lead.phone"]').evaluateAll(elements => elements.every(element => getComputedStyle(element).display === 'none'))) result.failures.push('repeated field instances did not share the preview setting');
  if (result.writes.length || result.businessRequests.length) result.failures.push('unsaved preview issued a request');
  result.checks.push('visual edit hides all matching fixture anchors without a business request');

  const row = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'lead.phone' }) });
  await page.getByLabel('메뉴·필드 검색').fill('lead.phone');
  await row.locator('summary').click();
  if (await row.getByRole('checkbox', { name: '표시', exact: false }).isChecked()) result.failures.push('list editor did not read visual patch');
  await row.getByRole('checkbox', { name: '표시', exact: false }).check();
  await phone.waitFor({ state: 'visible' });
  await row.getByLabel('법인별 표시명').fill('법인 전화 W05');
  await page.waitForTimeout(300);
  result.debug = { phone: await phone.evaluate(element => element.textContent), input: await row.getByLabel('법인별 표시명').inputValue() };
  await phone.getByText('법인 전화 W05').waitFor();
  if (result.writes.length) result.failures.push('list and visual edits saved before the Save action');
  result.checks.push('list editor reads visual patch; list edit restores the same preview; translation appears immediately');

  await page.getByRole('button', { name: '작업본 저장', exact: true }).click();
  await page.getByText('저장된 작업본', { exact: false }).waitFor();
  if (result.writes.length !== 1 || result.writes[0].headers['if-match'] !== '"1"' || !result.writes[0].headers['idempotency-key'] || result.writes[0].headers.authorization !== 'Bearer W05_SYNTHETIC_ADMIN') result.failures.push('draft save lost authentication, revision or idempotency boundary');
  if (drafts.get(companyA)?.config.translations['ko-KR']?.['hq.field.lead.phone'] !== '법인 전화 W05') result.failures.push('translation did not persist in the shared draft');
  result.checks.push('one PATCH saves shared patches and translation with revision and idempotency key');

  await page.reload();
  await page.getByLabel('법인', { exact: true }).selectOption(companyA);
  await page.getByText('저장된 작업본', { exact: false }).waitFor();
  await page.locator('.visual-preview-controls select').nth(1).selectOption('create');
  await page.locator('.visual-preview-status').filter({ hasText: /fixture/ }).waitFor();
  await frame.locator('dialog[data-config-id="POP.LEAD.CREATE"] [data-config-id="lead.phone"]').first().getByText('법인 전화 W05').waitFor();
  result.checks.push('saved translation reappears after page reload and server draft query');

  await page.getByLabel('법인', { exact: true }).selectOption(companyB);
  await page.getByText('저장된 작업본', { exact: false }).waitFor();
  await page.locator('.visual-preview-controls select').nth(1).selectOption('create');
  await page.locator('.visual-preview-status').filter({ hasText: /fixture/ }).waitFor();
  if (await frame.locator('dialog[data-config-id="POP.LEAD.CREATE"] [data-config-id="lead.phone"]').first().innerText() === '법인 전화 W05') result.failures.push('company A translation leaked to company B');
  if (drafts.get(companyB).config.patches.length || Object.keys(drafts.get(companyB).config.translations).length) result.failures.push('company B draft changed');
  result.checks.push('company switch resets the preview and keeps the other draft unchanged');

  await frame.locator('dialog[data-config-id="POP.LEAD.CREATE"] [data-config-id="lead.phone"]').first().click();
  await page.getByTestId('visual-property-visible').uncheck();
  await page.getByText('저장하지 않은 변경이 있습니다.').waitFor();
  let prompted = false;
  page.once('dialog', dialog => { prompted = true; void dialog.dismiss(); });
  await page.getByLabel('법인', { exact: true }).selectOption(companyA);
  if (!prompted || await page.getByLabel('법인', { exact: true }).inputValue() !== companyB || await page.getByTestId('visual-property-visible').isChecked()) result.failures.push('unsaved company switch was not stopped');
  result.checks.push('unsaved company switch requires confirmation and cancel preserves the local edit');
  denySave.add(companyB);
  await Promise.all([page.waitForResponse(response => response.url().includes('/api/admin/config/drafts/') && response.status() === 403), page.getByRole('button', { name: '작업본 저장', exact: true }).click()]);
  if (drafts.get(companyB).revision !== 1 || drafts.get(companyB).config.patches.length) result.failures.push('403 modified the server draft');
  if (!await page.getByText('저장하지 않은 변경이 있습니다.').count()) result.failures.push('403 discarded the unsaved edit');
  denySave.delete(companyB);
  result.checks.push('403 leaves the local edit and server revision unchanged');

  staleSave.add(companyB);
  await Promise.all([page.waitForResponse(response => response.url().includes('/api/admin/config/drafts/') && response.status() === 409), page.getByRole('button', { name: '작업본 저장', exact: true }).click()]);
  if (drafts.get(companyB).revision !== 1 || drafts.get(companyB).config.patches.length) result.failures.push('409 modified the server draft');
  await page.getByText('저장하지 않은 변경이 있습니다.').waitFor();
  staleSave.delete(companyB);
  result.checks.push('409 does not mark a stale draft as saved');

  failOnce.add(companyB);
  await page.getByRole('button', { name: '작업본 저장', exact: true }).click();
  await page.getByText('처리 결과가 불확실합니다.', { exact: false }).waitFor();
  await page.getByRole('button', { name: '같은 요청 다시 시도', exact: true }).click();
  await page.getByText('저장된 작업본', { exact: false }).waitFor();
  const firstTry = result.writes.at(-2), secondTry = result.writes.at(-1);
  if (!firstTry || !secondTry || firstTry.headers['idempotency-key'] !== secondTry.headers['idempotency-key'] || firstTry.headers['if-match'] !== '"1"' || JSON.stringify(firstTry.body) !== JSON.stringify(secondTry.body)) result.failures.push('uncertain retry changed the idempotency key, revision or body');
  if (drafts.get(companyB).revision !== 2 || !drafts.get(companyB).config.patches.some(patch => patch.targetId === 'lead.phone' && patch.property === 'visible' && patch.value === false)) result.failures.push('retry did not persist company B edit');
  result.checks.push('503 retry sends the same body, revision and idempotency key');

  await page.screenshot({ path: path.join(out, 'company-b-isolated.png') });
  if (result.externalRequests.length || result.downloads.length) result.failures.push('preview issued an external request or download');
  await context.close();
} catch (error) {
  result.failures.push(error instanceof Error ? error.stack : String(error));
} finally {
  if (browser) await browser.close();
  if (runtime) await runtime.close();
  const evidence = { ...result, writes: result.writes.map(item => ({ method: item.method, path: item.path, revision: item.headers['if-match'], idempotencyKeyPresent: Boolean(item.headers['idempotency-key']), authorizationPresent: Boolean(item.headers.authorization), body: item.body })) };
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ checks: result.checks, debug: result.debug, writes: result.writes.map(item => ({ method: item.method, path: item.path, revision: item.headers['if-match'], idempotencyKey: Boolean(item.headers['idempotency-key']), patches: item.body.patches, translations: item.body.translations })), businessRequests: result.businessRequests, failures: result.failures }, null, 2));
}
if (result.failures.length) process.exitCode = 1;
