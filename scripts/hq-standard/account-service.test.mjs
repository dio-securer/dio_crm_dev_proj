import test from 'node:test';
import assert from 'node:assert/strict';
import {createHqApplication} from './runtime.mjs';
const {seedIDs:ids}=await import('../../backend/src/hq-mock/seed.ts');
async function client(app,loginId='hq-admin'){const s=await app.handle({method:'POST',path:'/api/hq/session',body:{loginId,password:'HQ-DEMO',datasetId:'HQ_DEMO'}});return(method,path,body)=>app.handle({method,path,body,token:s.body.accessToken});}
test('account customer-center CRUD persists properties and protects version, permissions and contact membership',async()=>{
 const app=createHqApplication(),admin=await client(app),viewer=await client(app,'hq-viewer');const path=`/api/accounts/${ids.approvedAccount}/services`;
 const input={subject:'CODEX customer center',content:'문의 내용',answer:'답변',internalNote:'내부 비고',status:'신규등록',origin:'Community',priority:'Medium',type:'C/S 문의',contactPublicId:ids.contact,idempotencyKey:'case-create'};
 const create=await admin('POST',path,input);assert.equal(create.status,200,JSON.stringify(create.body));assert.equal(create.body.version,1);
 const edit=await admin('PATCH',`${path}/${create.body.public_id}`,{...input,status:'확인 중',expectedVersion:1,idempotencyKey:'case-edit'});assert.equal(edit.status,200);assert.equal(edit.body.status,'확인 중');
 assert.equal((await admin('GET',path)).body.items[0].internalNote,'내부 비고');
 assert.equal((await admin('PATCH',`${path}/${create.body.public_id}`,{...input,expectedVersion:1})).status,409);
 assert.equal((await viewer('POST',path,input)).status,403);
 assert.equal((await admin('POST',path,{...input,contactPublicId:'00000000-0000-4000-8000-000000000000',idempotencyKey:'foreign-contact'})).status,400);
 const complete=await admin('PATCH',`${path}/${create.body.public_id}`,{...input,status:'답변완료',expectedVersion:2});assert.equal(complete.status,200);assert.ok(complete.body.end_at);
 assert.equal((await admin('DELETE',`${path}/${create.body.public_id}`,{expectedVersion:3})).status,200);
 assert.deepEqual((await admin('GET',path)).body.items,[]);
 assert.equal((await admin('GET',`/api/accounts/${ids.otherCompanyAccount}/services`)).status,404);
});
test('customer-center contact options respect masked contact name fields',async()=>{
 const source=createHqApplication(),standard=structuredClone(source.standard);
 const field=standard.fields.find(field=>field.entity==='contact'&&field.current.dbField==='contact_name');field.masking='redact';field.unmaskPermission='TEST.UNMASK';
 const app=createHqApplication({standard}),admin=await client(app);
 const result=await admin('GET',`/api/accounts/${ids.approvedAccount}/services`);
 assert.equal(result.status,200);assert.ok(result.body.contacts.length);
 assert.equal(result.body.contacts[0].name,'••••');
});
test('account-only sharing does not grant customer-center access',async()=>{
 const app=createHqApplication(),admin=await client(app),sales=await client(app,'hq-sales');
 const parent=`/api/accounts/${ids.otherOwnerAccount}`;
 const created=await admin('POST',`${parent}/services`,{subject:'PRIVATE CASE SUBJECT',idempotencyKey:'private-case'});assert.equal(created.status,200);
 await admin('PATCH',`${parent}/services/${created.body.public_id}`,{subject:'PRIVATE CASE EDIT',content:'PRIVATE CASE CONTENT',expectedVersion:1});
 assert.equal((await admin('POST',`${parent}/shares`,{userId:1,access:'EDIT',idempotencyKey:'account-only'})).status,200);
 assert.equal((await sales('GET',parent)).status,200);
 assert.equal((await sales('GET',`${parent}/services`)).status,403);
 assert.equal((await sales('POST',`${parent}/services`,{subject:'not allowed',idempotencyKey:'no-case'})).status,403);
 assert.equal(JSON.stringify((await sales('GET',`${parent}/customer-detail`)).body).includes('PRIVATE CASE'),false);
});
