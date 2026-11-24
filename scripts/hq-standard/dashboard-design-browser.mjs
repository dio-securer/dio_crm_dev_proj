import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';

const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{width:1440,height:900},{width:834,height:1194},{width:390,height:844}]) {
    const context = await browser.newContext({ viewport, locale:'ko-KR', serviceWorkers:'block' });
    const page = await context.newPage();
    await page.goto(server.url + '/analytics');
    await page.getByRole('heading', { name:'영업 분석' }).waitFor();
    await page.locator('.h06-metric').first().waitFor();
    assert.ok(await page.locator('.h06-metric svg').count() > 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth-innerWidth) <= 1);
    await page.getByRole('button', {name:'대시보드 편집'}).click();
    await page.getByRole('button', {name:'대시보드 저장'}).click();
    await page.getByRole('status').getByText('표시 설정을 이 브라우저의 현재 사용자 설정으로 저장했습니다.').waitFor();
    await page.reload();
    await page.getByRole('button', {name:'대시보드 편집'}).waitFor();
    await page.getByRole('button', {name:'대시보드 목록'}).click();
    await page.getByRole('button', {name:'활동 대시보드'}).click();
    await page.getByRole('heading', {name:'활동 대시보드'}).waitFor();
    console.log(`PASS ${viewport.width} dashboard navigation and preference save`);
    await context.close();
  }
} finally { await browser.close(); server.server.closeAllConnections(); await server.close(); }
