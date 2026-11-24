import test from 'node:test';
import assert from 'node:assert/strict';
import {createHqApplication} from './runtime.mjs';
const {installOpportunityNoteRoutes}=await import('../../backend/src/hq-mock/opportunity-note-routes.ts');
const {seedIDs:ids}=await import('../../backend/src/hq-mock/seed.ts');
async function client(app,loginId='hq-admin'){const s=await app.handle({method:'POST',path:'/api/hq/session',body:{loginId,password:'HQ-DEMO',datasetId:'HQ_DEMO'}});return(method,path,body)=>app.handle({method,path,body,token:s.body.accessToken});}
async function setup(){const app=createHqApplication();const call=await client(app);const opp=(await call('POST','/api/opportunities',{accountPublicId:ids.approvedAccount,opportunityName:'CODEX notes',recordType:'NEW',expectedCloseDate:'2026-12-01'})).body;return {app,call,opp,url:`/api/opportunities/${opp.public_id}/notes`};}
test('plain text note CRUD, authors, idempotency and version conflict preserve parent',async()=>{
 const {call,opp,url}=await setup(),input={title:'CODEX note',body:'first\n<script>alert(1)</script>',idempotencyKey:'new'};
 const created=await call('POST',url,input);assert.equal(created.status,200,JSON.stringify(created.body));assert.equal(created.body.body,input.body);assert.ok(created.body.createdByName);assert.equal(created.body.format,'PLAIN_TEXT');
 assert.equal((await call('POST',url,input)).body.public_id,created.body.public_id);
 assert.equal((await call('POST',url,{...input,title:'different'})).status,409);
 const path=`${url}/${created.body.public_id}`;const edit=await call('PATCH',path,{title:'changed',body:'next',expectedVersion:1,idempotencyKey:'edit'});assert.equal(edit.status,200);assert.equal(edit.body.version,2);assert.equal(edit.body.body,'next');assert.ok(edit.body.modifiedByName);
 assert.equal((await call('PATCH',path,{body:'stale',expectedVersion:1,idempotencyKey:'stale'})).status,409);assert.equal((await call('DELETE',path,{expectedVersion:1,idempotencyKey:'stale-delete'})).status,409);
 assert.equal((await call('DELETE',path,{expectedVersion:2,idempotencyKey:'delete'})).status,200);assert.equal((await call('GET',url)).body.items.length,0);assert.equal((await call('DELETE',path,{expectedVersion:2,idempotencyKey:'delete'})).status,200);
 assert.equal((await call('GET',`/api/opportunities/${opp.public_id}`)).body.version,opp.version);
});
test('note validates input and rechecks read/write permission before receipt replay',async()=>{
 const {app,call,url}=await setup(),viewer=await client(app,'hq-viewer');
 for(const fields of [{title:null},{body:3},{title:'x'.repeat(256)},{body:'x'.repeat(50001)}])assert.equal((await call('POST',url,{...fields,idempotencyKey:'invalid'})).status,400);
 const input={title:'',body:'plain',idempotencyKey:'create'};const note=await call('POST',url,input);assert.equal(note.status,200);assert.equal(note.body.title,'제목 없는 노트');
 assert.equal((await viewer('POST',url,input)).status,403);
 const actor=app.personas.find(p=>p.loginId==='hq-admin');actor.permissions=actor.permissions.filter(p=>p!=='OPPORTUNITY.READ');assert.equal((await call('GET',url)).status,403);assert.equal((await call('POST',url,input)).status,403);
});
