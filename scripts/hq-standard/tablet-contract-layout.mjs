import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');
const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [768, 1024]) {
    const page = await browser.newPage({ viewport: { width, height: 1024 } });
    await page.goto(`${server.url}/contracts?record=${seedIDs.approvedContract}`);
    const header = page.locator('.contract-detail-heading');
    await header.getByRole('heading', { name: '계약 상세' }).waitFor();
    const title = await header.locator('h2').boundingBox(), back = await header.getByRole('button', { name: '목록으로' }).boundingBox();
    assert.ok(title && back && title.x < back.x && Math.abs((title.y + title.height / 2) - (back.y + back.height / 2)) < 2);
    const tabs = page.getByRole('tablist', { name: '계약 관련정보' });
    const tabElements = tabs.getByRole('tab');
    for (let i = 0; i < await tabElements.count(); i++) {
      await tabElements.nth(i).click();
      assert.equal(await tabElements.nth(i).getAttribute('aria-selected'), 'true');
    }
    await tabElements.first().click();
    const table = page.locator('.contract-plan-table table');
    await table.waitFor();
    assert.ok(await table.evaluate(e => Math.abs(e.getBoundingClientRect().width - e.parentElement.getBoundingClientRect().width) < 2));
    assert.ok(await table.locator('th').first().evaluate(e => parseFloat(getComputedStyle(e).fontSize) >= 14));
    await page.getByRole('button', { name: '수금계획 조회' }).click();
    await page.getByRole('dialog', { name: '수금계획 조회' }).getByRole('button', { name: '닫기', exact: true }).last().click();
    await header.getByRole('button', { name: '목록으로' }).click();
    await page.getByRole('heading', { name: '계약 목록' }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    console.log(`${width} PASS 계약 헤더·탭·표·조회·목록`);
    await page.close();
  }
} finally { await browser.close(); server.server.closeAllConnections(); await server.close(); }
