import fs from 'node:fs';import path from 'node:path';
import {readActivityMap} from './activity-map';import {CompanyConfigurationService} from './config-service';import {emptyConfigState} from './config-store';import {resolveCompanyConfig} from '@dio-crm/contracts/crm-customization';
const artifact=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../packages/contracts/catalogs/hq-activity-map-review.json'),'utf8')),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',actor={id,companyId};
describe('configured activity map',()=>{
 function fixture(){
  const permissions=[...new Set(['runtime.read',...artifact.catalog.entries.flatMap((e:any)=>[...e.permissions,...e.readPermissions,...e.writePermissions])])];const state:any=emptyConfigState(companyId,{[id]:{active:true,permissions:permissions as string[],denied:[]}});state.activeReleaseId=id;state.releases[id]={id,effective:resolveCompanyConfig(artifact.catalog,{companyId,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[]} as any)};
  const queries:string[]=[],repo={transact:async(_c:any,_a:any,work:any)=>work({state,identityActive:true,domain:{companyKey:9,query:async(sql:string,p:any)=>{
   queries.push(sql);expect(sql).toContain('company_id=@companyKey AND owner_user_id=@userKey');expect(p).toMatchObject({companyKey:9,userKey:7});
   if(sql.includes('FROM crm_activity'))return {recordset:[{public_id:id,status:'PLANNED',planned_at:'2026-12-01T10:00',target_latitude:37,target_longitude:127}]};
   return {recordset:[{public_id:id,name:'Near',latitude:37,longitude:127,address:'Address'},{public_id:id,name:'Far',latitude:38,longitude:128,address:'Other'}]};
  }}})};
  const service=new CompanyConfigurationService(repo as any,[]),run=(query:any={})=>readActivityMap(service,{query:{date:'2026-12-01',latitude:37,longitude:127,...query}} as any,actor,7);
  return {run,queries,set:(key:string,patch:any)=>Object.assign(state.releases[id].effective.entries.find((e:any)=>e.id===key).settings,patch)};
 }
 it('returns scoped nearby entities within radius and explicit scalar projection',async()=>{const f=fixture(),r=await f.run();expect(r.data.leads).toEqual([{public_id:id,name:'Near',latitude:37,longitude:127,address:'Address',distance_m:0}]);expect(f.queries).toHaveLength(3);});
 it('hidden map section denies its inherited query fields before SQL',async()=>{const f=fixture();f.set('section:activity.map',{visible:false});await expect(f.run()).rejects.toMatchObject({code:'QUERY_FIELD_DENIED'});expect(f.queries).toHaveLength(0);});
 it('disabled map command rejects before SQL',async()=>{const f=fixture();f.set('ACT.map',{enabled:false});await expect(f.run()).rejects.toMatchObject({code:'ACTION_DENIED'});expect(f.queries).toHaveLength(0);});
 it('masked source GPS cannot be inferred through distance',async()=>{const f=fixture();f.set('lead.latitude',{masking:'redact'});await expect(f.run()).rejects.toMatchObject({code:'QUERY_FIELD_DENIED'});expect(f.queries.some(q=>q.includes('FROM crm_lead'))).toBe(false);});
 it('hidden map output omitted even when source readable',async()=>{const f=fixture();f.set('activityMap.address',{visible:false});const r=await f.run();expect((r.data.leads as any[])[0]).not.toHaveProperty('address');});
 it('restricted radius query cannot be supplied',async()=>{const f=fixture();f.set('activityMap.radiusKm',{readOnly:true});await expect(f.run({radiusKm:5})).rejects.toMatchObject({code:'QUERY_CONTROL_DENIED'});});
 it.each([{date:'2026-02-30'},{latitude:91},{longitude:-181},{radiusKm:51},{extra:true}])('invalid map query rejects %j',async q=>{const f=fixture();await expect(f.run(q)).rejects.toThrow();expect(f.queries).toHaveLength(0);});
});
