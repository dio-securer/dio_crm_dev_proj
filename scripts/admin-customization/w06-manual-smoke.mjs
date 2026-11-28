import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, ...(process.env.HQ_BROWSER_CHANNEL ? { channel: process.env.HQ_BROWSER_CHANNEL } : {}) });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.W06_FIXTURE_URL ?? 'http://127.0.0.1:3211/admin/customization');
  await page.getByRole('heading', { name: '법인 CRM 설정' }).waitFor();
  await page.getByLabel('법인', { exact: true }).selectOption('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  await page.locator('.visual-preview-controls select').nth(1).selectOption('create');
  await page.locator('.visual-preview-status').filter({ hasText: /fixture/ }).waitFor();
  const frame = page.frameLocator('iframe[title*="격리 미리보기"]');
  await frame.locator('dialog[data-config-id="POP.LEAD.CREATE"] [data-config-id="lead.hospitalName"]').first().click();
  await page.getByTestId('visual-property-visible').uncheck();
  await page.getByRole('button', { name: '작업본 저장', exact: true }).click();
  await page.getByText('저장된 작업본', { exact: false }).first().waitFor();
  await page.getByRole('button', { name: '검증', exact: true }).click();
  await page.getByTestId('admin-validation-state').getByText('검증 실패', { exact: false }).waitFor();
  const issues = await page.locator('.visual-preview-issues button').allInnerTexts();
  if (!issues.some(issue => issue.includes('lead.hospitalName')) || !await page.getByRole('button', { name: '게시', exact: true }).isDisabled() || errors.length) throw new Error(JSON.stringify({ issues, errors }));
  console.log(JSON.stringify({ status: 'PASS', scope: 'Real loopback HTTP, synthetic admin fixture', issues, publishBlocked: true, pageErrors: errors }));
} finally {
  await browser.close();
}
