import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHqServer } from '../hq-standard/server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtime = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
try {
  const post = async (url, body) => {
    const response = await fetch(runtime.url + url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HQ-Mode': 'HQ_HTTP_MOCK' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
    return response.json();
  };
  const session = await post('/api/hq/session', { loginId: 'hq-admin', password: 'HQ-DEMO', datasetId: 'HQ_DEMO' });
  const get = async url => {
    const response = await fetch(runtime.url + url, { headers: { Authorization: `Bearer ${session.accessToken}`, 'X-HQ-Mode': 'HQ_HTTP_MOCK' } });
    if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
    return response.json();
  };
  const leads = await get('/api/leads?search=&scope=recent');
  const accounts = await get('/api/accounts?scope=managed');
  const fixtures = {
    generatedFrom: 'isolated HQ_DEMO seed; no real business records',
    actor: { user: session.user, dataset: session.dataset },
    clock: await get('/api/hq/status'),
    context: await get('/api/me/context'),
    policy: await get('/api/hq/policy'),
    leads, accounts,
    leadDetails: {}, leadHistory: {}, leadConversionOptions: {},
    accountDetails: {},
    leadOptions: await get('/api/leads/options'),
    activities: await get('/api/activities?relatedType=LEAD')
  };
  for (const row of leads) {
    fixtures.leadDetails[row.public_id] = await get(`/api/leads/${row.public_id}`);
    fixtures.leadHistory[row.public_id] = await get(`/api/leads/${row.public_id}/history`);
    fixtures.leadConversionOptions[row.public_id] = await get(`/api/leads/${row.public_id}/conversion-options`);
  }
  for (const row of accounts) fixtures.accountDetails[row.public_id] = await get(`/api/accounts/${row.public_id}/customer-detail`);
  const output = path.join(root, 'frontend/src/customization/visual-preview-fixtures.json');
  await fs.writeFile(output, JSON.stringify(fixtures, null, 2) + '\n');
  console.log(`${output}: ${leads.length} leads, ${accounts.length} accounts`);
} finally {
  await runtime.close();
}
