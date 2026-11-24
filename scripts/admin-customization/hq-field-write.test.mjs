import test from 'node:test';import assert from 'node:assert/strict';import '../hq-standard/register.mjs';
const {SqlHqFieldWriter}=await import('../../backend/src/customization/hq-field-write.ts');
const {SqlHqExtensionDeploymentAuthority}=await import('../../backend/src/customization/sql-hq-extension-authority.ts');
const actor='11111111-1111-4111-8111-111111111111',company='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
class Db{
 state={fields:{},receipts:{},events:[],releases:{},links:[],assignments:[],head:null};hq=true;target=true;fail='';queries=[];
 async transaction(work){const next=structuredClone(this.state);const result=await work(this.query(next));this.state=next;return result;}
 query(s=this.state){return async(sql,p={})=>{this.queries.push(sql);if(this.fail&&sql.includes(this.fail))return {recordset:[],rowsAffected:[0]};let rows=[];
 if(sql.includes('sp_getapplock'))rows=[{result:0}];
 else if(sql.startsWith('SELECT u.user_id'))rows=this.hq?[{user_id:1,can_define:true,can_distribute:true}]:[];
 else if(sql.startsWith('SELECT c.company_id'))rows=this.target?[{company_id:2,payload_json:JSON.stringify({active:true,permissions:['config.publish'],denied:[]})}]:[];
 else if(sql.startsWith('SELECT request_hash'))rows=s.receipts[p.receiptId]?[s.receipts[p.receiptId]]:[];
 else if(sql.startsWith('SELECT public_id'))rows=Object.values(s.fields).filter(f=>f.key===p.key);
 else if(sql.startsWith('INSERT dbo.crm_standard_extension_field('))s.fields[p.id]={id:p.id,key:p.key};
 else if(sql.startsWith('INSERT dbo.crm_standard_extension_field_version'))s.fields[p.id].payload_json=p.payload;
 else if(sql.startsWith('SELECT TOP (101)'))rows=Object.values(s.fields).map(f=>({field_id:f.id,field_key:f.key,definition_version:1,payload_json:f.payload_json}));
 else if(sql.startsWith('SELECT v.payload_json'))rows=s.fields[p.id]?[s.fields[p.id]]:[];
 else if(sql.startsWith('SELECT release_id'))rows=s.head?[{release_id:s.head}]:[];
 else if(sql.startsWith('SELECT field_id,definition_version FROM dbo.crm_standard_extension_assignment'))rows=s.assignments;
 else if(sql.startsWith('INSERT dbo.crm_hq_extension_release('))s.releases[p.id]={payload_json:p.payload,content_hash:p.hash};
 else if(sql.startsWith('INSERT dbo.crm_hq_extension_release_field'))s.links.push({releaseId:p.releaseId,field_id:p.id,definition_version:p.version});
 else if(sql.startsWith('INSERT dbo.crm_standard_extension_assignment'))s.assignments.push({field_id:p.id,definition_version:p.version});
 else if(sql.startsWith('INSERT dbo.crm_hq_extension_target_head')||sql.startsWith('UPDATE dbo.crm_hq_extension_target_head'))s.head=p.id;
 else if(sql.startsWith('INSERT dbo.crm_hq_field_event'))s.events.push(p);
 else if(sql.startsWith('INSERT dbo.crm_hq_field_receipt'))s.receipts[p.receiptId]={request_hash:p.digest,payload_json:p.payload,content_hash:p.contentHash};
 else if(sql.startsWith('SELECT payload_json,content_hash'))rows=s.releases[p.hqReleaseId]?[s.releases[p.hqReleaseId]]:[];
 else if(sql.startsWith('SELECT field_id,definition_version FROM dbo.crm_hq_extension_release_field'))rows=s.links.filter(f=>f.releaseId===p.hqReleaseId).sort((a,b)=>a.field_id.localeCompare(b.field_id));
 else throw Error('Unexpected SQL '+sql);return {recordset:structuredClone(rows),rowsAffected:[1]};};}
}
const definition={key:'x_score',type:'number',labels:{'ko-KR':'Score','en-US':'Score'},min:0,max:10,reason:'Test'};
test('define and intended distribution persist atomically in registry format without CRM activation',async()=>{
 const db=new Db(),svc=new SqlHqFieldWriter(db),field=await svc.define(actor,definition,'one');assert.equal(field.min,0);
 const input={companyId:company,expectedHqReleaseId:null,fields:[{id:field.id,version:1}],reason:'Assign'};
 const result=await svc.distribute(actor,input,'two');assert.equal(result.requiresCompanyPublication,true);assert.equal(db.state.head,result.hqReleaseId);
 assert.equal(await new SqlHqExtensionDeploymentAuthority().verifyHqRelease({query:db.query(),companyKey:2},result.hqReleaseId,input.fields),true);
 assert.deepEqual(await svc.distribute(actor,input,'two'),result);assert.equal(db.state.events.length,2);
 assert.ok(db.queries.every(sql=>!sql.includes('INSERT dbo.crm_config_release')&&!sql.includes('UPDATE dbo.crm_config')));
 db.hq=false;await assert.rejects(svc.define(actor,definition,'one'),e=>e.code==='HQ_PERMISSION_REQUIRED');db.hq=true;db.target=false;await assert.rejects(svc.distribute(actor,input,'two'),e=>e.code==='HQ_TARGET_DENIED');
});
test('invalid, duplicate, stale and failed persistence leave committed state unchanged',async()=>{
 const db=new Db(),svc=new SqlHqFieldWriter(db),field=await svc.define(actor,definition,'one'),before=structuredClone(db.state);
 for(const fn of [()=>svc.define(actor,{...definition,max:-1},'bad'),()=>svc.define(actor,definition,'duplicate'),()=>svc.define(actor,{...definition,max:20},'one'),()=>svc.distribute(actor,{companyId:company,expectedHqReleaseId:actor,fields:[{id:field.id,version:1}],reason:'Assign'},'stale')]){await assert.rejects(fn());assert.deepEqual(db.state,before);}
 db.fail='INSERT dbo.crm_hq_field_receipt';await assert.rejects(svc.define(actor,{...definition,key:'x_other'},'rollback'),e=>e.code==='HQ_WRITE_FAILED');assert.deepEqual(db.state,before);
});
test('new assignment cannot remove previous fields and corruption is rejected',async()=>{
 const db=new Db(),svc=new SqlHqFieldWriter(db),f=await svc.define(actor,definition,'one');const r=await svc.distribute(actor,{companyId:company,expectedHqReleaseId:null,fields:[{id:f.id,version:1}],reason:'Assign'},'two');
 const other=await svc.define(actor,{...definition,key:'x_other'},'three');const before=structuredClone(db.state);
 await assert.rejects(svc.distribute(actor,{companyId:company,expectedHqReleaseId:r.hqReleaseId,fields:[{id:other.id,version:1}],reason:'Remove'},'four'),e=>e.code==='FIELD_REMOVAL_UNSUPPORTED');assert.deepEqual(db.state,before);
 db.state.releases[r.hqReleaseId].content_hash='bad';await assert.rejects(svc.distribute(actor,{companyId:company,expectedHqReleaseId:r.hqReleaseId,fields:[{id:f.id,version:1},{id:other.id,version:1}],reason:'Add'},'five'),e=>e.code==='HQ_REGISTRY_INVALID');
});
test('read returns authenticated capabilities and verified target intent without writes',async()=>{
 const db=new Db(),svc=new SqlHqFieldWriter(db),field=await svc.define(actor,definition,'field');
 const first=await svc.read(actor);assert.deepEqual(first.capabilities,{define:true,distribute:true});assert.equal(first.target,null);assert.deepEqual(first.definitions,[field]);
 const r=await svc.distribute(actor,{companyId:company,expectedHqReleaseId:null,fields:[{id:field.id,version:1}],reason:'Assign'},'assign');const before=structuredClone(db.state),read=await svc.read(actor,company);
 assert.deepEqual(read.target,{companyId:company,hqReleaseId:r.hqReleaseId,fields:[{id:field.id,version:1}]});assert.deepEqual(db.state,before);
 db.target=false;await assert.rejects(svc.read(actor,company),e=>e.code==='HQ_TARGET_DENIED');db.target=true;db.hq=false;await assert.rejects(svc.read(actor),e=>e.code==='HQ_PERMISSION_REQUIRED');db.hq=true;
 db.state.releases[r.hqReleaseId].content_hash='bad';await assert.rejects(svc.read(actor,company),e=>e.code==='HQ_REGISTRY_INVALID');
});
