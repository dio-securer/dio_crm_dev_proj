import fs from 'node:fs';
import path from 'node:path';
import { resolveCompanyConfig } from '@dio-crm/contracts/crm-customization';
import { emptyConfigState } from './config-store';
import { makeSqlLeadExtensionPortFactory } from './sql-lead-extension-product';
import { executeLeadExtensionRequest, readLeadExtensionRequest } from './lead-extension-request';

const A='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',U='11111111-1111-4111-8111-111111111111',R='33333333-3333-4333-8333-333333333333',ID='55555555-5555-4555-8555-555555555555',F='abcdefab-cdef-4abc-8def-abcdefabcdef',actor={companyId:A,id:U};
const artifact=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../packages/contracts/catalogs/hq-codes-review.json'),'utf8'));
jest.mock('./extension-release-snapshot',()=>({loadExtensionReleaseSnapshot:async(tx:any)=>({companyId:tx.state.companyId,configReleaseId:tx.state.activeReleaseId,hqReleaseId:'44444444-4444-4444-8444-444444444444',fields:[{id:'abcdefab-cdef-4abc-8def-abcdefabcdef',version:1,type:'text',required:false,labels:{'ko-KR':'메모','en-US':'Note'}}]})}));
const req=(method:string,body:any,key='one',query:any={})=>({method,path:method==='POST'?'/api/leads':'/api/leads/'+ID,body,query,headers:{'x-config-release-id':R,'x-config-permission-version':'1','idempotency-key':key}} as any);
function fixture(){
 const permissions=[...new Set(['runtime.read','runtime.write','LEAD.READ','LEAD.WRITE',`fields.${F}.read`,`fields.${F}.write`,...artifact.catalog.entries.flatMap((e:any)=>[...e.permissions,...e.readPermissions,...e.writePermissions])])] as string[];
 let state:any=emptyConfigState(A,{[U]:{active:true,permissions,denied:[]}});state.activeReleaseId=R;state.releases[R]={id:R,companyId:A,effective:resolveCompanyConfig(artifact.catalog,{companyId:A,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[]} as any)};
 let db:any={exists:false,revision:0,values:{},version:'0x0000000000000001',audits:0,base:{hospital_name:'Clinic',owner_user_id:7,status:'NEW'}};let fail=false;const calls:string[]=[];
 const repo={transact:async(_c:string,_a:string,work:any)=>{const next=structuredClone(state),d=structuredClone(db);const query=async(sql:string,p:any={})=>{calls.push(sql);
  if(sql.includes('p.permission_code=@permission'))return {recordset:[{permission_code:p.permission}]};
  if(sql.includes('SELECT user_id FROM dbo.crm_user'))return {recordset:[{user_id:7}]};
  if(sql.includes('SELECT user_id FROM crm_user'))return {recordset:[{user_id:7}]};
  if(sql.includes('FROM dbo.crm_lead l'))return {recordset:d.exists?[{company_public_id:A,lead_public_id:ID,owner_public_id:U,version:d.version}]:[]};
  if(sql.includes('SELECT owner_user_id,status,'))return {recordset:d.exists?[d.base]:[]};
  if(sql.includes('SELECT lead_id FROM dbo.crm_lead'))return {recordset:d.exists?[{lead_id:1}]:[]};
  if(sql.includes('SELECT revision,payload_json FROM dbo.crm_extension_values'))return {recordset:d.revision?[{revision:d.revision,payload_json:JSON.stringify(d.values)}]:[]};
  if(sql.startsWith('INSERT INTO crm_lead')){d.exists=true;return {recordset:[{public_id:ID}],rowsAffected:[1]};}
  if(sql.startsWith('UPDATE crm_lead')){if(p.expectedVersion!==d.version)return {recordset:[],rowsAffected:[0]};d.base.phone=p.v0;d.version='0x0000000000000002';return {recordset:[],rowsAffected:[1]};}
  if(sql.startsWith('INSERT INTO dbo.crm_extension_values')||sql.startsWith('UPDATE dbo.crm_extension_values')){if(fail)throw new Error('synthetic extension failure');d.revision=p.revision;d.values=JSON.parse(p.payload);return {recordset:[],rowsAffected:[1]};}
  if(sql.startsWith('INSERT INTO dbo.crm_extension_audit')){d.audits++;return {recordset:[],rowsAffected:[1]};}
  throw new Error('Unexpected query: '+sql);
 };const result=await work({state:next,identityActive:true,domain:{companyKey:9,query}});state=next;db=d;return result;}};
 return {factory:makeSqlLeadExtensionPortFactory(repo as any,async()=>true),get:()=>({state,db}),calls,fail:()=>{fail=true;}};
}
describe('opt-in lead extension product SQL port (synthetic queries)',()=>{
 it('writes and reads base and extension under a single repository transaction',async()=>{const f=fixture();const create=await executeLeadExtensionRequest(req('POST',{base:{hospitalName:'Clinic'},extensions:{[F]:{definitionVersion:1,value:'initial'}}}),actor,7,'create',f.factory);expect(create.data.extensionRevision).toBe(1);const read=await readLeadExtensionRequest(req('GET',null,'read',{extensions:'1'}),actor,7,'detail',f.factory);expect(read.data).toMatchObject({public_id:ID,extensionRevision:1,extensionValues:{[F]:{value:'initial'}}});const update=await executeLeadExtensionRequest(req('PATCH',{base:{phone:'10'},extensions:{[F]:{definitionVersion:1,value:'next'}},expectedBaseVersion:'0x0000000000000001',expectedExtensionRevision:1},'update'),actor,7,'detail',f.factory);expect(update.data.extensionRevision).toBe(2);expect(f.calls.some(sql=>sql.includes('row_version=CONVERT(binary(8),@expectedVersion,1)'))).toBe(true);});
 it('rolls back base insert when extension write fails',async()=>{const f=fixture();const before=JSON.stringify(f.get());f.fail();await expect(executeLeadExtensionRequest(req('POST',{base:{hospitalName:'Clinic'},extensions:{[F]:{definitionVersion:1,value:'initial'}}}),actor,7,'create',f.factory)).rejects.toThrow('synthetic extension failure');expect(JSON.stringify(f.get())).toBe(before);});
});

