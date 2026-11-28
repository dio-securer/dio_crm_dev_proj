import test from 'node:test';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';
import { HqRepository } from './runtime.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');
async function client(server, loginId) { const login = await fetch(`${server.url}/api/hq/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ loginId, password: 'HQ-DEMO' }) }); const { accessToken } = await login.json(); return async (method, path, body) => { const r = await fetch(server.url + path, { method, headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); const data = await r.json(); assert.equal(r.status, 200, `${method} ${path}: ${JSON.stringify(data)}`); return data; }; }
test('OD03 real mock event intake deduplicates partial delivery by source and line', async t => {
 const factory = datasetId => { const repo = new HqRepository({datasetId}); if (datasetId === 'HQ_DEMO') repo.transact(d => { const order = d.collections.orders.find(r => r.public_id === seedIDs.readyOrder); order.items[0].quantity = 10; order.items[0].unit = 'EA'; order.items[0].amount = 1000000; order.order_amount = 1000000; }); return repo; };
 const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false, application: { repositoryFactory: factory } }); t.after(() => server.close());
 const sales = await client(server, 'hq-sales'), admin = await client(server, 'hq-admin');
 const request = await sales('POST', `/api/orders/${seedIDs.readyOrder}/submit`, {}); await admin('POST', '/api/hq/interfaces/advance', { requestId: request.requestId });
 const order = await sales('GET', `/api/orders/${seedIDs.readyOrder}`), line = order.items[0].public_id;
 const delivery = { erpDeliveryNo: 'OD03-D1', orderLinePublicId: line, deliveryStatus: 'DELIVERED', shippedQty: 6, deliveredQty: 4, unit: 'EA' };
 async function event(key, deliveries) { const sent = await admin('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-008', entityType: 'ORDER', entityPublicId: seedIDs.readyOrder, idempotencyKey: key, payload: { orderPublicId: seedIDs.readyOrder, erpOrderNo: order.erp_order_no, status: 'PROCESSING', deliveries } }); await admin('POST', '/api/hq/interfaces/advance', { requestId: sent.requestId }); }
 await event('od03-1', [delivery]); let result = await sales('GET', `/api/orders/${seedIDs.readyOrder}/fulfillment`); assert.equal(result.lineSummary[0].remainingQty, 6); assert.equal(result.lineSummary[0].deliveredQty, 4);
 await event('od03-2', [delivery]); result = await sales('GET', `/api/orders/${seedIDs.readyOrder}/fulfillment`); assert.equal(result.deliveries.length, 1); assert.equal(result.lineSummary[0].remainingQty, 6);
 await event('od03-3', [{ ...delivery, erpDeliveryNo: 'OD03-D2', shippedQty: 3, deliveredQty: 3 }]); result = await sales('GET', `/api/orders/${seedIDs.readyOrder}/fulfillment`); assert.equal(result.lineSummary[0].deliveredQty, 7); assert.equal(result.lineSummary[0].remainingQty, 3);
});
test('OD03 API refuses partial aggregate when another event is outside actor scope', async t => {
 const factory = datasetId => { const repo = new HqRepository({datasetId}); if (datasetId === 'HQ_DEMO') repo.transact(d => {
  const order = d.collections.orders.find(r => r.public_id === seedIDs.readyOrder); order.items[0].quantity = 10; order.items[0].unit = 'EA'; order.items[0].amount = 1000000; order.order_amount = 1000000;
  for (const [id,owner,qty] of [['00000000-0000-4000-8000-000000009991',1,4],['00000000-0000-4000-8000-000000009992',2,3]]) d.collections.deliveries.push({public_id:id, company_id:1, organization_id:10, owner_user_id:owner, version:1, order_public_id:seedIDs.readyOrder, erp_delivery_no:id, order_line_public_id:seedIDs.product, shipped_qty:qty, delivered_qty:qty, unit:'EA', delivery_status:'DELIVERED'});
 }); return repo; };
 const server = await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{repositoryFactory:factory}}); t.after(() => server.close());
 const sales = await client(server,'hq-sales'), admin = await client(server,'hq-admin');
 const restricted = await sales('GET', `/api/orders/${seedIDs.readyOrder}/fulfillment`); assert.equal(restricted.deliveries.length,1); assert.equal(restricted.lineSummary[0].remainingQty,null); assert.ok(restricted.lineSummary[0].issue);
 const full = await admin('GET', `/api/orders/${seedIDs.readyOrder}/fulfillment`); assert.equal(full.deliveries.length,2); assert.equal(full.lineSummary[0].remainingQty,3);
});
