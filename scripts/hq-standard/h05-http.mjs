import test from 'node:test';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');

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

test('opportunity multi-product selection saves atomically and respects closed status', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false }); t.after(() => server.close());
  const sales = await client(server, 'hq-sales');
  const opportunity = await sales.ok('POST', '/api/opportunities', { accountPublicId: seedIDs.approvedAccount, opportunityName: '제품 복수 선택 테스트', expectedCloseDate: '2026-11-10' });
  const path = `/api/opportunities/${opportunity.public_id}`, item = { packagePublicId: seedIDs.product, quantity: 2, proposedUnitPrice: 100000 };
  const before = await sales.ok('GET', path);
  assert.equal((await sales.call('POST', `${path}/products/batch`, { items: [item, { ...item, packagePublicId: seedIDs.packageProduct, quantity: 0 }] })).status, 400);
  assert.deepEqual(await sales.ok('GET', path), before);
  assert.equal((await sales.call('POST', `${path}/products/batch`, { items: [item, item] })).status, 400);
  const lines = await sales.ok('POST', `${path}/products/batch`, { items: [item, { ...item, packagePublicId: seedIDs.packageProduct, quantity: 1, proposedUnitPrice: 300000 }] });
  assert.equal(lines.length, 2);
  assert.equal((await sales.ok('GET', path)).amount, 500000);
  await sales.ok('POST', `${path}/stage`, { toStage: 'CLOSED_WON' });
  assert.equal((await sales.call('POST', `${path}/products/batch`, { items: [item] })).status, 409);
  assert.equal((await sales.ok('GET', path)).products.length, 2);
});

