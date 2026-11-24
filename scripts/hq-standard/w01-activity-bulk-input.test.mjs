import test from 'node:test';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');

test('malformed bulk plan items are rejected before creation and valid items still work', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
  t.after(() => server.close());
  const login = await fetch(server.url + '/api/hq/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ loginId: 'hq-sales', password: 'HQ-DEMO' }) });
  const { accessToken } = await login.json();
  const headers = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };
  const list = async () => (await (await fetch(server.url + '/api/activities', { headers })).json());
  const valid = { relatedType: 'ACCOUNT', relatedPublicId: seedIDs.approvedAccount, plannedAt: '2026-03-11T09:00:00Z' };
  const before = await list();
  const datasetBefore = server.app.repository('HQ_DEMO').read();
  for (const bad of [null, 'invalid', 3, [], true]) {
    const response = await fetch(server.url + '/api/activities/plans/bulk', { method: 'POST', headers, body: JSON.stringify({ plans: [valid, bad] }) });
    assert.equal(response.status, 400, `malformed ${JSON.stringify(bad)}`);
    assert.equal((await response.json()).error, 'BULK_PLAN_ITEM_INVALID');
    assert.deepEqual(await list(), before);
    assert.deepEqual(server.app.repository('HQ_DEMO').read(), datasetBefore);
  }
  const rollback = await fetch(server.url + '/api/activities/plans/bulk', { method: 'POST', headers, body: JSON.stringify({ plans: [{ ...valid, directWorkType: 'DIRECT_WORK', directWorkReason: 'test' }, { ...valid, relatedPublicId: seedIDs.otherCompanyAccount }] }) });
  assert.equal(rollback.status, 404);
  assert.deepEqual(server.app.repository('HQ_DEMO').read(), datasetBefore, 'later invalid object rolls back activities, direct work and audit');
  const viewerLogin = await fetch(server.url + '/api/hq/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ loginId: 'hq-viewer', password: 'HQ-DEMO' }) });
  const viewerToken = (await viewerLogin.json()).accessToken;
  const viewerHeaders = { ...headers, authorization: `Bearer ${viewerToken}` };
  const unauthorized = await fetch(server.url + '/api/activities/plans/bulk', { method: 'POST', headers: viewerHeaders, body: JSON.stringify({ plans: [valid] }) });
  assert.equal(unauthorized.status, 403);
  const malformedUnauthorized = await fetch(server.url + '/api/activities/plans/bulk', { method: 'POST', headers: viewerHeaders, body: JSON.stringify({ plans: [null] }) });
  assert.equal(malformedUnauthorized.status, 400);
  assert.equal((await malformedUnauthorized.json()).error, 'BULK_PLAN_ITEM_INVALID');
  assert.deepEqual(server.app.repository('HQ_DEMO').read(), datasetBefore);
  const response = await fetch(server.url + '/api/activities/plans/bulk', { method: 'POST', headers, body: JSON.stringify({ plans: [valid] }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).createdCount, 1);
});
