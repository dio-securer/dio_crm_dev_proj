import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.ADMIN_MOCK_URL ?? 'http://127.0.0.1:5174';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
const frameRequests = [];
page.setDefaultTimeout(20000);
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (request.frame() !== page.mainFrame() && !request.url().startsWith('about:')) frameRequests.push(request.url());
});
await page.addInitScript(() => {
  window.__previewMessages = [];
  window.addEventListener('message', event => {
    if (event.data?.type === 'DIO_VISUAL_PREVIEW_READY') window.__previewMessages.push(event.data);
  });
});
let exitCode = 0;
try {
  await page.goto(`${base}/admin/customization`);
  await page.getByLabel('아이디').fill('admin');
  await page.getByLabel('비밀번호').fill('1234');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByRole('option', { name: 'DIO 데모 법인' }).waitFor({ state: 'attached' });
  await page.getByLabel('법인', { exact: true }).selectOption('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  await page.getByRole('button', { name: '화면 속성', exact: true }).click();
  const controls = page.locator('.visual-preview-controls select');
  await controls.nth(0).selectOption('HQ_LEAD');
  await controls.nth(1).selectOption('list');
  const iframe = page.locator('iframe[title="HQ_LEAD list 법인 작업본 화면"]');
  await iframe.waitFor();
  const frame = page.frameLocator('iframe[title="HQ_LEAD list 법인 작업본 화면"]');
  await frame.locator('.hq-lead-list').waitFor({ state: 'visible' });
  await page.locator('.visual-preview-stage:not(.visual-preview-standard) [role="status"]').filter({ hasText: '고정 fixture' }).waitFor();
  const anchors = await frame.locator('[data-config-id]').count();
  const messages = await page.evaluate(() => window.__previewMessages);
  const sandbox = await iframe.getAttribute('sandbox');
  assert.ok(anchors > 0, 'The preview must contain actual lead screen elements');
  assert.ok(messages.some(message => message.screen === 'HQ_LEAD' && message.variant === 'list' && message.anchorCount > 0), 'The runtime must send READY');
  assert.equal(sandbox, 'allow-scripts');
  assert.deepEqual(frameRequests, [], 'The isolated preview must not issue network requests');
  assert.deepEqual(errors, [], 'The page must not throw JavaScript errors');
  const builtContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await builtContext.addInitScript(() => { window.__DIO_VISUAL_PREVIEW_HARNESS__ = true; });
  const builtPage = await builtContext.newPage();
  builtPage.setDefaultTimeout(20000);
  await builtPage.goto(process.env.HQ_PREVIEW_URL ?? 'http://127.0.0.1:3210/');
  await builtPage.locator('.visual-preview-stage:not(.visual-preview-standard) [role="status"]').filter({ hasText: '고정 fixture' }).waitFor();
  const builtFrame = builtPage.frameLocator('iframe[title="HQ_LEAD list 법인 작업본 화면"]');
  await builtFrame.locator('.hq-lead-list').waitFor({ state: 'visible' });
  const builtAnchors = await builtFrame.locator('[data-config-id]').count();
  assert.ok(builtAnchors > 0, 'The built application must render the lead preview');
  console.log(JSON.stringify({ result: 'PASS', anchors, builtAnchors, ready: messages.length, sandbox, frameRequests }, null, 2));
} catch (error) {
  exitCode = 1;
  console.error(error);
} finally {
  await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 5000))]);
  process.exit(exitCode);
}
