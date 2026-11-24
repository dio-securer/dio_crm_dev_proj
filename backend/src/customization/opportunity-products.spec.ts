import fs from 'node:fs';
import path from 'node:path';
import {executeOpportunityProduct} from './opportunity-products';
import {CompanyConfigurationService} from './config-service';
import {emptyConfigState} from './config-store';
import {resolveCompanyConfig} from '@dio-crm/contracts/crm-customization';
const artifact=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../packages/contracts/catalogs/hq-sales-review.json'),'utf8'));
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',actor={id,companyId};
describe('opportunity product transactions',()=>{
 function fixture(){
  const permissions=[...new Set(['runtime.read','runtime.write','PRODUCT_PACKAGE.READ',...artifact.catalog.entries.flatMap((e:any)=>[...e.permissions,...e.readPermissions,...e.writePermissions])])];
  let state:any=emptyConfigState(companyId,{[id]:{active:true,permissions:permissions as string[],denied:[]}});state.activeReleaseId=id;state.releases[id]={id,effective:resolveCompanyConfig(artifact.catalog,{companyId,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[]} as any)};state.fixture={owner:7,locked:false,product:null,amount:0,writes:[]};let fail=false;
  const repo={transact:async(_c:any,_a:any,work:any)=>{const copy=JSON.parse(JSON.stringify(state)),domain={companyKey:9,query:async(sql:string,p:any)=>{
   if(sql.startsWith('SELECT opportunity_id'))return {recordset:copy.fixture.owner===p.userKey?[{opportunity_id:1,stage:'PROPOSAL',amount:copy.fixture.amount,contract_created_yn:copy.fixture.locked}]:[]};
   if(sql.startsWith('SELECT product_package_id'))return {recordset:[{product_package_id:2}]};
   if(sql.startsWith('SELECT quantity')||sql.startsWith('SELECT p.quantity'))return {recordset:copy.fixture.product?[{...copy.fixture.product,package_public_id:id}]:[]};
   copy.fixture.writes.push(sql);
   if(sql.startsWith('DELETE')){const had=!!copy.fixture.product;copy.fixture.product=null;return {recordset:[],rowsAffected:[had?1:0]};}
   if(sql.startsWith('UPDATE o')){if(fail)throw Error('aggregate failure');copy.fixture.amount=copy.fixture.product?copy.fixture.product.quantity*copy.fixture.product.proposed_unit_price:0;}
   else copy.fixture.product={quantity:p.quantity,proposed_unit_price:p.price,note:p.note};
   return {recordset:[],rowsAffected:[1]};
  }};const r=await work({state:copy,identityActive:true,domain});state=copy;return r;}};
  const service=new CompanyConfigurationService(repo as any,[]);
  const run=(method:string,body?:unknown,key='request')=>executeOpportunityProduct(service,{method,path:'/api/opportunities/'+id+'/products'+(method==='POST'?'':'/'+id),query:{},body,headers:{'x-config-release-id':id,'x-config-permission-version':'1','idempotency-key':key}} as any,actor,7);
  return {run,get:()=>state,edit:(fn:(s:any)=>void)=>fn(state),fail:()=>fail=true};
 }
 it('add applies quantity default and repeats no write',async()=>{const f=fixture(),body={packagePublicId:id,proposedUnitPrice:12.5};await f.run('POST',body);await f.run('POST',body);expect(f.get().fixture.amount).toBe(12.5);expect(f.get().fixture.writes).toHaveLength(2);});
 it('aggregate fault rolls back item and receipt',async()=>{const f=fixture(),before=JSON.stringify(f.get());f.fail();await expect(f.run('POST',{packagePublicId:id,proposedUnitPrice:12.5})).rejects.toThrow('aggregate failure');expect(JSON.stringify(f.get())).toBe(before);});
 it('hidden price prevents item write',async()=>{const f=fixture();f.edit(s=>s.releases[id].effective.entries.find((e:any)=>e.id==='opportunity.price').settings.visible=false);await expect(f.run('POST',{packagePublicId:id,proposedUnitPrice:12.5})).rejects.toMatchObject({status:403});});
 it('excess decimal precision is rejected',async()=>{const f=fixture();await expect(f.run('POST',{packagePublicId:id,proposedUnitPrice:0.001})).rejects.toMatchObject({code:'INVALID_FIELD_VALUE'});});
 it('patch preserves omitted fields and recalculates amount',async()=>{const f=fixture();f.edit(s=>s.fixture.product={quantity:2,proposed_unit_price:5,note:'x'});await f.run('PATCH',{quantity:3});expect(f.get().fixture.product).toEqual({quantity:3,proposed_unit_price:5,note:'x'});expect(f.get().fixture.amount).toBe(15);});
 it('post upsert requires edit action as well as add',async()=>{const f=fixture();f.edit(s=>{s.fixture.product={quantity:2,proposed_unit_price:5};s.releases[id].effective.entries.find((e:any)=>e.id==='OPP.product.edit').settings.enabled=false;});await expect(f.run('POST',{packagePublicId:id,proposedUnitPrice:12})).rejects.toMatchObject({code:'ACTION_DENIED'});});
 it('delete replays without re-deleting',async()=>{const f=fixture();f.edit(s=>s.fixture.product={quantity:2,proposed_unit_price:5});await f.run('DELETE');await f.run('DELETE');expect(f.get().fixture.amount).toBe(0);expect(f.get().fixture.writes).toHaveLength(2);});
 it('current owner checked before replay',async()=>{const f=fixture();await f.run('POST',{packagePublicId:id,proposedUnitPrice:12});f.edit(s=>s.fixture.owner=8);await expect(f.run('POST',{packagePublicId:id,proposedUnitPrice:12})).rejects.toMatchObject({code:'NOT_FOUND'});});
 it('contract lock prevents product changes',async()=>{const f=fixture();f.edit(s=>s.fixture.locked=true);await expect(f.run('POST',{packagePublicId:id,proposedUnitPrice:12})).rejects.toMatchObject({code:'OPPORTUNITY_LOCKED'});});
 it('patch required note uses immutable existing package identity',async()=>{const f=fixture();f.edit(s=>{s.fixture.product={quantity:2,proposed_unit_price:5};s.releases[id].effective.entries.find((e:any)=>e.id==='opportunity.productNote').requiredWhen={kind:'equals',fieldKey:'opportunity.productPublicId',value:id};});await expect(f.run('PATCH',{quantity:3})).rejects.toMatchObject({code:'REQUIRED_FIELD'});expect(f.get().fixture.writes).toHaveLength(0);});
});
