import test from 'node:test';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');

test('initial test plan preserves zero and negative rows when the total matches', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
  t.after(() => server.close());
  const login = await fetch(server.url + '/api/hq/session', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({loginId:'hq-sales',password:'HQ-DEMO'})});
  const {accessToken} = await login.json();
  const request = async (method,path,body) => {
    const response = await fetch(server.url + path, {method,headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},...(body === undefined ? {} : {body:JSON.stringify(body)})});
    return {status:response.status, body:await response.json()};
  };
  const path = `/api/contracts/${seedIDs.pendingContract}`;
  const version = (await request('GET',path)).body.version;
  const rows = [-1,0,1000001].map((amount,index)=>({installmentNo:index+1,collectionMethod:'현금할부',amount,plannedDate:'2026-12-31'}));
  const saved = await request('POST',`${path}/collection-plans`,{rows,expectedVersion:version});
  assert.equal(saved.status,200,JSON.stringify(saved.body));
  const loaded = await request('GET',`${path}/collection-plans`);
  assert.deepEqual(loaded.body.filter(row=>row.is_current).map(row=>row.amount),[-1,0,1000001]);
});

test('deleting an initial plan archives it without changing other rows; stale and forbidden deletes do not mutate', async t => {
 const {HqRepository}=await import('./runtime.mjs'); let repo;
 const factory=id=>{const r=new HqRepository({datasetId:id}); if(id==='HQ_DEMO')repo=r; return r;};
 const s=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{repositoryFactory:factory}}); t.after(()=>s.close());
 async function client(loginId){const r=await fetch(s.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId,password:'HQ-DEMO'})}); const {accessToken}=await r.json(); return async (method,path,body)=>{const x=await fetch(s.url+path,{method,headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:x.status,body:await x.json()};};}
 const sales=await client('hq-sales'),viewer=await client('hq-viewer'),base=`/api/contracts/${seedIDs.pendingContract}`;
 const version=(await sales('GET',base)).body.version;
 const result=await sales('POST',`${base}/collection-plans`,{expectedVersion:version,rows:[{installmentNo:1,collectionMethod:'현금할부',amount:500000,plannedDate:'2026-12-01'},{installmentNo:2,collectionMethod:'기타',amount:500000,plannedDate:'2026-12-02'}]});assert.equal(result.status,200);
 const [first,second]=result.body; const before=repo.read();
 assert.equal((await viewer('DELETE',`${base}/collection-plans/${first.public_id}`,{expectedVersion:version+1})).status,403);assert.deepEqual(repo.read(),before);
 assert.equal((await sales('DELETE',`${base}/collection-plans/${first.public_id}`,{expectedVersion:version})).status,409);assert.deepEqual(repo.read(),before);
 const removed=await sales('DELETE',`${base}/collection-plans/${first.public_id}`,{expectedVersion:version+1});assert.equal(removed.status,200,JSON.stringify(removed.body));
 const saved=repo.read().collections.plans;assert.equal(saved.find(x=>x.public_id===first.public_id).deleted_yn,true);assert.equal(saved.find(x=>x.public_id===first.public_id).is_current,false);assert.equal(saved.find(x=>x.public_id===second.public_id).amount,500000);
 const rec=await sales('GET',`${base}/reconciliation`);assert.equal(rec.body.currentPlanTotal,500000);assert.equal(rec.body.correctionRequired,true);
});

test('editing an existing initial plan keeps its identity and stored extra fields', async t => {
  const server = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
  t.after(() => server.close());
  const login = await fetch(server.url + '/api/hq/session', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:'hq-sales',password:'HQ-DEMO'})});
  const {accessToken} = await login.json();
  const request = async (method,path,body) => {const r=await fetch(server.url+path,{method,headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};};
  const path=`/api/contracts/${seedIDs.pendingContract}`;
  const before=await request('GET',`${path}/collection-plans`);
  const existing=before.body.find(row=>row.is_current);
  assert.ok(existing);
  const version=(await request('GET',path)).body.version;
  const saved=await request('POST',`${path}/collection-plans`,{expectedVersion:version,rows:[{publicId:existing.public_id,installmentNo:1,collectionMethod:'CMS자동이체',amount:1000000,plannedDate:'2026-12-31'}]});
  assert.equal(saved.status,200,JSON.stringify(saved.body));
  const after=(await request('GET',`${path}/collection-plans`)).body.find(row=>row.is_current);
  assert.equal(after.public_id,existing.public_id);
  assert.equal(after.version,existing.version+1);
  assert.equal(after.collection_method,'CMS자동이체');
  assert.equal(after.planned_date,'2026-12-31');
  const bad=await request('POST',`${path}/collection-plans`,{expectedVersion:version+1,rows:[{publicId:seedIDs.approvedContract,installmentNo:1,collectionMethod:'기타',amount:1000000,plannedDate:'2026-12-31'}]});
  assert.equal(bad.status,400);
  assert.equal((await request('GET',`${path}/collection-plans`)).body.find(row=>row.is_current).public_id,existing.public_id);
});
