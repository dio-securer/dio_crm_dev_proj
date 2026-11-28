import test from 'node:test';
import assert from 'node:assert/strict';
import {createHqApplication} from './runtime.mjs';
const {seedIDs:ids}=await import('../../backend/src/hq-mock/seed.ts');
async function client(app,loginId='hq-admin') {
 const login=await app.handle({method:'POST',path:'/api/hq/session',body:{loginId,password:'HQ-DEMO',datasetId:'HQ_DEMO'}});
 return (method,path,body)=>app.handle({method,path,body,token:login.body.accessToken});
}
test('isolated account files upload/download/version/delete with scope and content boundaries',async()=>{
 const app=createHqApplication(),request=await client(app),viewer=await client(app,'hq-viewer');
 const path=`/api/accounts/${ids.approvedAccount}/files`;
 const input={name:'test.txt',contentType:'text/plain',base64:Buffer.from('CODEX attachment test').toString('base64'),idempotencyKey:'file-1'};
 const created=await request('POST',path,input);assert.equal(created.status,200,JSON.stringify(created.body));
 const replay=await request('POST',path,input);assert.equal(replay.body.public_id,created.body.public_id);
 assert.equal((await request('POST',path,{...input,name:'changed.txt'})).status,409);
 assert.equal(JSON.stringify((await request('GET',path)).body).includes(input.base64),false);
 assert.equal(JSON.stringify((await request('GET',`/api/accounts/${ids.approvedAccount}`)).body).includes(input.base64),false);
 const filePath=`${path}/${created.body.public_id}`;
 const download=await request('GET',`${filePath}/download`);assert.equal(download.status,200);assert.equal(Buffer.from(download.body).toString(),'CODEX attachment test');
 const renamed=await request('PATCH',filePath,{name:'renamed.txt',expectedVersion:1});assert.equal(renamed.status,200);assert.equal(renamed.body.version,2);
 const version=await request('POST',`${filePath}/version`,{contentType:'text/plain',base64:Buffer.from('VERSION TWO').toString('base64'),changeNote:'테스트 개정',expectedVersion:2,idempotencyKey:'version-2'});assert.equal(version.status,200);assert.equal(version.body.name,'renamed.txt');assert.equal(version.body.version,3);
 assert.equal(Buffer.from((await request('GET',`${filePath}/download`)).body).toString(),'VERSION TWO');
 assert.equal((await request('POST',`${filePath}/version`,{contentType:'text/plain',base64:Buffer.from('STALE').toString('base64'),expectedVersion:2,idempotencyKey:'stale-version'})).status,409);
 assert.equal((await viewer('POST',path,input)).status,403);
 assert.equal((await request('POST',path,{...input,name:'attack.html',contentType:'text/html',idempotencyKey:'bad'})).status,400);
 assert.equal((await request('POST',path,{...input,name:'../test.txt',idempotencyKey:'bad-name'})).status,400);
 assert.equal((await request('POST',path,{...input,name:'fake.pdf',contentType:'application/pdf',idempotencyKey:'fake'})).status,400);
 assert.equal((await request('POST',path,{...input,base64:Buffer.alloc(512*1024+1).toString('base64'),idempotencyKey:'large'})).status,400);
 assert.equal((await request('GET',`/api/accounts/${ids.pendingAccount}/files/${created.body.public_id}/download`)).status,404);
 assert.equal((await request('DELETE',filePath,{expectedVersion:99})).status,409);
 assert.equal((await request('DELETE',filePath,{expectedVersion:3})).status,200);
 assert.equal((await request('GET',`${filePath}/download`)).status,404);
 const history=(await request('GET',`/api/accounts/${ids.approvedAccount}/customer-detail`)).body.timeline;
 assert.ok(history.some(item=>item.action==='ACC.fileUpload'));assert.ok(history.some(item=>item.action==='ACC.fileDelete'));
 assert.equal((await request('GET',`/api/accounts/${ids.otherCompanyAccount}/files`)).status,404);
});
test('merge preserves datasets by rejecting unresolved active attachment, share or case inheritance',async()=>{
 for(const kind of ['files','shares','services']) {
  const app=createHqApplication(),admin=await client(app);
  const primary=(await admin('POST','/api/accounts',{accountName:'Merge primary',idempotencyKey:'merge-p'})).body;
  const source=(await admin('POST','/api/accounts',{accountName:'Merge source',idempotencyKey:'merge-s'})).body;
  const body=kind==='files'?{name:'keep.txt',contentType:'text/plain',base64:Buffer.from('preserve').toString('base64')}:kind==='shares'?{userId:1,access:'READ'}:{subject:'Preserve case'};
  assert.equal((await admin('POST',`/api/accounts/${source.public_id}/${kind}`,{...body,idempotencyKey:'related'})).status,200);
  const before=app.repository('HQ_DEMO').read();
  const result=await admin('POST','/api/accounts/merge',{primaryPublicId:primary.public_id,duplicatePublicIds:[source.public_id],expectedVersions:{[primary.public_id]:1,[source.public_id]:1},idempotencyKey:'protected-merge'});
  assert.equal(result.status,409,kind);assert.equal(result.body.error,'MERGE_RELATED_DATA_POLICY_REQUIRED');
  assert.deepEqual(app.repository('HQ_DEMO').read(),before);
 }
});
test('EDIT sharing permits attachment writes without merge privilege but cannot bypass revoked account/action rights',async()=>{
 const app=createHqApplication(),admin=await client(app),sales=await client(app,'hq-sales');
 const person=app.personas.find(user=>user.loginId==='hq-sales');person.permissions=person.permissions.filter(p=>p!=='ACCOUNT.MERGE');
 const path=`/api/accounts/${ids.otherOwnerAccount}`;
 assert.equal((await admin('POST',`${path}/shares`,{userId:person.userId,access:'EDIT',idempotencyKey:'plain-edit'})).status,200);
 const file={name:'shared.txt',contentType:'text/plain',base64:Buffer.from('shared').toString('base64'),idempotencyKey:'plain-file'};
 assert.equal((await sales('POST',`${path}/files`,file)).status,200);
 person.permissions=person.permissions.filter(p=>p!=='ACCOUNT.WRITE');
 assert.equal((await sales('POST',`${path}/files`,{...file,idempotencyKey:'revoked-file'})).status,403);
 assert.equal((await sales('POST',`${path}/contacts`,{contactName:'blocked',idempotencyKey:'revoked-contact'})).status,403);
 const standard=structuredClone(app.standard);standard.actions.find(action=>action.actionKey==='ACC.save').enabled=false;
 const disabled=createHqApplication({standard}),disabledAdmin=await client(disabled);
 assert.equal((await disabledAdmin('GET',`${path}/shares`)).body.canManage,false);
 assert.notEqual((await disabledAdmin('POST',`${path}/shares`,{userId:person.userId,access:'READ',idempotencyKey:'disabled'})).status,200);
});
test('account sharing grants bounded access and revocation without crossing company or write permissions',async()=>{
 const app=createHqApplication(),admin=await client(app),sales=await client(app,'hq-sales');
 const path=`/api/accounts/${ids.otherOwnerAccount}/shares`;
 assert.equal((await sales('GET',`/api/accounts/${ids.otherOwnerAccount}`)).status,404);
 const options=await admin('GET',path);assert.equal(options.status,200);
 const person=options.body.users.find(user=>user.loginId==='hq-sales');assert.ok(person);
 const readonly=options.body.users.find(user=>!user.canEdit);assert.ok(readonly);
 assert.equal((await admin('POST',path,{userId:readonly.userId,access:'EDIT',idempotencyKey:'escalate'})).status,403);
 assert.equal((await admin('POST',path,{userId:21,access:'READ',idempotencyKey:'foreign'})).status,400);
 const share=await admin('POST',path,{userId:person.userId,access:'READ',teamRole:'담당 영업',idempotencyKey:'share-1'});assert.equal(share.status,200,JSON.stringify(share.body));
 assert.equal((await sales('GET',`/api/accounts/${ids.otherOwnerAccount}`)).status,200);
 assert.equal((await sales('PATCH',`/api/accounts/${ids.otherOwnerAccount}/hospital`,{staffCount:3,expectedVersion:1,idempotencyKey:'no-write'})).status,403);
 assert.equal((await admin('PATCH',`${path}/${share.body.public_id}`,{access:'EDIT',teamRole:'담당 영업',expectedVersion:1})).status,200);
 assert.equal((await sales('PATCH',`/api/accounts/${ids.otherOwnerAccount}/hospital`,{staffCount:3,expectedVersion:1,idempotencyKey:'write'})).status,200);
 assert.equal((await sales('POST',path,{userId:readonly.userId,access:'READ',idempotencyKey:'delegate'})).status,403);
 assert.equal((await admin('DELETE',`${path}/${share.body.public_id}`,{expectedVersion:2})).status,200);
 assert.equal((await sales('GET',`/api/accounts/${ids.otherOwnerAccount}`)).status,404);
});
