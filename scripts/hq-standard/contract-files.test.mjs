import test from 'node:test';
import assert from 'node:assert/strict';
import {createHqApplication} from './runtime.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');

test('isolated contract attachment upload, access control, download and deletion', async()=>{
  const app=createHqApplication();
  const auth=async loginId=>{const session=await app.handle({method:'POST',path:'/api/hq/session',body:{loginId,password:'HQ-DEMO'}});return(method,path,body)=>app.handle({method,path,body,token:session.body.accessToken});};
  const sales=await auth('hq-sales'), viewer=await auth('hq-viewer');
  const path=`/api/contracts/${seedIDs.approvedContract}/files`;
  const body={name:'test.txt',contentType:'text/plain',base64:Buffer.from('synthetic file').toString('base64'),note:'sandbox',idempotencyKey:'one'};
  const denied=await viewer('POST',path,body);assert.equal(denied.status,403);
  const created=await sales('POST',path,body);assert.equal(created.status,200,JSON.stringify(created.body));
  assert.equal(created.body.name,'test.txt');assert.equal(created.body.base64,undefined);
  assert.equal((await sales('POST',path,body)).body.public_id,created.body.public_id);
  assert.equal((await sales('GET',path)).body.items.length,1);
  assert.equal((await sales('GET',`${path}/${created.body.public_id}/download`)).body.toString(),'synthetic file');
  const contract=await sales('GET',`/api/contracts/${seedIDs.approvedContract}`);assert.equal(contract.body.mock_files,undefined);
  const eligible=await sales('GET','/api/orders/eligible-contracts'); assert.equal(eligible.status,200); assert.ok(!JSON.stringify(eligible.body).includes(body.base64));
  assert.equal((await sales('DELETE',`${path}/${created.body.public_id}`,{expectedVersion:1})).status,200);
  assert.equal((await sales('GET',path)).body.items.length,0);
});
