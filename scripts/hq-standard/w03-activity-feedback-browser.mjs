import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';

const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
console.log('server started');
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
console.log('browser started');
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  let calls = 0;
  await page.route('**/api/activities/calendar?*', async route => {
    calls++;
    await route.fulfill(calls === 1 ? { status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'TEST_CALENDAR_FAILURE' }) } : { status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.goto(server.url + '/activities', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.locator('.hq-mock-controls').waitFor();
  const schedule = page.locator('.hq-act-card').filter({ has: page.getByRole('tablist') });
  await schedule.getByRole('alert').waitFor();
  assert.equal(await schedule.getByText('선택한 날짜에 활동계획이 없습니다.').count(), 0, 'error is not an empty result');
  await schedule.getByRole('button', { name: '다시 시도' }).click();
  await schedule.getByText('선택한 날짜에 활동계획이 없습니다.').waitFor();
  assert.equal(await schedule.getByRole('alert').count(), 0);
  assert.ok(calls >= 2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText('다건 등록은 PC에서 이용할 수 있습니다.').waitFor({ state: 'visible' });
  console.log('PASS calendar error, retry, empty result and mobile bulk guidance');
} finally { await browser.close(); await server.close(); }
