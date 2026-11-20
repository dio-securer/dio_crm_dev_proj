import test from 'node:test';
import assert from 'node:assert/strict';
import {createHqApplication} from './runtime.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');

async function setup(){
 const app=createHqApplication();
 const login=async loginId=>{const result=await app.handle({method:'POST',path:'/api/hq/session',body:{loginId,password:'HQ-DEMO',datasetId:'HQ_DEMO'}});return(method,path,body)=>app.handle({method,path,body,token:result.body.accessToken});};
 return {app,call:await login('hq-sales'),viewer:await login('hq-viewer')};
}
const base={accountPublicId:seedIDs.approvedAccount,opportunityName:'CODEX informational fields',expectedCloseDate:'2026-12-20'};
const info={interestProduct:'제품 A\n제품 B',description:'설명\n둘째 줄',ownedEquipment:'보유 장비',competitorUsage:'타사 정보',treatmentFeeInfo:'수가 정보',specialTerms:'특약사항',paymentDate:'2026-12-21',paymentMethod:'현금할부',installmentMonths:12};
const dbKey=key=>key.replace(/[A-Z]/g,c=>`_${c.toLowerCase()}`);

test('renewal inventory and payment situation persist, clear, and reject invalid values atomically',async()=>{
 const {app,call,viewer}=await setup();
 const renewal={stockStatus:'잔여 재고 20개\n합성 검증',paymentStatus:'이전 계약 결제 확인 대기'};
 const created=await call('POST','/api/opportunities',{...base,recordType:'RECONTRACT',...renewal});
 assert.equal(created.status,200,JSON.stringify(created.body));
 const url=`/api/opportunities/${created.body.public_id}`;
 for(const [key,value] of Object.entries(renewal))assert.equal(created.body[dbKey(key)],value,key);
 const changed={stockStatus:'재고 확인 완료',paymentStatus:''};
 const saved=await call('PATCH',url,{...changed,expectedVersion:created.body.version});
 assert.equal(saved.status,200,JSON.stringify(saved.body));
 const read=await call('GET',url);for(const [key,value] of Object.entries(changed))assert.equal(read.body[dbKey(key)],value,key);
 for(const invalid of [{stockStatus:7},{paymentStatus:null},{stockStatus:'x'.repeat(2001)},{paymentStatus:'x'.repeat(2001)}]){
  const before=app.repository('HQ_DEMO').read();
  assert.equal((await call('PATCH',url,invalid)).status,400);
  assert.equal((await call('POST','/api/opportunities',{...base,recordType:'RECONTRACT',...invalid})).status,400);
  assert.deepEqual(app.repository('HQ_DEMO').read(),before);
 }
 assert.equal((await viewer('PATCH',url,renewal)).status,403);
 assert.equal((await call('PATCH',url,{...renewal,expectedVersion:created.body.version})).status,409);
 assert.equal((await call('GET',url)).body.stock_status,changed.stockStatus);
});

test('opportunity creation and edits persist Salesforce informational fields without changing workflow',async()=>{
 const {call}=await setup();
 const created=await call('POST','/api/opportunities',{...base,...info,idempotencyKey:'info-create'});assert.equal(created.status,200,JSON.stringify(created.body));
 const url=`/api/opportunities/${created.body.public_id}`;
 for(const [key,value] of Object.entries(info))assert.equal(created.body[dbKey(key)],value,key);
 assert.equal(created.body.stage,'NEEDS_ANALYSIS');assert.equal(created.body.contract_created_yn,false);
 const changed={...info,description:'수정한 설명',paymentDate:'',paymentMethod:'',installmentMonths:0};
 const saved=await call('PATCH',url,{...changed,expectedVersion:created.body.version,idempotencyKey:'info-edit'});assert.equal(saved.status,200,JSON.stringify(saved.body));
 const read=await call('GET',url);for(const [key,value] of Object.entries(changed))assert.equal(read.body[dbKey(key)],value,key);
 assert.equal((await call('PATCH',url,{description:'stale',expectedVersion:1})).status,409);
 assert.equal((await call('GET',url)).body.description,'수정한 설명');
});

test('opportunity optional info validates calendar dates, integer installments and text atomically',async()=>{
 const {app,call}=await setup();
 const created=await call('POST','/api/opportunities',base);assert.equal(created.status,200);
 const url=`/api/opportunities/${created.body.public_id}`;
 for(const extra of [{paymentDate:'2026-02-30'},{paymentDate:'2026-2-02'},{paymentDate:7},{paymentMethod:'unrecognized-new-method'},{installmentMonths:-1},{installmentMonths:1.5},{installmentMonths:121},{description:'x'.repeat(4001)},{ownedEquipment:42}]){
  const before=app.repository('HQ_DEMO').read();
  assert.equal((await call('PATCH',url,extra)).status,400,JSON.stringify(extra));
  assert.deepEqual(app.repository('HQ_DEMO').read(),before);
  assert.equal((await call('POST','/api/opportunities',{...base,...extra})).status,400,JSON.stringify(extra));
  assert.deepEqual(app.repository('HQ_DEMO').read(),before);
 }
});

test('observed payment choices accept new values while unchanged legacy payment values remain editable',async()=>{
 const {app,call}=await setup();
 for(const paymentMethod of ['','역구매','현금 일시불','현금할부','카드 일시불(카드사 할부)','매월카드결제(카드할부)','기타','매입상계']){
  const created=await call('POST','/api/opportunities',{...base,paymentMethod});assert.equal(created.status,200,paymentMethod);assert.equal(created.body.payment_method,paymentMethod);
 }
 const created=await call('POST','/api/opportunities',base);
 app.repository('HQ_DEMO').transact(d=>{d.collections.opportunities.find(row=>row.public_id===created.body.public_id).payment_method='Legacy wire';});
 const saved=await call('PATCH',`/api/opportunities/${created.body.public_id}`,{paymentMethod:'Legacy wire',description:'legacy preserved'});
 assert.equal(saved.status,200);assert.equal(saved.body.payment_method,'Legacy wire');assert.equal(saved.body.description,'legacy preserved');
});

test('informational field writes retain permission and server-managed field boundaries',async()=>{
 const {app,call,viewer}=await setup(),created=await call('POST','/api/opportunities',base),url=`/api/opportunities/${created.body.public_id}`;
 const before=app.repository('HQ_DEMO').read();
 assert.equal((await viewer('PATCH',url,info)).status,403);
 assert.equal((await viewer('POST','/api/opportunities',{...base,...info})).status,403);
 assert.equal((await call('PATCH',url,{contractCreatedYn:true})).status,400);
 assert.equal((await call('POST','/api/opportunities',{...base,contractCreatedYn:true})).status,400);
 assert.deepEqual(app.repository('HQ_DEMO').read(),before);
});
