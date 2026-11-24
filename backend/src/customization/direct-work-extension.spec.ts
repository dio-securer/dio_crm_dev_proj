import fs from 'node:fs';import path from 'node:path';
import {resolveCompanyConfig} from '@dio-crm/contracts/crm-customization';
import {emptyConfigState} from './config-store';import {CompanyConfigurationService} from './config-service';import {executeDirectWorkExtension} from './direct-work-extension';

const artifact=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../packages/contracts/catalogs/hq-codes-review.json'),'utf8'));
const actorId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',workId='cccccccc-cccc-4ccc-8ccc-cccccccccccc',priorId='dddddddd-dddd-4ddd-8ddd-dddddddddddd',actor={id:actorId,companyId};

function fixture(){
 const permissions=[...new Set(['runtime.read','runtime.write',...artifact.catalog.entries.flatMap((entry:any)=>[...entry.permissions,...entry.readPermissions,...entry.writePermissions])])];let state:any=emptyConfigState(companyId,{[actorId]:{active:true,permissions,denied:[]}});
 state.activeReleaseId=actorId;state.releases[actorId]={id:actorId,config:{},effective:resolveCompanyConfig(artifact.catalog,{companyId,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[]} as any)};
 state.fixture={status:'REQUESTED',step:'BRANCH',branch:8,division:9,round:2,activity:'COMPLETED',erp:'NOT_REQUESTED',requestId:priorId,priorStatus:'FAILED',candidate:12,candidateValid:true,writes:[]};
 const queries:Array<{sql:string;params:any}>=[],repo={transact:async(_company:any,_actor:any,work:any)=>{const copy=JSON.parse(JSON.stringify(state)),f=copy.fixture;const result=await work({state:copy,identityActive:true,domain:{companyKey:7,query:async(sql:string,params:any={})=>{
  queries.push({sql,params});if(sql.startsWith('SELECT country_code'))return {recordset:[{country_code:'KR',market_profile_code:null}]};
  if(sql.startsWith('SELECT d.direct_work_id'))return {recordset:[{direct_work_id:3,activity_id:4,owner_user_id:5,status:f.status,approval_round:f.round,branch_approver_user_id:f.branch,division_approver_user_id:f.division,erp_sync_status:f.erp,erp_request_id:f.requestId,work_type:'DIRECT_WORK',reason:'Visit',activity_status:f.activity}]};
  if(sql.startsWith('SELECT DISTINCT TOP 100'))return {recordset:f.candidateValid?[{user_id:f.candidate,user_name:'Approver'}]:[]};
  if(sql.startsWith('SELECT status FROM crm_interface_log'))return {recordset:[{status:f.priorStatus}]};
  if(sql.startsWith('SELECT COALESCE'))return {recordset:[{locale:'ko-KR'}]};
  f.writes.push({sql,params});if(sql.startsWith('UPDATE crm_direct_work SET branch_approver_user_id'))f.branch=params.after;
  if(sql.startsWith('UPDATE crm_direct_work SET division_approver_user_id'))f.division=params.after;
  if(sql.startsWith('UPDATE crm_direct_work SET erp_sync_status')){f.erp='REQUESTING';f.requestId=params.requestId;}
  return {recordset:[],rowsAffected:[1]};
 }}});state=copy;return result;}};
 const service=new CompanyConfigurationService(repo as any,[]),run=(suffix:string,body?:unknown,requestKey='key',method='POST',query:any={})=>executeDirectWorkExtension(service,{method,path:'/api/direct-works/'+workId+suffix,body,query,headers:{'x-config-release-id':actorId,'x-config-permission-version':'1','idempotency-key':requestKey}} as any,actor,6);
 return {run,queries,get:()=>state,edit:(mutate:(state:any)=>void)=>mutate(state)};
}

