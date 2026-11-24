import test from 'node:test';
import assert from 'node:assert/strict';
import {startHqServer} from './server.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
test('contract attributes save independently with permission and version checks',async t=>{
 const s=await startHqServer({port:0,storageDir:false,autoAdvance:false}); t.after(()=>s.close());
 async function client(id){const login=await fetch(s.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:id,password:'HQ-DEMO'})});const {accessToken}=await login.json();return async(method,path,body)=>{const r=await fetch(s.url+path,{method,headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};};}
 const sales=await client('hq-sales'),viewer=await client('hq-viewer'),path=`/api/contracts/${seedIDs.pendingContract}`;
 const before=(await sales('GET',path)).body;
 const input={expectedVersion:before.version,contractName:'CODEX TEST',contractDate:'2026-12-31',packageClassification:'ECO',productAmount:200000,goodsAmount:30000,specialTerms:'테스트 특약',description:'테스트 설명'};
 assert.equal((await viewer('PATCH',path,input)).status,403);
 const saved=await sales('PATCH',path,input);assert.equal(saved.status,200,JSON.stringify(saved.body));
 assert.equal(saved.body.contract_name,'CODEX TEST');assert.equal(saved.body.special_terms,'테스트 특약');assert.equal(saved.body.description,'테스트 설명');assert.equal(saved.body.product_amount,200000);assert.equal(saved.body.goods_amount,30000);assert.equal(saved.body.contract_amount,before.contract_amount);
 assert.equal((await sales('PATCH',path,input)).status,409);
 assert.equal((await sales('GET',path)).body.contract_name,'CODEX TEST');
 const partial=await sales('PATCH',path,{expectedVersion:saved.body.version,description:'partial update'});assert.equal(partial.status,200,JSON.stringify(partial.body));assert.equal(partial.body.special_terms,'테스트 특약');assert.equal(partial.body.product_amount,200000);
});
