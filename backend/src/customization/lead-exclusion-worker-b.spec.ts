import fs from 'node:fs';
import path from 'node:path';
import {resolveCompanyConfig} from '@dio-crm/contracts/crm-customization';
import {emptyConfigState} from './config-store';
import {CompanyConfigurationService} from './config-service';
import {ConfiguredLeadGateway} from './lead-gateway';

const A='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',U='11111111-1111-4111-8111-111111111111',R='33333333-3333-4333-8333-333333333333',ID='55555555-5555-4555-8555-555555555555',actor={companyId:A,id:U};
const artifact=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../packages/contracts/catalogs/hq-codes-review.json'),'utf8'));
function fixture(){
 const permissions=[...new Set(['runtime.read','runtime.write','LEAD.READ','LEAD.WRITE',...artifact.catalog.entries.flatMap((e:any)=>[...e.permissions,...e.readPermissions,...e.writePermissions])])] as string[];
 let state:any=emptyConfigState(A,{[U]:{active:true,permissions,denied:[]}});state.activeReleaseId=R;state.releases[R]={id:R,companyId:A,effective:resolveCompanyConfig(artifact.catalog,{companyId:A,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[]} as any)};
 let db:any={row:{company_id:9,owner_user_id:7,status:'CONTACT_EXCLUDED',contact_exclude_reason:'before',hospital_name:'Clinic',version:'0x0000000000000001'},history:[]};let fail=false;const calls:any[]=[],versions=new Map<string,string>();
 const repo={transact:async(_c:any,_a:any,work:any)=>{const next=JSON.parse(JSON.stringify(state)),d=JSON.parse(JSON.stringify(db));const query=async(sql:string,p:any={})=>{calls.push({sql,p});
  if(sql.startsWith('SELECT company_id,owner_user_id,status,'))return {recordset:[d.row]};
  if(sql.startsWith('SELECT status,contact_exclude_reason FROM dbo.crm_lead'))return {recordset:[d.row]};
  if(sql.startsWith('UPDATE crm_lead')){if(p.expectedVersion!==d.row.version)return {recordset:[],rowsAffected:[0]};for(const m of sql.matchAll(/(\w+)=@v(\d+)/g))d.row[m[1]]=p['v'+m[2]];d.row.version='0x'+(BigInt(d.row.version)+1n).toString(16).padStart(16,'0');return {recordset:[],rowsAffected:[1]};}
  if(sql.startsWith('INSERT INTO dbo.crm_audit_log')){if(fail)throw Error('audit failure');d.history.push({before:JSON.parse(p.beforeJson),after:JSON.parse(p.afterJson),actor:p.userKey,company:p.companyKey});return {recordset:[],rowsAffected:[1]};}
  throw Error('unexpected query '+sql);
 };const result=await work({state:next,identityActive:true,domain:{companyKey:9,query}});state=next;db=d;return result;}};
 const gateway=new ConfiguredLeadGateway(new CompanyConfigurationService(repo as any,[]));
 const save=(value:any,key='request',who=actor,version?:string)=>{if(!versions.has(key))versions.set(key,version??db.row.version);return gateway.handle({method:'PATCH',path:'/api/leads/'+ID,query:{},body:{contactExcludeReason:value,expectedVersion:versions.get(key)},headers:{'x-config-release-id':R,'x-config-permission-version':'1','idempotency-key':key}} as any,who,7);};
 return {save,get:()=>({state,db}),calls,fail:(v:boolean)=>{fail=v;}};
}
describe('worker B actual configuration service and lead gateway with transactional SQL fake',()=>{
 it('replays same key without extra UPDATE or history, rejects changed payload',async()=>{const f=fixture();await f.save('after');const count=()=>f.calls.filter(c=>c.sql.startsWith('UPDATE crm_lead')).length;expect(count()).toBe(1);await f.save('after');expect(count()).toBe(1);await expect(f.save('different')).rejects.toBeDefined();expect(count()).toBe(1);expect(f.get().db.history).toHaveLength(1);expect(f.get().db.history[0]).toMatchObject({before:{contactExcludeReason:'before'},after:{contactExcludeReason:'after'},company:9,actor:7});expect(f.calls.some(c=>c.sql.includes('UPDLOCK,HOLDLOCK'))).toBe(true);});
 it('rolls back failed history and receipt and can retry the same key',async()=>{const f=fixture();const before=JSON.stringify(f.get());f.fail(true);await expect(f.save('after')).rejects.toThrow('audit failure');expect(JSON.stringify(f.get())).toBe(before);f.fail(false);await f.save('after');expect(f.get().db.history).toHaveLength(1);});
 it('same value with a new request updates the row but creates no extra history',async()=>{const f=fixture();await f.save('after','first');await f.save('after','second');expect(f.calls.filter(c=>c.sql.startsWith('UPDATE crm_lead'))).toHaveLength(2);expect(f.get().db.history).toHaveLength(1);});
 it('rejects an unknown member before data mutation',async()=>{const f=fixture();const before=JSON.stringify(f.get());await expect(f.save('after','request',{companyId:A,id:'22222222-2222-4222-8222-222222222222'})).rejects.toBeDefined();expect(JSON.stringify(f.get())).toBe(before);});
 it('uses row-version compare-and-swap and rejects a stale new request',async()=>{const f=fixture();await f.save('after','first');const before=JSON.stringify(f.get());await expect(f.save('new value','second')).resolves.toBeDefined();expect(f.calls.some(c=>c.sql.startsWith('UPDATE crm_lead')&&c.sql.includes('row_version=CONVERT(binary(8),@expectedVersion,1)'))).toBe(true);const stale=JSON.stringify(f.get());await expect(f.save('stale','third',actor,'0x0000000000000001')).rejects.toMatchObject({code:'LEAD_CHANGED'});expect(JSON.stringify(f.get())).toBe(stale);expect(before).not.toBe(stale);});
});

