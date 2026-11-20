import test from 'node:test';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';
test('additional history records only changed values before and after', async t => {
 const s=await startHqServer({port:0,storageDir:false,autoAdvance:false});t.after(()=>s.close());
 const session=await fetch(s.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:'hq-admin',password:'HQ-DEMO'})}).then(r=>r.json());
 const call=async(method,path,body)=>{const r=await fetch(s.url+path,{method,headers:{'content-type':'application/json',authorization:`Bearer ${session.accessToken}`},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()}};
 const lead=(await call('POST','/api/leads',{hospitalName:'시험',idempotencyKey:'create'})).body;
 const path=`/api/leads/${lead.public_id}`;
 const first=await call('PATCH',path+'/additional',{values:{interestProducts:'A',staffCount:3},expectedVersion:lead.version,idempotencyKey:'one'});
 const second=await call('PATCH',path+'/additional',{values:{interestProducts:'B',staffCount:3},expectedVersion:first.body.version,idempotencyKey:'two'});
 assert.equal(second.status,200);
 const history=(await call('GET',path+'/history')).body;
 const last=history.filter(x=>x.action==='LEAD.additional').at(-1);
 assert.deepEqual(last.additional_changes,{interestProducts:{before:'A',after:'B'}});
});
