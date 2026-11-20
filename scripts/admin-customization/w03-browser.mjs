import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHqServer } from '../hq-standard/server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'docs/admin-platform/customization/evidence/w03');
await fs.mkdir(out, { recursive: true });
const result = { kind: 'W03 isolated actual React preview', states: [], apiRequests: [], externalRequests: [], downloads: [], popups: [], failures: [], screenshots: [] };
let runtime, browser;
try {
  runtime = await startHqServer({ port: 0, storageDir: false });
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ headless: true, ...(process.env.HQ_BROWSER_CHANNEL ? { channel: process.env.HQ_BROWSER_CHANNEL } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => { window.__DIO_VISUAL_PREVIEW_HARNESS__ = true; });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('download', download => result.downloads.push(download.suggestedFilename()));
  page.on('popup', popup => result.popups.push(popup.url()));
  page.on('pageerror', error => result.failures.push(`page error: ${error.stack ?? error.message}`));
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) result.apiRequests.push(`${request.method()} ${url.pathname}`);
    if (url.origin !== runtime.url && url.protocol !== 'about:') result.externalRequests.push(request.url());
  });
  await page.goto(runtime.url);
  await page.getByRole('heading', { name: 'W03 fixture preview' }).waitFor();
  await page.locator('iframe[title*="법인 작업본 화면"]').waitFor();
  await page.waitForTimeout(1000);
  const child = page.frames().find(item => item !== page.mainFrame());
  result.isolation = child ? await child.evaluate(async () => {
    let storageBlocked = false, parentBlocked = false, cookieBlocked = false;
    try { void localStorage.length; } catch { storageBlocked = true; }
    try { void window.parent.document.body; } catch { parentBlocked = true; }
    try { void document.cookie; } catch { cookieBlocked = true; }
    let connectionBlocked = false;
    try { await fetch('https://example.invalid/w03-probe'); } catch { connectionBlocked = true; }
    return { origin: location.origin, storageBlocked, parentBlocked, cookieBlocked, connectionBlocked, locale: document.documentElement.lang };
  }) : null;
  const frame = page.frameLocator('iframe[title*="법인 작업본 화면"]');
  async function state(screen, variant, device, label) {
    await page.locator('.visual-preview-controls select').nth(0).selectOption(screen);
    await page.locator('.visual-preview-controls select').nth(1).selectOption(variant);
    await page.locator('.visual-preview-controls select').nth(2).selectOption(device);
    await page.getByRole('status').filter({ hasText: /고정 fixture/ }).waitFor({ timeout: 20000 });
    await page.locator('.visual-preview-stage:not(.visual-preview-standard) [role="status"]').filter({ hasText: /fixture/ }).waitFor({ timeout: 20000 });
    const anchors = await frame.locator('[data-config-id]').count();
    if (!anchors) result.failures.push(`${label}: no actual screen anchors`);
    const target = screen === 'HQ_LEAD'
      ? { list: '.hq-lead-list', detail: '.hq-lead-detail', create: 'dialog[data-config-id="POP.LEAD.CREATE"]', owner: 'dialog[data-config-id="POP.LEAD.OWNER"]', convert: 'dialog[data-config-id="POP.LEAD.CONVERT"]' }[variant]
      : { list: device === 'pc' ? '.account-desktop' : '.account-mobile', detail: '.hq-account-workspace', create: '[data-config-instance="create.crmName"]', contact: 'dialog[data-config-id="POP.ACC.CONTACT"]', bulk: 'dialog[data-config-id="POP.ACC.BULK"]', merge: 'dialog[data-config-id="POP.ACC.MERGE"]' }[variant];
    if (!target || !await frame.locator(target).first().isVisible()) result.failures.push(`${label}: requested state did not render visibly`);
    const locale = await frame.locator('html').getAttribute('lang');
    if (locale?.slice(0, 2) !== (await page.locator('.visual-preview-controls select').nth(3).inputValue()).slice(0, 2)) result.failures.push(`${label}: locale did not switch`);
    result.states.push({ label, screen, variant, device, locale, anchors });
    return anchors;
  }
  await state('HQ_LEAD', 'list', 'pc', 'lead-list-pc');
  await frame.locator('[data-config-instance="list.create"]').click();
  if (await frame.locator('dialog[data-config-id="POP.LEAD.CREATE"]').count()) result.failures.push('lead list click opened business form');
  for (const screen of ['HQ_LEAD', 'HQ_ACCOUNT']) {
    const variants = screen === 'HQ_LEAD' ? ['list', 'detail', 'create', 'owner', 'convert'] : ['list', 'detail', 'create', 'contact', 'bulk', 'merge'];
    for (const device of ['pc', 'mobile']) {
      for (const variant of variants) {
        if (screen === 'HQ_LEAD' && variant === 'list' && device === 'pc') continue;
        await state(screen, variant, device, `${screen}-${variant}-${device}`);
      }
    }
  }
  await page.locator('.visual-preview-controls select').nth(3).selectOption('en-US');
  await state('HQ_LEAD', 'create', 'pc', 'lead-create-en-pc');
  await state('HQ_ACCOUNT', 'detail', 'mobile', 'account-detail-en-mobile');
  await page.locator('.visual-preview-controls select').nth(3).selectOption('ko-KR');
  await state('HQ_ACCOUNT', 'bulk', 'mobile', 'account-bulk-mobile');
  await frame.locator('[data-testid="save-ledger"]').click({ force: true });
  if (await frame.locator('[data-row-status="SUCCESS"]').count()) result.failures.push('bulk save changed fixture row');
  await page.screenshot({ path: path.join(out, 'account-bulk-mobile.png') });
  result.screenshots.push('account-bulk-mobile.png');
  if (!result.isolation || result.isolation.origin !== 'null' || !result.isolation.storageBlocked || !result.isolation.parentBlocked || !result.isolation.cookieBlocked || !result.isolation.connectionBlocked) result.failures.push('preview iframe isolation failed');
  const frameSandboxes = await page.locator('iframe').evaluateAll(frames => frames.map(frame => frame.getAttribute('sandbox')));
  if (frameSandboxes.length !== 2 || frameSandboxes.some(value => value !== 'allow-scripts')) result.failures.push('preview iframe sandbox changed');
  if (result.apiRequests.length) result.failures.push('preview issued business API requests');
  if (result.externalRequests.length) result.failures.push('preview issued external requests');
  if (result.downloads.length || result.popups.length) result.failures.push('preview opened a download or popup');
  await context.close();
} catch (error) {
  result.failures.push(error instanceof Error ? error.stack : String(error));
} finally {
  if (browser) await browser.close();
  if (runtime) await runtime.close();
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ states: result.states, isolation: result.isolation, apiRequests: result.apiRequests, externalRequests: result.externalRequests, downloads: result.downloads, popups: result.popups, failures: result.failures }, null, 2));
}
if (result.failures.length) process.exitCode = 1;
