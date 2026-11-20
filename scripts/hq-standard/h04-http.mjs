import test from 'node:test';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');

test('legacy seeded activity appears in calendar with check-in coordinates', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
  t.after(() => server.close());
  const sales = await client(server, 'hq-sales');
  const rows = await sales.ok('GET', '/api/activities/calendar?from=2026-10-22&to=2026-10-22');
  const activity = rows.find(row => row.public_id === seedIDs.activity);
  assert.equal(activity?.planned_date, '2026-10-22');
  assert.equal(activity?.planned_at, '2026-10-22T01:00:00.000Z');
  assert.equal(activity?.target_latitude, 35.171);
  await sales.ok('POST', `/api/activities/${seedIDs.activity}/check-in`, { latitude: 35.171, longitude: 129.127, isMocked: true });
});

async function client(server, loginId = 'hq-admin') {
  const login = await fetch(`${server.url}/api/hq/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ loginId, password: 'HQ-DEMO' }) });
  const session = await login.json();
  const call = async (method, path, body, scenario) => {
    const response = await fetch(server.url + path, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${session.accessToken}`, ...(scenario ? { 'x-hq-scenario': scenario } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  const ok = async (...args) => { const response = await call(...args); assert.equal(response.status, 200, `${args[0]} ${args[1]} ${JSON.stringify(response.body)}`); return response.body; };
  return { call, ok };
}

test('H04 HQ03 activity, report and direct work share IDs; ERP failure and retry converge', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false }); t.after(() => server.close());
  const sales = await client(server, 'hq-sales'), branch = await client(server, 'hq-branch'), division = await client(server, 'hq-division'), admin = await client(server);
  const plannedAt = '2026-10-24T09:00:00.000Z';
  const plan = await sales.ok('POST', '/api/activities/plans', { relatedType: 'ACCOUNT', relatedPublicId: seedIDs.approvedAccount, plannedAt, visitPurpose: 'HQ03', directWorkType: 'DIRECT_WORK', directWorkReason: 'early visit' });
  assert.equal((await sales.ok('GET', '/api/activities/calendar?from=2026-10-24&to=2026-10-24')).some(a => a.public_id === plan.activityPublicId), true);
  assert.equal((await sales.ok('GET', `/api/direct-work/${plan.directWorkPublicId}`)).activity_public_id, plan.activityPublicId);
  assert.equal((await sales.call('POST', `/api/activities/${plan.activityPublicId}/check-in`, { latitude: 0, longitude: 0 })).status, 422);
  await sales.ok('POST', `/api/activities/${plan.activityPublicId}/check-in`, { latitude: 35.171, longitude: 129.127, isMocked: true });
  await sales.ok('PATCH', `/api/activities/${plan.activityPublicId}`, { consultationContent: 'HQ03 consultation' });
  const draft = await sales.ok('POST', '/api/activity-reports/prepare', { reportDate: '2026-10-24' });
  assert.equal((await sales.call('POST', `/api/activity-reports/${draft.public_id}/request-approval`, {})).status, 409);
  await sales.ok('POST', `/api/direct-work/${plan.directWorkPublicId}/request-approval`, {});
  await branch.ok('POST', `/api/direct-work/${plan.directWorkPublicId}/decision/branch`, { action: 'APPROVE', comment: 'ok' });
  await division.ok('POST', `/api/direct-work/${plan.directWorkPublicId}/decision/division`, { action: 'APPROVE', comment: 'ok' }, 'TRANSIENT_FAILURE');
  assert.equal((await sales.ok('GET', `/api/direct-work/${plan.directWorkPublicId}`)).erp_sync_status, 'NOT_REQUESTED');
  await sales.ok('POST', `/api/activities/${plan.activityPublicId}/check-out`, { latitude: 35.171, longitude: 129.127, isMocked: true }, 'TRANSIENT_FAILURE');
  const direct = await sales.ok('GET', `/api/direct-work/${plan.directWorkPublicId}`);
  assert.equal(direct.erp_sync_status, 'REQUESTING');
  const request = (await admin.ok('GET', '/api/interface-logs')).find(log => log.businessKey.entityId === direct.public_id);
  assert.equal(request.interfaceCode, 'IF-ERP-012');
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: request.requestId, scenario: 'TRANSIENT_FAILURE' });
  assert.equal((await sales.ok('GET', `/api/direct-work/${plan.directWorkPublicId}`)).erp_sync_status, 'FAILED');
  const retry = await division.ok('POST', `/api/direct-work/${plan.directWorkPublicId}/erp/retry`, { idempotencyKey: 'hq03-retry' });
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: retry.requestId, scenario: 'SUCCESS' });
  assert.equal((await sales.ok('GET', `/api/direct-work/${plan.directWorkPublicId}`)).erp_sync_status, 'SUCCESS');
  assert.equal((await admin.ok('GET', '/api/interface-logs')).filter(log => log.businessKey.entityId === direct.public_id).length, 2);
  const refreshed = await sales.ok('POST', '/api/activity-reports/prepare', { reportDate: '2026-10-24' });
  assert.equal(refreshed.items[0].activity_public_id, plan.activityPublicId);
  assert.equal(refreshed.items[0].related_public_id, seedIDs.approvedAccount);
  const completedActivity = await sales.ok('GET', `/api/activities/${plan.activityPublicId}`);
  assert.equal(refreshed.items[0].item_type, 'RESULT');
  assert.equal(refreshed.items[0].in_at_snapshot, completedActivity.in_at);
  assert.equal(refreshed.items[0].out_at_snapshot, completedActivity.out_at);
  await sales.ok('POST', `/api/activity-reports/${draft.public_id}/request-approval`, {});
  assert.equal((await sales.call('POST', `/api/activity-reports/${draft.public_id}/approve/branch`, {})).status, 403);
  await branch.ok('POST', `/api/activity-reports/${draft.public_id}/comment/branch`, { comment: 'reviewed' });
  assert.equal((await branch.ok('GET', `/api/activity-reports/${draft.public_id}`)).status, 'REQUESTED');
  await branch.ok('POST', `/api/activity-reports/${draft.public_id}/approve/branch`, {});
  await division.ok('POST', `/api/activity-reports/${draft.public_id}/approve/division`, {});
  assert.equal((await sales.ok('GET', `/api/activity-reports/${draft.public_id}`)).status, 'FINAL_APPROVED');
});

