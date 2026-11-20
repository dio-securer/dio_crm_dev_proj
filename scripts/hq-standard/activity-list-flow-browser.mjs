import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';

const runtime = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', timeout: 90000 });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto(runtime.url + '/activities', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('.hq-mock-controls').waitFor({ timeout: 30000 });
    await page.locator('.hq-mock-controls select').first().selectOption('hq-sales');
    await page.getByRole('tab', { name: '활동 목록' }).waitFor();
    await page.getByLabel('활동 검색').waitFor();
    assert.equal(await page.getByText('단건 활동 계획', { exact: true }).count(), 0);
    await page.screenshot({ path: `docs/crm-activity/evidence/W00/activity-after-list-${viewport.width}.png`, fullPage: true });
    const first = page.locator('.hq-act-schedule-row').first();
    await first.waitFor({ timeout: 30000 });
    const name = await first.locator('strong').innerText();
    await page.getByLabel('활동 검색').fill(name);
    await first.waitFor();
    await first.click();
    await page.locator('[data-hq-screen="SCR-ACT-002"]').waitFor();
    if (viewport.width === 1440) {
      await page.getByRole('button', { name: '병원 위치로 모의 IN' }).click();
      const consultation = page.getByLabel('상담정보');
      await consultation.fill('저장하지 않은 상담');
      await page.getByRole('button', { name: '병원 위치로 모의 OUT' }).click();
      await page.getByText('상담 내용을 저장한 뒤 방문을 종료해 주세요.').waitFor();
      assert.equal(await consultation.inputValue(), '저장하지 않은 상담');
      await page.getByRole('button', { name: '상담 저장' }).click();
      await page.getByText('상담 내용을 저장했습니다.').waitFor();
      await page.getByRole('button', { name: '병원 위치로 모의 OUT' }).click();
      await page.getByText('OUT을 등록했습니다.').waitFor();
    }
    await page.getByRole('button', { name: '목록으로 돌아가기' }).click();
    await page.getByRole('button', { name: '활동 등록' }).click();
    await page.locator('form').first().waitFor();
    const purpose = page.locator('form').first().getByLabel('방문 목적');
    await purpose.fill('임시 방문 목적');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: '목록으로 돌아가기' }).click();
    assert.equal(await purpose.inputValue(), '임시 방문 목적');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '목록으로 돌아가기' }).click();
    await page.getByLabel('활동 검색').waitFor();
    await page.getByRole('button', { name: '활동 등록' }).click();
    assert.equal(await page.locator('form').first().getByLabel('방문 목적').inputValue(), '');
    await page.getByRole('button', { name: '목록으로 돌아가기' }).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log(`PASS ${viewport.width}px list, search, detail, return, registration and return`);
    await context.close();
  }
} finally { await browser.close(); await runtime.close(); }
