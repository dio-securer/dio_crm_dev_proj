import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');
const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
const browser = await chromium.launch({ headless: true });
const aligned = async (a, b) => { const x = await a.boundingBox(), y = await b.boundingBox(); assert.ok(x && y && Math.abs((x.y + x.height / 2) - (y.y + y.height / 2)) < 2); };
try {
  for (const width of [768, 1024]) {
    const page = await browser.newPage({ viewport: { width, height: 1024 } });
    await page.goto(`${server.url}/leads?lead=${seedIDs.lead}`);
    const reason = page.locator('.lead-stage-reason');
    await reason.waitFor();
    await aligned(reason.locator('input'), reason.getByTestId('save-stage'));
    const nav = page.locator('.lead-mobile-navigation');
    const navBox = await nav.boundingBox();
    const navItems = await nav.locator('a:visible, button:visible').all();
    const last = await navItems.at(-1).boundingBox();
    assert.ok(navBox && last && Math.abs(navBox.x + navBox.width - last.x - last.width) < 2);
    await page.goto(server.url + '/accounts');
    const tools = page.locator('.hq-account-tools').first();
    const buttons = tools.locator('button:visible');
    if (await buttons.count() === 2) { const a = await buttons.nth(0).boundingBox(), b = await buttons.nth(1).boundingBox(); assert.ok(a && b && Math.abs(a.width - b.width) < 2); }
    await page.goto(server.url + '/activities');
    const filters = page.locator('.hq-activity-primary .hq-act-card > .hq-act-actions').filter({ has: page.getByLabel('활동 검색') });
    await filters.waitFor();
    await aligned(page.getByLabel('활동 검색'), page.getByLabel('활동 상태'));
    await page.locator('.hq-act-schedule-row').first().click();
    await page.locator('[data-hq-screen="SCR-ACT-002"] .hq-act-detail').waitFor();
    const boxes = await page.locator('[data-hq-screen="SCR-ACT-002"] .hq-act-detail > div').all();
    assert.equal(boxes.length, 5);
    const rects = await Promise.all(boxes.map(box => box.boundingBox()));
    assert.ok(rects.every(box => box && Math.abs(box.y - rects[0].y) < 2));
    for (const [path, selector] of [[`/opportunities?record=${seedIDs.approvedOpportunity}`, '.hq-opportunity-page'], [`/orders?record=${seedIDs.readyOrder}`, '.h06-order-page']]) {
      await page.goto(server.url + path);
      const heading = page.locator(`${selector} .tablet-detail-heading`);
      await heading.waitFor();
      if (selector === '.h06-order-page') await page.locator('.h06-order-page .h06-summary dd').first().waitFor();
      await aligned(heading.locator('h2'), heading.getByRole('button', { name: '목록으로' }));
      assert.ok((await heading.locator('h2').boundingBox()).x < (await heading.locator('button').boundingBox()).x);
      if (selector === '.h06-order-page') page.once('dialog', dialog => dialog.accept());
      await heading.getByRole('button', { name: '목록으로' }).click();
      await heading.waitFor({ state: 'detached' });
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    console.log(`${width} PASS 리드·거래처·활동·기회·주문 태블릿 배치`);
    await page.close();
  }
} finally { await browser.close(); server.server.closeAllConnections(); await server.close(); }