test('H04 bulk plans roll back, scope and owner checks fail closed', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false }); t.after(() => server.close());
  const sales = await client(server, 'hq-sales'), viewer = await client(server, 'hq-viewer');
  const input = { relatedType: 'ACCOUNT', relatedPublicId: seedIDs.approvedAccount, plannedAt: '2026-10-25T09:00:00.000Z' };
  const before = (await sales.ok('GET', '/api/activities')).length;
  assert.equal((await sales.call('POST', '/api/activities/plans/bulk', { plans: [input, { ...input, relatedPublicId: seedIDs.otherCompanyAccount }] })).status, 404);
  assert.equal((await sales.ok('GET', '/api/activities')).length, before);
  assert.equal((await viewer.call('POST', '/api/activities/plans', input)).status, 403);
  assert.equal((await sales.call('GET', '/api/activities/map/today?date=2026-10-25&latitude=35.171')).status, 400);
});

test('H04 related READ, map exclusion and branch scope prevent source disclosure', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false }); t.after(() => server.close());
  const sales = await client(server, 'hq-sales'), branch = await client(server, 'hq-branch');
  const mapPath = '/api/activities/map/today?date=2026-10-22&latitude=35.171&longitude=129.127';
  const map = await sales.ok('GET', mapPath);
  assert.equal(map.nearbyHospitals.some(row => row.public_id === seedIDs.noCoordinatesLead), false);
  assert.equal(map.nearbyHospitals.some(row => row.public_id === seedIDs.otherCompanyLead), false);
  assert.equal((await branch.ok('GET', mapPath)).nearbyHospitals.some(row => row.public_id === seedIDs.otherCompanyAccount), false);
  const leadScreen = server.app.standard.screens.find(row => row.screenKey === 'HQ_LEAD');
  leadScreen.enabled = false;
  assert.equal((await sales.call('POST', '/api/activities/plans', { relatedType: 'LEAD', relatedPublicId: seedIDs.lead, plannedAt: '2026-10-28T09:00:00.000Z' })).status, 403);
  assert.equal((await sales.ok('GET', mapPath)).nearbyHospitals.some(row => row.related_type === 'LEAD'), false);
  leadScreen.enabled = true;
  const accountScreen = server.app.standard.screens.find(row => row.screenKey === 'HQ_ACCOUNT');
  const plan = await sales.ok('POST', '/api/activities/plans', { relatedType: 'ACCOUNT', relatedPublicId: seedIDs.approvedAccount, plannedAt: '2026-10-25T09:00:00.000Z', directWorkType: 'DIRECT_WORK', directWorkReason: 'early visit' });
  const report = await sales.ok('POST', '/api/activity-reports/prepare', { reportDate: '2026-10-24' });
  const accountName = (await sales.ok('GET', `/api/accounts/${seedIDs.approvedAccount}`)).account_name;
  assert.equal(report.items.some(item => item.activity_public_id === plan.activityPublicId), true);
  accountScreen.enabled = false;
  assert.equal((await sales.call('POST', '/api/activities/plans', { relatedType: 'ACCOUNT', relatedPublicId: seedIDs.approvedAccount, plannedAt: '2026-10-28T09:00:00.000Z' })).status, 403);
  const hiddenMap = await sales.ok('GET', mapPath);
  assert.equal(hiddenMap.nearbyHospitals.some(row => row.related_type === 'ACCOUNT'), false);
  assert.equal(hiddenMap.plans.some(row => row.related_type === 'ACCOUNT'), false);
  assert.equal((await sales.ok('GET', '/api/activities/calendar?from=2026-10-25&to=2026-10-25')).some(row => row.public_id === plan.activityPublicId), false);
  assert.equal((await sales.ok('GET', '/api/activities')).some(row => row.public_id === plan.activityPublicId), false);
  assert.equal((await sales.call('GET', `/api/activities/${plan.activityPublicId}`)).status, 404);
  assert.equal((await sales.ok('GET', '/api/activities/map/today?date=2026-10-25&latitude=35.171&longitude=129.127')).plans.some(row => row.public_id === plan.activityPublicId), false);
  assert.equal((await sales.ok('GET', `/api/activity-reports/${report.public_id}`)).items.some(item => item.activity_public_id === plan.activityPublicId), false);
  assert.equal((await sales.ok('GET', `/api/activity-reports?search=${encodeURIComponent(accountName)}`)).some(row => row.public_id === report.public_id), false);
  assert.equal((await sales.ok('GET', '/api/direct-work')).some(row => row.public_id === plan.directWorkPublicId), false);
  assert.equal((await sales.call('GET', `/api/direct-work/${plan.directWorkPublicId}`)).status, 404);
  accountScreen.enabled = true;
  const salesPersona = server.app.personas.find(row => row.loginId === 'hq-sales');
  salesPersona.permissions = salesPersona.permissions.filter(key => key !== 'ACCOUNT.READ');
  assert.equal((await sales.ok('GET', '/api/activities/calendar?from=2026-10-25&to=2026-10-25')).some(row => row.public_id === plan.activityPublicId), false);
  assert.equal((await sales.ok('GET', '/api/activities')).some(row => row.public_id === plan.activityPublicId), false);
  assert.equal((await sales.call('GET', `/api/activities/${plan.activityPublicId}`)).status, 404);
  assert.equal((await sales.ok('GET', '/api/activities/map/today?date=2026-10-25&latitude=35.171&longitude=129.127')).plans.some(row => row.public_id === plan.activityPublicId), false);
  assert.equal((await sales.ok('GET', `/api/activity-reports/${report.public_id}`)).items.some(item => item.activity_public_id === plan.activityPublicId), false);
  assert.equal((await sales.call('GET', `/api/direct-work/${plan.directWorkPublicId}`)).status, 404);
  server.app.personas.find(row => row.loginId === 'hq-sales').permissions = server.app.personas.find(row => row.loginId === 'hq-sales').permissions.filter(key => key !== 'LEAD.READ');
  assert.equal((await sales.call('POST', '/api/activities/plans', { relatedType: 'LEAD', relatedPublicId: seedIDs.lead, plannedAt: '2026-10-29T09:00:00.000Z' })).status, 403);
  assert.equal((await sales.ok('GET', mapPath)).nearbyHospitals.some(row => row.related_type === 'LEAD'), false);
  const existing = await branch.ok('GET', `/api/leads/${seedIDs.lead}`);
  const excluded = await branch.ok('PATCH', `/api/leads/${seedIDs.lead}`, { mapExcluded: true, expectedVersion: existing.version, idempotencyKey: 'h04-map-excluded' });
  assert.equal((await branch.ok('GET', mapPath)).nearbyHospitals.some(row => row.public_id === excluded.public_id), false);
});

