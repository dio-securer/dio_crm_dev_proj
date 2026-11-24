import test from 'node:test';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';
import { createHqApplication } from './runtime.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
test('OD01 masked address writeback is rejected without changing original; full reentry succeeds',async t=>{
 const standard=structuredClone(createHqApplication().standard),field=standard.fields.find(x=>x.fieldKey==='order.deliveryAddress');field.masking='last4';delete field.unmaskPermission;
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{standard}});t.after(()=>server.close());
 const session=await fetch(server.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:'hq-sales',password:'HQ-DEMO'})});const {accessToken}=await session.json();
 const call=async(method,path,body)=>{const r=await fetch(server.url+path,{method,headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
 const path=`/api/orders/${seedIDs.readyOrder}/delivery`, secret='서울 비밀주소 1234', replacement='부산 새주소 9876';
 const first=await call('PATCH',path,{deliveryAddressType:'DIRECT',deliveryAddress:secret});assert.equal(first.status,200);assert.notEqual(first.body.delivery_address,secret);
 const repo=server.app.repository('HQ_DEMO'),before=repo.read(); const rejected=await call('PATCH',path,{deliveryAddressType:'DIRECT',deliveryAddress:first.body.delivery_address,note:'변경'});assert.equal(rejected.status,400);assert.equal(rejected.body.error,'DELIVERY_ADDRESS_REENTRY_REQUIRED');assert.deepEqual(repo.read(),before);
 const updated=await call('PATCH',path,{deliveryAddressType:'DIRECT',deliveryAddress:replacement,note:'변경'});assert.equal(updated.status,200);assert.notEqual(updated.body.delivery_address,replacement);assert.equal(repo.read().collections.orders.find(x=>x.public_id===seedIDs.readyOrder).delivery_address,replacement);
});
