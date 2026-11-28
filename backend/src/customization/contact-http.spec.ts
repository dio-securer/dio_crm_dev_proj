import {IncomingMessage} from 'node:http';import {Socket} from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {executeContact,executeContactCreateAlias} from './contact-http';
import {CompanyConfigurationService} from './config-service';
import {emptyConfigState} from './config-store';
import {resolveCompanyConfig} from '@dio-crm/contracts/crm-customization';
const artifact=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../packages/contracts/catalogs/hq-customer-review.json'),'utf8'));
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',contactId='cccccccc-cccc-4ccc-8ccc-cccccccccccc',actor={id,companyId};
describe('configured contact domain',()=>{
 function fixture(){
  const permissions=[...new Set(['runtime.read','runtime.write',...artifact.catalog.entries.flatMap((e:any)=>[...e.permissions,...e.readPermissions,...e.writePermissions])])];
  let state:any=emptyConfigState(companyId,{[id]:{active:true,permissions:permissions as string[],denied:[]}});state.activeReleaseId=id;const config={companyId,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[]};state.releases[id]={id,config,effective:resolveCompanyConfig(artifact.catalog,config as any)};state.fixture={owner:7,deleted:false,writes:[]};let fail=false;
  const query=jest.fn();
  const repo={transact:async(_c:any,_u:any,work:any)=>{const copy=JSON.parse(JSON.stringify(state));const domain={companyKey:9,query:async(sql:string,params:any={})=>{query(sql,params);if(sql.startsWith('SELECT account_id'))return {recordset:[{account_id:1,owner_user_id:copy.fixture.owner,account_status:'ACTIVE'}]};if(sql.startsWith('SELECT'))return {recordset:copy.fixture.deleted&&sql.includes('c.deleted_yn=0')?[]:[{company_id:9,public_id:contactId,contact_name:'Doctor',account_public_id:id,deleted_yn:copy.fixture.deleted?1:0}]};if(fail)throw Error('write failure');copy.fixture.writes.push(sql);if(sql.startsWith('UPDATE crm_contact SET deleted_yn'))copy.fixture.deleted=true;return {recordset:[{public_id:contactId}],rowsAffected:[1]};}};const result=await work({state:copy,identityActive:true,domain});state=copy;return result;}};
  const service=new CompanyConfigurationService(repo as any,[]);
  const run=(method:string,body?:unknown)=>executeContact(service,{method,query:{},body,headers:{'x-config-release-id':id,'x-config-permission-version':'1','idempotency-key':'request'}} as any,actor,7,['GET','POST'].includes(method)?id:undefined,['PATCH','DELETE'].includes(method)?contactId:undefined);
  const alias=(body:unknown)=>executeContactCreateAlias(service,Object.assign(new IncomingMessage(new Socket()),{method:'POST',query:{},body,headers:{'x-config-release-id':id,'x-config-permission-version':'1','idempotency-key':'request'}}) as any,actor,7);
  return {alias,run,query,get:()=>state,edit:(fn:(s:any)=>void)=>fn(state),fail:()=>fail=true};
 }
 it('list filters through parent owner authorization',async()=>{const f=fixture();const r=await f.run('GET');expect(r.data).toEqual([expect.objectContaining({contact_name:'Doctor'})]);f.edit(s=>{s.fixture.owner=8;s.members[id].denied.push('ACCOUNT.MERGE');});await expect(f.run('GET')).rejects.toMatchObject({code:'NOT_FOUND'});});
 it('create is idempotent and pins account identity',async()=>{const f=fixture();await f.run('POST',{contactName:'Doctor'});await f.run('POST',{contactName:'Doctor'});expect(f.get().fixture.writes).toHaveLength(1);expect(f.query.mock.calls.find(([sql])=>sql.startsWith('INSERT'))?.[1].accountId).toBe(1);});
 it('client cannot supply another account link',async()=>{const f=fixture();await expect(f.run('POST',{contactName:'Doctor',accountPublicId:contactId})).rejects.toThrow();expect(f.get().fixture.writes).toHaveLength(0);});
 it.each([{readOnly:true},{masking:'redact'},{visible:false}])('creation checks selected parent policy %j',async settings=>{const f=fixture();f.edit(s=>Object.assign(s.releases[id].effective.entries.find((e:any)=>e.id==='contact.accountPublicId').settings,settings));await expect(f.run('POST',{contactName:'Doctor'})).rejects.toMatchObject({status:403});expect(f.get().fixture.writes).toHaveLength(0);});
 it('creation missing mapped required value rolls back',async()=>{const f=fixture();f.edit(s=>s.releases[id].effective.entries.find((e:any)=>e.id==='contact.note').settings.required=true);await expect(f.run('POST',{contactName:'Doctor'})).rejects.toMatchObject({code:'REQUIRED_FIELD'});});
 it('soft deletion replay does not repeat the mutation',async()=>{const f=fixture();await f.run('DELETE');await f.run('DELETE');expect(f.get().fixture.deleted).toBe(true);expect(f.get().fixture.writes).toHaveLength(1);});
 it('revoked delete action prevents receipt replay',async()=>{const f=fixture();await f.run('DELETE');f.edit(s=>s.releases[id].effective.entries.find((e:any)=>e.id==='CONTACT.delete').settings.enabled=false);await expect(f.run('DELETE')).rejects.toMatchObject({code:'ACTION_DENIED'});});
 it('failed create leaves state and receipts untouched',async()=>{const f=fixture(),before=JSON.stringify(f.get());f.fail();await expect(f.run('POST',{contactName:'Doctor'})).rejects.toThrow();expect(JSON.stringify(f.get())).toBe(before);});
 it('hidden note cannot be patched',async()=>{const f=fixture();f.edit(s=>s.releases[id].effective.entries.find((e:any)=>e.id==='contact.note').settings.visible=false);await expect(f.run('PATCH',{note:'private'})).rejects.toMatchObject({code:'FIELD_WRITE_DENIED'});});
 it('HQ create alias shares the parent API receipt and policy checks',async()=>{const f=fixture();await f.alias({accountPublicId:id,contactName:'Doctor'});await f.run('POST',{contactName:'Doctor'});expect(f.get().fixture.writes).toHaveLength(1);});
 it('HQ alias cannot create under inaccessible parent',async()=>{const f=fixture();f.edit(s=>{s.fixture.owner=8;s.members[id].denied.push('ACCOUNT.MERGE');});await expect(f.alias({accountPublicId:id,contactName:'Doctor'})).rejects.toMatchObject({code:'NOT_FOUND'});expect(f.get().fixture.writes).toHaveLength(0);});

});
