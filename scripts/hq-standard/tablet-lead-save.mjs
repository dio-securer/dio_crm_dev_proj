import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';

const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [768, 1024]) {
    const page = await browser.newPage({ viewport: { width, height: 1024 } });
    await page.goto(server.url + '/leads');
    await page.getByRole('button', { name: '신규병원 등록' }).click();
    const dialog = page.locator('dialog[open]');
    await dialog.locator('[data-field-key="hospitalName"]').fill(`격리 패드 병원 ${width}`);
    await dialog.locator('[data-field-key="phone"]').fill('010-0000-1234');
    await dialog.getByRole('button', { name: '생성', exact: true }).click();
    await page.locator('.hq-lead-detail').waitFor();
    const form = page.locator('.lead-details-form');
    await form.locator('[data-field-key="phone"]').fill('010-0000-4321');
    await form.getByRole('button', { name: '저장', exact: true }).click();
    await page.getByText('저장되었습니다.', { exact: true }).first().waitFor();
    await page.reload();
    assert.equal(await form.locator('[data-field-key="phone"]').inputValue(), '010-0000-4321');
    console.log(`${width} PASS 리드 신규·수정·재조회`);
    await page.close();
  }
} finally {
  await browser.close(); server.server.closeAllConnections(); await server.close();
}
