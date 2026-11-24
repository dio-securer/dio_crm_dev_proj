import test from 'node:test';
import assert from 'node:assert/strict';
import {createHqApplication} from './runtime.mjs';
const {seedIDs:ids}=await import('../../backend/src/hq-mock/seed.ts');
async function client(app,loginId='hq-admin'){const s=await app.handle({method:'POST',path:'/api/hq/session',body:{loginId,password:'HQ-DEMO',datasetId:'HQ_DEMO'}});return(method,path,body)=>app.handle({method,path,body,token:s.body.accessToken});}
test('direct delivery recipient information is versioned and survives reload',async()=>{
 const app=createHqApplication(),call=await client(app);
 const draft=(await call('POST','/api/orders',{contractPublicId:ids.approvedContract})).body;
 const url=`/api/orders/${draft.public_id}/delivery`;
 const data={deliveryAddressType:'DIRECT',deliveryAddress:'Test Street 10',recipientName:'테스트 수령자',recipientPhone:'010-0000-1234',postalCode:'12345',expectedVersion:draft.version};
 const saved=await call('PATCH',url,data);assert.equal(saved.status,200,JSON.stringify(saved.body));
 const reload=await call('GET',`/api/orders/${draft.public_id}`);
 assert.equal(reload.body.recipient_name,data.recipientName);assert.equal(reload.body.recipient_phone,data.recipientPhone);assert.equal(reload.body.postal_code,data.postalCode);
 assert.equal((await call('PATCH',url,{...data,recipientName:'stale'})).status,409);
 assert.equal((await call('GET',`/api/orders/${draft.public_id}`)).body.recipient_name,data.recipientName);
});
test('order uses only same-account active destination and preserves saved address snapshot',async()=>{
 const app=createHqApplication(),call=await client(app),viewer=await client(app,'hq-viewer');
 const base=`/api/accounts/${ids.approvedAccount}/destinations`;
 const destination=await call('POST',base,{name:'CODEX destination',address:'Test 1',detailAddress:'Floor 2',idempotencyKey:'dest'});assert.equal(destination.status,200);
 const order=await call('POST','/api/orders',{contractPublicId:ids.approvedContract});const url=`/api/orders/${order.body.public_id}/delivery`;
 const input={deliveryAddressType:'DIRECT',destinationPublicId:destination.body.public_id,destinationVersion:1};
 const saved=await call('PATCH',url,input);assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.delivery_address,'Test 1 Floor 2');
 assert.equal((await viewer('PATCH',url,input)).status,403);
 const foreign=await call('POST',`/api/accounts/${ids.otherOwnerAccount}/destinations`,{name:'other',address:'Foreign',idempotencyKey:'other'});
 assert.equal((await call('PATCH',url,{...input,destinationPublicId:foreign.body.public_id})).status,404);
 await call('PATCH',`${base}/item/${destination.body.public_id}`,{name:'changed',address:'New',expectedVersion:1});
 assert.equal((await call('PATCH',url,input)).status,409);
 assert.equal((await call('GET',`/api/orders/${order.body.public_id}`)).body.delivery_address,'Test 1 Floor 2');
 await call('DELETE',`${base}/item/${destination.body.public_id}`,{expectedVersion:2});
 assert.equal((await call('PATCH',url,{...input,destinationVersion:3})).status,404);
 assert.equal((await call('GET',`/api/orders/${order.body.public_id}`)).body.delivery_address,'Test 1 Floor 2');
});

test('inactive destination and withdrawn account permission cannot be used for delivery',async()=>{
 const app=createHqApplication(),call=await client(app),sales=await client(app,'hq-sales');
 const base=`/api/accounts/${ids.approvedAccount}/destinations`;
 const destination=(await call('POST',base,{name:'inactive',address:'Test',idempotencyKey:'inactive'})).body;
 const draft=(await call('POST','/api/orders',{contractPublicId:ids.approvedContract})).body;
 const payload={deliveryAddressType:'DIRECT',destinationPublicId:destination.public_id,destinationVersion:1};
 app.repository('HQ_DEMO').transact(d=>{d.collections.accounts.find(a=>a.public_id===ids.approvedAccount).mock_destinations[0].active=false;});
 assert.equal((await call('PATCH',`/api/orders/${draft.public_id}/delivery`,payload)).status,404);
 const actor=app.personas.find(p=>p.loginId==='hq-sales');actor.permissions=actor.permissions.filter(p=>p!=='ACCOUNT.READ');
 assert.equal((await sales('PATCH',`/api/orders/${draft.public_id}/delivery`,payload)).status,403);
});

test('delivery optimistic version rejects stale edits without losing newer destination',async()=>{
 const app=createHqApplication(),call=await client(app);const draft=(await call('POST','/api/orders',{contractPublicId:ids.approvedContract})).body;const url=`/api/orders/${draft.public_id}/delivery`;
 const first=await call('PATCH',url,{deliveryAddressType:'DIRECT',deliveryAddress:'First',expectedVersion:draft.version});assert.equal(first.status,200);
 const stale=await call('PATCH',url,{deliveryAddressType:'DIRECT',deliveryAddress:'Stale',expectedVersion:draft.version});assert.equal(stale.status,409);assert.equal(stale.body.error,'VERSION_CONFLICT');
 assert.equal((await call('GET',`/api/orders/${draft.public_id}`)).body.delivery_address,'First');
 assert.equal((await call('PATCH',url,{deliveryAddressType:'ACCOUNT',expectedVersion:'2'})).status,400);
});