test('H05 opportunity to ERP contract and changed collection plan shares one dataset', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false }); t.after(() => server.close());
  const sales = await client(server, 'hq-sales'), admin = await client(server);
  const opp = await sales.ok('POST', '/api/opportunities', { accountPublicId: seedIDs.approvedAccount, opportunityName: 'H05 new opportunity', expectedCloseDate: '2026-11-10' });
  const product = await sales.ok('POST', `/api/opportunities/${opp.public_id}/products`, { packagePublicId: seedIDs.product, quantity: 2, proposedUnitPrice: 500000 });
  assert.equal((await sales.ok('GET', `/api/opportunities/${opp.public_id}`)).amount, 1000000);
  assert.equal((await sales.call('PATCH', `/api/opportunities/${opp.public_id}/products/${product.public_id}`, { quantity: 0 })).status, 422);
  await sales.ok('PATCH', `/api/opportunities/${opp.public_id}/products/${product.public_id}`, { quantity: 1, proposedUnitPrice: 1000000 });
  assert.equal((await sales.ok('GET', `/api/opportunities/${opp.public_id}`)).amount, 1000000);
  await sales.ok('PATCH', `/api/opportunities/${opp.public_id}`, { priceListCode: 'CUSTOM_QUOTE', interestProduct: '', paymentMethod: '' });
  await sales.ok('PATCH', `/api/opportunities/${opp.public_id}`, { priceListCode: 'ERP_STANDARD' });
  assert.equal((await sales.ok('GET', `/api/opportunities/${opp.public_id}`)).amount, 100000);
  await sales.ok('PATCH', `/api/opportunities/${opp.public_id}/products/${product.public_id}`, { quantity: 2, proposedUnitPrice: 500000 });
  assert.equal((await sales.call('POST', `/api/opportunities/${opp.public_id}/stage`, { toStage: 'CLOSED_WON' })).status, 200);
  assert.equal((await sales.call('PATCH', `/api/opportunities/${opp.public_id}/products/${product.public_id}`, { quantity: 3 })).status, 409);
  const con = await sales.ok('POST', '/api/contracts', { opportunityPublicId: opp.public_id, productAmount: 1000000, contractDate: '2026-10-23' });
  assert.equal((await sales.call('POST', '/api/contracts', { opportunityPublicId: opp.public_id, productAmount: 1000000 })).status, 409);
  assert.equal((await sales.call('POST', `/api/contracts/${con.public_id}/collection-plans`, { rows: [{ installmentNo: 1, collectionMethod: 'BANK_TRANSFER', amount: 999999, plannedDate: '2026-11-01' }] })).status, 422);
  await sales.ok('POST', `/api/contracts/${con.public_id}/collection-plans`, { rows: [{ installmentNo: 1, collectionMethod: 'BANK_TRANSFER', amount: 400000, plannedDate: '2026-11-01' }, { installmentNo: 2, collectionMethod: 'BANK_TRANSFER', amount: 600000, plannedDate: '2026-12-01' }] });
  const allPlans = await sales.ok('GET', '/api/collection-plans');
  assert.equal(allPlans.filter(plan => plan.contract_public_id === con.public_id).length, 2);
  assert.ok(allPlans.every(plan => plan.is_current === true && typeof plan.contract_name === 'string'));
  const request = await sales.ok('POST', `/api/contracts/${con.public_id}/erp-request`, {});
  assert.equal((await sales.call('POST', `/api/contracts/${con.public_id}/collection-plans`, { rows: [{ installmentNo: 1, collectionMethod: 'BANK_TRANSFER', amount: 1000000, plannedDate: '2026-11-01' }] })).status, 409);
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: request.requestId, scenario: 'SUCCESS' });
  assert.match((await sales.ok('GET', `/api/contracts/${con.public_id}`)).erp_contract_no, /^MOCK-CON-/);
  assert.equal((await sales.ok('GET', `/api/contracts/${con.public_id}/collection-plans`)).every(p => p.erp_sync_status === 'SUCCESS' && p.locked_yn === true), true);
  const change = await sales.ok('POST', `/api/contracts/${con.public_id}/collection-plans/change`, { rows: [{ installmentNo: 1, collectionMethod: 'BANK_TRANSFER', amount: 1000000, plannedDate: '2027-01-01' }] });
  assert.equal(change.planVersion, 2);
  assert.equal((await sales.call('POST', `/api/contracts/${con.public_id}/collection-plans/change`, { rows: [{ installmentNo: 1, collectionMethod: 'BANK_TRANSFER', amount: 1000000, plannedDate: '2027-02-01' }] })).status, 409);
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: change.requestId, scenario: 'SUCCESS' });
  const plans = await sales.ok('GET', `/api/contracts/${con.public_id}/collection-plans`);
  assert.equal(plans.filter(p => p.is_current).length, 1);
  assert.equal(plans.find(p => p.is_current).erp_sync_status, 'SUCCESS');
  assert.equal((await sales.ok('GET', `/api/contracts/${con.public_id}/reconciliation`)).outstandingAmount, 1000000);
});

