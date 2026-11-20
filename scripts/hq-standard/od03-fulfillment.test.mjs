import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeFulfillment } from '../../backend/src/hq-mock/order-fulfillment.ts';
test('OD03 unique line events yield 10 ordered, 6 shipped, 4 delivered then 7 delivered', () => {
 const lines = [{ public_id: 'line-1', quantity: 10, unit: 'EA' }];
 const first = { erp_delivery_no: 'D1', order_line_public_id: 'line-1', shipped_qty: 6, delivered_qty: 4, unit: 'EA', delivery_status: 'DELIVERED' };
 assert.deepEqual(summarizeFulfillment(lines, [first, { ...first }])[0], { lineId: 'line-1', orderedQty: 10, shippedQty: 6, deliveredQty: 4, remainingQty: 6, issue: null });
 const next = { erp_delivery_no: 'D2', order_line_public_id: 'line-1', shipped_qty: 3, delivered_qty: 3, unit: 'EA', delivery_status: 'DELIVERED' };
 assert.deepEqual(summarizeFulfillment(lines, [first, next])[0], { lineId: 'line-1', orderedQty: 10, shippedQty: 9, deliveredQty: 7, remainingQty: 3, issue: null });
});
test('OD03 does not calculate from a visibility-restricted subset', () => {
 const result = summarizeFulfillment([{ public_id: 'line-1', quantity: 10, unit: 'EA' }], [{ erp_delivery_no: 'D1', order_line_public_id: 'line-1', shipped_qty: 6, delivered_qty: 4, unit: 'EA', delivery_status: 'DELIVERED' }], false)[0];
 assert.ok(result.issue); assert.equal(result.remainingQty, null);
});
test('OD03 incomplete, cancelled, conflicting, unit mismatch and overdelivery never silently calculate', () => {
 const lines = [{ public_id: 'line-1', quantity: 10, unit: 'EA' }];
 const base = { erp_delivery_no: 'D1', order_line_public_id: 'line-1', shipped_qty: 6, delivered_qty: 4, unit: 'EA', delivery_status: 'DELIVERED' };
 for (const events of [[{ ...base, delivered_qty: undefined }], [{ ...base, delivery_status: 'CANCELLED' }], [{ ...base, delivery_status: 'SHIPPED' }], [base, { ...base, delivered_qty: 5 }], [base, { erp_delivery_no: 'OLD' }], [{ ...base, unit: 'BOX' }], [{ ...base, delivered_qty: 11 }]]) {
   const result = summarizeFulfillment(lines, events)[0]; assert.ok(result.issue); assert.equal(result.remainingQty, null);
 }
});
