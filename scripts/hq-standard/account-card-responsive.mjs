import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';

const server = await startHqServer({ port:0, storageDir:false, autoAdvance:false });
const browser = await chromium.launch({ headless:true });
try {
  for (const viewport of [{width:834,height:1194},{width:390,height:844},{width:320,height:700}]) {
    const context = await browser.newContext({viewport,locale:'ko-KR',serviceWorkers:'block'});
    const page = await context.newPage();
    await page.goto(server.url+'/accounts');
    const filters = page.locator('.mob-filters');
    await filters.waitFor();
    const buttons = filters.locator('button');
    assert.equal(await buttons.count(),3);
    const first = await buttons.nth(0).boundingBox(), last = await buttons.nth(2).boundingBox();
    assert.ok(first && last && Math.abs(first.y-last.y)<2, '필터가 한 행에 배치되어야 합니다');
    await buttons.nth(2).click();
    await page.locator('.mob-account-row').first().waitFor();
    assert.equal(await page.locator('.mob-account-row svg').first().isVisible(),true);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1);
    await page.locator('.mob-account-row').first().click();
    await page.locator('.hq-account-workspace').waitFor();
    assert.equal(await page.locator('.hq-account-glance').isVisible(),true, '상세 핵심 정보가 표시되어야 합니다');
    console.log(`PASS ${viewport.width}: filters, account card and detail`);
    await context.close();
  }
} finally { await browser.close();server.server.closeAllConnections();await server.close(); }
