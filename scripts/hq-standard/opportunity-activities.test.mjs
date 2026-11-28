import test from 'node:test';
import assert from 'node:assert/strict';
import {createHqApplication} from './runtime.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
async function setup(){
 const app=createHqApplication();
 const login=async id=>{const r=await app.handle({method:'POST',path:'/api/hq/session',body:{loginId:id,password:'HQ-DEMO',datasetId:'HQ_DEMO'}});return(method,path,body)=>app.handle({method,path,body,token:r.body.accessToken});};
 const call=await login('hq-sales'),viewer=await login('hq-viewer');
 const opp=await call('POST','/api/opportunities',{accountPublicId:seedIDs.approvedAccount,opportunityName:'CODEX ACTIVITY',expectedCloseDate:'2026-12-20'});
 return {app,call,viewer,opp:opp.body,path:`/api/opportunities/${opp.body.public_id}/timeline`};
}
test('task call and event create/edit/delete retain parent version and independent audit',async()=>{
 const {app,call,path,opp}=await setup();
 for(const kind of ['TASK','CALL','EVENT']){
  const input={kind,subject:`${kind} test`,note:'synthetic note',dueDate:'2026-12-20',status:'PLANNED',priority:'HIGH',ownerUserId:1,...(kind==='EVENT'?{startAt:'2026-12-20T09:00',endAt:'2026-12-20T10:00',location:'테스트 장소'}:{})};
  const created=await call('POST',path,{...input,idempotencyKey:`create-${kind}`});assert.equal(created.status,200,JSON.stringify(created.body));
  const replay=await call('POST',path,{...input,idempotencyKey:`create-${kind}`});assert.equal(replay.body.item.public_id,created.body.item.public_id);
  const itemUrl=`${path}/${created.body.item.public_id}`;
  const edited=await call('PATCH',itemUrl,{subject:'수정',status:'COMPLETED',priority:'LOW',expectedVersion:1,idempotencyKey:`edit-${kind}`});assert.equal(edited.status,200,JSON.stringify(edited.body));assert.equal(edited.body.item.version,2);
  assert.equal((await call('PATCH',itemUrl,{subject:'stale',expectedVersion:1})).status,409);
  assert.equal((await call('DELETE',itemUrl,{expectedVersion:2,idempotencyKey:`delete-${kind}`})).status,200);
  assert.equal((await call('DELETE',itemUrl,{expectedVersion:2,idempotencyKey:`delete-${kind}`})).status,200);
 }
 assert.deepEqual((await call('GET',path)).body.items,[]);
 const row=app.repository('HQ_DEMO').read().collections.opportunities.find(x=>x.public_id===opp.public_id);
 assert.equal(row.version,opp.version);assert.equal(row.mock_timeline.length,3);assert.ok(row.mock_timeline.every(x=>x.deleted));
 assert.ok(app.repository('HQ_DEMO').read().collections.auditLogs.some(x=>x.action==='OPPORTUNITY_ACTIVITY_DELETE'));
});
test('activity validation is atomic; event range, impossible date and foreign owner are rejected',async()=>{
 const {app,call,path}=await setup();
 for(const bad of [{kind:'INVALID'},{dueDate:'2026-02-30'},{status:'UNKNOWN'},{priority:'URGENT'},{note:7},{ownerUserId:99},{kind:'EVENT',startAt:'2026-12-20T10:00',endAt:'2026-12-20T09:00'},{kind:'EVENT',startAt:'2026-02-30T09:00',endAt:'2026-03-01T10:00'}]){
  const before=app.repository('HQ_DEMO').read();const r=await call('POST',path,{kind:'TASK',subject:'validation',...bad});assert.ok([400,403].includes(r.status),JSON.stringify(r));assert.deepEqual(app.repository('HQ_DEMO').read(),before);
 }
});
test('activity endpoints enforce parent visibility, current write permissions and idempotency content',async()=>{
 const {app,call,viewer,path,opp}=await setup();
 const body={kind:'TASK',subject:'test',idempotencyKey:'protected'};
 const created=await call('POST',path,body);assert.equal(created.status,200);
 assert.equal((await viewer('POST',path,body)).status,403);
 assert.equal((await viewer('PATCH',`${path}/${created.body.item.public_id}`,{subject:'no',expectedVersion:1})).status,403);
 assert.equal((await viewer('DELETE',`${path}/${created.body.item.public_id}`,{expectedVersion:1})).status,403);
 assert.equal((await call('POST',path,{...body,subject:'different'})).status,409);
 const sales=app.personas.find(x=>x.userId===1);sales.permissions=sales.permissions.filter(x=>x!=='ACTIVITY.WRITE');
 assert.equal((await call('POST',path,body)).status,403);
 app.repository('HQ_DEMO').transact(d=>{d.collections.opportunities.find(x=>x.public_id===opp.public_id).deleted=true;});
 assert.equal((await call('GET',path)).status,404);
});
test('disabled activity screen blocks reads, writes and committed replay',async()=>{
 const {app,call,path}=await setup();const body={kind:'TASK',subject:'screen',idempotencyKey:'screen'};
 assert.equal((await call('POST',path,body)).status,200);
 app.standard.screens.find(x=>x.screenKey==='HQ_ACTIVITY').enabled=false;
 const before=app.repository('HQ_DEMO').read();
 assert.equal((await call('GET',path)).status,403);
 assert.equal((await call('POST',path,body)).status,403);
 assert.equal((await call('POST',path,{kind:'TASK',subject:'new'})).status,403);
 assert.deepEqual(app.repository('HQ_DEMO').read(),before);
});
