import fs from 'node:fs';
import path from 'node:path';
import {ConfiguredCustomerGateway,accountBindings} from './customer-gateway';
import {CompanyConfigurationService} from './config-service';
import {emptyConfigState} from './config-store';
import {resolveCompanyConfig} from '@dio-crm/contracts/crm-customization';
const artifact=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../packages/contracts/catalogs/hq-customer-review.json'),'utf8'));
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',publicId='cccccccc-cccc-4ccc-8ccc-cccccccccccc',actor={id,companyId};
describe('configured account gateway',()=>{
 function fixture(){
  const permissions=[...new Set(['runtime.read','runtime.write',...artifact.catalog.entries.flatMap((e:any)=>[...e.permissions,...e.readPermissions,...e.writePermissions])])];
  let state:any=emptyConfigState(companyId,{[id]:{active:true,permissions:permissions as string[],denied:[]}});const config={companyId,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[],activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR',translations:{}};state.activeReleaseId=id;state.releases[id]={id,config,effective:resolveCompanyConfig(artifact.catalog,config as any)};state.row={company_id:9,public_id:publicId,owner_user_id:7,account_name:'Clinic',account_status:'ACTIVE',business_no:'123'};state.writes=[];let fail=false;
  const query=jest.fn();
  const repository={transact:async(_company:any,_actor:any,work:any)=>{const copy=JSON.parse(JSON.stringify(state));const domain={companyKey:9,query:async(sql:string,params:Record<string,any>={})=>{query(sql,params);if(sql.startsWith('SELECT account_id'))return {recordset:[]};if(sql.startsWith('SELECT'))return {recordset:[copy.row]};if(fail)throw Error('SQL failed');copy.writes.push(sql);if(sql.startsWith('UPDATE')){const pairs=sql.split(' SET ')[1].split(',updated_at')[0].split(',');for(const pair of pairs){const [column,value]=pair.split('=@');copy.row[column]=params[value];}}return {recordset:[{public_id:publicId}],rowsAffected:[1]};}};const result=await work({state:copy,domain,identityActive:true});state=copy;return result;}};
  const gateway=new ConfiguredCustomerGateway(new CompanyConfigurationService(repository as any,[]));
  const run=(method='GET',path='/api/accounts',body?:unknown,query={})=>gateway.handle({method,path,query,body,headers:{'x-config-release-id':id,'x-config-permission-version':'1','idempotency-key':'request'}} as any,actor,7);
  return {run,query,get:()=>state,edit:(fn:(s:any)=>void)=>fn(state),fail:()=>{fail=true;}};
 }
 it('every mapped field exists in the reviewed catalog',()=>{for(const b of accountBindings)expect(artifact.catalog.entries.find((e:any)=>e.id===b.fieldId)).toBeDefined();});
 it('list projects fields and keeps company and row scope',async()=>{const f=fixture();const r=await f.run();expect(r.data).toEqual([expect.objectContaining({public_id:publicId,account_name:'Clinic'})]);expect(f.query.mock.calls[0][0]).toContain('a.company_id=@companyKey');});
 it('hidden search field denies before SQL',async()=>{const f=fixture();f.edit(s=>s.releases[id].effective.entries.find((e:any)=>e.id==='account.erp.biz_no').settings.visible=false);await expect(f.run('GET','/api/accounts',undefined,{search:'123'})).rejects.toMatchObject({code:'QUERY_FIELD_DENIED'});expect(f.query).not.toHaveBeenCalled();});
 it('cross-owner without current management grant is rejected',async()=>{const f=fixture();f.edit(s=>{s.members[id].denied.push('ACCOUNT.MERGE');s.row.owner_user_id=8;});await expect(f.run('GET','/api/accounts/'+publicId)).rejects.toMatchObject({code:'NOT_FOUND'});});
 it('patch writes only mapped field and supports idempotent replay',async()=>{const f=fixture();await f.run('PATCH','/api/accounts/'+publicId,{accountName:'Changed'});await f.run('PATCH','/api/accounts/'+publicId,{accountName:'Changed'});expect(f.get().row.account_name).toBe('Changed');expect(f.get().writes).toHaveLength(1);});
 it('write failure leaves domain and config unchanged',async()=>{const f=fixture(),before=JSON.stringify(f.get());f.fail();await expect(f.run('PATCH','/api/accounts/'+publicId,{accountName:'Changed'})).rejects.toThrow();expect(JSON.stringify(f.get())).toBe(before);});
 it('creation applies current catalog and creates one receipt',async()=>{const f=fixture();await f.run('POST','/api/accounts',{accountName:'New'});await f.run('POST','/api/accounts',{accountName:'New'});expect(f.get().writes).toHaveLength(1);expect(Object.keys(f.get().receipts)).toHaveLength(1);});
 it('unmapped required account field stops creation',async()=>{const f=fixture();f.edit(s=>s.releases[id].effective.entries.find((e:any)=>e.id==='account.hospitalSize').settings.required=true);await expect(f.run('POST','/api/accounts',{accountName:'New'})).rejects.toMatchObject({code:'CREATION_FIELD_UNMAPPED'});expect(f.get().writes).toHaveLength(0);});
 it('server owner default conflicts are rejected',async()=>{const f=fixture();f.edit(s=>s.releases[id].effective.entries.find((e:any)=>e.id==='account.ownerUserId').settings.default=99);await expect(f.run('POST','/api/accounts',{accountName:'New'})).rejects.toMatchObject({code:'CREATION_DEFAULT_CONFLICT'});});
 it('SQL status default participates in conditional required',async()=>{const f=fixture();f.edit(s=>s.releases[id].effective.entries.find((e:any)=>e.id==='account.hospitalSize').requiredWhen={kind:'equals',fieldKey:'account.accountStatus',value:'ACTIVE'});await expect(f.run('POST','/api/accounts',{accountName:'New'})).rejects.toMatchObject({code:'CREATION_FIELD_UNMAPPED'});});
 it('scope cannot infer a masked usage flag',async()=>{const f=fixture();f.edit(s=>s.releases[id].effective.entries.find((e:any)=>e.id==='account.erp.use_yn').settings.masking='redact');await expect(f.run('GET','/api/accounts',undefined,{scope:'all'})).rejects.toMatchObject({code:'QUERY_FIELD_DENIED'});expect(f.query).not.toHaveBeenCalled();});
});
