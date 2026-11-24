import {ConfiguredLeadGateway} from './lead-gateway';

const actor={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',companyId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};
const rowId='cccccccc-cccc-4ccc-8ccc-cccccccccccc', release='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const policy={authenticated:true,companyId:actor.companyId,allowed:['LEAD.READ','LEAD.WRITE'],denied:[]};

function fixture(status='CONTACT_EXCLUDED',reason:string|null='before'){
 let db={row:{company_id:9,owner_user_id:7,status,contact_exclude_reason:reason,hospital_name:'Clinic'},history:[] as any[]};
 let failHistory=false;
 const service={writeSqlFields:async(_actor:any,_context:any,_action:any,_id:any,_key:any,input:any,adapter:any)=>{
  const next=structuredClone(db);
  const query=async(sql:string,p:any={})=>{
   if(sql.startsWith('SELECT company_id,owner_user_id,status,'))return {recordset:[next.row]};
   if(sql.startsWith('SELECT status,contact_exclude_reason FROM dbo.crm_lead'))return {recordset:[next.row]};
   if(sql.startsWith('UPDATE crm_lead')){if(sql.includes('contact_exclude_reason=@v0'))next.row.contact_exclude_reason=p.v0;return {recordset:[],rowsAffected:[1]};}
   if(sql.startsWith('INSERT INTO dbo.crm_audit_log')){if(failHistory)throw Error('history unavailable');next.history.push({before:JSON.parse(p.beforeJson),after:JSON.parse(p.afterJson),actor:p.userKey,company:p.companyKey});return {recordset:[],rowsAffected:[1]};}
   throw Error('unexpected query '+sql);
  };
  const domain={companyKey:9,query};await adapter.load(domain,actor,policy);
  const columns:Record<string,unknown>={};if(Object.hasOwn(input,'contactExcludeReason'))columns.contact_exclude_reason=input.contactExcludeReason;
  await adapter.save(domain,columns);db=next;return {data:next.row};
 }};
 const gateway=new ConfiguredLeadGateway(service as any);
 const save=(body:any)=>gateway.handle({method:'PATCH',path:'/api/leads/'+rowId,query:{},body:{...body,expectedVersion:'0x0000000000000001'},headers:{'x-config-release-id':release,'x-config-permission-version':'1','idempotency-key':'test'}} as any,actor,7);
 return {save,get:()=>structuredClone(db),failHistory:()=>{failHistory=true;}};
}

describe('lead exclusion reason audit (synthetic domain transaction)',()=>{
 it('writes before/after once, and leaves identical values without a history entry',async()=>{const f=fixture();await f.save({contactExcludeReason:'after'});expect(f.get().history).toEqual([{before:{contactExcludeReason:'before'},after:{contactExcludeReason:'after'},actor:7,company:9}]);await f.save({contactExcludeReason:'after'});expect(f.get().history).toHaveLength(1);});
 it('rejects blank only when an excluded reason changes, and accepts up to 500 UTF-16 units',async()=>{const f=fixture();for(const value of [null,'  ','x'.repeat(501)])await expect(f.save({contactExcludeReason:value})).rejects.toBeDefined();expect(f.get().history).toHaveLength(0);await f.save({contactExcludeReason:'x'.repeat(500)});expect(f.get().history).toHaveLength(1);});
 it('preserves old behavior outside the excluded state',async()=>{const f=fixture('NEW');await f.save({contactExcludeReason:null});expect(f.get().row.contact_exclude_reason).toBeNull();expect(f.get().history).toHaveLength(1);});
 it('does not reject an unrelated save for an old excluded row with blank reason',async()=>{const f=fixture('CONTACT_EXCLUDED',null);await expect(f.save({phone:'1'})).resolves.toBeDefined();expect(f.get().history).toHaveLength(0);});
 it('rolls back the reason update when its history insert fails',async()=>{const f=fixture();const before=f.get();f.failHistory();await expect(f.save({contactExcludeReason:'after'})).rejects.toThrow('history unavailable');expect(f.get()).toEqual(before);});
});