describe('worker B additional integration boundaries',()=>{
 it('unreadable extension is omitted from both metadata and values while base stays available',async()=>{const f=fixture();await executeLeadExtensionRequest(req('POST',{base:{hospitalName:'Clinic'},extensions:{[F]:{definitionVersion:1,value:'secret'}}}),actor,7,'create',f.factory);f.get().state.members[U].denied.push(`fields.${F}.read`);const result=await readLeadExtensionRequest(req('GET',null,'read',{extensions:'1'}),actor,7,'detail',f.factory);expect((result.data as any).extensionValues).toEqual({});expect((result.data as any).extensionFields).toEqual([]);expect((result.data as any).hospital_name).toBeDefined();});
 it('create metadata requires create popup and action even with field permissions',async()=>{const f=fixture();const entry=f.get().state.releases[R].effective.entries.find((e:any)=>e.id==='POP.LEAD.CREATE');entry.settings.visible=false;await expect(readLeadExtensionRequest(req('GET',null,'read'),actor,7,'create',f.factory)).rejects.toMatchObject({code:'ACTION_TARGET_UNAVAILABLE'});});
 it('stale base version rejects before writing either base or extension',async()=>{const f=fixture();await executeLeadExtensionRequest(req('POST',{base:{hospitalName:'Clinic'},extensions:{[F]:{definitionVersion:1,value:'original'}}}),actor,7,'create',f.factory);const before=JSON.stringify(f.get());await expect(executeLeadExtensionRequest(req('PATCH',{base:{phone:'10'},extensions:{[F]:{definitionVersion:1,value:'changed'}},expectedBaseVersion:'0x0000000000000002',expectedExtensionRevision:1},'update'),actor,7,'detail',f.factory)).rejects.toMatchObject({code:'RECORD_CONFLICT'});expect(JSON.stringify(f.get())).toBe(before);});
});
