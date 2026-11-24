import test from 'node:test';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');
async function client(server, loginId) {
  const login = await fetch(`${server.url}/api/hq/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ loginId, password: 'HQ-DEMO' }) });
  const { accessToken } = await login.json();
  return async (method, path, body) => { const response = await fetch(server.url + path, { method, headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: response.status, body: await response.json() }; };
}
test('isolated draft deletion removes its lines, enforces ownership and rejects stale versions', async t => {
  const server = await startHqServer({port:0,storageDir:false,autoAdvance:false}); t.after(() => server.close());
  const sales = await client(server,'hq-sales'), viewer = await client(server,'hq-viewer');
  const created = await sales('POST','/api/orders',{contractPublicId:seedIDs.approvedContract});
  const id = created.body.public_id;
  const added = await sales('POST',`/api/orders/${id}/items`,{productPublicId:seedIDs.product,quantity:2});
  assert.equal(added.status,200);
  assert.equal((await viewer('DELETE',`/api/orders/${id}`,{expectedVersion:added.body.version})).status,403);
  assert.equal((await sales('DELETE',`/api/orders/${id}`,{expectedVersion:created.body.version})).status,409);
  assert.equal((await sales('GET',`/api/orders/${id}`)).body.items.length,1);
  assert.equal((await sales('DELETE',`/api/orders/${id}`,{expectedVersion:added.body.version})).status,200);
  assert.equal((await sales('GET',`/api/orders/${id}`)).status,404);
});
test('a requested mock order cannot be deleted and its items remain intact', async t => {
  const server=await startHqServer({port:0,storageDir:false,autoAdvance:false}); t.after(()=>server.close());
  const sales=await client(server,'hq-sales');
  const initial=await sales('GET',`/api/orders/${seedIDs.readyOrder}`);
  const submit=await sales('POST',`/api/orders/${seedIDs.readyOrder}/submit`,{idempotencyKey:'delete-after-submit',expectedVersion:initial.body.version});
  assert.equal(submit.status,200);
  const before=await sales('GET',`/api/orders/${seedIDs.readyOrder}`);
  const deleted=await sales('DELETE',`/api/orders/${seedIDs.readyOrder}`,{expectedVersion:before.body.version});
  assert.equal(deleted.status,409);
  const after=await sales('GET',`/api/orders/${seedIDs.readyOrder}`);
  assert.deepEqual(after.body,before.body);
});
test('OD02 rejects a stale catalogue price and keeps the draft unchanged', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false }); t.after(() => server.close());
  const sales = await client(server, 'hq-sales'), admin = await client(server, 'hq-admin');
  const draft = await sales('POST', '/api/orders', { contractPublicId: seedIDs.approvedContract }); assert.equal(draft.status, 200);
  const added = await sales('POST', `/api/orders/${draft.body.public_id}/items`, { productPublicId: seedIDs.product, quantity: 1 }); assert.equal(added.status, 200);
  const sync = await admin('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-006', entityType: 'PRODUCT_CATALOG', entityPublicId: seedIDs.product, idempotencyKey: 'od02-price', payload: { products: [{ productPublicId: seedIDs.product, erpItemCode: 'MOCK-P001', itemName: '품목', itemType: 'PRODUCT', category: 'IMPLANT', unitPrice: 123456, stockQty: 100, orderAvailable: true }] } }); assert.equal(sync.status, 200);
  assert.equal((await admin('POST', '/api/hq/interfaces/advance', { requestId: sync.body.requestId })).status, 200);
  const before = await sales('GET', `/api/orders/${draft.body.public_id}`);
  const submit = await sales('POST', `/api/orders/${draft.body.public_id}/submit`, {});
  assert.equal(submit.status, 409); assert.equal(submit.body.error, 'ORDER_PRICE_CHANGED');
  const after = await sales('GET', `/api/orders/${draft.body.public_id}`); assert.deepEqual(after.body, before.body);
});
test('OD02 snapshots only a supplied source unit on new order lines', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false }); t.after(() => server.close());
  const sales = await client(server, 'hq-sales'), admin = await client(server, 'hq-admin');
  const draft = await sales('POST', '/api/orders', { contractPublicId: seedIDs.approvedContract });
  const noUnit = await sales('POST', `/api/orders/${draft.body.public_id}/items`, { productPublicId: seedIDs.product, quantity: 1 }); assert.equal(noUnit.status, 200); assert.equal(noUnit.body.items[0].unit, undefined);
  const sync = await admin('POST', '/api/hq/interfaces/request', { interfaceCode: 'IF-ERP-006', entityType: 'PRODUCT_CATALOG', entityPublicId: seedIDs.product, idempotencyKey: 'od02-unit', payload: { products: [{ productPublicId: seedIDs.product, erpItemCode: 'MOCK-P001', itemName: '품목', itemType: 'PRODUCT', category: 'IMPLANT', unitPrice: 100000, stockQty: 100, orderAvailable: true, unit: 'EA' }] } }); assert.equal(sync.status, 200); assert.equal((await admin('POST', '/api/hq/interfaces/advance', { requestId: sync.body.requestId })).status, 200);
  const next = await sales('POST', '/api/orders', { contractPublicId: seedIDs.approvedContract }); const withUnit = await sales('POST', `/api/orders/${next.body.public_id}/items`, { productPublicId: seedIDs.product, quantity: 1 }); assert.equal(withUnit.body.items[0].unit, 'EA');
  const old = await sales('GET', `/api/orders/${draft.body.public_id}`); assert.equal(old.body.items[0].unit, undefined);
});
test('OD02 retrying a mock submit with the same key returns one request without changing the draft again', async t => {
  const server = await startHqServer({port:0,storageDir:false,autoAdvance:false}); t.after(() => server.close());
  const sales = await client(server,'hq-sales');
  const initial = await sales('GET', `/api/orders/${seedIDs.readyOrder}`); const version = initial.body.version;
  const first = await sales('POST', `/api/orders/${seedIDs.readyOrder}/submit`, {idempotencyKey:'od02-retry', expectedVersion:version}); assert.equal(first.status,200);
  const second = await sales('POST', `/api/orders/${seedIDs.readyOrder}/submit`, {idempotencyKey:'od02-retry', expectedVersion:version}); assert.equal(second.status,200); assert.equal(second.body.requestId,first.body.requestId);
  const different = await sales('POST', `/api/orders/${seedIDs.readyOrder}/submit`, {idempotencyKey:'od02-retry', expectedVersion:version + 1}); assert.equal(different.status,409); assert.equal(different.body.error,'INTERFACE_IDEMPOTENCY_CONFLICT');
  const viewer = await client(server,'hq-viewer'); assert.equal((await viewer('POST', `/api/orders/${seedIDs.readyOrder}/submit`, {idempotencyKey:'od02-retry', expectedVersion:version})).status,403);
});
test('OD02 stale confirmation version is rejected without submitting', async t => {
 const server = await startHqServer({port:0,storageDir:false,autoAdvance:false}); t.after(() => server.close()); const sales = await client(server,'hq-sales');
 const before = await sales('GET', `/api/orders/${seedIDs.readyOrder}`);
 const changed = await sales('PATCH', `/api/orders/${seedIDs.readyOrder}/delivery`, {deliveryAddressType:'DIRECT',deliveryAddress:'새 주소'}); assert.equal(changed.status,200);
 const stale = await sales('POST', `/api/orders/${seedIDs.readyOrder}/submit`, {idempotencyKey:'od02-stale', expectedVersion:before.body.version}); assert.equal(stale.status,409); assert.equal(stale.body.error,'VERSION_CONFLICT');
 const after = await sales('GET', `/api/orders/${seedIDs.readyOrder}`); assert.equal(after.body.status,'DRAFT'); assert.equal(after.body.delivery_address,'새 주소');
});
test('OD01 order address masking covers list detail fulfillment and mutation responses', async t => {
 const { createHqApplication } = await import('./runtime.mjs'); const standard = structuredClone(createHqApplication().standard); const field=standard.fields.find(x => x.fieldKey==='order.deliveryAddress'); field.masking='redact'; delete field.unmaskPermission;
 const server = await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{standard}}); t.after(() => server.close()); const sales = await client(server,'hq-sales');
 const secret='부산 비밀배송주소 123';
 const changed=await sales('PATCH', `/api/orders/${seedIDs.readyOrder}/delivery`, {deliveryAddressType:'DIRECT',deliveryAddress:secret}); assert.equal(changed.status,200);
 const paths=['/api/orders',`/api/orders/${seedIDs.readyOrder}`,`/api/orders/${seedIDs.readyOrder}/fulfillment`,`/api/contracts/${seedIDs.approvedContract}/orders`,`/api/accounts/${seedIDs.approvedAccount}/customer-detail`];
 for (const response of [changed,...await Promise.all(paths.map(path=>sales('GET',path)))]) { assert.equal(response.status,200); assert.equal(JSON.stringify(response.body).includes(secret),false); }
});
test('OD01 default policy retains usable stored delivery address for account and lab', async t => {
 const server = await startHqServer({port:0,storageDir:false,autoAdvance:false}); t.after(()=>server.close()); const sales=await client(server,'hq-sales');
 const account = await sales('GET', `/api/orders/${seedIDs.readyOrder}`); assert.ok(account.body.delivery_address);
 const labs=await sales('GET', `/api/orders/labs?accountPublicId=${seedIDs.approvedAccount}`); const lab=await sales('PATCH', `/api/orders/${seedIDs.readyOrder}/delivery`, {deliveryAddressType:'LAB',labPublicId:labs.body[0].public_id}); assert.equal(lab.status,200); assert.ok(lab.body.delivery_address);
});
test('OD01 labs do not return an unprojected account address', async t => {
 const server = await startHqServer({port:0,storageDir:false,autoAdvance:false}); t.after(()=>server.close()); const sales=await client(server,'hq-sales');
 const result=await sales('GET', `/api/orders/labs?accountPublicId=${seedIDs.approvedAccount}`); assert.equal(result.status,200); assert.equal(Object.hasOwn(result.body[0], 'address'),false);
});
test('OD01 last4 delivery policy applies without mutating stored source', async t => {
 const { createHqApplication, HqRepository } = await import('./runtime.mjs');
 for (const mode of ['last4']) {
  const standard=structuredClone(createHqApplication().standard), field=standard.fields.find(x=>x.fieldKey==='order.deliveryAddress'); if(mode==='hidden') field.visible=false; else {field.masking='last4'; delete field.unmaskPermission;}
  let repo; const factory=datasetId=>{ const r=new HqRepository({datasetId}); if(datasetId==='HQ_DEMO') repo=r; return r; };
  const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{standard,repositoryFactory:factory}}); t.after(()=>server.close()); const sales=await client(server,'hq-sales');
  const secret='비밀 배송지 9876'; const saved=await sales('PATCH', `/api/orders/${seedIDs.readyOrder}/delivery`, {deliveryAddressType:'DIRECT',deliveryAddress:secret}); assert.equal(saved.status,200);
  const read=await sales('GET', `/api/orders/${seedIDs.readyOrder}`); assert.equal(JSON.stringify(read.body).includes(secret),false);
  if(mode==='hidden') assert.equal(read.body.delivery_address,undefined); else assert.ok(read.body.delivery_address.endsWith('9876'));
  assert.equal(repo.read().collections.orders.find(row=>row.public_id===seedIDs.readyOrder).delivery_address,secret);
 }
});
test('OD01 masked delivery address cannot be written back as the original', async t => {
 const { createHqApplication } = await import('./runtime.mjs'); const standard=structuredClone(createHqApplication().standard); const field=standard.fields.find(x=>x.fieldKey==='order.deliveryAddress'); field.masking='last4'; delete field.unmaskPermission;
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{standard}}); t.after(()=>server.close()); const sales=await client(server,'hq-sales');
 const secret='비밀주소9876'; const first=await sales('PATCH', `/api/orders/${seedIDs.readyOrder}/delivery`, {deliveryAddressType:'DIRECT',deliveryAddress:secret}); assert.equal(first.status,200); const masked=first.body.delivery_address; assert.notEqual(masked,secret);
 const attempted=await sales('PATCH', `/api/orders/${seedIDs.readyOrder}/delivery`, {deliveryAddressType:'DIRECT',deliveryAddress:masked,note:'변경'}); assert.equal(attempted.status,400); assert.equal(attempted.body.error,'DELIVERY_ADDRESS_REENTRY_REQUIRED');
});
test('masked delivery policy hides and rejects changes to recipient details', async t => {
 const {createHqApplication,HqRepository}=await import('./runtime.mjs'); const standard=structuredClone(createHqApplication().standard);
 const field=standard.fields.find(x=>x.fieldKey==='order.deliveryAddress'); field.masking='last4'; delete field.unmaskPermission;
 const factory=datasetId=>{const repo=new HqRepository({datasetId});if(datasetId==='HQ_DEMO')repo.transact(d=>Object.assign(d.collections.orders.find(r=>r.public_id===seedIDs.readyOrder),{recipient_name:'private name',recipient_phone:'01012345678',postal_code:'12345'}));return repo;};
 const server=await startHqServer({port:0,storageDir:false,application:{standard,repositoryFactory:factory}});t.after(()=>server.close());const sales=await client(server,'hq-sales');
 const read=await sales('GET',`/api/orders/${seedIDs.readyOrder}`);assert.equal(read.body.recipient_name,undefined);assert.equal(read.body.recipient_phone,undefined);assert.equal(read.body.postal_code,undefined);
 for(const path of ['/api/orders',`/api/orders/${seedIDs.readyOrder}/fulfillment`,`/api/contracts/${seedIDs.approvedContract}/orders`,`/api/accounts/${seedIDs.approvedAccount}/customer-detail`]) { const result=await sales('GET',path);assert.equal(result.status,200);assert.equal(JSON.stringify(result.body).includes('01012345678'),false, path);assert.equal(JSON.stringify(result.body).includes('private name'),false,path); }
 const update=await sales('PATCH',`/api/orders/${seedIDs.readyOrder}/delivery`,{deliveryAddressType:'DIRECT',deliveryAddress:'new address',recipientName:'changed'});assert.equal(update.status,403);
});
