import test from 'node:test';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';
test('isolated lead timeline creates, edits and deletes each type with version protection', async t => {
 const s=await startHqServer({port:0,storageDir:false,autoAdvance:false});t.after(()=>s.close());
 const session=await fetch(s.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:'hq-admin',password:'HQ-DEMO'})}).then(r=>r.json());
 const call=async(method,path,body)=>{const r=await fetch(s.url+path,{method,headers:{'content-type':'application/json',authorization:`Bearer ${session.accessToken}`},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()}};
 const lead=(await call('POST','/api/leads',{hospitalName:'시험',idempotencyKey:'create'})).body;
 assert.ok(lead.owner_name && !/^\d+$/.test(lead.owner_name),'new lead has a human-readable owner');
 const base=`/api/leads/${lead.public_id}/timeline`;
 const deniedSession=await fetch(s.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:'hq-viewer',password:'HQ-DEMO'})}).then(r=>r.json());
 const denied=await fetch(s.url+base,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${deniedSession.accessToken}`},body:JSON.stringify({kind:'TASK',subject:'차단',idempotencyKey:'readonly'})});
 assert.equal(denied.status,403);
 for(const kind of ['TASK','CALL','EVENT']){
  const created=await call('POST',base,{kind,subject:kind+' 시험',note:'처음',dueDate:'2026-11-20',status:'PLANNED',priority:'HIGH',idempotencyKey:'create-'+kind});assert.equal(created.status,200);
  const item=created.body.item;assert.equal(item.dueDate,'2026-11-20');assert.equal(item.priority,'HIGH');assert.equal(item.status,'PLANNED');
  assert.equal((await call('GET',`/api/leads/${lead.public_id}`)).body.version,lead.version,'timeline does not conflict with independent lead edits');
  assert.equal(Object.hasOwn((await call('GET',`/api/leads/${lead.public_id}`)).body,'mock_timeline'),false);
  const edited=await call('PATCH',base+'/'+item.public_id,{subject:kind+' 수정',note:'수정',expectedVersion:item.version,idempotencyKey:'edit-'+kind});assert.equal(edited.status,200);
  assert.equal((await call('PATCH',base+'/'+item.public_id,{subject:'오래된 값',expectedVersion:item.version,idempotencyKey:'stale-'+kind})).status,409);
  assert.equal((await call('DELETE',base+'/'+item.public_id,{expectedVersion:edited.body.item.version,idempotencyKey:'delete-'+kind})).status,200);
 }
 assert.deepEqual((await call('GET',base)).body.items,[]);
 const edit=await call('PATCH',`/api/leads/${lead.public_id}`,{hospitalName:'새 이름',expectedVersion:lead.version,idempotencyKey:'independent-edit'});assert.equal(edit.status,200);
 const stale=await call('PATCH',`/api/leads/${lead.public_id}`,{hospitalName:'오래된 이름',expectedVersion:lead.version,idempotencyKey:'stale-edit'});assert.equal(stale.status,409,'genuine concurrent lead edit still conflicts');
});
