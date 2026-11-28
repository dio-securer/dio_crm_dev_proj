#!/usr/bin/env node
// F2-5 browser check of the generic engine screens: the real frontend (Vite dev server) in Chromium, drawing the
// repository's real lead metadata, against a MOCK of the engine API (mock-api.mjs: real engine model and write checks,
// rows in memory, no row access, no SQL). Synthetic: no backend process and no database are involved.
//   pnpm build                       (the engine's dist is needed)
//   node scripts/engine-ui/browser-check.mjs
// Screenshots and the result go to ENGINE_UI_OUT (default .guard/engine-ui/, which git ignores). Exit code 0 only on PASS.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockEngineApi } from './mock-api.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(repo, 'package.json'));
const engine = createRequire(path.join(repo, 'backend/package.json'))('@dio-crm/engine');
const out = path.resolve(process.env.ENGINE_UI_OUT || path.join(repo, '.guard/engine-ui'));
const port = Number(process.env.ENGINE_UI_PORT || 5197), origin = `http://127.0.0.1:${port}`;
const LOCALE = 'ko-KR';

function readMetadata() {
  const files = [];
  const walk = dir => { for (const e of fs.readdirSync(path.join(repo, dir), { withFileTypes: true })) { const rel = `${dir}/${e.name}`; if (e.isDirectory()) walk(rel); else files.push({ path: rel, content: fs.readFileSync(path.join(repo, rel), 'utf8') }); } };
  walk('metadata');
  return files;
}
const term = (file, key) => JSON.parse(fs.readFileSync(path.join(repo, `metadata/terms/${LOCALE}/${file}.json`), 'utf8'))[key];
// A fixture child object: the repository has no reference field yet, and a related list needs one. Labels reuse lead terms.
const json = (file, value) => ({ path: `metadata/objects/visit/${file}`, content: JSON.stringify(value) });
const visit = [
  json('object.json', { aliases: [], key: 'visit', labelKey: 'lead.tab.keyman', pluralLabelKey: 'lead.section.keyman' }),
  json('fields.json', { fields: [{ aliases: [], key: 'lead_ref', labelKey: 'lead.label', required: true, system: false, type: 'reference', referenceObject: 'lead' },
    { aliases: [], key: 'memo', labelKey: 'lead.field.address', required: false, system: false, type: 'text' }, { aliases: [], key: 'owner', labelKey: 'lead.field.owner_name', required: false, system: false, type: 'text' }] }),
  json('list-views.json', { entity: 'visit', views: [{ key: 'all', labelKey: 'lead.view.hq_default', columns: ['memo', 'lead_ref', 'owner'], filter: { op: 'not', arg: { op: 'isEmpty', field: 'lead_ref' } }, sort: [], pageSize: 25, shared: true }] }),
  json('access.json', { entity: 'visit', rules: [{ kind: 'own', ownerField: 'owner' }] }),
];

