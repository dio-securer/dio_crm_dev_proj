import test from 'node:test';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');

test('sales calendar dates reject impossible values without changing records, with contract and collection regression', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
  t.after(() => server.close());
  const login = await fetch(server.url + '/api/hq/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ loginId: 'hq-sales', password: 'HQ-DEMO' }) });
  const { accessToken } = await login.json();
  const headers = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };
  const call = async (method, path, body) => { const response = await fetch(server.url + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: response.status, body: await response.json() }; };
  const create = date => call('POST', '/api/opportunities', { accountPublicId: seedIDs.approvedAccount, opportunityName: 'O01 calendar validation', ...(date === undefined ? {} : { expectedCloseDate: date }) });
  for (const value of ['2026-02-29', '2026-02-30', '2026-04-31']) {
    const before = server.app.repository('HQ_DEMO').read(); const result = await create(value);
    assert.equal(result.status, 400, value); assert.deepEqual(server.app.repository('HQ_DEMO').read(), before);
  }
  const leap = await create('2024-02-29'); assert.equal(leap.status, 200); assert.equal(leap.body.expected_close_date, '2024-02-29');
  const normal = await create('2026-04-30'); assert.equal(normal.status, 200);
  const defaultDate = await create(); assert.equal(defaultDate.status, 200); assert.equal(defaultDate.body.expected_close_date, server.app.repository('HQ_DEMO').read().clock.slice(0, 10));
  const path = `/api/opportunities/${normal.body.public_id}`;
  const beforePatch = server.app.repository('HQ_DEMO').read();
  const invalidPatch = await call('PATCH', path, { opportunityName: 'must not persist', expectedCloseDate: '2026-02-30' });
  assert.equal(invalidPatch.status, 400); assert.deepEqual(server.app.repository('HQ_DEMO').read(), beforePatch);
  assert.equal((await call('PATCH', path, { expectedCloseDate: '2024-02-29' })).status, 200);
  assert.equal((await call('POST', `${path}/products`, { packagePublicId: seedIDs.product, quantity: 1, proposedUnitPrice: 100000 })).status, 200);
  assert.equal((await call('POST', `${path}/stage`, { toStage: 'CLOSED_WON' })).status, 200);
  const contractBody = { opportunityPublicId: normal.body.public_id, productAmount: 100000 };
  const beforeContract = server.app.repository('HQ_DEMO').read();
  assert.equal((await call('POST', '/api/contracts', { ...contractBody, contractDate: '2026-04-31' })).status, 400);
  assert.deepEqual(server.app.repository('HQ_DEMO').read(), beforeContract);
  const contract = await call('POST', '/api/contracts', { ...contractBody, contractDate: '2024-02-29' }); assert.equal(contract.status, 200);
  const plans = `/api/contracts/${contract.body.public_id}/collection-plans`;
  const row = { installmentNo: 1, collectionMethod: 'BANK_TRANSFER', amount: 100000 };
  const beforePlan = server.app.repository('HQ_DEMO').read();
  assert.equal((await call('POST', plans, { rows: [{ ...row, plannedDate: '2026-02-30' }] })).status, 400);
  assert.deepEqual(server.app.repository('HQ_DEMO').read(), beforePlan);
  assert.equal((await call('POST', plans, { rows: [{ ...row, plannedDate: '2026-04-30' }] })).status, 200);
});