describe('direct work #36 managed commands',()=>{
 it('lists only current-step eligible approvers',async()=>{const f=fixture();const result=await f.run('/approvers',undefined,'key','GET',{step:'BRANCH'});expect(result.data).toEqual([{public_id:'12',name:'Approver'}]);expect(f.queries.find(q=>q.sql.startsWith('SELECT DISTINCT TOP 100'))?.sql).toContain('u.organization_id=owner.organization_id');await expect(f.run('/approvers',undefined,'key','GET',{step:'DIVISION'})).rejects.toMatchObject({code:'DIRECT_WORK_STATE_CONFLICT'});});
 it('reassigns the current step with candidate policy and audits reason once',async()=>{const f=fixture(),body={step:'BRANCH',approverUserId:12,reason:'Coverage'};await f.run('/reassign',body);await f.run('/reassign',body);expect(f.get().fixture.branch).toBe(12);expect(f.get().fixture.writes.filter((w:any)=>w.sql.startsWith('UPDATE crm_direct_work SET branch_approver_user_id'))).toHaveLength(1);expect(f.get().fixture.writes.find((w:any)=>w.sql.startsWith('INSERT INTO crm_approval_action'))?.params.reason).toBe('Coverage');expect(f.get().fixture.writes.some((w:any)=>w.sql.startsWith('INSERT INTO crm_audit_log'))).toBe(true);});
 it('allows an unassigned current step through a null-safe state check',async()=>{const f=fixture();f.edit(s=>s.fixture.branch=null);await f.run('/reassign',{step:'BRANCH',approverUserId:12,reason:'Vacant'});const update=f.get().fixture.writes.find((w:any)=>w.sql.startsWith('UPDATE crm_direct_work SET branch_approver_user_id'));expect(update.sql).toContain('branch_approver_user_id IS NULL AND @before IS NULL');expect(update.params.before).toBeNull();});
 it('rejects wrong step, missing candidate and permission revocation before a write',async()=>{const f=fixture();await expect(f.run('/reassign',{step:'DIVISION',approverUserId:12,reason:'Coverage'})).rejects.toMatchObject({code:'DIRECT_WORK_STATE_CONFLICT'});f.edit(s=>s.fixture.candidateValid=false);await expect(f.run('/reassign',{step:'BRANCH',approverUserId:12,reason:'Coverage'})).rejects.toMatchObject({code:'APPROVER_INVALID'});expect(f.get().fixture.writes).toHaveLength(0);f.edit(s=>s.members[actorId].denied.push('DIRECT_WORK.MANAGE'));await expect(f.run('/reassign',{step:'BRANCH',approverUserId:12,reason:'Coverage'})).rejects.toMatchObject({code:'ACTION_DENIED'});});
 it('creates a new ERP correlation after a settled failure and replays the same command',async()=>{const f=fixture();f.edit(s=>{s.fixture.status='DIVISION_APPROVED';s.fixture.erp='FAILED';});const first=await f.run('/erp/retry',{}),second=await f.run('/erp/retry',{});expect((first.data as any).requestId).not.toBe(priorId);expect((second.data as any).requestId).toBe((first.data as any).requestId);expect(f.get().outbox).toHaveLength(1);expect(f.get().outbox[0].delivery.actionId).toBe('DW.erpRetry');expect(f.get().fixture.writes.filter((w:any)=>w.sql.startsWith('INSERT INTO crm_interface_log'))).toHaveLength(1);});
 it('keeps uncertain delivery on its original correlation and rejects new business retry',async()=>{const f=fixture();f.edit(s=>{s.fixture.status='DIVISION_APPROVED';s.fixture.erp='TIMED_OUT';s.fixture.priorStatus='TIMED_OUT';s.outbox=[{id:priorId,type:'DOMAIN_DELIVERY',status:'PENDING',delivery:{unknownOutcome:true}}];});await expect(f.run('/erp/retry',{})).rejects.toMatchObject({code:'DELIVERY_OUTCOME_UNKNOWN'});expect(f.get().fixture.writes).toHaveLength(0);});
});
