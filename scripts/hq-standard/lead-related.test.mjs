import test from 'node:test';
import assert from 'node:assert/strict';
import {startHqServer} from './server.mjs';
test('lead related records require permission, survive reads and deduplicate retries', async t => {
 const s=await startHqServer({port:0,storageDir:false,autoAdvance:false});t.after(()=>s.close());
 async function client(loginId){const session=await fetch(s.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId,password:'HQ-DEMO'})}).then(r=>r.json());return async(method,url,body)=>{const r=await fetch(s.url+url,{method,headers:{'content-type':'application/json',authorization:`Bearer ${session.accessToken}`},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};}
 const a=await client('hq-admin'), reader=await client('hq-readonly');const lead=(await a('POST','/api/leads',{hospitalName:'테스트',businessNo:'TEST-123',idempotencyKey:'new'})).body;const base=`/api/leads/${lead.public_id}`;
 let result=await a('POST',base+'/related',{kind:'campaign',name:'시험 캠페인',idempotencyKey:'c1'});assert.equal(result.status,200,JSON.stringify(result.body));assert.equal((await a('POST',base+'/related',{kind:'campaign',name:'시험 캠페인',idempotencyKey:'c1'})).status,200);
 assert.equal((await a('POST',base+'/related',{kind:'coordinate',name:'주소 확인',latitude:35.1,longitude:129.1,idempotencyKey:'p1'})).status,200);
 result=await a('GET',base+'/related');assert.equal(result.body.campaigns.length,1);assert.equal(result.body.coordinates.length,1);
 assert.notEqual((await reader('POST',base+'/related',{kind:'campaign',name:'차단',idempotencyKey:'bad'})).status,200);
 assert.equal((await a('POST',base+'/related',{kind:'coordinate',name:'잘못된 좌표',latitude:1000,longitude:0,idempotencyKey:'bad2'})).status,400);
});

test('additional lead attributes enforce type, permissions and versions', async t => {
 const s=await startHqServer({port:0,storageDir:false,autoAdvance:false});t.after(()=>s.close());const session=await fetch(s.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:'hq-admin',password:'HQ-DEMO'})}).then(r=>r.json());
 async function call(method,url,body){const r=await fetch(s.url+url,{method,headers:{'content-type':'application/json',authorization:`Bearer ${session.accessToken}`},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()}}
 const lead=(await call('POST','/api/leads',{hospitalName:'시험',idempotencyKey:'create'})).body;const url=`/api/leads/${lead.public_id}/additional`;
 const saved=await call('PATCH',url,{values:{staffCount:4,ctOwned:true,leadSource:'심평원'},expectedVersion:lead.version,idempotencyKey:'save'});assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal((await call('GET',url)).body.values.staffCount,4);
 assert.equal((await call('PATCH',url,{values:{staffCount:-1},expectedVersion:saved.body.version,idempotencyKey:'bad'})).status,400);
 assert.equal((await call('PATCH',url,{values:{staffCount:7},expectedVersion:lead.version,idempotencyKey:'stale'})).status,409);
});