test('H04 report rejection and direct-work reassignment obey registered actions and current approver', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false }); t.after(() => server.close());
  const sales = await client(server, 'hq-sales'), branch = await client(server, 'hq-branch'), admin = await client(server);
  const plan = await sales.ok('POST', '/api/activities/plans', { relatedType: 'ACCOUNT', relatedPublicId: seedIDs.approvedAccount, plannedAt: '2026-10-30T09:00:00.000Z', directWorkType: 'DIRECT_LEAVE', directWorkReason: 'late appointment' });
  const draft = await sales.ok('POST', '/api/activity-reports/prepare', { reportDate: '2026-10-30' });
  await sales.ok('POST', `/api/activity-reports/${draft.public_id}/request-approval`, {});
  server.app.standard.actions.find(action => action.actionKey === 'REP.rejectBranch').enabled = false;
  assert.equal((await branch.call('POST', `/api/activity-reports/${draft.public_id}/reject/branch`, { comment: 'needs correction' })).status, 409);
  server.app.standard.actions.find(action => action.actionKey === 'REP.rejectBranch').enabled = true;
  await branch.ok('POST', `/api/activity-reports/${draft.public_id}/reject/branch`, { comment: 'needs correction' });
  assert.equal((await sales.ok('GET', `/api/activity-reports/${draft.public_id}`)).status, 'BRANCH_REJECTED');
  await sales.ok('POST', `/api/activity-reports/${draft.public_id}/request-approval`, {});
  await sales.ok('POST', `/api/direct-work/${plan.directWorkPublicId}/request-approval`, {});
  assert.equal((await branch.call('POST', `/api/direct-work/${plan.directWorkPublicId}/reassign`, { step: 'BRANCH', approverUserId: 1, reason: 'invalid role' })).status, 400);
  const changed = await branch.ok('POST', `/api/direct-work/${plan.directWorkPublicId}/reassign`, { step: 'BRANCH', approverUserId: 99, reason: 'manager unavailable' });
  assert.equal(changed.branch_approver_user_id, 99);
  assert.equal((await branch.call('POST', `/api/direct-work/${plan.directWorkPublicId}/decision/branch`, { action: 'APPROVE' })).status, 403);
  server.app.standard.actions.find(action => action.actionKey === 'DW.decision.branch').enabled = false;
  assert.equal((await admin.call('POST', `/api/direct-work/${plan.directWorkPublicId}/decision/branch`, { action: 'APPROVE' })).status, 409);
  server.app.standard.actions.find(action => action.actionKey === 'DW.decision.branch').enabled = true;
  assert.equal((await admin.ok('POST', `/api/direct-work/${plan.directWorkPublicId}/decision/branch`, { action: 'APPROVE' })).status, 'BRANCH_APPROVED');
});

