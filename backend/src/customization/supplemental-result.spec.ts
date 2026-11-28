import fs from 'node:fs';import path from 'node:path';import {applySupplementalResult} from './supplemental-result-http';import {CompanyConfigurationService} from './config-service';import {emptyConfigState} from './config-store';import {resolveCompanyConfig} from '@dio-crm/contracts/crm-customization';
import {createDomainDeliveryAdapter,createChangedPlanDeliveryAdapter} from './domain-delivery-adapters';
const artifact=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../packages/contracts/catalogs/hq-erp-command-review.json'),'utf8')),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',requestId='cccccccc-cccc-4ccc-8ccc-cccccccccccc',companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',actor={id,companyId};
describe('supplemental ERP results and domain delivery adapters',()=>{
 function fixture(plan=true){
  const permissions=[...new Set(['runtime.read','runtime.write',...artifact.catalog.entries.flatMap((e:any)=>[...e.permissions,...e.readPermissions,...e.writePermissions])])];let state:any=emptyConfigState(companyId,{[id]:{active:true,permissions:permissions as string[],denied:[]}});state.activeReleaseId=id;state.releases[id]={id,effective:resolveCompanyConfig(artifact.catalog,{companyId,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[]} as any)};
  state.outbox=[{id:requestId,type:'DOMAIN_DELIVERY',releaseId:id,status:'SENT',delivery:{actorId:id,permissionVersion:1,actionId:plan?'COL.planChange':'DW.decision.division',interfaceCode:plan?'IF-ERP-011':'IF-ERP-012',entityId:id,sourceFieldIds:[],payload:plan?{planVersion:4,previousVersion:1}:{},attempts:1,unknownOutcome:false,lastError:null}}];state.pendingActions[state.outbox[0].delivery.actionId]=1;state.fixture={writes:[],currentVersion:4};
  const repo={transact:async(_c:any,_a:any,work:any)=>{const copy=JSON.parse(JSON.stringify(state)),f=copy.fixture;const r=await work({state:copy,identityActive:true,domain:{companyKey:9,query:async(sql:string,p:any)=>{
   if(sql.startsWith('SELECT'))return {recordset:f.missing?[]:[{id:1,contract_id:1}]};
   f.writes.push({sql,p});if(f.fail&&sql.startsWith('UPDATE crm_interface_log'))throw Error('interface failure');
   if(sql.startsWith('UPDATE crm_collection_plan SET is_current=1'))f.currentVersion=p.previous;
   return {recordset:[],rowsAffected:[1]};
  }}});state=copy;return r;}};
  const service=new CompanyConfigurationService(repo as any,[]),run=(success:boolean,key='request')=>applySupplementalResult(service,{method:'POST',path:'/api/erp-results/'+(plan?'collection-plan':'direct-work'),query:{},headers:{'x-config-release-id':id,'x-config-permission-version':'1','idempotency-key':key},body:{requestId,entityId:id,success}} as any,actor);
  return {run,get:()=>state,edit:(fn:(s:any)=>void)=>fn(state)};
 }
 it('failed changed plan restores the actual previous active version across version gaps',async()=>{const f=fixture();await f.run(false);expect(f.get().fixture.currentVersion).toBe(1);expect(f.get().pendingActions['COL.planChange']).toBe(0);await f.run(false,'duplicate');expect(f.get().fixture.writes).toHaveLength(3);});
 it('successful changed plan remains current and becomes locked',async()=>{const f=fixture();await f.run(true);expect(f.get().fixture.currentVersion).toBe(4);expect(f.get().fixture.writes[0].p.success).toBe(true);expect(f.get().fixture.writes).toHaveLength(2);});
 it('interface failure rolls back restoration and completion',async()=>{const f=fixture();f.edit(s=>s.fixture.fail=true);const before=JSON.stringify(f.get());await expect(f.run(false)).rejects.toThrow('interface failure');expect(JSON.stringify(f.get())).toBe(before);});
 it('direct work result closes matching pending business count once',async()=>{const f=fixture(false);await f.run(true);await f.run(true,'duplicate');expect(f.get().pendingActions['DW.decision.division']).toBe(0);expect(f.get().fixture.writes).toHaveLength(2);});
 it('cancelled delivery cannot be resurrected by a callback',async()=>{const f=fixture(false);f.edit(s=>s.outbox[0].status='CANCELLED');await expect(f.run(true)).rejects.toMatchObject({code:'DELIVERY_RESULT_NOT_EXPECTED'});});
 it('unmatched entity request denies before mutation',async()=>{const f=fixture();f.edit(s=>s.fixture.missing=true);await expect(f.run(true)).rejects.toMatchObject({code:'DELIVERY_ENTITY_CHANGED'});});
 it('adapter checks current assigned approver and completed activity before direct work send',async()=>{
  const sqls:string[]=[],transport={supportsIdempotency:true as const,send:jest.fn()},adapter=createDomainDeliveryAdapter('IF-ERP-012',transport),job=fixture(false).get().outbox[0].delivery;
  await adapter.authorize({domain:{companyKey:9,query:async(sql:string)=>{sqls.push(sql);return {recordset:sql.startsWith('SELECT country_code')?[{country_code:'KR',market_profile_code:null}]:[{id:1}]};}}} as any,job,requestId);
  expect(sqls[1]).toContain('e.division_approver_user_id=u.user_id');expect(sqls[1]).toContain("a.status='COMPLETED'");expect(transport.send).not.toHaveBeenCalled();
 });
 it('account delivery cancellation cleans up only the matching pending request',async()=>{
  const query=jest.fn().mockResolvedValue({recordset:[],rowsAffected:[1]}),adapter=createDomainDeliveryAdapter('IF-ERP-002',{supportsIdempotency:true,send:jest.fn()});await adapter.cancelled({domain:{companyKey:9,query}} as any,{entityId:id} as any,requestId);expect(query.mock.calls[0][0]).toContain("last_erp_request_id=@requestId AND integration_status='REQUESTING'");expect(query.mock.calls[0][1]).toMatchObject({companyKey:9,entityId:id,requestId});
 });
 it('changed plan adapter rejects changed owner/request without transport',async()=>{const transport={supportsIdempotency:true as const,send:jest.fn()},adapter=createChangedPlanDeliveryAdapter(transport);await expect(adapter.authorize({domain:{companyKey:9,query:async()=>({recordset:[]})}} as any,fixture().get().outbox[0].delivery,requestId)).rejects.toMatchObject({code:'DELIVERY_ENTITY_CHANGED'});expect(transport.send).not.toHaveBeenCalled();});
});
