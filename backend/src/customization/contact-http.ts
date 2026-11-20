import {Controller,Get,Post,Patch,Delete,Param,Req,UseGuards,UseFilters,Res} from '@nestjs/common';
import type {Response} from 'express';
import {z} from 'zod';
import {AuthGuard,type AuthenticatedRequest} from '../security/security';
import {CompanyConfigurationService,type ConfigActor,type SqlFieldAdapter} from './config-service';
import {ConfigurationIdentity,ConfigurationErrors} from './config-http';
import {configAssert,type ConfigState,type ConfigTransaction} from './config-store';
import {projectFields,validateFieldWrite,type FieldBinding} from './field-policy';
import {resolveActorPolicy,type ActorPolicy} from '@dio-crm/contracts/crm-customization';
export const contactBindings:FieldBinding[]=[['contactName','contact_name'],['contactType','contact_type'],['mobile','mobile'],['email','email'],['school','school'],['cohort','cohort'],['major','major'],['note','note']].map(([input,column])=>({fieldId:'contact.'+input,input,column,output:column}));
const uuid=z.string().uuid().transform(s=>s.toLowerCase());
const fields=z.object({contactName:z.string().trim().min(1).max(100).optional(),contactType:z.string().max(30).nullable().optional(),mobile:z.string().max(50).nullable().optional(),email:z.string().max(200).nullable().optional(),school:z.string().max(100).nullable().optional(),cohort:z.string().max(50).nullable().optional(),major:z.string().max(100).nullable().optional(),note:z.string().max(1000).nullable().optional()}).strict();
type Domain=NonNullable<ConfigTransaction['domain']>;
export function executeContactCreateAlias(service:CompanyConfigurationService,req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
 const {accountPublicId,...body}=fields.extend({accountPublicId:uuid}).strict().parse(req.body);
 return executeContact(service,{method:req.method,query:req.query,headers:req.headers,body} as AuthenticatedRequest,actor,userKey,accountPublicId);
}
const currentPolicy=(state:ConfigState,actor:ConfigActor):ActorPolicy=>({authenticated:true,companyId:actor.companyId,allowed:state.members[actor.id].permissions,denied:state.members[actor.id].denied});
export async function executeContact(service:CompanyConfigurationService,req:AuthenticatedRequest,actor:ConfigActor,userKey:number,parentId?:string,contactId?:string){
 configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');if(parentId)parentId=uuid.parse(parentId);if(contactId)contactId=uuid.parse(contactId);
 const parent=async(domain:Domain,policy:ActorPolicy,targetId=parentId)=>{configAssert(policy.allowed.includes('ACCOUNT.READ')&&!policy.denied.includes('ACCOUNT.READ'),403,'PERMISSION_DENIED');const found=await domain.query<{account_id:number;owner_user_id:number;account_status:string}>('SELECT account_id,owner_user_id,account_status FROM crm_account WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@parentId AND deleted_yn=0',{companyKey:domain.companyKey,parentId:targetId});configAssert(found.recordset.length===1,404,'NOT_FOUND');const row=found.recordset[0];configAssert(row.owner_user_id===userKey||(policy.allowed.includes('ACCOUNT.MERGE')&&!policy.denied.includes('ACCOUNT.MERGE')),404,'NOT_FOUND');configAssert(row.account_status!=='MERGED',409,'ACCOUNT_MERGED');return row;};
 const load=async(domain:Domain,policy:ActorPolicy,includeDeleted=false)=>{
  const found=await domain.query<Record<string,unknown>>('SELECT c.company_id,c.account_id,c.deleted_yn,CONVERT(varchar(36),a.public_id) account_public_id,'+contactBindings.map(b=>'c.'+b.column).join(',')+' FROM crm_contact c WITH(UPDLOCK,HOLDLOCK) JOIN crm_account a WITH(HOLDLOCK) ON a.account_id=c.account_id AND a.company_id=c.company_id WHERE c.company_id=@companyKey AND c.public_id=@contactId'+(includeDeleted?'':' AND c.deleted_yn=0'),{companyKey:domain.companyKey,contactId});configAssert(found.recordset.length===1,404,'NOT_FOUND');const row=found.recordset[0];await parent(domain,policy,String(row.account_public_id));return {companyKey:Number(row.company_id),row};
 };
 if(req.method==='GET'){
  configAssert(parentId,422,'INVALID_REQUEST');
  return service.readSqlList(actor,'HQ_ACCOUNT',{bindings:contactBindings,load:async(domain,_actor,policy)=>{const account=await parent(domain,policy);const rows=await domain.query<Record<string,unknown>>('SELECT company_id,CONVERT(varchar(36),public_id) public_id,'+contactBindings.map(b=>b.column).join(',')+' FROM crm_contact WITH(HOLDLOCK) WHERE company_id=@companyKey AND account_id=@accountId AND deleted_yn=0 ORDER BY contact_id',{companyKey:domain.companyKey,accountId:account.account_id});return rows.recordset.map(row=>({companyKey:Number(row.company_id),publicId:String(row.public_id),row}));}});
 }
 const context={releaseId:uuid.parse(req.headers['x-config-release-id']),permissionVersion:z.coerce.number().safe().int().positive().parse(req.headers['x-config-permission-version'])},key=req.headers['idempotency-key'];configAssert(typeof key==='string',428,'IDEMPOTENCY_REQUIRED');
 if(req.method==='PATCH'){
  const input=fields.parse(req.body);const adapter:SqlFieldAdapter={bindings:contactBindings,load:(domain,_actor,policy)=>load(domain,policy),save:async(domain,columns)=>{const pairs=Object.entries(columns);if(!pairs.length)return;const params:Record<string,unknown>={companyKey:domain.companyKey,contactId,userKey};pairs.forEach(([,value],i)=>params['v'+i]=value);const changed=await domain.query('UPDATE crm_contact SET '+pairs.map(([column],i)=>column+'=@v'+i).join(',')+',updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND public_id=@contactId AND deleted_yn=0',params);configAssert(changed.rowsAffected?.[0]===1,409,'CONTACT_CHANGED');}};
  const result=await service.writeSqlFields(actor,context,'CONTACT.save',contactId!,key,input,adapter);return {...result,data:{public_id:contactId!,...result.data}};
 }
 if(req.method==='DELETE'){
  configAssert(req.body===undefined||req.body===null||typeof req.body==='object'&&Object.keys(req.body).length===0,422,'INVALID_REQUEST');
  return service.executeBusiness(actor,context,'CONTACT.delete',key,{contactId},async(state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');await load(tx.domain,currentPolicy(state,actor));const result=await tx.domain.query('UPDATE crm_contact SET deleted_yn=1,updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND public_id=@contactId AND deleted_yn=0',{companyKey:tx.domain.companyKey,contactId,userKey});configAssert(result.rowsAffected?.[0]===1,409,'CONTACT_CHANGED');return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:contactId!,deleted:true}};},async(state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');await load(tx.domain,currentPolicy(state,actor),true);});
 }
 configAssert(req.method==='POST'&&parentId,422,'INVALID_REQUEST');const input=fields.parse(req.body);configAssert(input.contactName,422,'REQUIRED_FIELD');
 return service.executeBusiness(actor,context,'CONTACT.create',key,{parentId,input},async(state,tx)=>{
  configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const policy=currentPolicy(state,actor),account=await parent(tx.domain,policy),effective=state.releases[state.activeReleaseId!].effective;
  const columns=validateFieldWrite(effective,actor.companyId,policy,[...contactBindings,{fieldId:'contact.accountPublicId',input:'accountPublicId',column:'account_public_id',output:'account_public_id'}],{...input,accountPublicId:parentId},{},'create');
  delete columns.account_public_id; // The validated public identity is resolved to account_id by parent().
  const values={'contact.accountPublicId':parentId,...Object.fromEntries(contactBindings.map(b=>[b.fieldId,columns[b.column]]))},availability=new Map(resolveActorPolicy(effective,actor.companyId,policy,values).map(p=>[p.id,p]));
  const parentField=effective.entries.find(e=>e.id==='contact.accountPublicId');configAssert(parentField&&availability.get(parentField.id)?.enabled,403,'CREATION_FIELD_DENIED');configAssert(!Object.hasOwn(parentField.settings,'default')||parentField.settings.default===parentId,422,'CREATION_DEFAULT_CONFLICT');
  for(const e of effective.entries.filter(e=>e.kind==='FIELD'&&e.bindingKind==='DATA'&&e.id.startsWith('contact.')))configAssert(e.id==='contact.accountPublicId'||contactBindings.some(b=>b.fieldId===e.id)||(!availability.get(e.id)?.required&&!Object.hasOwn(e.settings,'default')),422,'CREATION_FIELD_UNMAPPED');
  const pairs=Object.entries(columns),params:Record<string,unknown>={companyKey:tx.domain.companyKey,accountId:account.account_id,userKey};pairs.forEach(([,value],i)=>params['v'+i]=value);
  const saved=await tx.domain.query<{public_id:string}>('INSERT INTO crm_contact(company_id,account_id,created_by,updated_by,'+pairs.map(([c])=>c).join(',')+') OUTPUT CONVERT(varchar(36),inserted.public_id) public_id VALUES(@companyKey,@accountId,@userKey,@userKey,'+pairs.map((_,i)=>'@v'+i).join(',')+')',params);configAssert(saved.recordset.length===1,500,'DOMAIN_WRITE_FAILED');
  return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:saved.recordset[0].public_id,...projectFields(effective,actor.companyId,policy,contactBindings,columns)}};
 },async(state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');await parent(tx.domain,currentPolicy(state,actor));});
}
@Controller('api')
@UseGuards(AuthGuard)
@UseFilters(ConfigurationErrors)
export class ConfigurationContactsController{
 constructor(private readonly service:CompanyConfigurationService,private readonly identity:ConfigurationIdentity){}
 private async run(req:AuthenticatedRequest,res:Response,parentId?:string,id?:string){const actor=await this.identity.actor(req);const result=await executeContact(this.service,req,actor,req.authUser!.sub,parentId,id);res.setHeader('X-Config-Release-Id',result.releaseId);res.setHeader('X-Config-Permission-Version',String(result.permissionVersion));return result.data;}
 @Get('accounts/:parentId/contacts') list(@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response,@Param('parentId') parentId:string){return this.run(req,res,parentId);}
 @Post('accounts/:parentId/contacts') create(@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response,@Param('parentId') parentId:string){return this.run(req,res,parentId);}
 @Post('contacts')async createAlias(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){const actor=await this.identity.actor(req),result=await executeContactCreateAlias(this.service,req,actor,req.authUser!.sub);res.setHeader('X-Config-Release-Id',result.releaseId);res.setHeader('X-Config-Permission-Version',String(result.permissionVersion));return result.data;}
 @Patch('contacts/:id') patch(@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response,@Param('id') id:string){return this.run(req,res,undefined,id);}
 @Delete('contacts/:id') remove(@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response,@Param('id') id:string){return this.run(req,res,undefined,id);}
}