test('H05 unapproved account cannot win; collection and sales results are visible', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false }); t.after(() => server.close());
  const sales = await client(server, 'hq-sales'), admin = await client(server);
  assert.equal((await sales.call('POST', `/api/opportunities/${seedIDs.pendingOpportunity}/stage`, { toStage: 'CLOSED_WON' })).status, 422);
  const before = await sales.ok('GET', `/api/opportunities/${seedIDs.pendingOpportunity}`);
  assert.equal(before.stage, 'NEGOTIATION'); assert.equal(before.amount, 1000000);
  const received = await admin.ok('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-009', entityType: 'CONTRACT', entityPublicId: seedIDs.approvedContract, idempotencyKey: 'h05-collection', payload: { contractPublicId: seedIDs.approvedContract, rows: [{ erpCollectionNo: 'H05-COL-01', currency: 'KRW', amount: 200000, collectedAt: '2026-10-23' }] } });
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: received.requestId });
  assert.equal((await sales.ok('GET', `/api/contracts/${seedIDs.approvedContract}/reconciliation`)).outstandingAmount, 800000);
  assert.equal((await sales.ok('GET', `/api/contracts/${seedIDs.approvedContract}/collections`))[0].amount, 200000);
  const salesRequest = await admin.ok('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-010', entityType: 'ACCOUNT', entityPublicId: seedIDs.approvedAccount, idempotencyKey: 'h05-sales', payload: { accountPublicId: seedIDs.approvedAccount, rows: [{ erpSalesNo: 'H05-SALE-01', salesDate: '2026-10-23', amount: 250000, contractPublicId: seedIDs.approvedContract }] } });
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: salesRequest.requestId });
  assert.equal((await sales.ok('GET', `/api/contracts/${seedIDs.approvedContract}/sales`))[0].amount, 250000);
  assert.equal((await sales.ok('GET', `/api/contracts/${seedIDs.approvedContract}/collection-plans`))[0].locked_yn, true);
  const excess = await admin.ok('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-009', entityType: 'CONTRACT', entityPublicId: seedIDs.approvedContract, idempotencyKey: 'h05-overcollection', payload: { contractPublicId: seedIDs.approvedContract, rows: [{ erpCollectionNo: 'H05-COL-OVER', currency: 'KRW', amount: 1200000, collectedAt: '2026-10-23' }] } });
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: excess.requestId });
  const recon = await sales.ok('GET', `/api/contracts/${seedIDs.approvedContract}/reconciliation`);
  assert.equal(recon.actualTotal, 1400000); assert.equal(recon.overCollectionAmount, 400000); assert.equal(recon.correctionRequired, true);
});

test('H05 zero-value opportunity cannot enter a contract flow with no valid plan', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false }); t.after(() => server.close());
  const sales = await client(server, 'hq-sales');
  const opp = await sales.ok('POST', '/api/opportunities', { accountPublicId: seedIDs.approvedAccount, opportunityName: 'H05 zero-value' });
  await sales.ok('POST', `/api/opportunities/${opp.public_id}/products`, { packagePublicId: seedIDs.product, quantity: 1, proposedUnitPrice: 0 });
  assert.equal((await sales.call('POST', `/api/opportunities/${opp.public_id}/stage`, { toStage: 'CLOSED_WON' })).status, 422);
  assert.equal((await sales.ok('GET', `/api/opportunities/${opp.public_id}`)).stage, 'NEEDS_ANALYSIS');
});

test('H05 failed ERP contract request can retry without duplicating the contract', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false }); t.after(() => server.close());
  const sales = await client(server, 'hq-sales'), admin = await client(server);
  const opp = await sales.ok('POST', '/api/opportunities', { accountPublicId: seedIDs.approvedAccount, opportunityName: 'H05 retry' });
  await sales.ok('POST', `/api/opportunities/${opp.public_id}/products`, { packagePublicId: seedIDs.product, quantity: 1, proposedUnitPrice: 100000 });
  await sales.ok('POST', `/api/opportunities/${opp.public_id}/stage`, { toStage: 'CLOSED_WON' });
  const con = await sales.ok('POST', '/api/contracts', { opportunityPublicId: opp.public_id, productAmount: 100000 });
  await sales.ok('POST', `/api/contracts/${con.public_id}/collection-plans`, { rows: [{ installmentNo: 1, collectionMethod: 'BANK_TRANSFER', amount: 100000, plannedDate: '2026-11-01' }] });
  const first = await sales.ok('POST', `/api/contracts/${con.public_id}/erp-request`, {}, 'TRANSIENT_FAILURE');
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: first.requestId, scenario: 'TRANSIENT_FAILURE' });
  assert.equal((await sales.ok('GET', `/api/contracts/${con.public_id}`)).status, 'ERP_FAILED');
  const next = await sales.ok('POST', `/api/contracts/${con.public_id}/erp-request`, {});
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: next.requestId, scenario: 'SUCCESS' });
  assert.equal((await sales.ok('GET', `/api/contracts/${con.public_id}`)).status, 'ERP_APPROVED');
  assert.equal((await sales.ok('GET', '/api/contracts')).filter(row => row.opportunity_public_id === opp.public_id).length, 1);
});
