import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../hq-standard/register.mjs';
import { startHqServer } from '../hq-standard/server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'docs/admin-platform/customization/evidence/w06');
await fs.mkdir(out, { recursive: true });
const { resolveCompanyConfig, validateTranslations } = await import('../../packages/contracts/src/crm-customization.ts');
const baseline = JSON.parse(await fs.readFile(path.join(root, 'packages/contracts/catalogs/hq-customization-baseline.json'), 'utf8'));
const artifact = { ...baseline, publicationReady: true }; // Synthetic published standard; baseline remains unready.
const html = await fs.readFile(path.join(root, 'frontend/dist/index.html'), 'utf8');
const companyA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const companyB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const createDraft = companyId => ({ id: companyId === companyA ? 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' : 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', revision: 1, state: 'DRAFT', config: { companyId, baseStandardReleaseId: artifact.catalog.standardReleaseId, patches: [], activeLocales: ['ko-KR', 'en-US'], defaultLocale: 'ko-KR', translations: {} } });
const drafts = new Map([[companyA, createDraft(companyA)], [companyB, createDraft(companyB)]]);
const active = new Map([[companyA, null], [companyB, null]]);
const releases = new Map([[companyA, []], [companyB, []]]);
const validations = new Map();
const result = { kind: 'W06 validation and publish, synthetic admin API', checks: [], calls: [], businessRequests: [], externalRequests: [], downloads: [], failures: [] };
let runtime, browser, page;
const check = (condition, message) => { if (!condition) result.failures.push(message); };
try {
  runtime = await startHqServer({ port: 0, storageDir: false });
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ headless: true, ...(process.env.HQ_BROWSER_CHANNEL ? { channel: process.env.HQ_BROWSER_CHANNEL } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(() => { try { localStorage.setItem('dio_crm_access_token', 'W06_SYNTHETIC_ADMIN'); } catch { /* Opaque preview frame. */ } });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => result.failures.push(`page error: ${error.message}`));
  page.on('download', download => result.downloads.push(download.suggestedFilename()));
  page.on('request', request => { const url = new URL(request.url()); if (url.origin !== runtime.url && url.protocol !== 'about:') result.externalRequests.push(request.url()); });
  await page.route('**/admin/customization', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), body = req.postDataJSON();
    const answer = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    const error = (code, status) => answer({ code }, status);
    if (url.pathname === '/api/admin/hq/fields') return error('UNAVAILABLE', 503);
    if (url.pathname === '/api/admin/companies') return answer({ items: [{ id: companyA, name: 'Fixture A' }, { id: companyB, name: 'Fixture B' }], nextCursor: null });
    if (url.pathname === '/api/admin/catalogs') return answer(artifact);
    if (url.pathname === '/api/admin/config/drafts' && req.method() === 'GET') {
      const companyId = url.searchParams.get('scopeKey');
      return answer({ activeReleaseId: active.get(companyId), capabilities: { edit: true, preview: true, publish: true }, drafts: [drafts.get(companyId)].filter(draft => draft && ['DRAFT', 'VALIDATED'].includes(draft.state)), releases: releases.get(companyId) ?? [] });
    }
    if (url.pathname.startsWith('/api/admin/config/drafts/') && req.method() === 'PATCH') {
      const draft = [...drafts.values()].find(item => item.id === url.pathname.split('/').at(-1));
      result.calls.push({ action: 'save', headers: req.headers(), body });
      if (!draft || draft.config.companyId !== body.companyId) return error('NOT_FOUND', 404);
      if (req.headers()['if-match'] !== `"${draft.revision}"`) return error('DRAFT_CONFLICT', 409);
      const updated = { ...draft, revision: draft.revision + 1, state: 'DRAFT', config: { ...draft.config, ...body } };
      drafts.set(body.companyId, updated);
      return answer(updated);
    }
    if (url.pathname === '/api/admin/config/validate' && req.method() === 'POST') {
      const draft = [...drafts.values()].find(item => item.id === body.draftIds?.[0] && item.config.companyId === body.companyId);
      result.calls.push({ action: 'validate', companyId: body.companyId, revision: body.revisions?.[0], headers: req.headers() });
      if (!draft || draft.revision !== body.revisions?.[0]) return error('DRAFT_CONFLICT', 409);
      const effective = resolveCompanyConfig(artifact.catalog, draft.config);
      const errors = [...effective.issues, ...validateTranslations(artifact.catalog.entries, draft.config.activeLocales, draft.config.defaultLocale, artifact.translations, draft.config.translations)];
      if (draft.rebase?.conflicts.length) errors.push({ code: 'REBASE_UNRESOLVED', targetId: draft.id, messageKey: 'customization.errors.REBASE_UNRESOLVED' });
      const validation = { id: `validation-${validations.size + 1}`, draftId: draft.id, revision: draft.revision, companyId: body.companyId, effective, errors };
      validations.set(validation.id, validation);
      result.calls.at(-1).validationId = validation.id;
      return answer(validation);
    }
    if (url.pathname === '/api/admin/config/preview' && req.method() === 'POST') {
      result.calls.push({ action: 'preview', companyId: body.companyId, validationId: body.validationId, headers: req.headers() });
      const validation = validations.get(body.validationId), draft = drafts.get(body.companyId);
      if (!validation || validation.companyId !== body.companyId || validation.revision !== draft?.revision) return error('VALIDATION_STALE', 409);
      return answer({ mode: 'PREVIEW', effective: validation.effective, errors: validation.errors, sideEffects: false });
    }
    const releaseRead = url.pathname.match(/^\/api\/admin\/companies\/([^/]+)\/releases\/([^/]+)$/);
    if(releaseRead&&req.method()==='GET') return answer(releases.get(releaseRead[1])?.find(item=>item.id===releaseRead[2])??{code:'NOT_FOUND'},releases.get(releaseRead[1])?.some(item=>item.id===releaseRead[2])?200:404);
    const releaseCompany = url.pathname.match(/^\/api\/admin\/companies\/([^/]+)\/releases$/)?.[1];
    if (releaseCompany && req.method() === 'POST' && active.has(releaseCompany)) {
      result.calls.push({ action: 'publish', companyId: releaseCompany, headers: req.headers(), body });
      const validation = validations.get(body.validationId), draft = drafts.get(releaseCompany);
      if (!validation || validation.companyId !== releaseCompany || validation.revision !== draft?.revision) return error('VALIDATION_STALE', 409);
      if (validation.errors.length) return error('VALIDATION_FAILED', 422);
      if (active.get(releaseCompany) !== body.expectedReleaseId) return error('RELEASE_CONFLICT', 409);
      const release = { id: releaseCompany === companyA ? 'release-w06-a' : 'release-w06-b', companyId: releaseCompany, standardReleaseId: draft.config.baseStandardReleaseId, reason: body.reason, createdAt: new Date().toISOString(), config: structuredClone(draft.config) };
      active.set(releaseCompany, release.id); releases.get(releaseCompany).push(release); drafts.set(releaseCompany, { ...draft, state: 'PUBLISHED' });
      return answer(release, 201);
    }
    result.businessRequests.push(`${req.method()} ${url.pathname}`);
    return error('UNEXPECTED_REQUEST', 404);
  });

  await page.goto(runtime.url + '/admin/customization');
  await page.getByLabel('법인', { exact: true }).selectOption(companyA);
  await page.getByText('저장된 작업본', { exact: false }).first().waitFor();
  await page.locator('.visual-preview-controls select').nth(1).selectOption('create');
  await page.locator('.visual-preview-stage:not(.visual-preview-standard) [role="status"]').filter({ hasText: /fixture/ }).waitFor();
  const frame = page.frameLocator('iframe[title*="법인 작업본 화면"]');
  const hospital = frame.locator('dialog[data-config-id="POP.LEAD.CREATE"] [data-config-id="lead.hospitalName"]').first();
  await hospital.click();
  await page.getByTestId('visual-property-visible').uncheck();
  await page.getByText('저장하지 않은 변경이 있습니다.').waitFor();
  check(await page.getByRole('button', { name: '미리보기', exact: true }).isDisabled(), 'preview allowed unsaved edit');
  check(await page.getByRole('button', { name: '게시', exact: true }).isDisabled(), 'publish allowed unsaved edit');
  await page.getByRole('button', { name: '작업본 저장', exact: true }).click();
  await page.getByText('저장된 작업본', { exact: false }).first().waitFor();
  await page.getByRole('button', { name: '검증', exact: true }).click();
  await page.getByTestId('admin-validation-state').getByText('검증 실패', { exact: false }).waitFor();
  const errors = validations.get('validation-1')?.errors ?? [];
  check(errors.some(issue => issue.code === 'REQUIRED_UNREACHABLE' && issue.targetId === 'lead.hospitalName'), 'required field error missing');
  check(errors.some(issue => issue.code === 'DEPENDENCY_MISSING' && issue.targetId === 'LEAD.create'), 'dependency error missing');
  check(await page.locator('.visual-preview-issues button').filter({ hasText: 'lead.hospitalName' }).count() > 0, 'visual issue navigation missing');
  await page.locator('.visual-preview-issues button').filter({ hasText: 'lead.hospitalName' }).click();
  check(await page.getByTestId('visual-selected-issues').count() > 0, 'selected element issue missing');
  check(await page.getByRole('button', { name: '게시', exact: true }).isDisabled(), 'invalid draft was publishable');
  result.checks.push('required/dependency errors appear on the screen and selected property; publish remains disabled');
  await page.screenshot({ path: path.join(out, 'required-field-validation.png'), fullPage: true });

  await page.getByTestId('visual-property-visible').check();
  await page.locator('.visual-property-translation input').fill(' ');
  check(await page.getByTestId('admin-validation-state').innerText().then(text => text.includes('이전 검증 결과는 사용할 수 없습니다')), 'edit did not invalidate prior validation');
  check(await page.getByRole('button', { name: '미리보기', exact: true }).isDisabled(), 'stale preview enabled after edit');
  await page.getByRole('button', { name: '작업본 저장', exact: true }).click();
  await page.getByText('저장된 작업본', { exact: false }).first().waitFor();
  await page.getByRole('button', { name: '검증', exact: true }).click();
  await page.getByTestId('admin-validation-state').getByText('검증 실패', { exact: false }).waitFor();
  check((validations.get('validation-2')?.errors ?? []).some(issue => issue.code === 'INVALID_TRANSLATION' && issue.targetId === 'lead.hospitalName'), 'translation error missing');
  check(await page.getByRole('button', { name: '게시', exact: true }).isDisabled(), 'translation error was publishable');
  result.checks.push('translation error blocks publish; editing invalidates the previous validation');

  await page.locator('.visual-property-translation input').fill('W06 병원명');
  await page.getByRole('button', { name: '작업본 저장', exact: true }).click();
  await page.getByText('저장된 작업본', { exact: false }).first().waitFor();
  await page.getByRole('button', { name: '검증', exact: true }).click();
  await page.getByTestId('admin-validation-state').getByText('검증 통과', { exact: false }).waitFor();
  check((validations.get('validation-3')?.errors ?? []).length === 0, 'corrected draft did not pass validation');
  check(await page.getByRole('button', { name: '게시', exact: true }).isDisabled(), 'publish allowed before server preview');
  await page.getByRole('button', { name: '미리보기', exact: true }).click();
  await page.getByText('미리보기는 업무 데이터를 변경하지 않습니다.').waitFor();
  check(await page.getByRole('button', { name: '게시', exact: true }).isDisabled(), 'publish allowed without reason');
  await page.locator('details.admin-extra-settings').first().evaluate(element => { element.open = true; });
  await page.getByLabel('변경 사유').fill('W06 합성 검증');
  await page.getByRole('button', { name: '게시', exact: true }).click();
  await page.getByText('진행 중인 작업본이 없습니다.').waitFor();
  check(active.get(companyA) === 'release-w06-a' && active.get(companyB) === null, 'publish changed wrong company release pointer');
  check(drafts.get(companyB).revision === 1 && drafts.get(companyB).config.patches.length === 0, 'publish changed company B draft');
  check(releases.get(companyA)[0]?.config.translations['ko-KR']['hq.field.lead.hospitalName'] === 'W06 병원명', 'release did not contain edited translation');
  const publish = result.calls.find(call => call.action === 'publish');
  check(publish?.headers.authorization === 'Bearer W06_SYNTHETIC_ADMIN' && Boolean(publish?.headers['idempotency-key']), 'publish auth/idempotency header missing');
  check(result.calls.filter(call => ['validate', 'preview'].includes(call.action)).every(call => call.headers.authorization === 'Bearer W06_SYNTHETIC_ADMIN' && Boolean(call.headers['idempotency-key'])), 'validation/preview auth or idempotency header missing');
  check(publish?.body.validationId === 'validation-3' && publish?.body.expectedReleaseId === null, 'publish validation/release fence missing');
  result.checks.push('validated draft requires server preview and reason; release applies to A only and retains the edited label');
  await page.screenshot({ path: path.join(out, 'published-company-a.png') });
  check(result.businessRequests.length === 0 && result.externalRequests.length === 0 && result.downloads.length === 0, 'business/external request or download occurred');
  await context.close();
} catch (error) {
  if(page) result.debug = (await page.locator('body').innerText().catch(()=>'' )).slice(0,2000);
  result.failures.push(error instanceof Error ? error.stack : String(error));
} finally {
  if (browser?.isConnected()) await browser.close();
  if (runtime) await runtime.close();
  const evidence = { ...result, calls: result.calls.map(call => ({ action: call.action, companyId: call.companyId, revision: call.revision, validationId: call.validationId ?? call.body?.validationId, expectedReleaseId: call.body?.expectedReleaseId, authPresent: Boolean(call.headers?.authorization), idempotencyKeyPresent: Boolean(call.headers?.['idempotency-key']), errorCodes: call.action === 'validate' ? validations.get(call.validationId)?.errors.map(issue => issue.code) : undefined })) };
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ checks: result.checks, failures: result.failures, calls: evidence.calls, businessRequests: result.businessRequests }, null, 2));
}
if (result.failures.length) process.exitCode = 1;
