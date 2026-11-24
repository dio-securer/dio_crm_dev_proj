import fs from 'node:fs';import path from 'node:path';import {executeActivityGps} from './activity-gps';import {CompanyConfigurationService} from './config-service';import {emptyConfigState} from './config-store';import {resolveCompanyConfig} from '@dio-crm/contracts/crm-customization';
const artifact=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../packages/contracts/catalogs/hq-activity-review.json'),'utf8')),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',actor={id,companyId};
describe('configured GPS activity commands',()=>{
 function fixture(){
  const permissions=[...new Set(['runtime.read','runtime.write',...artifact.catalog.entries.flatMap((e:any)=>[...e.permissions,...e.readPermissions,...e.writePermissions])])];let state:any=emptyConfigState(companyId,{[id]:{active:true,permissions:permissions as string[],denied:[]}});state.activeReleaseId=id;state.releases[id]={id,effective:resolveCompanyConfig(artifact.catalog,{companyId,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[]} as any)};state.fixture={owner:7,status:'PLANNED',other:false,direct:false,queued:false,writes:[]};let fail=false;
  const repo={transact:async(_c:any,_a:any,work:any)=>{const copy=JSON.parse(JSON.stringify(state)),f=copy.fixture;const r=await work({state:copy,identityActive:true,domain:{companyKey:9,query:async(sql:string,p:any)=>{
   if(sql.startsWith('SELECT country_code'))return {recordset:[{country_code:f.country??'KR',market_profile_code:null}]};
   if(sql.startsWith('SELECT activity_id,owner'))return {recordset:f.owner===p.userKey?[{activity_id:1,owner_user_id:7,status:f.status,target_latitude:37,target_longitude:127}]:[]};
   if(sql.startsWith('SELECT activity_id FROM'))return {recordset:f.other?[{activity_id:2}]:[]};
   if(sql.startsWith('SELECT TOP 1 setting'))return {recordset:[{setting_value:'200'}]};
   if(sql.startsWith('SELECT d.direct_work_id'))return {recordset:f.direct&&!f.queued?[{direct_work_id:1,public_id:id,work_type:'DIRECT_WORK',reason:'Visit'}]:[]};
   f.writes.push(sql);if(sql.startsWith('UPDATE crm_activity'))f.status=p.status;if(sql.startsWith('UPDATE crm_direct_work'))f.queued=true;if(fail&&sql.startsWith('INSERT INTO crm_interface_log'))throw Error('queue failure');return {recordset:[],rowsAffected:[1]};
  }}});state=copy;return r;}};
  const service=new CompanyConfigurationService(repo as any,[]),run=(command='check-in',body:unknown={latitude:37,longitude:127})=>executeActivityGps(service,{method:'POST',path:'/api/activities/'+id+'/'+command,query:{},body,headers:{'x-config-release-id':id,'x-config-permission-version':'1','idempotency-key':'request'}} as any,actor,7);
  return {run,get:()=>state,edit:(fn:(s:any)=>void)=>fn(state),fail:()=>fail=true};
 }
 it('device readonly capture permitted only by dedicated action, replay once',async()=>{const f=fixture();await f.run();await f.run();expect(f.get().fixture.status).toBe('IN_PROGRESS');expect(f.get().fixture.writes).toHaveLength(1);});
 it('hidden coordinate prevents capture',async()=>{const f=fixture();f.edit(s=>s.releases[id].effective.entries.find((e:any)=>e.id==='activity.latitude').settings.visible=false);await expect(f.run()).rejects.toMatchObject({code:'DEVICE_CAPTURE_DENIED'});});
 it('masked target coordinate prevents distance inference',async()=>{const f=fixture();f.edit(s=>s.releases[id].effective.entries.find((e:any)=>e.id==='activity.targetLatitude').settings.masking='redact');await expect(f.run()).rejects.toMatchObject({code:'QUERY_FIELD_DENIED'});});
 it('other open activity prevents check-in',async()=>{const f=fixture();f.edit(s=>s.fixture.other=true);await expect(f.run()).rejects.toMatchObject({code:'GPS_CHECKIN_DENIED'});});
 it('out-of-range position prevents check-in',async()=>{const f=fixture();await expect(f.run('check-in',{latitude:38,longitude:127})).rejects.toMatchObject({code:'GPS_CHECKIN_DENIED'});});
 it('owner rechecked before receipt replay',async()=>{const f=fixture();await f.run();f.edit(s=>s.fixture.owner=8);await expect(f.run()).rejects.toMatchObject({code:'NOT_FOUND'});});
 it('checkout and approved direct-work outbox commit once',async()=>{const f=fixture();f.edit(s=>{s.fixture.status='IN_PROGRESS';s.fixture.direct=true;});await f.run('check-out');await f.run('check-out');expect(f.get().fixture.status).toBe('COMPLETED');expect(f.get().outbox).toHaveLength(1);expect(f.get().fixture.queued).toBe(true);});
 it('queue failure rolls back completed status',async()=>{const f=fixture();f.edit(s=>{s.fixture.status='IN_PROGRESS';s.fixture.direct=true;});const before=JSON.stringify(f.get());f.fail();await expect(f.run('check-out')).rejects.toThrow('queue failure');expect(JSON.stringify(f.get())).toBe(before);});
 it('current company market is checked before command replay',async()=>{const f=fixture();await f.run();f.edit(s=>s.fixture.country='ZZ');await expect(f.run()).rejects.toMatchObject({code:'FEATURE_NOT_AVAILABLE_FOR_MARKET'});});
});
