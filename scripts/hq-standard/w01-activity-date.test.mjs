import test from 'node:test';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');

test('calendar and report reject impossible dates while accepting a real leap day', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
  t.after(() => server.close());
  const login = await fetch(server.url + '/api/hq/session', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ loginId: 'hq-admin', password: 'HQ-DEMO' }),
  });
  const { accessToken } = await login.json();
  const headers = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };
  const invalidCalendar = await fetch(server.url + '/api/activities/calendar?from=2026-02-31&to=2026-03-31', { headers });
  assert.equal(invalidCalendar.status, 400);
  const invalidReport = await fetch(server.url + '/api/activity-reports/prepare', {
    method: 'POST', headers, body: JSON.stringify({ reportDate: '2026-02-29' }),
  });
  assert.equal(invalidReport.status, 400);
  const invalidMap = await fetch(server.url + '/api/activities/map/today?date=2026-04-31&latitude=35&longitude=129', { headers });
  assert.equal(invalidMap.status, 400);
  const before = await (await fetch(server.url + '/api/activities', { headers })).json();
  const invalidPlan = await fetch(server.url + '/api/activities/plans', {
    method: 'POST', headers,
    body: JSON.stringify({ relatedType: 'ACCOUNT', relatedPublicId: seedIDs.approvedAccount, plannedAt: '2026-02-31T09:00:00Z' }),
  });
  assert.equal(invalidPlan.status, 400);
  const after = await (await fetch(server.url + '/api/activities', { headers })).json();
  assert.equal(after.length, before.length);
  const midnight24 = await fetch(server.url + '/api/activities/plans', {
    method: 'POST', headers,
    body: JSON.stringify({ relatedType: 'ACCOUNT', relatedPublicId: seedIDs.approvedAccount, plannedAt: '2026-02-28T24:00:00Z' }),
  });
  assert.equal(midnight24.status, 400);
  const offset = await fetch(server.url + '/api/activities/plans', {
    method: 'POST', headers,
    body: JSON.stringify({ relatedType: 'ACCOUNT', relatedPublicId: seedIDs.approvedAccount, plannedAt: '2026-03-02T00:30:00+09:00' }),
  });
  assert.equal(offset.status, 200);
  const created = await offset.json();
  const stored = await (await fetch(server.url + `/api/activities/${created.activityPublicId}`, { headers })).json();
  assert.equal(stored.planned_at, '2026-03-01T15:30:00.000Z');
  assert.equal(stored.planned_date, '2026-03-02');
  const validCalendar = await fetch(server.url + '/api/activities/calendar?from=2024-02-29&to=2024-02-29', { headers });
  assert.equal(validCalendar.status, 200);
});
