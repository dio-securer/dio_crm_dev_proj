import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, ...(process.env.HQ_BROWSER_CHANNEL ? { channel: process.env.HQ_BROWSER_CHANNEL } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
  await page.goto(process.env.LEAD_GRID_TEST_URL ?? 'http://127.0.0.1:3213/admin/customization');
  await page.locator('main select').first().selectOption('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  const picker = page.locator('section[aria-label="리드 목록 열 추가"]');
  await picker.waitFor();
  await picker.locator('input').fill('lead.address');
  await picker.getByRole('button', { name: '추가' }).click();
  const frames = page.locator('.visual-preview-stage iframe');
  await frames.nth(1).contentFrame().locator('.hq-lead-list thead th').nth(5).waitFor();
  const heads = async () => Promise.all([0, 1].map(async index => frames.nth(index).contentFrame().locator('.hq-lead-list thead th').allTextContents()));
  const afterAdd = await heads();
  if (afterAdd[0].length !== 5 || afterAdd[1].length !== 6) throw new Error(`Preview columns: ${JSON.stringify(afterAdd)}`);
  const anchors = await frames.nth(1).contentFrame().locator('.hq-lead-list table').evaluate(table => ({ header: table.querySelector('thead th:last-child')?.getAttribute('data-config-id'), cell: table.querySelector('tbody tr:first-child td:last-child')?.getAttribute('data-config-id') }));
  if (anchors.header !== 'lead.address' || anchors.cell !== 'lead.address') throw new Error(`Column anchors: ${JSON.stringify(anchors)}`);
  await page.getByRole('button', { name: '작업본 저장' }).click();
  await page.reload();
  await page.locator('main select').first().selectOption('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  await picker.waitFor();
  await picker.locator('input').fill('lead.address');
  await picker.getByText('목록에 배치됨').waitFor();
  await frames.nth(1).contentFrame().locator('.hq-lead-list thead th').nth(5).waitFor();
  const afterReload = await heads();
  if (afterReload[0].length !== 5 || afterReload[1].length !== 6) throw new Error(`Reload columns: ${JSON.stringify(afterReload)}`);
  await page.getByRole('button', { name: '검증', exact: true }).click();
  await page.getByRole('button', { name: '미리보기', exact: true }).click();
  await page.getByLabel('변경 사유').fill('reviewed lead grid column');
  await Promise.all([page.waitForResponse(response => response.url().includes('/releases') && response.request().method() === 'POST' && response.ok()), page.getByRole('button', { name: '게시', exact: true }).click()]);
  console.log(JSON.stringify({ checks: ['candidate search and add', 'header/cell anchors', 'standard/draft comparison', 'save and requery', 'validate, preview and publish'], columns: afterReload.map(item => item.length) }));
} finally { await browser.close(); }
