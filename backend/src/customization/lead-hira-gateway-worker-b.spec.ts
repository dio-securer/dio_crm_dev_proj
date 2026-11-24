import fs from 'node:fs';
import path from 'node:path';
import {resolveCompanyConfig} from '@dio-crm/contracts/crm-customization';
import {ConfiguredLeadGateway} from './lead-gateway';
import {projectFields} from './field-policy';
const companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id='cccccccc-cccc-4ccc-8ccc-cccccccccccc',actor={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',companyId};
const catalog=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../packages/contracts/catalogs/hq-codes-review.json'),'utf8')).catalog;
const effective=()=>resolveCompanyConfig(catalog,{companyId,baseStandardReleaseId:catalog.standardReleaseId,patches:[]} as any);
const perms=[...new Set<string>(catalog.entries.flatMap((e:any)=>[...e.permissions,...e.readPermissions,...e.writePermissions]))];
const policy={authenticated:true,companyId,allowed:perms,denied:[] as string[]};
const request=(method='GET',body:any={})=>({method,path:'/api/leads/'+id,query:{},body,headers:{}} as any);
function setup(enabled:boolean, value:unknown=false, missing=false){
 const result=effective(), calls:string[]=[];
 const query=async(sql:string)=>{calls.push(sql);if(missing&&sql.includes('hira_sync_exclude_yn'))throw new Error('B_MISSING_SCHEMA');return {recordset:[{company_id:9,owner_user_id:7,status:'NEW',hira_sync_exclude_yn:value}]};};
 const service={readSqlFields:async(_a:any,_s:any,adapter:any)=>{const loaded=await adapter.load({companyKey:9,query},actor,policy);return {data:projectFields(result,companyId,policy,adapter.bindings,loaded.row)};}};
 return {result,calls,gateway:new ConfiguredLeadGateway(service as any,null,{hiraExclusion:enabled})};
}
describe('worker B ordinary lead HIRA reads',()=>{
 it.each([true,false,null])('projects value %s only through opted-in GET',async value=>{const f=setup(true,value);const r=await f.gateway.handle(request(),actor,7);expect((r.data as any).hira_sync_exclude_yn).toBe(value);expect(f.calls[0]).toContain('hira_sync_exclude_yn');});
 it('default off avoids unknown column and response',async()=>{const f=setup(false,false,true);const r=await f.gateway.handle(request(),actor,7);expect(r.data).not.toHaveProperty('hira_sync_exclude_yn');expect(f.calls[0]).not.toContain('hira_sync_exclude_yn');});
 it('enabled on missing schema fails',async()=>{const f=setup(true,false,true);await expect(f.gateway.handle(request(),actor,7)).rejects.toThrow('B_MISSING_SCHEMA');});
 it('masks the value, and never exposes when field or section is denied',async()=>{const f=setup(true);const field=f.result.entries.find(e=>e.id==='lead.hiraExcluded')!;field.settings.masking='redact';expect(((await f.gateway.handle(request(),actor,7)).data as any).hira_sync_exclude_yn).toBe('***');field.settings.masking='none';field.readPermissions=['B.PRIVATE'];expect((await f.gateway.handle(request(),actor,7)).data).not.toHaveProperty('hira_sync_exclude_yn');field.readPermissions=[];f.result.entries.find(e=>e.id==='section:lead.hira')!.settings.enabled=false;expect((await f.gateway.handle(request(),actor,7)).data).not.toHaveProperty('hira_sync_exclude_yn');});
 it('blocks direct PATCH regardless of read flag',async()=>{for(const enabled of [true,false]){const f=setup(enabled);await expect(f.gateway.handle(request('PATCH',{hiraExcluded:'true'}),actor,7)).rejects.toMatchObject({code:'UNREGISTERED_FIELD'});}});
});
