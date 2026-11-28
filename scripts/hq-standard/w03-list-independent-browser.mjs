import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';

const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
console.log('isolated in-memory server', server.url);
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', timeout: 120000 });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  const page = await context.newPage();
  await page.goto(`${server.url}/activities`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('tab', { name: '목록' }).waitFor({ timeout: 120000 });
  console.log('INITIAL', JSON.stringify((await page.locator('.hq-act-page').innerText()).slice(0, 1600)));
  await page.screenshot({ path: 'docs/crm-activity/evidence/W00/activity-after-list-pc.png', fullPage: true });
  const rows = page.locator('.hq-act-schedule-row');
  console.log('ROWS', await rows.count());
  if (await rows.count()) {
    await rows.first().click();
    console.log('DETAIL', JSON.stringify((await page.locator('.hq-act-page').innerText()).slice(0, 700)));
    await page.getByRole('button', { name: '목록으로' }).click();
  }
  await page.getByRole('button', { name: '활동 등록' }).click();
  console.log('REGISTER', JSON.stringify((await page.locator('.hq-act-page').innerText()).slice(0, 500)));
  await page.getByRole('button', { name: '목록으로' }).click();
  for (const tab of ['일', '월', '지도']) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    console.log(`TAB ${tab}`, JSON.stringify((await page.locator('.hq-act-page').innerText()).slice(-300)));
  }
  await page.getByRole('tab', { name: '목록' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/crm-activity/evidence/W00/activity-after-list-mobile.png', fullPage: true });
  console.log('MOBILE screenshot saved');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel('검증 사용자').selectOption('hq-sales');
  await page.getByRole('tab', { name: '목록' }).waitFor({ timeout: 30000 });
  await page.getByLabel('활동 상태').selectOption('PLANNED');
  await page.locator('.hq-act-schedule-row').first().waitFor({ timeout: 30000 });
  await page.locator('.hq-act-schedule-row').first().click();
  await page.locator('[data-hq-screen="SCR-ACT-002"]').waitFor({ timeout: 30000 });
  console.log('SALES DETAIL', JSON.stringify((await page.locator('.hq-act-page').innerText()).slice(0, 600)));
  const mockIn = page.getByRole('button', { name: '병원 위치로 모의 IN' });
  if (await mockIn.count()) {
    await mockIn.click();
    await page.getByText('IN을 등록했습니다.').waitFor({ timeout: 30000 });
    console.log('AFTER IN', JSON.stringify((await page.locator('.hq-act-page').innerText()).slice(0, 600)));
    await page.getByLabel('상담정보').fill('독립 테스트 상담');
    let outRequests = 0;
    page.on('request', request => { if (request.url().includes('/check-out')) outRequests++; });
    await page.getByRole('button', { name: '병원 위치로 모의 OUT' }).click();
    await page.getByText('상담 내용을 저장한 뒤 방문을 종료해 주세요.').waitFor({ timeout: 30000 });
    assert.equal(await page.getByLabel('상담정보').inputValue(), '독립 테스트 상담');
    assert.equal(outRequests, 0);
    console.log('UNSAVED OUT BLOCKED, INPUT RETAINED, REQUESTS', outRequests);
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: '목록으로 돌아가기' }).click();
    console.log('UNSAVED DISMISS', await page.getByLabel('상담정보').inputValue());
    await page.getByRole('button', { name: '상담 저장' }).click();
    await page.getByText('상담 내용을 저장했습니다.').waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: '병원 위치로 모의 OUT' }).click();
    await page.getByText('OUT을 등록했습니다.').waitFor({ timeout: 30000 });
    console.log('AFTER OUT', JSON.stringify((await page.locator('.hq-act-page').innerText()).slice(0, 600)));
    await page.getByRole('button', { name: '목록으로 돌아가기' }).click();
    console.log('RETURN FILTER', await page.getByLabel('활동 상태').inputValue());
    await page.getByLabel('활동 검색').fill('없는 검색어');
    await page.getByRole('button', { name: '활동 등록' }).click();
    const single = page.locator('section').filter({ has: page.getByRole('heading', { name: '단건 활동 계획' }) });
    await single.getByLabel('병원·거래처').selectOption({ label: '본사 신규 치과' });
    await single.getByLabel('방문 목적').fill('독립 등록 검증');
    await single.getByRole('button', { name: '등록', exact: true }).click();
    await page.getByText('활동 계획을 등록했습니다.').waitFor({ timeout: 30000 });
    console.log('AFTER REGISTER', JSON.stringify({ search: await page.getByLabel('활동 검색').inputValue(), status: await page.getByLabel('활동 상태').inputValue(), text: (await page.locator('.hq-act-page').innerText()).slice(-350) }));
    await page.getByRole('button', { name: '활동 등록' }).click();
    const nextSingle = page.locator('section').filter({ has: page.getByRole('heading', { name: '단건 활동 계획' }) });
    await nextSingle.getByLabel('방문 목적').fill('저장 전 등록 입력');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: '목록으로 돌아가기' }).click();
    console.log('REGISTER DISCARD DISMISSED', await nextSingle.getByLabel('방문 목적').inputValue());
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '목록으로 돌아가기' }).click();
    await page.getByRole('button', { name: '활동 등록' }).click();
    console.log('REGISTER AFTER DISCARD', await nextSingle.getByLabel('방문 목적').inputValue());
    await page.getByRole('button', { name: '목록으로 돌아가기' }).click();
    await page.getByLabel('검증 사용자').selectOption('hq-viewer');
    await page.getByRole('tab', { name: '목록' }).waitFor({ timeout: 30000 });
    console.log('VIEWER REGISTER BUTTON', await page.getByRole('button', { name: '활동 등록' }).count());
  }
} finally {
  await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 5000))]);
  await Promise.race([server.close(), new Promise(resolve => setTimeout(resolve, 5000))]);
}
process.exit(0);
