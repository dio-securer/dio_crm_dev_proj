import test from 'node:test';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');
test('OD02 replay preserves the dataset and respects current action access', async t => {
 const server = await startHqServer({port:0,storageDir:false,autoAdvance:false}); t.after(() => server.close());
 const login=await fetch(server.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:'hq-sales',password:'HQ-DEMO'})}); const {accessToken}=await login.json();
 const call=async(method,path,body)=>{const r=await fetch(server.url+path,{method,headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
 const path=`/api/orders/${seedIDs.readyOrder}/submit`, initial=await call('GET',`/api/orders/${seedIDs.readyOrder}`), body={idempotencyKey:'b-lost-response',expectedVersion:initial.body.version};
 const first=await call('POST',path,body); assert.equal(first.status,200); const snapshot=server.app.repository('HQ_DEMO').read();
 const replay=await call('POST',path,body); assert.equal(replay.status,200); assert.equal(replay.body.requestId,first.body.requestId); assert.deepEqual(server.app.repository('HQ_DEMO').read(),snapshot);
 server.app.standard.actions.find(x=>x.actionKey==='ORD.submit').enabled=false;
 const denied=await call('POST',path,body); assert.notEqual(denied.status,200); assert.deepEqual(server.app.repository('HQ_DEMO').read(),snapshot);
});
