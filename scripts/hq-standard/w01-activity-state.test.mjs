import test from 'node:test';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');

test('planned activity must check in before consultation or checkout and becomes locked after checkout', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
  t.after(() => server.close());
  const response = await fetch(server.url + '/api/hq/session', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ loginId: 'hq-sales', password: 'HQ-DEMO' }),
  });
  const { accessToken } = await response.json();
  const headers = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };
  const path = `/api/activities/${seedIDs.activity}`;
  const gps = { latitude: 35.171, longitude: 129.127, isMocked: true };
  const call = (method, suffix, body) => fetch(server.url + path + suffix, { method, headers, body: JSON.stringify(body) });
  const record = async () => (await (await fetch(server.url + path, { headers })).json());
  const state = async () => (await record()).status;
  const rejectWithoutMutation = async (method, suffix, body) => {
    const before = await record();
    const result = await call(method, suffix, body);
    assert.equal(result.status, 422);
    assert.equal((await result.json()).error, 'ACTION_NOT_ALLOWED');
    const after = await record();
    for (const field of ['status', 'consultation_content', 'history', 'version']) {
      assert.deepEqual(after[field], before[field], `rejected ${suffix || 'consultation'} changed ${field}`);
    }
  };

  assert.equal(await state(), 'PLANNED');
  await rejectWithoutMutation('PATCH', '', { consultationContent: 'premature' });
  await rejectWithoutMutation('POST', '/check-out', gps);
  assert.equal(await state(), 'PLANNED');
  assert.equal((await call('POST', '/check-in', gps)).status, 200);
  assert.equal(await state(), 'IN_PROGRESS');
  await rejectWithoutMutation('POST', '/check-in', gps);
  assert.equal((await call('PATCH', '', { consultationContent: 'follow-up discussion' })).status, 200);
  assert.equal((await call('POST', '/check-out', gps)).status, 200);
  assert.equal(await state(), 'COMPLETED');
  await rejectWithoutMutation('POST', '/check-out', gps);
  await rejectWithoutMutation('PATCH', '', { consultationContent: 'after checkout' });
  const final = await (await fetch(server.url + path, { headers })).json();
  assert.equal(final.consultation_content, 'follow-up discussion');
  assert.equal(final.status, 'COMPLETED');
});
