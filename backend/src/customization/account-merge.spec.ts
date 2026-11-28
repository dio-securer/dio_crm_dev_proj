import fs from 'node:fs';import path from 'node:path';
import {handleAccountMerge} from './account-merge';import {CompanyConfigurationService} from './config-service';import {emptyConfigState} from './config-store';import {resolveCompanyConfig} from '@dio-crm/contracts/crm-customization';
const artifact=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../packages/contracts/catalogs/hq-account-merge-review.json'),'utf8')),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',duplicate='cccccccc-cccc-4ccc-8ccc-cccccccccccc',companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',actor={id,companyId};
describe('configured account duplicates and merge',()=>{
 function fixture(){
  const permissions=[...new Set(['runtime.read','runtime.write',...artifact.catalog.entries.flatMap((e:any)=>[...e.permissions,...e.readPermissions,...e.writePermissions])])];let state:any=emptyConfigState(companyId,{[id]:{active:true,permissions:permissions as string[],denied:[]}});state.activeReleaseId=id;state.releases[id]={id,effective:resolveCompanyConfig(artifact.catalog,{companyId,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[]} as any)};state.fixture={writes:[],merged:false};
  const queries:string[]=[],repo={transact:async(_c:any,_a:any,work:any)=>{const copy=JSON.parse(JSON.stringify(state)),f=copy.fixture;const r=await work({state:copy,identityActive:true,domain:{companyKey:9,query:async(sql:string,p:any)=>{
   queries.push(sql);
   if(sql.startsWith('SELECT account_id,CONVERT')){const dup=p.publicId===duplicate;return {recordset:f.missing&&dup?[]:[{account_id:dup?2:1,public_id:p.publicId,account_name:'Hospital',business_no:f.businessMismatch&&dup?'other':'123',erp_customer_code:null,integration_status:'NOT_REQUESTED',account_status:dup&&f.merged?'MERGED':'ACTIVE',merged_into_account_id:dup&&f.merged?1:null,deleted_yn:dup&&f.merged?true:false}]};}
   if(sql.startsWith('SELECT owner_user_id'))return {recordset:f.collision?[{owner_user_id:7,planned_date:'2026-12-01'}]:[]};
   if(sql.startsWith('SELECT TOP 1 account_id'))return {recordset:f.financial&&sql.includes('crm_contract')||f.children&&sql.includes('crm_contact')?[{account_id:2}]:[]};
   if(sql.startsWith('SELECT TOP 1 event_id'))return {recordset:f.eventOnly?[{event_id:4}]:[]};
   if(sql.startsWith('SELECT TOP 1 activity_id'))return {recordset:[]};
   if(sql.startsWith('SELECT'))return {recordset:[{company_id:9,public_id:duplicate,account_name:'Hospital',business_no:'123',account_status:'ACTIVE',erp_customer_code:null}]};
   f.writes.push(sql);if(f.fail&&sql.startsWith('INSERT INTO crm_account_merge_history'))throw Error('history failure');if(sql.startsWith('UPDATE crm_account SET'))f.merged=true;return {recordset:[],rowsAffected:[1]};
  }}});state=copy;return r;}};
  const service=new CompanyConfigurationService(repo as any,[]),run=(method='POST',body:any={primaryPublicId:id,duplicatePublicIds:[duplicate]})=>handleAccountMerge(service,{method,path:method==='GET'?'/api/accounts/duplicates/123':'/api/accounts/merge',body,query:{},headers:{'x-config-release-id':id,'x-config-permission-version':'1','idempotency-key':'request'}} as any,actor,7);
  return {run,queries,get:()=>state,edit:(fn:(s:any)=>void)=>fn(state),field:(key:string,patch:any)=>Object.assign(state.releases[id].effective.entries.find((e:any)=>e.id===key).settings,patch)};
 }
 it('merges atomically once and allows replay of its own tombstone',async()=>{const f=fixture();await f.run();await f.run();expect(f.get().fixture.merged).toBe(true);expect(f.get().fixture.writes).toHaveLength(6);});
 it('missing or other-company account denies before write',async()=>{const f=fixture();f.edit(s=>s.fixture.missing=true);await expect(f.run()).rejects.toMatchObject({code:'NOT_FOUND'});expect(f.get().fixture.writes).toHaveLength(0);expect(f.queries[0]).toContain('company_id=@companyKey');});
 it('different business numbers reject merge',async()=>{const f=fixture();f.edit(s=>s.fixture.businessMismatch=true);await expect(f.run()).rejects.toMatchObject({code:'ACCOUNT_MERGE_CONFLICT'});});
 it('financial history requires review without mutation',async()=>{const f=fixture();f.edit(s=>s.fixture.financial=true);await expect(f.run()).rejects.toMatchObject({code:'ACCOUNT_MERGE_FINANCIAL_HISTORY'});expect(f.get().fixture.writes).toHaveLength(0);});
 it('activity daily target conflict rolls back whole merge',async()=>{const f=fixture();f.edit(s=>s.fixture.collision=true);await expect(f.run()).rejects.toMatchObject({code:'ACTIVITY_DUPLICATE'});expect(f.get().fixture.writes).toHaveLength(0);});
 it('readonly selected duplicate collection cannot be submitted',async()=>{const f=fixture();f.field('merge.duplicatePublicIds',{readOnly:true});await expect(f.run()).rejects.toMatchObject({code:'FIELD_WRITE_DENIED'});});
 it('child account assignment policy enforced',async()=>{const f=fixture();f.edit(s=>s.fixture.children=true);f.field('contact.accountPublicId',{readOnly:true});await expect(f.run()).rejects.toMatchObject({code:'FIELD_WRITE_DENIED'});});
 it.each(['readOnly','visible'])('event-only association honors %s policy',async setting=>{const f=fixture();f.edit(s=>s.fixture.eventOnly=true);f.field('activity.relatedPublicId',{[setting]:setting==='readOnly'});await expect(f.run()).rejects.toMatchObject({code:'FIELD_WRITE_DENIED'});expect(f.get().fixture.writes).toHaveLength(0);});
 it('history failure restores all moved children and receipt',async()=>{const f=fixture();f.edit(s=>s.fixture.fail=true);const before=JSON.stringify(f.get());await expect(f.run()).rejects.toThrow('history failure');expect(JSON.stringify(f.get())).toBe(before);});
 it('masked business number cannot be used for duplicate search',async()=>{const f=fixture();f.field('account.erp.biz_no',{masking:'redact'});await expect(f.run('GET')).rejects.toMatchObject({code:'QUERY_FIELD_DENIED'});expect(f.queries).toHaveLength(0);});
 it('duplicate list never emits internal numeric account ID',async()=>{const f=fixture();const r=await f.run('GET');expect((r.data as any[])[0]).not.toHaveProperty('account_id');expect(f.queries[0]).toContain('(@manager=1 OR owner_user_id=@userKey)');});
 it('revoked merge permission denies replay',async()=>{const f=fixture();await f.run();f.edit(s=>s.members[id].denied=['ACCOUNT.MERGE']);await expect(f.run()).rejects.toMatchObject({code:'ACTION_DENIED'});});
});