test('H04 direct GET endpoints close when standard screens or read actions are disabled', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false }); t.after(() => server.close());
  const admin = await client(server);
  const screen = key => server.app.standard.screens.find(row => row.screenKey === key);
  const action = key => server.app.standard.actions.find(row => row.actionKey === key);
  screen('HQ_ACTIVITY').enabled = false;
  for (const path of ['/api/activities', `/api/activities/${seedIDs.activity}`, '/api/activities/calendar?from=2026-10-22&to=2026-10-22', '/api/activities/map/today?date=2026-10-22&latitude=35.171&longitude=129.127'])
    assert.ok([403, 422].includes((await admin.call('GET', path)).status), path);
  screen('HQ_ACTIVITY').enabled = true;
  action('ACT.calendar').enabled = false;
  assert.equal((await admin.call('GET', '/api/activities/calendar?from=2026-10-22&to=2026-10-22')).status, 409);
  action('ACT.calendar').enabled = true;
  action('ACT.map').enabled = false;
  assert.equal((await admin.call('GET', '/api/activities/map/today?date=2026-10-22&latitude=35.171&longitude=129.127')).status, 409);
  screen('HQ_ACTIVITY_REPORT').enabled = false;
  assert.equal((await admin.call('GET', '/api/activity-reports')).status, 403);
  assert.equal((await admin.call('GET', `/api/activity-reports/${seedIDs.pendingReport}`)).status, 403);
  screen('HQ_DIRECT_WORK').enabled = false;
  assert.equal((await admin.call('GET', '/api/direct-work')).status, 403);
  assert.equal((await admin.call('GET', `/api/direct-work/${seedIDs.directWork}`)).status, 403);
  assert.equal((await admin.call('GET', '/api/direct-work/approvers?step=BRANCH')).status, 403);
});
