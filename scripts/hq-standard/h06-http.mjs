import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from '../../backend/node_modules/exceljs/excel.js';
import { startHqServer } from './server.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');

async function client(server, loginId = 'hq-sales') {
  const login = await fetch(`${server.url}/api/hq/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ loginId, password: 'HQ-DEMO' }) });
  const session = await login.json();
  const call = async (method, path, body, scenario) => {
    const response = await fetch(server.url + path, { method, headers: { authorization: `Bearer ${session.accessToken}`, 'content-type': 'application/json', ...(scenario ? { 'x-hq-scenario': scenario } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const type = response.headers.get('content-type') ?? '';
    return { status: response.status, body: type.includes('json') ? await response.json() : new Uint8Array(await response.arrayBuffer()), headers: response.headers };
  };
  const ok = async (...args) => { const result = await call(...args); assert.equal(result.status, 200, `${args[0]} ${args[1]} ${JSON.stringify(result.body)}`); return result.body; };
  return { call, ok };
}

test('H06 draft, ERP catalogue, order, delivery and failed retry share one state', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false }); t.after(() => server.close());
  const sales = await client(server), admin = await client(server, 'hq-admin');
  assert.equal((await sales.call('GET', '/api/order-products')).status, 400);
  assert.equal((await sales.call('GET', '/api/order-products?itemType=PRODUCT&search=ab')).status, 400);
  const catalog = await sales.ok('GET', '/api/order-products?itemType=PRODUCT&search=MOCK');
  assert.ok(catalog.some(p => p.public_id === seedIDs.product));
  const draft = await sales.ok('POST', '/api/orders', { contractPublicId: seedIDs.approvedContract });
  assert.equal((await sales.call('POST', '/api/orders', { contractPublicId: seedIDs.pendingContract })).status, 422);
  assert.equal((await sales.call('POST', `/api/orders/${draft.public_id}/items`, { productPublicId: seedIDs.zeroStockProduct, quantity: 1 })).status, 409);
  assert.equal((await sales.call('POST', `/api/orders/${draft.public_id}/items`, { productPublicId: seedIDs.negativeStockProduct, quantity: 1 })).status, 409);
  assert.equal((await sales.call('POST', `/api/orders/${draft.public_id}/items`, { productPublicId: seedIDs.unavailableProduct, quantity: 1 })).status, 409);
  assert.equal((await sales.call('POST', `/api/orders/${draft.public_id}/items`, { productPublicId: seedIDs.product, quantity: 1, unitPrice: 1 })).status, 400);
  await sales.ok('POST', `/api/orders/${draft.public_id}/items`, { productPublicId: seedIDs.product, quantity: 2 });
  await sales.ok('POST', `/api/orders/${draft.public_id}/items`, { productPublicId: seedIDs.packageProduct, quantity: 1 });
  assert.equal((await sales.ok('GET', `/api/orders/${draft.public_id}`)).order_amount, 400000);
  assert.equal((await sales.call('PATCH', `/api/orders/${draft.public_id}/delivery`, { deliveryAddressType: 'DIRECT', deliveryAddress: '' })).status, 400);
  const labs = await sales.ok('GET', `/api/orders/labs?accountPublicId=${seedIDs.approvedAccount}`);
  await sales.ok('PATCH', `/api/orders/${draft.public_id}/delivery`, { deliveryAddressType: 'LAB', labPublicId: labs[0].public_id });
  const request = await sales.ok('POST', `/api/orders/${draft.public_id}/submit`, {}, 'TRANSIENT_FAILURE');
  assert.equal((await sales.ok('GET', `/api/orders/${draft.public_id}`)).status, 'REQUESTING');
  assert.equal((await sales.call('POST', `/api/orders/${draft.public_id}/submit`, {})).status, 422);
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: request.requestId, scenario: 'TRANSIENT_FAILURE' });
  assert.equal((await sales.ok('GET', `/api/orders/${draft.public_id}`)).status, 'FAILED');
  const retry = await sales.ok('POST', `/api/orders/${draft.public_id}/submit`, { idempotencyKey: 'h06-retry' });
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: retry.requestId });
  const accepted = await sales.ok('GET', `/api/orders/${draft.public_id}`);
  assert.equal(accepted.status, 'ACCEPTED'); assert.match(accepted.erp_order_no, /^MOCK-ORD-/);
  assert.equal((await sales.call('POST', `/api/orders/${draft.public_id}/items`, { productPublicId: seedIDs.product, quantity: 1 })).status, 409);
  assert.equal((await sales.ok('GET', `/api/orders/${draft.public_id}/fulfillment`)).order.public_id, draft.public_id);
  const excess = await sales.ok('POST', '/api/orders', { contractPublicId: seedIDs.approvedContract });
  await sales.ok('POST', `/api/orders/${excess.public_id}/items`, { productPublicId: seedIDs.product, quantity: 7 });
  assert.equal((await sales.call('POST', `/api/orders/${excess.public_id}/submit`, {})).status, 409);
  assert.equal((await sales.ok('GET', `/api/orders/${excess.public_id}`)).status, 'DRAFT');
});

test('H06 ERP results flow to fulfillment, ledger, statement files and dashboard', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false }); t.after(() => server.close());
  const sales = await client(server), admin = await client(server, 'hq-admin');
  const orderReq = await sales.ok('POST', `/api/orders/${seedIDs.readyOrder}/submit`, {});
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: orderReq.requestId });
  const erpOrderNo = (await sales.ok('GET', `/api/orders/${seedIDs.readyOrder}`)).erp_order_no;
  const completed = await admin.ok('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-008', entityType: 'ORDER', entityPublicId: seedIDs.readyOrder, idempotencyKey: 'h06-complete', payload: { orderPublicId: seedIDs.readyOrder, erpOrderNo, status: 'COMPLETED', deliveries: [{ erpDeliveryNo: 'H06-DEL-01', deliveryStatus: 'DELIVERED', shippedAt: '2026-10-23', deliveredAt: '2026-10-23' }] } });
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: completed.requestId });
  const saleReq = await admin.ok('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-010', entityType: 'ACCOUNT', entityPublicId: seedIDs.approvedAccount, idempotencyKey: 'h06-sale', payload: { accountPublicId: seedIDs.approvedAccount, rows: [{ erpSalesNo: 'H06-SALE-01', currency: 'KRW', salesDate: '2026-10-23', amount: 200000, orderPublicId: seedIDs.readyOrder, contractPublicId: seedIDs.approvedContract, itemCode: 'MOCK-P001', quantity: 2 }] } });
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: saleReq.requestId });
  const colReq = await admin.ok('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-009', entityType: 'CONTRACT', entityPublicId: seedIDs.approvedContract, idempotencyKey: 'h06-col', payload: { contractPublicId: seedIDs.approvedContract, rows: [{ erpCollectionNo: 'H06-COL-01', currency: 'KRW', amount: 100000, collectedAt: '2026-10-23' }] } });
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: colReq.requestId });
  const returnReq = await admin.ok('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-014', entityType: 'ORDER', entityPublicId: seedIDs.readyOrder, idempotencyKey: 'h06-return', payload: { orderPublicId: seedIDs.readyOrder, rows: [{ erpReferenceNo: 'H06-RET-01', transactionType: 'RETURN', status: 'COMPLETED', quantity: 1, amount: 100000, processedAt: '2026-10-23', erpSalesNo: 'H06-SALE-01' }] } });
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: returnReq.requestId });
  const overReturn = await admin.ok('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-014', entityType: 'ORDER', entityPublicId: seedIDs.readyOrder,
    idempotencyKey: 'h06-over-return', payload: { orderPublicId: seedIDs.readyOrder, rows: [{ erpReferenceNo: 'H06-RET-OVER', transactionType: 'RETURN', status: 'COMPLETED', quantity: 2, amount: 200000, processedAt: '2026-10-23', erpSalesNo: 'H06-SALE-01' }] } });
  assert.equal((await admin.call('POST', '/api/hq/interfaces/advance', { requestId: overReturn.requestId })).status, 422);
  const fulfillment = await sales.ok('GET', `/api/orders/${seedIDs.readyOrder}/fulfillment`);
  assert.equal(fulfillment.order.status, 'COMPLETED'); assert.equal(fulfillment.deliveries.length, 1); assert.equal(fulfillment.sales.length, 1); assert.equal(fulfillment.collections.length, 1); assert.equal(fulfillment.returns.length, 1);
  const related = await sales.ok('GET', `/api/contracts/${seedIDs.approvedContract}/orders`);
  assert.equal(related.orders.length, 1); assert.equal(related.orders[0].public_id, seedIDs.readyOrder);
  assert.equal(related.returns.length, 1); assert.equal(related.returns[0].erp_reference_no, 'H06-RET-01');
  const unrelated = await sales.ok('GET', `/api/contracts/${seedIDs.pendingContract}/orders`);
  assert.equal(unrelated.orders[0].public_id, seedIDs.pendingOrder); assert.equal(unrelated.returns.length, 0);
  const query = `from=2026-10-01&to=2026-10-31&contractPublicId=${seedIDs.approvedContract}`;
  const ledger = await sales.ok('GET', `/api/analytics/accounts/${seedIDs.approvedAccount}/ledger?${query}`);
  assert.equal(ledger.summary.salesAmount, 200000); assert.equal(ledger.summary.collectionAmount, 100000); assert.equal(ledger.summary.returnExchangeCount, 1); assert.equal(ledger.summary.rowCount, 3);
  const statement = await sales.ok('GET', `/api/analytics/accounts/${seedIDs.approvedAccount}/statements?${query}`);
  assert.equal(statement.summary.totalAmount, 200000);
  const xlsx = await sales.call('GET', `/api/analytics/accounts/${seedIDs.approvedAccount}/ledger.xlsx?${query}`);
  assert.equal(xlsx.status, 200); assert.equal(Buffer.from(xlsx.body).subarray(0, 2).toString(), 'PK');
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(xlsx.body));
  assert.ok(workbook.worksheets[0].getSheetValues().some(row => Array.isArray(row) && row[7] === 200000));
  const pdf = await sales.call('POST', `/api/analytics/accounts/${seedIDs.approvedAccount}/statements/pdf?${query}`, { selectedSalesPublicIds: [statement.rows[0].public_id] });
  assert.equal(pdf.status, 200); assert.equal(Buffer.from(pdf.body).subarray(0, 4).toString(), '%PDF');
  const dash = await sales.ok('GET', '/api/analytics/dashboard?from=2026-10-01&to=2026-10-31');
  assert.equal(dash.sales.amount, 200000); assert.equal(dash.collections.amount, 100000); assert.equal(dash.asOf, '2026-10-22T00:00:00.000Z');
  const emptyPeriod = await sales.ok('GET', '/api/analytics/dashboard?from=2020-01-01&to=2020-01-31');
  assert.equal(emptyPeriod.pipeline.count, 0); assert.equal(emptyPeriod.contracts.count, 0); assert.equal(emptyPeriod.orders.count, 0);
});

test('H06 rejects unsolicited ERP completion and identity or status regression', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false }); t.after(() => server.close());
  const sales = await client(server), admin = await client(server, 'hq-admin');
  const unsoldReturn = await admin.ok('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-014', entityType: 'ORDER', entityPublicId: seedIDs.readyOrder,
    idempotencyKey: 'h06-unsold-return', payload: { orderPublicId: seedIDs.readyOrder, rows: [{ erpReferenceNo: 'H06-UNSOLD', transactionType: 'RETURN', status: 'COMPLETED', quantity: 1, processedAt: '2026-10-23' }] } });
  assert.equal((await admin.call('POST', '/api/hq/interfaces/advance', { requestId: unsoldReturn.requestId })).status, 409);
  assert.equal((await sales.ok('GET', `/api/orders/${seedIDs.readyOrder}/fulfillment`)).returns.length, 0);
  const unsolicited = await admin.ok('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-008', entityType: 'ORDER', entityPublicId: seedIDs.readyOrder,
    idempotencyKey: 'h06-unsolicited', payload: { orderPublicId: seedIDs.readyOrder, erpOrderNo: 'UNSOLICITED', status: 'COMPLETED', deliveries: [{ erpDeliveryNo: 'BAD-DEL', deliveryStatus: 'DELIVERED' }] } });
  assert.equal((await admin.call('POST', '/api/hq/interfaces/advance', { requestId: unsolicited.requestId })).status, 409);
  assert.equal((await sales.ok('GET', `/api/orders/${seedIDs.readyOrder}`)).status, 'DRAFT');
  assert.equal((await sales.ok('GET', `/api/orders/${seedIDs.readyOrder}/fulfillment`)).deliveries.length, 0);
  const outgoing = await sales.ok('POST', `/api/orders/${seedIDs.readyOrder}/submit`, {});
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: outgoing.requestId });
  const erpOrderNo = (await sales.ok('GET', `/api/orders/${seedIDs.readyOrder}`)).erp_order_no;
  const lateFailure = await admin.ok('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-008', entityType: 'ORDER', entityPublicId: seedIDs.readyOrder,
    idempotencyKey: 'h06-late-failure', payload: { orderPublicId: seedIDs.readyOrder } });
  assert.equal((await admin.call('POST', '/api/hq/interfaces/advance', { requestId: lateFailure.requestId, scenario: 'TRANSIENT_FAILURE' })).status, 409);
  assert.equal((await sales.ok('GET', `/api/orders/${seedIDs.readyOrder}`)).status, 'ACCEPTED');
  const changed = await admin.ok('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-008', entityType: 'ORDER', entityPublicId: seedIDs.readyOrder,
    idempotencyKey: 'h06-changed-number', payload: { orderPublicId: seedIDs.readyOrder, erpOrderNo: 'CHANGED', status: 'COMPLETED' } });
  assert.equal((await admin.call('POST', '/api/hq/interfaces/advance', { requestId: changed.requestId })).status, 409);
  const completed = await admin.ok('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-008', entityType: 'ORDER', entityPublicId: seedIDs.readyOrder,
    idempotencyKey: 'h06-good-complete', payload: { orderPublicId: seedIDs.readyOrder, erpOrderNo, status: 'COMPLETED' } });
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: completed.requestId });
  const regression = await admin.ok('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-008', entityType: 'ORDER', entityPublicId: seedIDs.readyOrder,
    idempotencyKey: 'h06-regression', payload: { orderPublicId: seedIDs.readyOrder, erpOrderNo, status: 'ACCEPTED' } });
  assert.equal((await admin.call('POST', '/api/hq/interfaces/advance', { requestId: regression.requestId })).status, 409);
  assert.equal((await sales.ok('GET', `/api/orders/${seedIDs.readyOrder}`)).status, 'COMPLETED');
});

test('OD02 catalogue availability is checked without reserving stock across orders', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false }); t.after(() => server.close());
  const sales = await client(server), admin = await client(server, 'hq-admin');
  const stock = await admin.ok('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-006', entityType: 'PRODUCT_CATALOG', entityPublicId: seedIDs.product,
    idempotencyKey: 'h06-stock-3', payload: { products: [{ productPublicId: seedIDs.product, erpItemCode: 'MOCK-P001', itemName: '검수 재고 품목', itemType: 'PRODUCT', category: 'IMPLANT', unitPrice: 100000, stockQty: 3, orderAvailable: true }] } });
  await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: stock.requestId });
  const first = await sales.ok('POST', '/api/orders', { contractPublicId: seedIDs.approvedContract });
  await sales.ok('POST', `/api/orders/${first.public_id}/items`, { productPublicId: seedIDs.product, quantity: 2 });
  const request = await sales.ok('POST', `/api/orders/${first.public_id}/submit`, {}); await admin.ok('POST', '/api/hq/interfaces/advance', { requestId: request.requestId });
  const second = await sales.ok('POST', '/api/orders', { contractPublicId: seedIDs.approvedContract });
  await sales.ok('POST', `/api/orders/${second.public_id}/items`, { productPublicId: seedIDs.product, quantity: 2 });
  assert.equal((await sales.call('POST', `/api/orders/${second.public_id}/submit`, {})).status, 200);
  assert.equal((await sales.ok('GET', `/api/orders/${second.public_id}`)).status, 'REQUESTING');
  const catalog = await sales.ok('GET', '/api/order-products?itemType=PRODUCT');
  assert.equal(catalog.find(row => row.public_id === seedIDs.product).stock_qty, 3);
});

test('order quantity edits recalculate totals and reject invalid or submitted changes atomically', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false }); t.after(() => server.close());
  const sales = await client(server);
  const seeded = await sales.ok('GET', `/api/orders/${seedIDs.readyOrder}`);
  assert.ok(seeded.items[0].public_id);
  const seededUpdate = await sales.ok('PATCH', `/api/orders/${seedIDs.readyOrder}/items/${seeded.items[0].public_id}`, { quantity: 1 });
  assert.equal(seededUpdate.order_amount, 100000);
  const draft = await sales.ok('POST', '/api/orders', { contractPublicId: seedIDs.approvedContract });
  const added = await sales.ok('POST', `/api/orders/${draft.public_id}/items`, { productPublicId: seedIDs.product, quantity: 2 });
  const line = added.items[0], path = `/api/orders/${draft.public_id}/items/${line.public_id}`;
  const updated = await sales.ok('PATCH', path, { quantity: 3 });
  assert.equal(updated.items[0].public_id, line.public_id);
  assert.equal(updated.items[0].unit_price, line.unit_price);
  assert.equal(updated.items[0].amount, 3 * line.unit_price);
  assert.equal(updated.order_amount, 3 * line.unit_price);
  assert.equal(updated.version, added.version + 1);
  for (const body of [{ quantity: 0 }, { quantity: 1.5 }, { quantity: 10000 }, { quantity: 1, unitPrice: 1 }]) {
    assert.equal((await sales.call('PATCH', path, body)).status, 400);
  }
  assert.equal((await sales.call('PATCH', path, { quantity: 9999 })).status, 409);
  assert.deepEqual(await sales.ok('GET', `/api/orders/${draft.public_id}`), updated);
  await sales.ok('POST', `/api/orders/${draft.public_id}/submit`, {});
  assert.equal((await sales.call('PATCH', path, { quantity: 1 })).status, 409);
  assert.equal((await sales.ok('GET', `/api/orders/${draft.public_id}`)).items[0].quantity, 3);
});
