import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHqApplication} from './runtime.mjs';
import {createHqPolicy,validateHqStandard,applyHqOverride} from '../../packages/contracts/src/hq-standard.ts';

test('H03 runtime registry is valid and reverse authority does not reach the sales persona',()=>{
  const app=createHqApplication();
  assert.deepEqual(validateHqStandard(app.standard,app.capabilities).errors,[]);
  const policy=createHqPolicy(app.standard,app.capabilities);
  const values={'lead.status':'KEYMAN_MEETING','lead.targetStatus':'FIRST_VISIT','lead.reason':'Revisit required'};
  assert.equal(policy.transitionAllowed('LEAD.reverseTo.FIRST_VISIT',app.context(app.personas[0],values)),true);
  assert.equal(policy.transitionAllowed('LEAD.reverseTo.FIRST_VISIT',app.context(app.personas[1],values)),false);
  assert.equal(policy.transitionAllowed('LEAD.reverseTo.FIRST_VISIT',app.context(app.personas[0],{...values,'lead.reason':''})),false);
  assert.equal(policy.transitionAllowed('LEAD.reverseTo.FIRST_VISIT',app.context(app.personas[0],{...values,'lead.status':'CONVERTED'})),false);
});
test('H03 converted and read-only actors cannot edit customer fields through the shared policy',()=>{
  const app=createHqApplication(),policy=createHqPolicy(app.standard,app.capabilities);
  const active={'lead.status':'NEW','lead.hospitalName':'Clinic'};
  assert.equal(policy.fieldWritable('lead.keymanNote',app.context(app.personas[1],active)),true);
  assert.equal(policy.fieldWritable('lead.keymanNote',app.context(app.personas[4],active)),false);
  assert.equal(policy.fieldWritable('lead.keymanNote',app.context(app.personas[0],{...active,'lead.status':'CONVERTED'})),false);
  assert.equal(policy.actionAllowed('LEAD.create',app.context(app.personas[0],{'lead.hospitalName':''})),false);
});
test('H03 CRM outgoing name remains writable while every ERP inbound field is read-only',()=>{
  const app=createHqApplication(),policy=createHqPolicy(app.standard,app.capabilities),context=app.context(app.personas[0],{'account.crmName':'Clinic'});
  assert.equal(policy.fieldWritable('account.crmName',context),true);
  const inbound=app.standard.fields.filter(f=>f.entity==='account' && f.source==='ERP');
  assert.ok(inbound.length>0);
  for(const f of inbound)assert.equal(policy.fieldWritable(f.fieldKey,context),false,f.fieldKey);
});
test('H03 conversion existing branches require their reference and skip branches do not',()=>{
  const app=createHqApplication(),policy=createHqPolicy(app.standard,app.capabilities);
  const values={'lead.status':'KEYMAN_MEETING','lead.ownerUserId':1,'conversion.accountMode':'NEW','conversion.contactMode':'SKIP','conversion.opportunityMode':'SKIP'};
  assert.equal(policy.actionAllowed('LEAD.convert',app.context(app.personas[0],values)),true);
  assert.equal(policy.actionAllowed('LEAD.convert',app.context(app.personas[0],{...values,'conversion.contactMode':'EXISTING'})),false);
  assert.equal(policy.actionAllowed('LEAD.convert',app.context(app.personas[0],{...values,'conversion.opportunityMode':'EXISTING'})),false);
  assert.equal(policy.actionAllowed('LEAD.convert',app.context(app.personas[0],{...values,'conversion.opportunityMode':'BROKEN'})),false);
});
test('H03 contact name/account required inputs cannot be hidden by an override',()=>{
  const app=createHqApplication();
  const result=applyHqOverride(app.standard,{overrideKey:'H03.INVALID',parentStandardKey:app.standard.standardKey,parentVersion:app.standard.version,patches:[{target:'field',key:'contact.accountPublicId',changes:{visible:false}}]},app.capabilities);
  assert.equal(result.valid,false);
});
