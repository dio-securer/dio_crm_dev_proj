import test from 'node:test';
import assert from 'node:assert/strict';
import {createHqApplication} from './runtime.mjs';
const {seedIDs:ids}=await import('../../backend/src/hq-mock/seed.ts');
async function client(app,loginId='hq-admin'){const s=await app.handle({method:'POST',path:'/api/hq/session',body:{loginId,password:'HQ-DEMO',datasetId:'HQ_DEMO'}});return(method,path,body)=>app.handle({method,path,body,token:s.body.accessToken});}
async function setup(){const app=createHqApplication();const call=await client(app);const opp=(await call('POST','/api/opportunities',{accountPublicId:ids.approvedAccount,opportunityName:'CODEX contact roles',recordType:'NEW',expectedCloseDate:'2026-12-01'})).body;return {app,call,opp,url:`/api/opportunities/${opp.public_id}/contact-roles`};}
test('contact roles CRUD and single primary preserve parent and contact records',async()=>{
 const {app,call,opp,url}=await setup();const second=await call('POST','/api/contacts',{accountPublicId:ids.approvedAccount,contactName:'CODEX second',idempotencyKey:'second'});assert.equal(second.status,200,JSON.stringify(second.body));
 const input={contactPublicId:ids.contact,role:'구매 담당자',isPrimary:true,idempotencyKey:'one'};
 const one=await call('POST',url,input);assert.equal(one.status,200,JSON.stringify(one.body));assert.equal(one.body.isPrimary,true);assert.equal((await call('POST',url,input)).body.public_id,one.body.public_id);
 const two=await call('POST',url,{contactPublicId:second.body.public_id,role:'',isPrimary:true,idempotencyKey:'two'});assert.equal(two.status,200);
 const rows=(await call('GET',url)).body.items;assert.equal(rows.filter(x=>x.isPrimary).length,1);assert.equal(rows.find(x=>x.public_id===one.body.public_id).version,2);
 assert.equal((await call('PATCH',`${url}/${one.body.public_id}`,{role:'대표원장',isPrimary:false,expectedVersion:1,idempotencyKey:'stale'})).status,409);
 const edited=await call('PATCH',`${url}/${one.body.public_id}`,{role:'대표원장',isPrimary:false,expectedVersion:2,idempotencyKey:'edit'});assert.equal(edited.status,200);
 assert.equal((await call('DELETE',`${url}/${one.body.public_id}`,{expectedVersion:3,idempotencyKey:'delete'})).status,200);
 assert.equal((await call('GET',url)).body.items.length,1);assert.equal((await call('GET',`/api/opportunities/${opp.public_id}`)).body.version,opp.version);assert.equal((await call('GET',`/api/contacts/${ids.contact}`)).status,200);
});
test('contact roles reject foreign account, duplicate, invalid choice, viewer and revoked reads',async()=>{
 const {app,call,url}=await setup();const viewer=await client(app,'hq-viewer');const foreign=await call('POST','/api/contacts',{accountPublicId:ids.otherOwnerAccount,contactName:'foreign',idempotencyKey:'foreign'});
 const input={contactPublicId:ids.contact,role:'',isPrimary:false,idempotencyKey:'create'};
 assert.equal((await call('POST',url,{...input,contactPublicId:foreign.body.public_id})).status,422);
 assert.equal((await call('POST',url,{...input,role:'unknown'})).status,400);
 assert.equal((await call('POST',url,{...input,isPrimary:'true'})).status,400);
 assert.equal((await call('POST',url,{...input,isPrimary:null})).status,400);
 assert.equal((await call('POST',url,{...input,role:null})).status,400);
 assert.equal((await viewer('POST',url,input)).status,403);
 assert.equal((await call('POST',url,input)).status,200);
 assert.equal((await call('POST',url,{...input,idempotencyKey:'duplicate'})).status,409);
 const actor=app.personas.find(p=>p.loginId==='hq-admin');actor.permissions=actor.permissions.filter(p=>p!=='CONTACT.READ');
 assert.equal((await call('GET',url)).status,403);assert.equal((await call('POST',url,input)).status,403);
});


test('contact names are projected on reads and idempotent replay; deleted contact role can be cleaned up',async()=>{
 const {app,call,url}=await setup();const input={contactPublicId:ids.contact,role:'대표원장',isPrimary:false,idempotencyKey:'mask'};const created=await call('POST',url,input);assert.equal(created.status,200);
 const standard=structuredClone(app.standard);const field=standard.fields.find(f=>f.fieldKey==='contact.contactName');field.masking='redact';delete field.unmaskPermission;const restricted=createHqApplication({standard,repositoryFactory:()=>app.repository('HQ_DEMO')});const read=await client(restricted);
 const list=await read('GET',url);assert.equal(list.status,200);assert.notEqual(list.body.items[0].contactName,created.body.contactName);assert.equal((await read('POST',url,input)).body.contactName,list.body.items[0].contactName);
 const person=(await call('GET',`/api/contacts/${ids.contact}`)).body;assert.equal((await call('DELETE',`/api/contacts/${ids.contact}`,{expectedVersion:person.version,idempotencyKey:'delete-contact'})).status,200);
 const after=(await call('GET',url)).body.items[0];assert.equal(after.contactAvailable,false);assert.equal(after.contactName,null);
 assert.equal((await call('PATCH',`${url}/${after.public_id}`,{role:'구매 담당자',isPrimary:false,expectedVersion:after.version,idempotencyKey:'missing-person'})).status,404);
 assert.equal((await call('DELETE',`${url}/${after.public_id}`,{expectedVersion:after.version,idempotencyKey:'cleanup'})).status,200);
});
