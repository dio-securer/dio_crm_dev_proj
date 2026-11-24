import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');
const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
const browser = await chromium.launch({ headless: true });
async function check(title, button) {
  const a = await title.boundingBox(), b = await button.boundingBox();
  assert.ok(a && b && a.x < b.x && Math.abs(a.y + a.height / 2 - b.y - b.height / 2) < 3);
  assert.ok(b.width >= 100 && b.height >= 44);
}
try {
  for (const width of [768, 1024]) {
    const page = await browser.newPage({ viewport: { width, height: 1024 } });
    await page.goto(`${server.url}/leads?lead=${seedIDs.lead}`);
    const lead = page.locator('.lead-detail-top'); await lead.waitFor();
    await check(lead.locator('.lead-mobile-title'), lead.locator('.lead-detail-back'));
    const field = page.locator('.lead-details-form [data-field-key="hospitalName"]'); await field.fill(`격리 수정 ${width}`);
    page.once('dialog', dialog => dialog.dismiss()); await lead.locator('.lead-detail-back').click();
    assert.equal(await field.inputValue(), `격리 수정 ${width}`);
    page.once('dialog', dialog => dialog.accept()); await lead.locator('.lead-detail-back').click();
    await lead.waitFor({ state: 'detached' });
    await page.goto(server.url + '/activities');
    await page.locator('.hq-act-schedule-row').first().click();
    const activity = page.locator('[data-hq-screen="SCR-ACT-002"] .activity-detail-heading'); await activity.waitFor();
    await check(activity.locator('h2'), activity.locator('.activity-tablet-back'));
    await activity.locator('.activity-tablet-back').click(); await activity.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: '활동 등록', exact: true }).click();
    const create = page.locator('.activity-detail-heading').first(); await check(create.locator('h2'), create.locator('.activity-tablet-back'));
    await create.locator('.activity-tablet-back').click();
    await page.goto(server.url + '/accounts');
    await page.locator('.mob-account-row:visible, .pc-table-card tbody tr:visible').first().click();
    if (width === 768) {
      const account = page.locator('.mob-detail-top:has(.account-tablet-detail-title)'); await account.waitFor();
      await check(account.locator('.account-tablet-detail-title'), account.locator('button'));
      await account.locator('button').click(); await account.waitFor({ state: 'detached' });
    } else {
      const account = page.locator('.account-tablet-window-header'); await account.waitFor();
      await check(account.locator('h3'), account.locator('button'));
      await account.locator('button').click(); await account.waitFor({ state: 'detached' });
    }
    console.log(`${width} PASS 리드·활동·거래처 표준 헤더 및 목록 복귀`);
    await page.close();
  }
} finally { await browser.close(); server.server.closeAllConnections(); await server.close(); }
