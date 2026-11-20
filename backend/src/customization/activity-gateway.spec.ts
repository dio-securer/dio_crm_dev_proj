import fs from 'node:fs';import path from 'node:path';
import {ConfiguredActivityGateway} from './activity-gateway';import {CompanyConfigurationService} from './config-service';import {emptyConfigState} from './config-store';import {resolveCompanyConfig} from '@dio-crm/contracts/crm-customization';
const artifact=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../packages/contracts/catalogs/hq-activity-review.json'),'utf8')),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',actor={id,companyId};
describe('configured activity plans calendar and consultation',()=>{
 function fixture(){
  const permissions=[...new Set(['runtime.read','runtime.write',...artifact.catalog.entries.flatMap((e:any)=>[...e.permissions,...e.readPermissions,...e.writePermissions])])];let state:any=emptyConfigState(companyId,{[id]:{active:true,permissions:permissions as string[],denied:[]}});state.activeReleaseId=id;state.releases[id]={id,effective:resolveCompanyConfig(artifact.catalog,{companyId,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[]} as any)};state.fixture={owner:7,status:'IN_PROGRESS',reportLocked:false,visit:'old',plans:[],writes:[]};let fail=false;
  const queries:string[]=[],repo={transact:async(_c:any,_a:any,work:any)=>{const copy=JSON.parse(JSON.stringify(state)),f=copy.fixture;const r=await work({state:copy,identityActive:true,domain:{companyKey:9,query:async(sql:string,p:any)=>{
   queries.push(sql);if(sql.startsWith('SELECT country_code'))return {recordset:[{country_code:f.country??'KR',market_profile_code:null}]};if(sql.startsWith('SELECT lead_id'))return {recordset:f.owner===p.userKey?[{id:2,name:'Hospital',latitude:37,longitude:127}]:[]};
   if(sql.startsWith('SELECT activity_id'))return {recordset:f.plans.includes(p.plannedDate)?[{activity_id:1}]:[]};
   if(sql.startsWith('SELECT i.report_item_id'))return {recordset:f.reportLocked?[{report_item_id:1}]:[]};
   if(sql.startsWith('SELECT'))return {recordset:f.owner===p.userKey?[{company_id:9,public_id:id,activity_id:3,event_id:4,related_type:'LEAD',related_public_id:id,planned_at:'2026-12-01T10:00:00',subject:'Visit',owner_user_id:7,status:f.status,visit_purpose:f.visit}]:[]};
   f.writes.push(sql);if(sql.startsWith('INSERT INTO crm_activity(')){if(fail&&f.plans.length)throw Error('second plan failure');f.plans.push(p.plannedDate);return {recordset:[{activity_id:3,public_id:id}],rowsAffected:[1]};}
   if(sql.startsWith('INSERT INTO crm_activity_event'))return {recordset:[{event_id:4}],rowsAffected:[1]};
   if(sql.startsWith('UPDATE crm_activity SET visit_purpose'))f.visit=p.v0;
   return {recordset:[],rowsAffected:[1]};
  }}});state=copy;return r;}};
  const gateway=new ConfiguredActivityGateway(new CompanyConfigurationService(repo as any,[])),run=(method:string,suffix:string,body?:unknown,query={})=>gateway.handle({method,path:'/api/activities'+suffix,body,query,headers:{'x-config-release-id':id,'x-config-permission-version':'1','idempotency-key':'request'}} as any,actor,7);
  return {run,queries,get:()=>state,edit:(fn:(s:any)=>void)=>fn(state),fail:()=>fail=true};
 }
 const plan={relatedType:'LEAD',relatedPublicId:id,plannedAt:'2026-12-01T10:00',subject:'Visit'};
 it('single plan writes event/activity once under idempotency',async()=>{const f=fixture();await f.run('POST','/plans',plan);await f.run('POST','/plans',plan);expect(f.get().fixture.writes).toHaveLength(2);});
 it('revoking activity write after plan creation prevents replay without further writes',async()=>{
  const f=fixture();await f.run('POST','/plans',plan);const writes=f.get().fixture.writes.length;
  f.edit(s=>s.members[id].denied.push('ACTIVITY.WRITE'));
  await expect(f.run('POST','/plans',plan)).rejects.toMatchObject({status:403});
  expect(f.get().fixture.writes).toHaveLength(writes);
 });
 it('bulk second failure rolls back prior rows and receipt',async()=>{const f=fixture(),before=JSON.stringify(f.get());f.fail();await expect(f.run('POST','/plans/bulk',{plans:[plan,{...plan,plannedAt:'2026-12-02T10:00'}]})).rejects.toThrow('second plan failure');expect(JSON.stringify(f.get())).toBe(before);});
 it('duplicate target/date denies entire batch',async()=>{const f=fixture(),before=JSON.stringify(f.get());await expect(f.run('POST','/plans/bulk',{plans:[plan,plan]})).rejects.toMatchObject({code:'ACTIVITY_DUPLICATE'});expect(JSON.stringify(f.get())).toBe(before);});
 it('target ownership checked',async()=>{const f=fixture();f.edit(s=>s.fixture.owner=8);await expect(f.run('POST','/plans',plan)).rejects.toMatchObject({code:'NOT_FOUND'});});
 it('masked source coordinates cannot be copied',async()=>{const f=fixture();f.edit(s=>s.releases[id].effective.entries.find((e:any)=>e.id==='lead.latitude').settings.masking='redact');await expect(f.run('POST','/plans',plan)).rejects.toMatchObject({code:'QUERY_FIELD_DENIED'});});
 it('invalid appointment calendar date rejected',async()=>{const f=fixture();await expect(f.run('POST','/plans',{...plan,plannedAt:'2026-02-30T10:00'})).rejects.toThrow();});
 it('direct work reason required',async()=>{const f=fixture();await expect(f.run('POST','/plans',{...plan,directWorkType:'DIRECT_WORK'})).rejects.toMatchObject({code:'REQUIRED_FIELD'});});
 it('direct work creation checks target write policy',async()=>{const f=fixture();f.edit(s=>s.releases[id].effective.entries.find((e:any)=>e.id==='directWork.reason').settings.readOnly=true);await expect(f.run('POST','/plans',{...plan,directWorkType:'DIRECT_WORK',directWorkReason:'Visit'})).rejects.toMatchObject({code:'FIELD_WRITE_DENIED'});expect(f.get().fixture.writes).toHaveLength(0);});
 it('direct work request without restrictive target policy creates all rows',async()=>{const f=fixture();await f.run('POST','/plans',{...plan,directWorkType:'DIRECT_WORK',directWorkReason:'Visit'});expect(f.get().fixture.writes).toHaveLength(3);});
 it('defaulted direct work rechecks current market on replay',async()=>{const f=fixture();f.edit(s=>{s.releases[id].effective.entries.find((e:any)=>e.id==='activity.directWorkType').settings.default='DIRECT_WORK';s.releases[id].effective.entries.find((e:any)=>e.id==='activity.directWorkReason').settings.default='Visit';});await f.run('POST','/plans',plan);f.edit(s=>s.fixture.country='XX');await expect(f.run('POST','/plans',plan)).rejects.toMatchObject({code:'FEATURE_NOT_AVAILABLE_FOR_MARKET'});expect(f.get().fixture.writes).toHaveLength(3);});
 it('disabled calendar action prevents query',async()=>{const f=fixture();f.edit(s=>s.releases[id].effective.entries.find((e:any)=>e.id==='ACT.calendar').settings.enabled=false);await expect(f.run('GET','/calendar',undefined,{from:'2026-12-01',to:'2026-12-31'})).rejects.toMatchObject({code:'ACTION_DENIED'});expect(f.queries).toHaveLength(0);});
 it('calendar projects hidden subject',async()=>{const f=fixture();f.edit(s=>s.releases[id].effective.entries.find((e:any)=>e.id==='activity.subject').settings.visible=false);const r=await f.run('GET','/calendar',undefined,{from:'2026-12-01',to:'2026-12-31'});expect((r.data as any[])[0]).not.toHaveProperty('subject');});
 it('consultation updates activity and event atomically',async()=>{const f=fixture();await f.run('PATCH','/'+id,{visitPurpose:'new'});expect(f.get().fixture.visit).toBe('new');expect(f.get().fixture.writes).toHaveLength(2);});
 it('final approved report locks activity edits',async()=>{const f=fixture();f.edit(s=>s.fixture.reportLocked=true);await expect(f.run('PATCH','/'+id,{visitPurpose:'new'})).rejects.toMatchObject({code:'ACTIVITY_EDIT_LOCKED'});});
 it('readonly consultation denied before writes',async()=>{const f=fixture();f.edit(s=>s.releases[id].effective.entries.find((e:any)=>e.id==='activity.consultation').settings.readOnly=true);await expect(f.run('PATCH','/'+id,{consultationContent:'new'})).rejects.toMatchObject({code:'FIELD_WRITE_DENIED'});expect(f.get().fixture.writes).toHaveLength(0);});
 it('hidden bulk section denies batch before mutation',async()=>{const f=fixture();f.edit(s=>s.releases[id].effective.entries.find((e:any)=>e.id==='section:activity.bulk').settings.visible=false);await expect(f.run('POST','/plans/bulk',{plans:[plan]})).rejects.toMatchObject({code:'ACTION_DENIED'});});

});