async function waitFor(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 250)); }
  throw new Error(`the frontend dev server did not answer at ${url}`);
}

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const steps = [], problems = [];
  const api = mockEngineApi(engine, [...readMetadata(), ...visit]);
  api.seed('visit', { lead_ref: '1', memo: 'first visit note', owner: 'mock-user' });
  api.seed('visit', { lead_ref: '2', memo: 'another lead', owner: 'mock-user' });
  api.seed('visit', { lead_ref: '1', memo: 'second visit note', owner: 'mock-user' });
  const vite = spawn('pnpm', ['--filter', '@dio-crm/web', 'exec', 'vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: repo, stdio: 'ignore', detached: true });
  let browser;
  const step = async (name, fn) => { try { await fn(); steps.push({ name, ok: true }); } catch (e) { steps.push({ name, ok: false, error: String(e.message).split('\n')[0] }); throw e; } };
  try {
    await waitFor(`${origin}/`, 60000);
    const { chromium } = require('playwright');
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: LOCALE });
    page.on('pageerror', e => problems.push(`page error: ${String(e).slice(0, 200)}`));
    page.on('console', m => { if (m.type() === 'error') problems.push(`console error: ${m.text().slice(0, 200)}`); });
    await page.addInitScript(() => localStorage.setItem('dio_crm_access_token', 'mock-token'));
    await page.route('**/api/**', async route => {
      const request = route.request();
      const answer = api.handle(request.method(), request.url(), request.postData() ? JSON.parse(request.postData()) : undefined);
      // Everything else the app shell asks for: an empty context, so it runs with its built-in defaults.
      if (!answer) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return route.fulfill({ status: answer.status, contentType: 'application/json', body: JSON.stringify(answer.body) });
    });
    const shot = name => page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
    const ui = page.locator('.engine-ui');
    const cell = key => ui.locator(`[data-field="${key}"]`);
    const button = name => ui.getByRole('button', { name: term('engine', name), exact: true });
    const expectText = async (locator, text) => { await locator.filter({ hasText: text }).first().waitFor({ timeout: 10000 }); };

    await step('list: the lead list is drawn from metadata, in Korean, and is empty', async () => {
      await page.goto(`${origin}/engine/lead`);
      await expectText(ui.locator('h1'), term('lead', 'lead.plural'));
      await expectText(ui.locator('.engine-empty'), term('engine', 'engine.list.empty'));
      await shot('01-list-empty');
    });
    await step('create: an empty save is refused by the engine and the errors appear under the required fields', async () => {
      await button('engine.action.new').click();
      await ui.locator('form[data-mode="create"]').waitFor();
      await expectText(ui.locator('label[for="engine-field-hospital_name"]'), term('lead', 'lead.field.hospital_name'));
      await button('engine.action.save').click();
      await expectText(cell('hospital_name').locator('.engine-error'), term('engine', 'engine.error.REQUIRED'));
      await expectText(cell('status').locator('.engine-error'), term('engine', 'engine.error.REQUIRED'));
      await expectText(ui.locator('.engine-banner'), term('engine', 'engine.error.INVALID_RECORD'));
      if (await cell('phone').locator('.engine-error').count()) throw new Error('an error is shown under a field that has none');
      await shot('02-create-errors');
    });
    await step('create: corrected values are saved and the detail screen shows them', async () => {
      await ui.locator('#engine-field-hospital_name').fill('Browser Check Clinic');
      await ui.locator('#engine-field-status').selectOption('NEW');
      await ui.locator('#engine-field-phone').fill('02-000-0000');
      await button('engine.action.save').click();
      await ui.locator('[data-engine="detail"][data-record-id="1"]').waitFor();
      await page.waitForURL(`${origin}/engine/lead/1`);
      await expectText(cell('hospital_name').locator('dd'), 'Browser Check Clinic');
      await expectText(cell('status').locator('dd'), term('lead', 'lead.status.NEW'));
      await expectText(cell('owner_name').locator('dd'), 'mock-user');
      const sent = api.log.filter(l => l.method === 'POST').at(-1).body;
      if (JSON.stringify(sent) !== JSON.stringify({ hospital_name: 'Browser Check Clinic', status: 'NEW', phone: '02-000-0000' })) throw new Error(`create sent ${JSON.stringify(sent)}`);
    });
    await step('related list: rows of the fixture object that refer to this lead, and only those', async () => {
      const related = ui.locator('[data-engine="related"][data-object="visit"]');
      await related.locator('tbody tr').nth(1).waitFor();
      const memos = await related.locator('td[data-field="memo"]').allInnerTexts();
      if (JSON.stringify(memos) !== JSON.stringify(['first visit note', 'second visit note'])) throw new Error(`related rows: ${JSON.stringify(memos)}`);
      if (await related.locator('[data-field="lead_ref"]').count()) throw new Error('the reference column is repeated in the related list');
      await shot('03-detail-related');
    });
    await step('detail: the second tab shows its own sections', async () => {
      await ui.getByRole('tab', { name: term('lead', 'lead.tab.keyman') }).click();
      await expectText(ui.locator('.engine-section h2'), term('lead', 'lead.section.keyman'));
      if (await cell('hospital_name').count()) throw new Error('a field of the first tab is still shown');
      await shot('04-detail-tab2');
    });
    await step('edit: only the changed field is sent, and the detail shows the new value', async () => {
      await button('engine.action.edit').click();
      await ui.locator('form[data-mode="edit"]').waitFor();
      if (await ui.locator('#engine-field-hospital_name').inputValue() !== 'Browser Check Clinic') throw new Error('the form is not filled from the record');
      if (!(await ui.locator('#engine-field-updated_at').isDisabled())) throw new Error('a system field can be edited');
      await ui.locator('#engine-field-phone').fill('02-111-1111');
      await shot('05-edit');
      await button('engine.action.save').click();
      await ui.locator('[data-engine="detail"]').waitFor();
      await expectText(cell('phone').locator('dd'), '02-111-1111');
      const sent = api.log.filter(l => l.method === 'PATCH').at(-1).body;
      if (JSON.stringify(sent) !== JSON.stringify({ phone: '02-111-1111' })) throw new Error(`edit sent ${JSON.stringify(sent)}`);
    });
    await step('list: the saved lead is listed, the other view filters it out, and a row opens its detail', async () => {
      await button('engine.action.back').click();
      await ui.locator('tr[data-record-id="1"]').waitFor();
      await expectText(ui.locator('td[data-field="status"]'), term('lead', 'lead.status.NEW'));
      await shot('06-list');
      await ui.locator('select').selectOption('excluded');
      await ui.locator('.engine-empty').waitFor();
      await page.waitForURL(`${origin}/engine/lead?view=excluded`);
      await ui.locator('select').selectOption('hq_default');
      await ui.locator('tr[data-record-id="1"] .engine-link').click();
      await page.waitForURL(`${origin}/engine/lead/1`);
    });
    await step('no label is missing: no raw term key is on screen', async () => {
      const text = await ui.innerText();
      const raw = text.match(/\b(engine|lead)\.[a-z_]+\.[\w.]+/g);
      if (raw) throw new Error(`raw keys on screen: ${[...new Set(raw)].join(', ')}`);
    });
    await step('an unknown object says so instead of drawing a screen', async () => {
      await page.goto(`${origin}/engine/nope`);
      await ui.locator('[data-error="OBJECT_NOT_FOUND"]').waitFor();
    });
    await step('narrow screen: the form stacks into one column', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${origin}/engine/lead/new`);
      await ui.locator('form[data-mode="create"]').waitFor();
      const boxes = await Promise.all(['hospital_name', 'status'].map(k => cell(k).boundingBox()));
      if (!(boxes[1].y > boxes[0].y + boxes[0].height - 1)) throw new Error('fields are still side by side at 390px');
      await shot('07-create-mobile');
    });
    // Errors the mock answers on purpose (the refused empty save, the unknown object) are expected; anything else is a problem.
    const unexpected = problems.filter(p => !/status of (400|404)/.test(p));
    await step('no page error and no unexpected console error', async () => { if (unexpected.length) throw new Error(unexpected.join(' | ')); });
  } catch { /* recorded in steps */ } finally {
    if (browser) await browser.close().catch(() => undefined);
    try { process.kill(-vite.pid, 'SIGTERM'); } catch { /* already gone */ }
  }
  const verdict = steps.length >= 11 && steps.every(s => s.ok) ? 'PASS' : 'FAIL';
  const result = { kind: 'SYNTHETIC', check: 'F2-5 generic engine screens in a browser (mock engine API)', verdict, locale: LOCALE, steps, requests: api.log.length };
  fs.writeFileSync(path.join(out, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(`[engine-ui] ${verdict}  ${path.relative(repo, path.join(out, 'result.json'))}`);
  for (const s of steps) console.log(`  ${s.ok ? 'ok  ' : 'FAIL'} ${s.name}${s.error ? `: ${s.error}` : ''}`);
  process.exitCode = verdict === 'PASS' ? 0 : 1;
}
main();
