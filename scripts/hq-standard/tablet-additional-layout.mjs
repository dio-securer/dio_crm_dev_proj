import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');
const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [768, 1024]) {
    const page = await browser.newPage({ viewport: { width, height: 1024 } });
    await page.goto(server.url + '/activity-reports');
    const prepare = page.locator('.hq-report-prepare');
    const date = await prepare.locator('input').boundingBox(), button = await prepare.getByRole('button').boundingBox();
    assert.ok(date && button && Math.abs(date.y + date.height - button.y - button.height) < 2);
    const filters = page.locator('.hq-report-queue > .hq-act-actions');
    assert.equal(await filters.locator('label').count(), 5);
    assert.equal(await filters.evaluate(e => getComputedStyle(e).display), 'grid');
    await page.locator('.hq-report-queue > button').click();
    await page.goto(server.url + '/ledger-statements');
    const ledger = page.locator('.h06-ledger-page .h06-card.h06-fields');
    await ledger.locator('select').first().selectOption(seedIDs.approvedAccount);
    await page.getByLabel('시작일').fill('2026-01-01');
    await page.getByLabel('종료일').fill('2026-12-31');
    await ledger.getByRole('button', { name: '조회' }).click();
    await page.getByRole('heading', { name: '원장', exact: true }).waitFor();
    const ledgerBox = await ledger.boundingBox(), searchBox = await ledger.getByRole('button', { name: '조회' }).boundingBox();
    assert.ok(ledgerBox && searchBox && searchBox.width > ledgerBox.width * .8);
    await page.goto(server.url + '/pipeline');
    await page.locator('.hq-sales-stats article').first().waitFor();
    assert.equal(await page.locator('.pipeline-mobile-label').first().isVisible(), true);
    await page.goto(server.url + '/ops');
    const table = page.locator('.hq-admin-page table').first();
    await table.waitFor();
    assert.equal(await table.evaluate(e => getComputedStyle(e).display), 'table');
    const tableBox = await table.boundingBox(), first = await table.locator('th').first().boundingBox(), second = await table.locator('th').last().boundingBox();
    assert.ok(tableBox && first && second && Math.abs(first.width + second.width - tableBox.width) < 3);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    console.log(`${width} PASS 활동보고·원장 조회·파이프라인·운영 상태 배치`);
    await page.close();
  }
} finally { await browser.close(); server.server.closeAllConnections(); await server.close(); }
