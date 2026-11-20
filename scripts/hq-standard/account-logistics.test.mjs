import test from 'node:test';
import assert from 'node:assert/strict';
import {createHqApplication} from './runtime.mjs';
import {startHqServer} from './server.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const {seedIDs:ids}=await import('../../backend/src/hq-mock/seed.ts');
async function client(app,loginId='hq-admin'){const s=await app.handle({method:'POST',path:'/api/hq/session',body:{loginId,password:'HQ-DEMO',datasetId:'HQ_DEMO'}});return(method,path,body)=>app.handle({method,path,body,token:s.body.accessToken});}
for(const kind of ['destinations','rentals'])test(`${kind}: CRUD, validation, isolation, conflicts and idempotency`,async()=>{
 const app=createHqApplication(),admin=await client(app),viewer=await client(app,'hq-viewer'),path=`/api/accounts/${ids.approvedAccount}/${kind}`;
 const input=kind==='destinations'?{name:'CODEX 배송지',address:'테스트로 1',recipient:'테스트',phone:'010-0000-0000',postalCode:'12345',detailAddress:'2층',note:'문 앞'}:{name:'CODEX 장비',serialNumber:'TEST001',installedOn:'2026-11-01',endsOn:'2027-11-01',ended:false,note:'테스트'};
 const created=await admin('POST',path,{...input,idempotencyKey:'create'});assert.equal(created.status,200,JSON.stringify(created.body));
 assert.equal((await admin('POST',path,{...input,idempotencyKey:'create'})).body.public_id,created.body.public_id);
 assert.equal((await admin('POST',path,{...input,name:'different',idempotencyKey:'create'})).status,409);
 assert.equal((await viewer('POST',path,{...input,idempotencyKey:'denied'})).status,403);
 assert.equal((await admin('GET',`/api/accounts/${ids.otherCompanyAccount}/${kind}`)).status,404);
 assert.equal((await admin('POST',path,{...input,name:'',idempotencyKey:'empty'})).status,400);
 if(kind==='rentals')for(const extra of [{endsOn:'2020-01-01'},{installedOn:'2026-02-30'},{ended:'false'}])assert.equal((await admin('POST',path,{...input,...extra,idempotencyKey:JSON.stringify(extra)})).status,400);
 const url=`${path}/item/${created.body.public_id}`;
 const edited=await admin('PATCH',url,{...input,name:'수정 완료',expectedVersion:1});assert.equal(edited.status,200);assert.equal(edited.body.version,2);
 assert.equal((await admin('PATCH',url,{...input,expectedVersion:1})).status,409);
 assert.equal((await admin('GET',path)).body.items[0].name,'수정 완료');
 assert.equal((await admin('DELETE',url,{expectedVersion:1})).status,409);
 assert.equal((await admin('DELETE',url,{expectedVersion:2})).status,200);
 assert.deepEqual((await admin('GET',path)).body.items,[]);
});
test('file-backed storage survives restart, edits and deletions',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'dio-logistics-'));
 let server;
 try{
  server=await startHqServer({port:0,storageDir:dir});let admin=await client(server.app);
  const base=`/api/accounts/${ids.approvedAccount}`;
  const destination=await admin('POST',`${base}/destinations`,{name:'persist address',address:'test',idempotencyKey:'persist-d'});
  const rental=await admin('POST',`${base}/rentals`,{name:'persist rental',idempotencyKey:'persist-r'});
  assert.equal(destination.status,200);assert.equal(rental.status,200);
  await server.close();server=await startHqServer({port:0,storageDir:dir});admin=await client(server.app);
  assert.equal((await admin('GET',`${base}/destinations`)).body.items[0].name,'persist address');
  assert.equal((await admin('GET',`${base}/rentals`)).body.items[0].name,'persist rental');
  assert.equal((await admin('PATCH',`${base}/destinations/item/${destination.body.public_id}`,{name:'edited persistent',address:'new address',expectedVersion:1})).status,200);
  assert.equal((await admin('DELETE',`${base}/rentals/item/${rental.body.public_id}`,{expectedVersion:1})).status,200);
  await server.close();server=await startHqServer({port:0,storageDir:dir});admin=await client(server.app);
  assert.equal((await admin('GET',`${base}/destinations`)).body.items[0].address,'new address');
  assert.deepEqual((await admin('GET',`${base}/rentals`)).body.items,[]);
 }finally{await server?.close();await rm(dir,{recursive:true,force:true});}
});
test('related records prevent unsafe merge and READ sharing cannot write',async()=>{
 for(const kind of ['destinations','rentals']){
  const app=createHqApplication(),admin=await client(app),sales=await client(app,'hq-sales');
  const primary=(await admin('POST','/api/accounts',{accountName:'CODEX primary',idempotencyKey:'p'})).body;
  const source=(await admin('POST','/api/accounts',{accountName:'CODEX source',idempotencyKey:'s'})).body;
  const body={name:'CODEX related',...(kind==='destinations'?{address:'test'}:{})};
  assert.equal((await admin('POST',`/api/accounts/${source.public_id}/${kind}`,{...body,idempotencyKey:'c'})).status,200);
  const merge=await admin('POST','/api/accounts/merge',{primaryPublicId:primary.public_id,duplicatePublicIds:[source.public_id],expectedVersions:{[primary.public_id]:1,[source.public_id]:1},idempotencyKey:'m'});
  assert.equal(merge.body.error,'MERGE_RELATED_DATA_POLICY_REQUIRED');
  const person=app.personas.find(p=>p.loginId==='hq-sales');
  const base=`/api/accounts/${ids.otherOwnerAccount}`;
  const share=await admin('POST',`${base}/shares`,{userId:person.userId,access:'READ',idempotencyKey:'read'});assert.equal(share.status,200);
  assert.equal((await sales('GET',`${base}/${kind}`)).status,200);
  assert.equal((await sales('POST',`${base}/${kind}`,{...body,idempotencyKey:'blocked'})).status,403);
 }
});
