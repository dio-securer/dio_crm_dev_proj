import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';
const runtime = await startHqServer({ port: 0, storageDir: false, autoAdvance: false, dist: 'frontend/dist-opportunity-guard-v3' });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', timeout: 90000 });
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
 await page.goto(runtime.url + '/opportunities', { waitUntil: 'domcontentloaded' });
 await page.locator('.hq-mock-controls select').first().selectOption('hq-sales');
 await page.locator('.hq-sales-row').first().click();
 const input = page.getByLabel('기회명').first(); await input.waitFor(); await page.waitForFunction(() => { const field = [...document.querySelectorAll('input')].find(x => x.closest('label')?.textContent?.includes('기회명')); return field && field.value.length > 0; }); await input.fill('뒤로가기 미저장 검증');
 const buttonDialog = page.waitForEvent('dialog', { timeout: 5000 }).then(dialog => dialog.dismiss()); await page.getByRole('button', { name: '목록으로' }).click(); await buttonDialog; assert.equal(await input.inputValue(), '뒤로가기 미저장 검증');
 const original = page.url();
 console.log('이탈 전', JSON.stringify(await page.evaluate(() => ({ url: location.href, state: history.state }))));
 const firstDialog = page.waitForEvent('dialog', { timeout: 10000 }).then(dialog => dialog.dismiss());
 await page.evaluate(() => history.back());
 try { await firstDialog; } catch (error) { console.log('확인창 없음, 이탈 후', JSON.stringify(await page.evaluate(() => ({ url: location.href, state: history.state, input: document.querySelector('input[value="뒤로가기 미저장 검증"]') !== null })))); throw error; }
 await page.waitForFunction(url => location.href === url, original);
 assert.equal(await input.inputValue(), '뒤로가기 미저장 검증');
 const secondDialog = page.waitForEvent('dialog', { timeout: 10000 }).then(dialog => dialog.accept());
 await page.evaluate(() => history.back());
 await secondDialog;
 await page.getByLabel('기회 검색').waitFor();
 console.log('PASS 뒤로가기 취소 시 입력·상세 보존, 수락 시 목록 이동');
} finally { await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 5000))]); runtime.server.closeAllConnections(); await runtime.close(); }
process.exit(0);
