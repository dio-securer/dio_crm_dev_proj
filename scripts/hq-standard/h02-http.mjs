import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {startHqServer} from './server.mjs';
const {seedIDs:ids}=await import('../../backend/src/hq-mock/seed.ts');

async function client(runtime,loginId='hq-admin',datasetId='HQ_DEMO') {
  const call = async(method,url,body,token,headers={})=>{
    const response=await fetch(runtime.url+url,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`} : {}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    assert.equal(response.headers.get('x-hq-mock'),'true');
    const value=await response.json();return {status:response.status,value};
  };
  const session=await call('POST','/api/hq/session',{loginId,password:'HQ-DEMO',datasetId});assert.equal(session.status,200);
  const token=session.value.accessToken;
  return {token,call,request:(method,url,body,headers)=>call(method,url,body,token,headers),ok:async(method,url,body,headers)=>{
    const r=await call(method,url,body,token,headers);assert.equal(r.status,200,`${method} ${url}: ${JSON.stringify(r.value)}`);return r.value;
  }};
}
async function memory(t,options={}) {const s=await startHqServer({port:0,storageDir:false,autoAdvance:false,...options});t.after(()=>s.close());return s;}

test('H02 HTTP authentication, real policy, ownership and fail-closed routes',async t=>{
  const s=await memory(t);const admin=await client(s),sales=await client(s,'hq-sales'),viewer=await client(s,'hq-viewer');
  assert.equal((await admin.call('GET','/api/accounts')).status,401);
  assert.equal((await admin.call('POST','/api/hq/session',{loginId:'hq-admin',password:'bad'})).status,401);
  assert.equal((await admin.call('POST','/api/hq/session',{loginId:'hq-sales',password:'HQ-DEMO',permissions:['HQ.RESET']})).status,400);
  assert.equal((await viewer.request('POST','/api/accounts',{accountName:'blocked'})).status,403);
  assert.equal((await sales.request('GET',`/api/leads/${ids.otherOwnerLead}`)).status,404);
  assert.equal((await admin.request('GET',`/api/accounts/${ids.otherCompanyAccount}`)).status,404);
  assert.ok(!(await sales.ok('GET','/api/accounts')).some(r=>r.public_id===ids.otherOwnerAccount));
  assert.equal((await admin.request('POST','/api/hq/actions/validate',{actionKey:'UNREGISTERED'})).status,409);
  assert.equal((await admin.request('POST','/api/real-database/connect',{})).status,404);
  assert.equal((await admin.request('GET','/api/accounts',undefined,{'x-hq-dataset':'HQ_OTHER'})).status,409);
  assert.equal((await admin.request('GET','/api/accounts',undefined,{'x-hq-schema-version':'99'})).status,409);
  const sourceWrite=await admin.request('POST','/api/accounts',{accountName:'blocked',erpApprovedYn:true});
  assert.equal(sourceWrite.status,403);assert.equal(sourceWrite.value.error,'SOURCE_FIELD_READ_ONLY');
  const externalOrigin=await fetch(s.url+'/api/hq/bootstrap',{headers:{origin:'https://outside.invalid'}});assert.equal(externalOrigin.status,403);
  const status=await admin.ok('GET','/api/hq/status');assert.equal(status.mode,'MOCK');assert.equal(status.outboundCalls,0);
});

test('H02 HTTP create/edit/list/detail, persistence restart and dataset-isolated reset',async t=>{
  const dir=mkdtempSync(path.join(tmpdir(),'hq-http-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  let s=await startHqServer({port:0,storageDir:dir,autoAdvance:false});t.after(async()=>{if(s)await s.close();});
  let admin=await client(s);const other=await client(s,'hq-admin','HQ_OTHER'),sales=await client(s,'hq-sales');
  const first=await admin.ok('POST','/api/accounts',{accountName:'HTTP 지속 저장 치과'});
  const edited=await admin.ok('PATCH',`/api/accounts/${first.public_id}`,{accountName:'HTTP 수정 치과',expectedVersion:first.version});
  assert.equal(edited.version,2);
  assert.equal((await admin.ok('GET',`/api/accounts/${first.public_id}`)).account_name,'HTTP 수정 치과');
  assert.equal((await admin.ok('GET','/api/accounts?search='+encodeURIComponent('HTTP 수정'))).length,1);
  assert.equal((await admin.request('PATCH',`/api/accounts/${first.public_id}`,{accountName:'stale',expectedVersion:1})).status,409);
  assert.equal((await other.ok('GET','/api/accounts')).some(r=>r.public_id===first.public_id),false);
  assert.equal((await sales.request('POST','/api/hq/reset/preview',{})).status,403);
  const preview=await admin.ok('POST','/api/hq/reset/preview',{});
  assert.equal((await other.request('POST','/api/hq/reset',{confirmationToken:preview.confirmationToken})).status,409);
  await admin.ok('PATCH',`/api/accounts/${first.public_id}`,{phone:'051-000-9999',expectedVersion:2});
  assert.equal((await admin.request('POST','/api/hq/reset',{confirmationToken:preview.confirmationToken})).value.error,'RESET_PREVIEW_STALE');
  const otherBytes=readFileSync(path.join(dir,'HQ_OTHER.json'),'utf8');
  const oldToken=admin.token;await s.close();s=null;
  s=await startHqServer({port:0,storageDir:dir,autoAdvance:false});admin=await client(s);
  assert.equal((await admin.call('GET','/api/accounts',undefined,oldToken)).status,401);
  assert.equal((await admin.ok('GET',`/api/accounts/${first.public_id}`)).phone,'051-000-9999');
  const latest=await admin.ok('POST','/api/hq/reset/preview',{});assert.ok(latest.counts.accounts>6);
  const reset=await admin.ok('POST','/api/hq/reset',{confirmationToken:latest.confirmationToken});assert.equal(reset.generation,2);
  assert.equal((await admin.ok('GET','/api/hq/session')).dataset.generation,2);
  assert.equal((await admin.request('GET',`/api/accounts/${first.public_id}`)).status,404);
  assert.equal((await admin.ok('GET',`/api/accounts/${ids.pendingAccount}`)).erp_approved_yn,false);
  assert.equal(readFileSync(path.join(dir,'HQ_OTHER.json'),'utf8'),otherBytes);
  assert.equal((await admin.request('POST','/api/hq/reset',{confirmationToken:latest.confirmationToken})).status,409);
});

test('H02 HTTP request/result separation, correlated deduplication, failure retry and stale generation',async t=>{
  const s=await memory(t);const admin=await client(s),sales=await client(s,'hq-sales');
  const input={interfaceCode:'IF-ERP-002',entityType:'ACCOUNT',entityPublicId:ids.pendingAccount,idempotencyKey:'http-account-1',payload:{},scenario:'DELAYED'};
  assert.equal((await sales.request('POST','/api/hq/interfaces/request',input)).status,403);
  const pending=await admin.ok('POST','/api/hq/interfaces/request',input);assert.equal(pending.status,'REQUESTING');
  const account=await admin.ok('GET',`/api/accounts/${ids.pendingAccount}`);assert.equal(account.erp_approved_yn,false);assert.equal(account.integration_status,'REQUESTING');
  assert.equal((await admin.ok('POST','/api/hq/interfaces/request',input)).requestId,pending.requestId);
  assert.equal((await admin.request('POST','/api/hq/interfaces/request',{...input,payload:{accountName:'conflicting'}})).status,409);
  const result={datasetId:'HQ_DEMO',requestId:pending.requestId,resultId:'http-account-result-1',generation:1,interfaceCode:'IF-ERP-003',businessKey:pending.businessKey,success:true,payload:{erpCustomerCode:'MOCK-HTTP-001',approved:true},version:1};
  assert.equal((await admin.request('POST','/api/hq/interfaces/result',{...result,businessKey:{...result.businessKey,entityId:ids.approvedAccount}})).status,409);
  await admin.ok('POST','/api/hq/interfaces/result',result);await admin.ok('POST','/api/hq/interfaces/result',result);
  const approved=await admin.ok('GET',`/api/accounts/${ids.pendingAccount}`);assert.equal(approved.erp_customer_code,'MOCK-HTTP-001');assert.equal(approved.erp_approved_yn,true);
  assert.equal((await admin.ok('GET','/api/interface-logs')).filter(x=>x.idempotencyKey===input.idempotencyKey).length,1);
  assert.equal((await admin.request('POST','/api/hq/interfaces/result',{...result,payload:{erpCustomerCode:'corrupted'}})).status,409);
  const failure=await admin.ok('POST','/api/hq/interfaces/request',{...input,entityPublicId:ids.noCoordinatesAccount,idempotencyKey:'http-fail',scenario:'TRANSIENT_FAILURE'});
  const failed=await admin.ok('POST','/api/hq/interfaces/advance',{requestId:failure.requestId,scenario:'TRANSIENT_FAILURE'});assert.equal(failed.status,'FAILED');
  const retry=await admin.ok('POST','/api/hq/interfaces/retry',{requestId:failure.requestId,idempotencyKey:'http-retry'});assert.equal(retry.retryOf,failure.requestId);
  await admin.ok('POST','/api/hq/interfaces/advance',{requestId:retry.requestId,scenario:'SUCCESS'});
  assert.equal((await admin.ok('GET',`/api/accounts/${ids.noCoordinatesAccount}`)).erp_approved_yn,true);
  const preview=await admin.ok('POST','/api/hq/reset/preview',{});await admin.ok('POST','/api/hq/reset',{confirmationToken:preview.confirmationToken});
  assert.equal((await admin.request('POST','/api/hq/interfaces/result',result)).value.error,'INTERFACE_GENERATION_MISMATCH');
  assert.equal((await admin.ok('GET',`/api/accounts/${ids.pendingAccount}`)).erp_approved_yn,false);
});

test('H02 default adapter progresses after request and external transports are blocked in the dedicated process',async t=>{
  const s=await memory(t,{autoAdvance:true}),admin=await client(s);
  const requested=await admin.ok('POST',`/api/erp-accounts/${ids.pendingAccount}/request`,{});assert.equal(requested.status,'REQUESTING');
  let row;for(let attempt=0;attempt<30;attempt++){row=await admin.ok('GET',`/api/accounts/${ids.pendingAccount}`);if(row.erp_approved_yn)break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(row.erp_approved_yn,true);assert.match(row.erp_customer_code,/^MOCK-/);assert.deepEqual(s.errors,[]);
  const child=spawnSync(process.execPath,['--input-type=module','-e',`import {installHqEgressFence} from './scripts/hq-standard/egress-fence.mjs';import {createRequire} from 'node:module';const r=createRequire(import.meta.url);const f=installHqEgressFence();for(const check of [()=>fetch('https://erp.invalid'),()=>r('node:http').request('http://erp.invalid'),()=>r('node:https').get('https://erp.invalid'),()=>r('node:net').connect(1433,'sql.invalid'),()=>r('node:tls').connect(443,'mail.invalid')]){try{await check();throw new Error('allowed');}catch(e){if(e.message!=='HQ_MOCK_EXTERNAL_EGRESS_BLOCKED')throw e;}}if(f.attemptCount()!==5)throw new Error('incorrect counter');console.log('EGRESS_PROBES_BLOCKED=5');`],{cwd:new URL('../..',import.meta.url),encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);assert.match(child.stdout,/EGRESS_PROBES_BLOCKED=5/);
});

test('H02 B review regressions: generic interface preserves scope, required fields and dataset binding',async t=>{
  const s=await memory(t),admin=await client(s),branch=await client(s,'hq-branch'),other=await client(s,'hq-admin','HQ_OTHER');
  s.app.repository('HQ_DEMO').transact(d=>{d.collections.accounts.find(x=>x.public_id===ids.otherOwnerAccount).organization_id=20;});
  assert.equal((await branch.request('GET',`/api/accounts/${ids.otherOwnerAccount}`)).status,404);
  const request={interfaceCode:'IF-ERP-002',entityType:'ACCOUNT',entityPublicId:ids.otherOwnerAccount,idempotencyKey:'outside-org',payload:{},scenario:'DELAYED'};
  assert.equal((await branch.request('POST','/api/hq/interfaces/request',request)).status,404);
  const log=await admin.ok('POST','/api/hq/interfaces/request',request);
  assert.equal((await branch.ok('GET','/api/interface-logs')).some(x=>x.requestId===log.requestId),false);
  assert.equal((await branch.request('POST','/api/hq/interfaces/advance',{requestId:log.requestId})).status,404);
  const result={datasetId:'HQ_DEMO',requestId:log.requestId,resultId:'b-scope',generation:1,interfaceCode:'IF-ERP-003',businessKey:log.businessKey,success:true,payload:{erpCustomerCode:'MOCK-B'},version:1};
  assert.equal((await branch.request('POST','/api/hq/interfaces/result',result)).status,404);
  await admin.ok('POST','/api/hq/interfaces/advance',{requestId:log.requestId,scenario:'TRANSIENT_FAILURE'});
  assert.equal((await branch.request('POST','/api/hq/interfaces/retry',{requestId:log.requestId,idempotencyKey:'outside-retry'})).status,404);
  const incomplete=await admin.ok('POST','/api/accounts',{accountName:'필수필드 부족',businessNo:'123-45-67890',ceoName:'원장',address:'부산'});
  assert.equal((await admin.request('POST',`/api/erp-accounts/${incomplete.public_id}/request`,{})).status,422);
  assert.equal((await admin.request('POST','/api/hq/interfaces/request',{...request,entityPublicId:incomplete.public_id,idempotencyKey:'missing-fields'})).status,422);
  const same={...request,entityPublicId:ids.pendingAccount,idempotencyKey:'dataset-binding'};
  const a=await admin.ok('POST','/api/hq/interfaces/request',same),b=await other.ok('POST','/api/hq/interfaces/request',same);
  const mixed={...result,requestId:b.requestId,businessKey:b.businessKey,resultId:'dataset-mixed'};
  assert.equal((await other.request('POST','/api/hq/interfaces/result',mixed)).value.error,'INTERFACE_DATASET_MISMATCH');
  assert.equal((await other.ok('GET',`/api/accounts/${ids.pendingAccount}`)).erp_approved_yn,false);
  assert.equal(a.datasetId,'HQ_DEMO');assert.equal(b.datasetId,'HQ_OTHER');
});
