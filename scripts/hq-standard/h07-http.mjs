import test from 'node:test';
import assert from 'node:assert/strict';
import { createHqApplication } from './runtime.mjs';

async function session(app, loginId) {
  const result = await app.handle({method:'POST',path:'/api/hq/session',body:{loginId,password:'HQ-DEMO'}});
  assert.equal(result.status,200,JSON.stringify(result.body));
  const token=result.body.accessToken;
  const call=(method,path,body)=>app.handle({method,path,body,token});
  const ok=async(method,path,body)=>{const response=await call(method,path,body);assert.equal(response.status,200,`${method} ${path}: ${JSON.stringify(response.body)}`);return response.body;};
  return {call,ok};
}

test('H07 menu, home and five admin screens follow session permissions',async()=>{
  const app=createHqApplication(),admin=await session(app,'hq-admin'),sales=await session(app,'hq-sales'),viewer=await session(app,'hq-viewer');
  const adminMenu=await admin.ok('GET','/api/hq/menu');
  for(const path of ['/','/leads','/hq-admin/users','/hq-admin/permissions','/hq-admin/codes','/hq-admin/interfaces','/hq-admin/audit'])assert.ok(adminMenu.some(x=>x.path===path),path);
  const salesMenu=await sales.ok('GET','/api/hq/menu');
  assert.ok(salesMenu.some(x=>x.path==='/'));
  assert.ok(!salesMenu.some(x=>x.path?.startsWith('/hq-admin')));
  assert.equal((await sales.call('GET','/api/hq/admin/users')).status,403);
  assert.equal((await viewer.call('PATCH','/api/hq/admin/users/1',{name:'Denied'})).status,403);
  assert.ok((await admin.ok('GET','/api/hq/home')).counts.leads>0);
  const ops=await admin.ok('GET','/api/ops/status');
  assert.equal(ops.status,'MOCK');assert.equal(ops.database.status,'NOT_CONNECTED');assert.equal(ops.outboundCalls,0);
  assert.equal((await sales.call('GET','/api/hq/admin/standard')).status,403);
});

test('H07 standard draft validation, publish, restore and company snapshot are separate',async()=>{
  const app=createHqApplication(),admin=await session(app,'hq-admin');
  const state=await admin.ok('GET','/api/hq/admin/standard');
  const original=state.published;
  const changed=structuredClone(original);changed.version='1.4.1';
  const lead=changed.menus.find(x=>x.screenKey==='HQ_LEAD');lead.enabled=false;
  const invalid=structuredClone(changed);invalid.screens.find(x=>x.screenKey==='HQ_LEAD').routeKey='missing';
  const preview=await admin.ok('POST','/api/hq/admin/standard/preview',{standard:invalid});assert.equal(preview.valid,false);
  await admin.ok('POST','/api/hq/admin/standard/draft',{standard:changed});
  assert.ok((await admin.ok('GET','/api/hq/menu')).some(x=>x.screenKey==='HQ_LEAD'));
  await admin.ok('POST','/api/hq/admin/standard/publish',{expectedVersion:original.version});
  assert.ok(!(await admin.ok('GET','/api/hq/menu')).some(x=>x.screenKey==='HQ_LEAD'));
  assert.equal((await admin.call('GET','/api/leads')).status,403);
  assert.equal((await admin.call('POST','/api/hq/admin/standard/publish',{expectedVersion:original.version})).status,409);
  const override={overrideKey:'H07-COMPANY',parentStandardKey:changed.standardKey,parentVersion:changed.version,patches:[{target:'menu',key:changed.menus.find(x=>x.screenKey==='HQ_ORDER').menuKey,changes:{enabled:false}}]};
  const overridePreview=await admin.ok('POST','/api/hq/admin/override/preview',{override});assert.equal(overridePreview.valid,true);
  assert.ok(!overridePreview.menu.includes('HQ_ORDER'));
  await admin.ok('POST','/api/hq/admin/override/apply',{override});
  assert.equal((await admin.call('GET','/api/orders')).status,403);
  await admin.ok('POST','/api/hq/admin/standard/restore',{index:0});
  assert.equal((await admin.call('GET','/api/orders')).status,403,'published restore must not merge company snapshot');
  await admin.ok('POST','/api/hq/admin/override/clear',{});
  assert.equal((await admin.call('GET','/api/orders')).status,200);
  assert.ok((await admin.ok('GET','/api/hq/menu')).some(x=>x.screenKey==='HQ_LEAD'));
});

test('H07 admin edits and audit are visible; all 15 interface contracts remain registered',async()=>{
  const app=createHqApplication(),admin=await session(app,'hq-admin');
  assert.equal((await admin.ok('GET','/api/hq/admin/users')).length,5);
  await admin.ok('PATCH','/api/hq/admin/users/1',{name:'Sales User',organizationId:20});
  assert.equal((await admin.ok('GET','/api/hq/admin/users')).find(x=>x.userId===1).name,'Sales User');
  await admin.ok('PATCH','/api/hq/admin/users/1',{active:false});
  assert.equal((await admin.ok('GET','/api/hq/admin/users')).find(x=>x.userId===1).active,false);
  await admin.ok('PATCH','/api/hq/admin/organizations/20',{name:'Branch 20'});
  assert.equal((await admin.ok('GET','/api/hq/admin/organizations')).find(x=>x.organization_id===20).organization_name,'Branch 20');
  await admin.ok('PATCH','/api/hq/admin/organizations/20',{active:false});
  assert.equal((await admin.ok('GET','/api/hq/admin/organizations')).find(x=>x.organization_id===20).active,false);
  await admin.ok('POST','/api/hq/admin/common-codes',{groupCode:'H07',code:'A',label:'Active'});
  assert.equal((await admin.ok('GET','/api/hq/admin/common-codes')).H07[0].label,'Active');
  await admin.ok('POST','/api/hq/admin/common-codes',{groupCode:'H07',code:'A',label:'Disabled',active:false});
  assert.equal((await admin.ok('GET','/api/hq/admin/common-codes')).H07[0].active,false);
  const roles=await admin.ok('GET','/api/hq/admin/roles');
  const viewer=roles.find(x=>x.roleKey==='HQ_VIEWER');
  await admin.ok('PATCH','/api/hq/admin/roles/HQ_VIEWER',{permissions:[...viewer.permissions,'ADMIN.WRITE'],scope:'BRANCH'});
  const changedViewer=(await admin.ok('GET','/api/hq/admin/roles')).find(x=>x.roleKey==='HQ_VIEWER');
  assert.ok(changedViewer.permissions.includes('ADMIN.WRITE'));assert.equal(changedViewer.scope,'BRANCH');
  assert.ok((await admin.ok('GET','/api/audit-logs')).some(x=>x.action==='ADM.codes.save'));
  const {HQ_INTERFACE_CODES}=await import('../../backend/src/hq-mock/model.ts');
  const {HQ_INTERFACE_REGISTRY}=await import('../../backend/src/hq-mock/interfaces.ts');
  assert.equal(HQ_INTERFACE_CODES.length,15);
  for(const code of HQ_INTERFACE_CODES)assert.ok(HQ_INTERFACE_REGISTRY[code]?.response,code);
});
