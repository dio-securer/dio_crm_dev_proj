import test from 'node:test';
import assert from 'node:assert/strict';
import {startHqServer} from '../hq-standard/server.mjs';

test('HQ mock records detail reason edits and keeps excluded reason nonblank',async t=>{
 const s=await startHqServer({port:0,storageDir:false,autoAdvance:false});t.after(()=>s.close());
 const session=await fetch(s.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:'hq-admin',password:'HQ-DEMO'})}).then(r=>r.json());
 const call=async(method,path,body)=>{const r=await fetch(s.url+path,{method,headers:{'content-type':'application/json',authorization:`Bearer ${session.accessToken}`},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};};
 let result=await call('POST','/api/leads',{hospitalName:'Audit clinic',idempotencyKey:'create'});assert.equal(result.status,200);let lead=result.body;
 result=await call('POST',`/api/leads/${lead.public_id}/status`,{toStatus:'CONTACT_EXCLUDED',reason:'before',expectedVersion:lead.version,idempotencyKey:'status'});assert.equal(result.status,200);lead=result.body;
 const payload={contactExcludeReason:'after',expectedVersion:lead.version,idempotencyKey:'reason'};
 result=await call('PATCH',`/api/leads/${lead.public_id}`,payload);assert.equal(result.status,200);const updated=result.body;
 const replay=await call('PATCH',`/api/leads/${lead.public_id}`,payload);assert.deepEqual(replay.body,updated);
 let history=(await call('GET',`/api/leads/${lead.public_id}/history`)).body;
 const changes=history.filter(row=>row.action==='LEAD.save'&&row.changes?.contact_exclude_reason);
 assert.equal(changes.length,1);assert.deepEqual(changes[0].changes.contact_exclude_reason,{before:'before',after:'after'});
 result=await call('PATCH',`/api/leads/${lead.public_id}`,{contactExcludeReason:'  ',expectedVersion:updated.version,idempotencyKey:'blank'});assert.equal(result.status,400);assert.equal(result.body.error,'EXCLUSION_REASON_REQUIRED');
 result=await call('PATCH',`/api/leads/${lead.public_id}`,{contactExcludeReason:'x'.repeat(501),expectedVersion:updated.version,idempotencyKey:'long'});assert.equal(result.status,400);
 result=await call('PATCH',`/api/leads/${lead.public_id}`,{contactExcludeReason:'after',expectedVersion:updated.version,idempotencyKey:'same'});assert.equal(result.status,200);assert.equal(result.body.version,updated.version);
 history=(await call('GET',`/api/leads/${lead.public_id}/history`)).body;assert.equal(history.filter(row=>row.action==='LEAD.save'&&row.changes?.contact_exclude_reason).length,1);
});
