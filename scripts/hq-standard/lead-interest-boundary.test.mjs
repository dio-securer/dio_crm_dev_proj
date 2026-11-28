import test from 'node:test';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';

test('lead interest products accepts 255 characters and rejects 256 without mutation', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
  t.after(() => server.close());
  const session = await fetch(server.url + '/api/hq/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ loginId: 'hq-admin', password: 'HQ-DEMO' }) }).then(r => r.json());
  const call = async (method, path, body) => {
    const response = await fetch(server.url + path, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${session.accessToken}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const lead = (await call('POST', '/api/leads', { hospitalName: '경계 시험', idempotencyKey: 'create' })).body;
  const path = `/api/leads/${lead.public_id}/additional`;
  const saved = await call('PATCH', path, { values: { interestProducts: 'T'.repeat(255) }, expectedVersion: lead.version, idempotencyKey: 'valid' });
  assert.equal(saved.status, 200);
  const rejected = await call('PATCH', path, { values: { interestProducts: 'T'.repeat(256) }, expectedVersion: saved.body.version, idempotencyKey: 'invalid' });
  assert.equal(rejected.status, 400);
  assert.equal((await call('GET', path)).body.values.interestProducts, 'T'.repeat(255));
});
