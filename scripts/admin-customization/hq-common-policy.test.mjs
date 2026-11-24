import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createHqApplication} from '../hq-standard/runtime.mjs';
const artifact=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-file-review.json','utf8'));
const result=()=>({ok:true,entries:structuredClone(artifact.catalog.entries),issues:[],provenance:{}});
const company='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('common screen restrictions reach HQ reads and writes without expanding legacy grants',()=>{
 const app=createHqApplication(),actor=app.personas[0],effective=result();
 effective.entries.find(e=>e.id==='HQ_LEAD').settings.visible=false;
 app.installCommonConfiguration(actor.companyId,company,effective);
 const policy=app.policyFor(actor),context=app.context(actor,{'lead.hospitalName':'Clinic','lead.status':'NEW'});
 assert.equal(policy.screenAllowed('HQ_LEAD',context),false);assert.equal(policy.fieldVisible('lead.hospitalName',context),false);assert.equal(policy.fieldWritable('lead.hospitalName',context),false);
 effective.entries.find(e=>e.id==='HQ_LEAD').settings.visible=true;
 assert.equal(app.policyFor(actor).screenAllowed('HQ_LEAD',context),false);
});
test('masking, write restrictions and missing action IDs fail closed',()=>{
 const app=createHqApplication(),actor=app.personas[0],effective=result();
 effective.entries.find(e=>e.id==='lead.hospitalName').settings.masking='redact';
 effective.entries=effective.entries.filter(e=>e.id!=='LEAD.reverse');
 app.installCommonConfiguration(actor.companyId,company,effective);
 const policy=app.policyFor(actor),context=app.context(actor,{'lead.hospitalName':'Private','lead.status':'KEYMAN_MEETING','lead.targetStatus':'FIRST_VISIT','lead.reason':'Test'});
 assert.equal(policy.readField('lead.hospitalName',context),'***');assert.equal(policy.fieldWritable('lead.hospitalName',context),false);
 assert.equal(policy.transitionAllowed('LEAD.reverseTo.FIRST_VISIT',context),false);
});
test('common restrictions are company scoped and current actor permissions still apply',()=>{
 const app=createHqApplication(),actor=app.personas[0],effective=result();
 effective.entries.find(e=>e.id==='HQ_LEAD').settings.visible=false;
 app.installCommonConfiguration(actor.companyId+100,company,effective);
 assert.equal(app.policyFor(actor).screenAllowed('HQ_LEAD',app.context(actor)),true);
 app.installCommonConfiguration(actor.companyId,company,result());
 const revoked={...actor,permissions:[]};assert.equal(app.policyFor(revoked).screenAllowed('HQ_LEAD',app.context(revoked)),false);
});
test('installed common company cannot execute unaccepted HQ DTOs or mock mutations',async()=>{
 const app=createHqApplication(),actor=app.personas[0];
 const login=await app.handle({method:'POST',path:'/api/hq/session',body:{loginId:actor.loginId,password:'HQ-DEMO'}});
 assert.equal(login.status,200);const token=login.body.accessToken;
 app.installCommonConfiguration(actor.companyId,company,result());
 for(const [method,path,body] of [['GET','/api/leads'],['PATCH','/api/leads/any',{hospitalName:'Bypass'}],['POST','/api/hq/admin/standard/publish',{}],['POST','/api/hq/reset/preview',{}]]){
  const response=await app.handle({method,path,body,token});assert.equal(response.status,409);assert.equal(response.body.error,'HQ_MANAGED_RUNTIME_REQUIRED');
 }
 assert.equal((await app.handle({method:'GET',path:'/api/hq/menu',token})).status,200);
 assert.equal((await app.handle({method:'POST',path:'/api/hq/logout',token})).status,200);
});
