import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHqServer } from '../hq-standard/server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'docs/admin-platform/customization/evidence/w04');
await fs.mkdir(out, { recursive: true });
const result = { kind: 'W04 visual element selection and properties', checks: [], apiRequests: [], downloads: [], failures: [] };
let runtime, browser;
try {
  runtime = await startHqServer({ port: 0, storageDir: false });
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ headless: true, ...(process.env.HQ_BROWSER_CHANNEL ? { channel: process.env.HQ_BROWSER_CHANNEL } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => { window.__DIO_VISUAL_PREVIEW_HARNESS__ = true; });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => result.failures.push(error.message));
  page.on('download', download => result.downloads.push(download.suggestedFilename()));
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) result.apiRequests.push(`${request.method()} ${request.url()}`); });
  await page.goto(runtime.url);
  const frame = page.frameLocator('iframe[title*="격리 미리보기"]');
  const ready = () => page.locator('.visual-preview-status').filter({ hasText: /fixture/ }).waitFor();
  const selected = () => page.getByTestId('visual-selected-id').innerText();
  await ready();

  const create = frame.locator('[data-config-id="LEAD.create"][data-config-instance="list.create"]');
  await create.focus();
  await create.press('Enter');
  if (await selected() !== 'LEAD.create') result.failures.push('keyboard selection did not preserve the config ID');
  if (!await create.evaluate(element => element.classList.contains('visual-preview-selected'))) result.failures.push('selected outline is missing');
  if (await frame.locator('dialog[data-config-id="POP.LEAD.CREATE"]').count()) result.failures.push('keyboard selection ran the business action');
  result.checks.push('keyboard selection and business action fence');

  await page.locator('.visual-preview-controls select').nth(1).selectOption('create');
  await ready();
  const phone = frame.locator('dialog[data-config-id="POP.LEAD.CREATE"] [data-config-id="lead.phone"]').first();
  await phone.click();
  if (await selected() !== 'lead.phone') result.failures.push('field click selected a different ID');
  const visible = page.getByTestId('visual-property-visible');
  await visible.uncheck();
  if (await visible.isChecked()) result.failures.push('property override was not reflected');
  if (!await page.locator('.visual-change-list').getByText('숨김').count()) result.failures.push('hidden field is absent from the change list');
  await page.locator('.visual-preview-controls select').nth(1).selectOption('list');
  await ready();
  await page.locator('.visual-change-list button').filter({ hasText: 'lead.phone' }).click();
  if (await selected() !== 'lead.phone' || await visible.isChecked()) result.failures.push('hidden field could not be reopened from the change list');
  await page.getByRole('button', { name: '상속 복원' }).first().click();
  if (!await visible.isChecked()) result.failures.push('inheritance reset did not restore the standard value');
  result.checks.push('field click, override, hidden list and inheritance reset');

  await frame.locator('[data-config-id="lead.status"]').first().click();
  if (!await page.getByText('본사 잠금:').count()) result.failures.push('headquarters lock reason is absent');
  result.checks.push('locked field exposes the headquarters restriction');
  const unsupported = frame.locator('[data-config-id="lead.scope"]').first();
  await unsupported.click();
  if (await selected() !== 'lead.scope') result.failures.push('unsupported anchor did not select');
  if (!await page.getByText('현재 화면에서 설정 미지원').count()) result.failures.push('unsupported reason is absent');
  if (await page.locator('.visual-property-panel input:not([disabled])').count()) result.failures.push('unsupported item has an editable input');
  result.checks.push('unsupported item is read only');

  await page.locator('.visual-preview-controls select').nth(0).selectOption('HQ_ACCOUNT');
  await page.locator('.visual-preview-controls select').nth(1).selectOption('create');
  await page.locator('.visual-preview-controls select').nth(2).selectOption('mobile');
  await ready();
  await frame.locator('[data-config-id="account.crmName"][data-config-instance="create.crmName"]').click();
  if (await selected() !== 'account.crmName') result.failures.push('mobile field click selected a different ID');
  if (!await page.getByTestId('visual-property-required').isChecked()) result.failures.push('required property does not show the standard value');
  result.checks.push('mobile account field selection');
  await page.screenshot({ path: path.join(out, 'account-create-mobile-editor.png') });
  if (result.apiRequests.length || result.downloads.length) result.failures.push('editor selection issued a business request or download');
  await context.close();
} catch (error) {
  result.failures.push(error instanceof Error ? error.stack : String(error));
} finally {
  if (browser) await browser.close();
  if (runtime) await runtime.close();
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
if (result.failures.length) process.exitCode = 1;
