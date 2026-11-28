import fs from 'node:fs';import path from 'node:path';
import {readContractCollections} from './collection-read';import {CompanyConfigurationService} from './config-service';import {emptyConfigState} from './config-store';import {resolveCompanyConfig} from '@dio-crm/contracts/crm-customization';
const artifact=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../packages/contracts/catalogs/hq-collection-review.json'),'utf8')),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',actor={id,companyId};
describe('configured collection reads',()=>{
 function fixture(){
  const permissions=[...new Set(['runtime.read',...artifact.catalog.entries.flatMap((e:any)=>[...e.permissions,...e.readPermissions,...e.writePermissions])])];const state:any=emptyConfigState(companyId,{[id]:{active:true,permissions:permissions as string[],denied:[]}});state.activeReleaseId=id;state.releases[id]={id,effective:resolveCompanyConfig(artifact.catalog,{companyId,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[]} as any)};const f={owner:7,paid:30.01};
  const queries:string[]=[],repo={transact:async(_c:any,_a:any,work:any)=>work({state,identityActive:true,domain:{companyKey:9,query:async(sql:string,p:any)=>{
   queries.push(sql);if(sql.startsWith('SELECT contract_id')){expect(p).toMatchObject({companyKey:9,userKey:7,publicId:id});return {recordset:f.owner===p.userKey?[{contract_id:1,contract_amount:100.01}]:[]};}
   if(sql.startsWith('SELECT ISNULL(SUM(amount),0) actual_total'))return {recordset:[{actual_total:f.paid}]};
   if(sql.startsWith('SELECT ISNULL(SUM(amount),0) plan_total'))return {recordset:[{plan_total:100.01,overdue_total:50.01}]};
   return {recordset:[{company_id:9,public_id:id,erp_collection_no:'ERP1',amount:f.paid,collected_at:'2026-12-01T10:30:00',source_system:'ERP'}]};
  }}})};
  const service=new CompanyConfigurationService(repo as any,[]),run=(suffix='reconciliation')=>readContractCollections(service,{method:'GET',path:'/api/contracts/'+id+'/'+suffix,query:{}} as any,actor,7);
  return {run,queries,state,f,field:(key:string,patch:any)=>Object.assign(state.releases[id].effective.entries.find((e:any)=>e.id===key).settings,patch)};
 }
 it('summary uses exact cents and projected derived values',async()=>{const f=fixture(),r=await f.run();expect(r.data).toEqual({summary:[{contractAmount:100.01,currentPlanTotal:100.01,actualTotal:30.01,overduePlanTotal:50.01,outstandingAmount:70,correctionRequired:true}]});});
 it('other owner cannot read actuals',async()=>{const f=fixture();f.f.owner=8;await expect(f.run('collections')).rejects.toMatchObject({code:'NOT_FOUND'});expect(f.queries).toHaveLength(1);});
 it('masked actual amount blocks aggregates before query',async()=>{const f=fixture();f.field('actual.amount',{masking:'redact'});await expect(f.run()).rejects.toMatchObject({code:'QUERY_FIELD_DENIED'});expect(f.queries).toHaveLength(0);});
 it('hidden collection section returns no summary or count',async()=>{const f=fixture();f.field('section:collection.actual',{visible:false});expect((await f.run()).data).toEqual({});expect(f.queries).toHaveLength(0);});
 it('actual projection preserves timestamp and hides ERP ID',async()=>{const f=fixture();f.field('actual.erpCollectionNo',{visible:false});const r=await f.run('collections');expect((r.data as any[])[0]).toEqual({public_id:id,amount:30.01,collected_at:'2026-12-01T10:30:00',source_system:'ERP'});});
 it('revoked collection permission cannot obtain identities',async()=>{const f=fixture();f.state.members[id].denied=['COLLECTION.READ'];await expect(f.run('collections')).rejects.toMatchObject({code:'QUERY_FIELD_DENIED'});expect(f.queries).toHaveLength(0);});
 it('overpayment yields zero outstanding and no correction',async()=>{const f=fixture();f.f.paid=200;const r=await f.run();expect((r.data as any).summary[0]).toMatchObject({outstandingAmount:0,correctionRequired:false});});
});
