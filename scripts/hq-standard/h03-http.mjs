import test from 'node:test';
import assert from 'node:assert/strict';
import {startHqServer} from './server.mjs';
const {seedIDs:ids}=await import('../../backend/src/hq-mock/seed.ts');
async function client(s,loginId='hq-admin'){
  const session=await fetch(s.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId,password:'HQ-DEMO'})}).then(r=>r.json());
  const call=async(method,url,body,headers={})=>{const r=await fetch(s.url+url,{method,headers:{'content-type':'application/json',authorization:`Bearer ${session.accessToken}`,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(r.headers.get('x-hq-mock'),'true');return {status:r.status,body:await r.json()};};
  return {call,ok:async(...args)=>{const r=await call(...args);assert.equal(r.status,200,`${args[0]} ${args[1]} ${JSON.stringify(r.body)}`);return r.body;}};
}
async function server(t){const s=await startHqServer({port:0,storageDir:false,autoAdvance:false});t.after(()=>s.close());return s;}

test('H03 HTTP HQ01 → HQ02: atomic conversion, correlated ERP approval and shared relation links',async t=>{
  const s=await server(t),a=await client(s);
  let lead=await a.ok('POST','/api/leads',{hospitalName:'H03 HTTP clinic',phone:'051-555-1000',businessNo:'H03-001',keymanName:'H03 keyman',keymanNote:'note',hospitalSize:5,doctorCount:3,chairCount:4,mapExcluded:true,idempotencyKey:'lead-create'});
  assert.equal(lead.status,'NEW');assert.equal(lead.keyman_note,'note');assert.equal(lead.map_excluded_yn,true);
  for(const toStatus of ['FIRST_VISIT','KEYMAN_MEETING'])lead=await a.ok('POST',`/api/leads/${lead.public_id}/status`,{toStatus,expectedVersion:lead.version,idempotencyKey:`stage-${toStatus}`});
  const input={accountMode:'NEW',contactMode:'NEW',opportunityMode:'NEW',contactName:'H03 contact',opportunityName:'H03 opportunity',expectedVersion:lead.version,idempotencyKey:'convert'};
  const before=s.app.repository('HQ_DEMO').read();
  assert.equal((await a.call('POST',`/api/leads/${lead.public_id}/convert`,{...input,simulateFailure:true})).status,503);
  assert.deepEqual(s.app.repository('HQ_DEMO').read(),before);
  const converted=await a.ok('POST',`/api/leads/${lead.public_id}/convert`,input);
  assert.deepEqual(await a.ok('POST',`/api/leads/${lead.public_id}/convert`,input),converted);
  const contact=await a.ok('GET',`/api/contacts/${converted.contactPublicId}`),opportunity=await a.ok('GET',`/api/opportunities/${converted.opportunityPublicId}`);
  assert.equal(contact.account_public_id,converted.accountPublicId);assert.equal(opportunity.account_public_id,converted.accountPublicId);assert.equal(opportunity.win_allowed,false);
  let account=await a.ok('GET',`/api/accounts/${converted.accountPublicId}`);assert.equal(account.contact_count,1);
  account=await a.ok('PATCH',`/api/accounts/${account.public_id}`,{businessName:'H03 business',ceoName:'H03 CEO',address:'Busan',addressLine1:'Busan',addressLine2:'2F',hospitalAddress:'Busan',zipCode:'48058',taxEmail:'h03@example.invalid',encryptedProviderNo:'H03-ENC',providerNo:'H03-P',openDate:'2026-01-01',expectedVersion:account.version});
  const request=await a.ok('POST',`/api/erp-accounts/${account.public_id}/request`,{expectedVersion:account.version,idempotencyKey:'erp-request'},{'x-hq-scenario':'DELAYED'});
  account=await a.ok('GET',`/api/accounts/${account.public_id}`);assert.equal(account.integration_status,'REQUESTING');assert.equal(account.erp_approved_yn,false);
  await a.ok('PATCH',`/api/accounts/${account.public_id}`,{accountName:'CRM changed after request',expectedVersion:account.version});
  await a.ok('POST','/api/hq/interfaces/advance',{requestId:request.requestId,scenario:'SUCCESS'});
  account=await a.ok('GET',`/api/accounts/${account.public_id}`);assert.equal(account.account_name,'CRM changed after request');assert.equal(account.erp_account_name,'H03 HTTP clinic');assert.equal(account.order_allowed,true);
  const approvedOpportunity=await a.ok('GET',`/api/opportunities/${converted.opportunityPublicId}`);assert.equal(approvedOpportunity.erp_customer_code,account.erp_customer_code);assert.equal(approvedOpportunity.win_allowed,true);
  const detail=await a.ok('GET',`/api/accounts/${account.public_id}/customer-detail`);assert.equal(detail.contacts[0].public_id,contact.public_id);assert.equal(detail.opportunities[0].public_id,opportunity.public_id);assert.equal(detail.interfaces[0].requestId,request.requestId);
  assert.equal((await a.ok('GET',`/api/leads/${lead.public_id}`)).status,'CONVERTED');assert.deepEqual(s.errors,[]);
});

test('H03 HTTP scope, reverse permission, source protection and direct conversion bypass fail closed',async t=>{
  const s=await server(t),a=await client(s),sales=await client(s,'hq-sales'),viewer=await client(s,'hq-viewer');
  assert.equal((await sales.call('GET',`/api/leads/${ids.otherOwnerLead}`)).status,404);
  assert.equal((await viewer.call('POST','/api/leads',{hospitalName:'forbidden',idempotencyKey:'v'})).status,403);
  const lead=await sales.ok('GET',`/api/leads/${ids.lead}`);
  assert.equal((await sales.call('POST',`/api/leads/${lead.public_id}/status`,{toStatus:'CONVERTED',expectedVersion:lead.version,idempotencyKey:'direct'})).status,400);
  assert.equal((await sales.call('POST',`/api/leads/${lead.public_id}/status`,{toStatus:'FIRST_VISIT',reason:'reverse',expectedVersion:lead.version,idempotencyKey:'reverse'})).status,409);
  const changed=await a.ok('POST',`/api/leads/${lead.public_id}/status`,{toStatus:'FIRST_VISIT',reason:'verified reverse',expectedVersion:lead.version,idempotencyKey:'admin-reverse'});assert.equal(changed.status,'FIRST_VISIT');
  assert.equal((await a.ok('GET',`/api/leads/${lead.public_id}/history`)).at(-1).reverse,true);
  assert.equal((await a.call('PATCH',`/api/accounts/${ids.approvedAccount}`,{erp_customer_code:'FAKE'})).body.error,'SOURCE_FIELD_READ_ONLY');
});

test('H03 HTTP existing/skip selection and mixed management-register save preserve failed input',async t=>{
  const s=await server(t),a=await client(s),lead=await a.ok('GET',`/api/leads/${ids.duplicateLead}`);
  const result=await a.ok('POST',`/api/leads/${lead.public_id}/convert`,{accountMode:'EXISTING',existingAccountPublicId:ids.approvedAccount,contactMode:'EXISTING',existingContactPublicId:ids.contact,opportunityMode:'SKIP',expectedVersion:lead.version,idempotencyKey:'existing-skip'});
  assert.equal(result.accountPublicId,ids.approvedAccount);assert.equal(result.contactPublicId,ids.contact);assert.equal(result.opportunityPublicId,null);
  const one=await a.ok('GET',`/api/accounts/${ids.approvedAccount}`),two=await a.ok('GET',`/api/accounts/${ids.pendingAccount}`);
  const failed={rowKey:'bad',publicId:two.public_id,expectedVersion:two.version,values:{accountName:''}};
  const saved=await a.ok('POST','/api/accounts/bulk-update',{idempotencyKey:'bulk',rows:[{rowKey:'good',publicId:one.public_id,expectedVersion:one.version,values:{accountName:'Bulk preserved'}},failed]});
  assert.equal(saved.successCount,1);assert.equal(saved.errorCount,1);assert.deepEqual(saved.results[1].input,failed);assert.equal((await a.ok('GET',`/api/accounts/${two.public_id}`)).account_name,two.account_name);
});
