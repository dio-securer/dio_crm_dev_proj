import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHqServer } from '../hq-standard/server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = process.env.W02_OUTPUT_DIR ? path.resolve(root, process.env.W02_OUTPUT_DIR) : path.join(root, 'docs/admin-platform/customization/evidence/w02');
await fs.mkdir(out, { recursive: true });
const mapping = JSON.parse(await fs.readFile(path.join(root, 'docs/admin-platform/customization/evidence/lead-account-element-map.json'), 'utf8'));
const byId = new Map(mapping.entries.map(entry => [entry.id, entry]));
const expected = mapping.entries.filter(entry => ['HQ_STRUCTURE', 'HQ_VISIBLE', 'HQ_VISIBLE_OR_QUERY', 'UNSUPPORTED_VISIBLE'].includes(entry.w01.disposition)).map(entry => entry.id);
const result = { kind: 'W02 live DOM anchors', source: 'current frontend/dist', catalog: mapping.sourceCatalog, viewports: {}, failures: [], missingIds: [], missingLocations: [], observedIds: [], states: 0 };
let runtime, browser;
try {
  runtime = await startHqServer({ port: 0, storageDir: false });
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ headless: true, ...(process.env.HQ_BROWSER_CHANNEL ? { channel: process.env.HQ_BROWSER_CHANNEL } : {}) });
  result.browserVersion = browser.version();
  for (const [name, viewport] of [['pc', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
    await context.route('**/*', route => new URL(route.request().url()).origin === runtime.url ? route.continue() : route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', error => result.failures.push(`${name}: ${error.message}`));
    const states = {};
    result.viewports[name] = states;
    async function shot(label) {
      states[label] = await page.evaluate(() => ({
        title: document.title,
        tabs: [...document.querySelectorAll('[role="tab"]')].map(el => ({ key: el.getAttribute('data-tab-key'), selected: el.getAttribute('aria-selected') })),
        fields: [...document.querySelectorAll('[data-field-key]')].map(el => el.getAttribute('data-field-key')),
        apiFields: [...document.querySelectorAll('[data-hq-api-field]')].map(el => el.getAttribute('data-hq-api-field')),
        anchors: [...document.querySelectorAll('[data-config-id]')].map(el => ({ id: el.getAttribute('data-config-id'), instance: el.getAttribute('data-config-instance'), support: el.getAttribute('data-config-support'), tag: el.tagName.toLowerCase() })),
        dialogs: [...document.querySelectorAll('dialog[open]')].map(el => el.querySelector('h2')?.textContent ?? ''),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      }));
      const anchors = states[label].anchors;
      if (!anchors.length) result.failures.push(`${name}/${label}: no config anchors`);
      if (states[label].horizontalOverflow) result.failures.push(`${name}/${label}: horizontal overflow`);
      const pairs = new Set();
      for (const anchor of anchors) {
        if (!byId.has(anchor.id)) result.failures.push(`${name}/${label}: unregistered ${anchor.id}`);
        if (!anchor.instance) result.failures.push(`${name}/${label}: missing instance ${anchor.id}`);
        if (anchor.support !== (byId.get(anchor.id)?.w01.disposition === 'UNSUPPORTED_VISIBLE' ? 'unsupported' : 'mapped')) result.failures.push(`${name}/${label}: support mismatch ${anchor.id}`);
        const pair = `${anchor.id}::${anchor.instance}`;
        if (pairs.has(pair)) result.failures.push(`${name}/${label}: duplicate ${pair}`);
        pairs.add(pair);
      }
      if (label === 'account-bulk-popup') {
        const wrongRows = await page.locator('[data-ledger-row]').evaluateAll(rows => rows.filter(row => row.getAttribute('data-config-instance') !== `bulk.row.${row.getAttribute('data-ledger-row')}.fields`).length);
        if (wrongRows) result.failures.push(`${name}/${label}: ${wrongRows} bulk row instances do not match record IDs`);
      }
      result.states++;
    }
    await page.goto(`${runtime.url}/leads?hq=1`);
    await page.locator('.hq-lead-list').waitFor();
    await shot('lead-list');
    await page.locator('.hq-lead-list [data-lead-id]').first().click();
    await page.locator('.hq-lead-detail').waitFor();
    await shot('lead-detail');
    for (const key of ['keyman', 'hospital', 'exclusions', 'marketing', 'history', 'activities']) {
      await page.locator(`[data-tab-key="${key}"]`).click();
      await shot(`lead-${key}`);
    }
    await page.locator('[data-tab-key="hira"]').click();
    await shot('lead-hira');
    if (await page.locator('.hq-lead-detail .page-actions button').count()) {
      await page.locator('.hq-lead-detail .page-actions button').first().click();
      await page.locator('dialog.hq-customer-modal[open]').waitFor();
      await shot('lead-owner-popup');
      await page.locator('dialog.hq-customer-modal[open]').getByRole('button', { name: '닫기' }).first().click().catch(async () => { await page.keyboard.press('Escape'); });
    }
    if (await page.locator('.hq-lead-detail .page-actions .button-primary').count()) {
      await page.locator('.hq-lead-detail .page-actions .button-primary').click();
      await page.locator('dialog.hq-customer-modal[open]').waitFor();
      await shot('lead-convert-popup');
      await page.getByTestId('conversion-account-mode').selectOption('EXISTING');
      await page.getByTestId('conversion-contact-mode').selectOption('EXISTING');
      await page.getByTestId('conversion-opportunity-mode').selectOption('EXISTING');
      await shot('lead-convert-existing');
    }
    // seedIDs.noCoordinatesLead is an owned NEW lead in the isolated HQ fixture.
    await page.goto(`${runtime.url}/leads?hq=1&lead=10000000-0000-4000-8000-00000000000e`);
    await page.locator('.hq-lead-detail').waitFor();
    await shot('lead-new-delete');
    await page.locator('.hq-stage-buttons button').nth(2).click();
    await shot('lead-reverse');
    await page.goto(`${runtime.url}/leads?hq=1`);
    await page.locator('.hq-lead-list').waitFor();
    await page.locator('.hq-lead-list .button-primary').first().click();
    await page.locator('dialog.hq-customer-modal[open]').waitFor();
    await shot('lead-create');
    await page.goto(`${runtime.url}/accounts?hq=1`);
    await page.locator(name === 'pc' ? '.account-desktop' : '.account-mobile').waitFor();
    await page.locator(name === 'pc' ? '.pc-table-card tbody tr' : '.mob-account-row').first().waitFor();
    await shot('account-list');
    await page.getByTestId('open-account-ledger').click();
    await page.locator('dialog.hq-customer-modal[open]').waitFor();
    await shot('account-bulk-popup');
    await page.keyboard.press('Escape');
    await page.getByTestId('open-account-merge').click();
    await page.locator('dialog.hq-customer-modal[open]').waitFor();
    await shot('account-merge-popup');
    await page.keyboard.press('Escape');
    await page.locator(name === 'pc' ? '.account-desktop .page-actions .button-primary' : '.mob-new').click();
    await page.locator(name === 'pc' ? '.pc-window-form' : '.mob-edit-form').waitFor();
    await shot('account-create');
    await page.goto(`${runtime.url}/accounts?hq=1`);
    await page.locator(name === 'pc' ? '.account-desktop' : '.account-mobile').waitFor();
    await page.locator(name === 'pc' ? '.pc-table-card tbody tr' : '.mob-account-row').first().click();
    await page.locator('.hq-account-workspace').waitFor();
    await shot('account-detail-basic');
    for (const key of ['erp', 'hospital', 'contacts', 'sales', 'order', 'service', 'timeline', 'analytics']) {
      await page.locator(`[data-tab-key="${key}"]`).click();
      await shot(`account-${key}`);
    }
    await page.locator('[data-tab-key="contacts"]').click();
    const accountId = await page.locator('.hq-account-workspace').getAttribute('data-account-id');
    if (await page.locator('[data-contact-id]').count()) {
      await page.locator('[data-contact-id]').first().click();
      await page.locator('dialog.hq-customer-modal[open]').waitFor();
      await shot('account-contact-edit-popup');
      await page.goto(`${runtime.url}/accounts?hq=1&record=${accountId}&tab=contacts`);
      await page.getByTestId('new-contact').waitFor();
    }
    if (await page.getByTestId('new-contact').count()) {
      await page.getByTestId('new-contact').click();
      await page.locator('dialog.hq-customer-modal[open]').waitFor();
      await shot('account-contact-popup');
    }
    await context.close();
  }
} catch (error) {
  result.failures.push(error instanceof Error ? error.stack : String(error));
} finally {
  const observed = new Set(Object.values(result.viewports).flatMap(viewport => Object.values(viewport).flatMap(state => state.anchors.map(anchor => anchor.id))));
  result.observedIds = [...observed].sort();
  result.expectedIds = expected.length;
  result.expectedLocations = mapping.entries.filter(item => expected.includes(item.id)).reduce((sum, item) => sum + item.w01.locations.reduce((count, location) => count + location.devices.length, 0), 0);
  result.missingIds = expected.filter(id => !observed.has(id));
  if (result.missingIds.length) result.failures.push(`${result.missingIds.length} mapped IDs without live DOM anchors`);
  const instanceMatches = (actual, expectedInstance) => {
    if (actual === expectedInstance || actual.startsWith(`${expectedInstance}.`)) return true;
    if (expectedInstance.includes('<')) {
      const [head, tail] = expectedInstance.split(/<[^>]+>/);
      return actual.startsWith(head) && actual.endsWith(tail);
    }
    return false;
  };
  for (const entry of mapping.entries.filter(item => expected.includes(item.id))) {
    for (const location of entry.w01.locations) {
      for (const device of location.devices) {
        const anchors = Object.values(result.viewports[device] ?? {}).flatMap(state => state.anchors);
        if (!anchors.some(anchor => anchor.id === entry.id && instanceMatches(anchor.instance, location.instanceId))) {
          result.missingLocations.push(`${device}:${entry.id}@${location.instanceId}`);
        }
      }
    }
  }
  if (result.missingLocations.length) result.failures.push(`${result.missingLocations.length} mapped locations without live DOM anchors`);
  if (browser) await browser.close();
  if (runtime) await runtime.close();
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ viewports: Object.keys(result.viewports), states: result.states, anchors: result.observedIds.length, missingIds: result.missingIds, missingLocations: result.missingLocations, failures: result.failures }, null, 2));
}
if (result.failures.length) process.exitCode = 1;
