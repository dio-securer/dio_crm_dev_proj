import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');
const runtime = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
const login = await (await fetch(runtime.url + '/api/hq/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ loginId: 'hq-sales', password: 'HQ-DEMO' }) })).json();
const headers = { authorization: `Bearer ${login.accessToken}`, 'content-type': 'application/json' };
const call = async (path, body) => { const response = await fetch(runtime.url + path, { method: 'POST', headers, body: JSON.stringify(body) }); assert.equal(response.status, 200, path); return response.json(); };
const plan = await call('/api/activities/plans', { relatedType: 'ACCOUNT', relatedPublicId: seedIDs.approvedAccount, plannedAt: '2026-10-24T09:00:00Z', visitPurpose: '보고 테스트' });
for (const action of ['check-in', 'check-out']) await call(`/api/activities/${plan.activityPublicId}/${action}`, { latitude: 35.171, longitude: 129.127, isMocked: true });
const report = await call('/api/activity-reports/prepare', { reportDate: '2026-10-24' });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', timeout: 90000 });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto(runtime.url + '/activity-reports', { waitUntil: 'domcontentloaded' });
    await page.locator('.hq-mock-controls select').first().selectOption('hq-sales');
    await page.locator('.hq-act-list-row').filter({ hasText: '2026-10-24' }).getByRole('button', { name: /상세 열기/ }).click();
    const dialog = page.locator('dialog[open]'); await dialog.waitFor();
    const field = dialog.getByLabel('상담정보').first(); await field.fill(`임시 상담 ${viewport.width}`);
    let submissions = 0; page.on('request', req => { if (req.url().includes('/request-approval')) submissions++; });
    await dialog.getByRole('button', { name: '승인요청', exact: true }).click();
    await dialog.getByText('변경한 보고 내용을 저장한 뒤 승인 요청해 주세요.').waitFor({ timeout: 5000 });
    assert.equal(submissions, 0);
    page.once('dialog', dialog => dialog.dismiss());
    await page.keyboard.press('Escape');
    assert.equal(await dialog.count(), 1);
    assert.equal(await field.inputValue(), `임시 상담 ${viewport.width}`);
    page.once('dialog', dialog => dialog.accept());
    await dialog.getByRole('button', { name: '닫기' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await context.close();
    console.log(`PASS ${viewport.width}px unsaved report submission and close`);
  }
} finally { await browser.close(); runtime.server.closeAllConnections(); await runtime.close(); }
