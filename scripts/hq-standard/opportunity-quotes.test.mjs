import test from 'node:test';
import assert from 'node:assert/strict';
import {createHqApplication} from './runtime.mjs';
const {seedIDs:ids}=await import('../../backend/src/hq-mock/seed.ts');
async function client(app,loginId='hq-admin'){const s=await app.handle({method:'POST',path:'/api/hq/session',body:{loginId,password:'HQ-DEMO',datasetId:'HQ_DEMO'}});return(method,path,body)=>app.handle({method,path,body,token:s.body.accessToken});}
async function setup(){const app=createHqApplication();const call=await client(app);const opp=await call('POST','/api/opportunities',{accountPublicId:ids.approvedAccount,opportunityName:'CODEX quote',recordType:'NEW',expectedCloseDate:'2026-12-01'});assert.equal(opp.status,200);const product=await call('POST',`/api/opportunities/${opp.body.public_id}/products`,{packagePublicId:ids.product,quantity:2,proposedUnitPrice:100000});assert.equal(product.status,200,JSON.stringify(product.body));return {app,call,opp:(await call('GET',`/api/opportunities/${opp.body.public_id}`)).body,url:`/api/opportunities/${opp.body.public_id}/quotes`};}
test('quote snapshot CRUD, totals, idempotency, stale edits and soft delete',async()=>{
 const {call,opp,url}=await setup();
 const input={name:'CODEX 견적',issueDate:'2026-11-10',expiryDate:'2026-11-24',description:'test',tax:3000,shipping:2000,idempotencyKey:'new',expectedOpportunityVersion:opp.version};
 const created=await call('POST',url,input);assert.equal(created.status,200,JSON.stringify(created.body));assert.equal(created.body.subtotal,200000);assert.equal(created.body.total,205000);assert.equal(created.body.lines.length,1);assert.equal(created.body.status,'DRAFT');assert.equal(created.body.syncing,false);
 const replay=await call('POST',url,input);assert.equal(replay.body.public_id,created.body.public_id);
 assert.equal((await call('POST',url,{...input,name:'conflict'})).status,409);
 const item=`${url}/${created.body.public_id}`;const changed=await call('PATCH',item,{name:'edited',expectedVersion:1,idempotencyKey:'edit'});assert.equal(changed.status,200);assert.equal(changed.body.version,2);
 assert.equal((await call('PATCH',item,{name:'stale',expectedVersion:1,idempotencyKey:'stale'})).status,409);
 assert.equal((await call('DELETE',item,{expectedVersion:1,idempotencyKey:'stale-delete'})).status,409);
 assert.equal((await call('DELETE',item,{expectedVersion:2,idempotencyKey:'delete'})).status,200);
 assert.equal((await call('GET',url)).body.items.length,0);
 assert.equal((await call('DELETE',item,{expectedVersion:2,idempotencyKey:'delete'})).status,200);
});
test('quote validates dates and money, denies viewer writes, keeps snapshot after parent product update',async()=>{
 const {app,call,opp,url}=await setup();const viewer=await client(app,'hq-viewer');
 assert.equal((await viewer('POST',url,{name:'denied',idempotencyKey:'deny',expectedOpportunityVersion:opp.version})).status,403);
 for(const patch of [{issueDate:'2026-02-30'},{tax:-1},{shipping:'5'},{expiryDate:'2026-11-01',issueDate:'2026-11-10'}])assert.equal((await call('POST',url,{name:'invalid',idempotencyKey:JSON.stringify(patch),expectedOpportunityVersion:opp.version,...patch})).status,400);
 const quote=await call('POST',url,{name:'snapshot',idempotencyKey:'snapshot',expectedOpportunityVersion:opp.version});assert.equal(quote.status,200);
 assert.equal((await call('PATCH',`/api/opportunities/${opp.public_id}/products/${opp.products[0].public_id}`,{quantity:3})).status,200);
 const stored=(await call('GET',url)).body.items[0];assert.equal(stored.subtotal,200000);assert.equal(stored.lines[0].quantity,2);
 assert.equal((await call('GET',`/api/opportunities/${ids.otherCompanyOpportunity}/quotes`)).status,404);
});


test('quote parent conflict and runtime permission changes are enforced before replay',async()=>{
 const {app,call,opp,url}=await setup();
 const input={name:'first',idempotencyKey:'first',expectedOpportunityVersion:opp.version};
 const created=await call('POST',url,input);assert.equal(created.status,200);
 assert.equal((await call('GET',`/api/opportunities/${opp.public_id}`)).body.version,opp.version);
 assert.equal((await call('PATCH',`/api/opportunities/${opp.public_id}/products/${opp.products[0].public_id}`,{quantity:3})).status,200);
 assert.equal((await call('POST',url,{...input,name:'second',idempotencyKey:'second'})).status,409);
 const actor=app.personas.find(p=>p.loginId==='hq-admin');actor.permissions=actor.permissions.filter(p=>p!=='OPPORTUNITY.WRITE');
 assert.equal((await call('POST',url,input)).status,403);
 assert.equal((await call('PATCH',`${url}/${created.body.public_id}`,{name:'denied',idempotencyKey:'denied',expectedVersion:1})).status,403);
 assert.equal((await call('GET',url)).body.items[0].name,'first');
});


test('quote denies redacted opportunity price and does not expose stored snapshots',async()=>{
 const {app,call,opp,url}=await setup();const quote=await call('POST',url,{name:'secret',idempotencyKey:'secret',expectedOpportunityVersion:opp.version});assert.equal(quote.status,200);
 const standard=structuredClone(app.standard);const price=standard.fields.find(f=>f.fieldKey==='opportunity.price');price.masking='redact';delete price.unmaskPermission;
 const restricted=createHqApplication({standard,repositoryFactory:()=>app.repository('HQ_DEMO')});const restrictedCall=await client(restricted);
 assert.equal((await restrictedCall('GET',url)).status,403);
 assert.equal((await restrictedCall('PATCH',`${url}/${quote.body.public_id}`,{name:'blocked',expectedVersion:1,idempotencyKey:'blocked'})).status,403);
});


test('deleted quote receipt remains protected after parent product removal',async()=>{
 const {app,call,opp,url}=await setup();const input={name:'private old quote',idempotencyKey:'private-old',expectedOpportunityVersion:opp.version};
 const quote=await call('POST',url,input);assert.equal(quote.status,200);
 assert.equal((await call('DELETE',`${url}/${quote.body.public_id}`,{idempotencyKey:'remove-private',expectedVersion:1})).status,200);
 assert.equal((await call('DELETE',`/api/opportunities/${opp.public_id}/products/${opp.products[0].public_id}`,{})).status,200);
 const standard=structuredClone(app.standard);const price=standard.fields.find(f=>f.fieldKey==='opportunity.price');price.masking='redact';delete price.unmaskPermission;
 const restricted=createHqApplication({standard,repositoryFactory:()=>app.repository('HQ_DEMO')});const restrictedCall=await client(restricted);
 assert.equal((await restrictedCall('POST',url,input)).status,403);
});
