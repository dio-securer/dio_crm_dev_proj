import {Controller,Post,Get,Delete,Req,Res,UseGuards,UseFilters,Inject,Optional} from '@nestjs/common';
import type {Response} from 'express';
import {z} from 'zod';
import {AuthGuard,type AuthenticatedRequest} from '../security/security';
import {ConfigurationErrors,ConfigurationIdentity} from './config-http';
import {CompanyConfigurationService,type ConfigActor} from './config-service';
import {configAssert,type ConfigState,type ConfigTransaction} from './config-store';
import {validateCreation} from './creation-policy';
import {projectFields,type FieldBinding} from './field-policy';
import {executeLeadExtensionRequest,readLeadExtensionRequest,hasExtensionPayload,LEAD_EXTENSION_PORT,type LeadExtensionPortFactory} from './lead-extension-request';

export const leadCreateBindings:FieldBinding[]=[['hospitalName','hospital_name','hospitalName'],['phone','phone','phone'],['address','address','address'],['businessNo','business_no','businessNo'],['keymanName','keyman_name','keymanSurname'],['keymanType','keyman_type','keymanType'],['keymanMobile','keyman_mobile','keymanMobile'],['keymanEmail','keyman_email','keymanEmail'],['school','school','keymanSchool'],['cohort','cohort','keymanClassYear'],['major','major','keymanMajor'],['mainSystem','main_system','mainSystem'],['subSystem','sub_system','subSystem']].map(([input,column,id])=>({input,column,output:column,fieldId:'lead.'+id}));
const lengths=[200,50,500,20,100,30,50,200,100,50,100,100,100];
export const leadCreateSchema=z.object(Object.fromEntries(leadCreateBindings.map((b,i)=>[b.input,i===0?z.string().trim().min(1).max(lengths[i]):z.string().max(lengths[i]).nullable().optional()]))).extend({ownerUserId:z.number().int().positive().safe().optional()}).strict();
type Domain=NonNullable<ConfigTransaction['domain']>;
const policy=(s:ConfigState,a:ConfigActor)=>({authenticated:true,companyId:a.companyId,allowed:s.members[a.id].permissions,denied:s.members[a.id].denied});
export async function executeLeadLifecycle(service:CompanyConfigurationService,req:AuthenticatedRequest,actor:ConfigActor,userKey:number,extensionPort?:LeadExtensionPortFactory|null){
 if(req.method==='POST'&&hasExtensionPayload(req.body))return executeLeadExtensionRequest(req,actor,userKey,'create',extensionPort);
 configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
 const context={releaseId:z.string().uuid().parse(req.headers['x-config-release-id']),permissionVersion:z.coerce.number().int().positive().safe().parse(req.headers['x-config-permission-version'])},key=req.headers['idempotency-key'];configAssert(typeof key==='string',428,'IDEMPOTENCY_REQUIRED');
 if(req.method==='POST'){
  const input=leadCreateSchema.parse(req.body),owner=Number(input.ownerUserId??userKey);
  const authorize=async(state:ConfigState,domain:Domain)=>{const p=policy(state,actor);configAssert(owner===userKey||p.allowed.includes('LEAD.MANAGE')&&!p.denied.includes('LEAD.MANAGE'),403,'PERMISSION_DENIED');const found=await domain.query('SELECT user_id FROM crm_user WITH(HOLDLOCK) WHERE company_id=@companyKey AND user_id=@owner AND is_active=1 AND deleted_yn=0',{companyKey:domain.companyKey,owner});configAssert(found.recordset.length===1,422,'OWNER_NOT_FOUND');};
  return service.executeBusiness(actor,context,'LEAD.create',key,input,async(state,tx)=>{
   configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const domain=tx.domain,p=policy(state,actor),effective=state.releases[state.activeReleaseId!].effective;
   const ownerBinding={fieldId:'lead.ownerUserId',input:'ownerUserId',column:'owner_user_id',output:'owner_user_id'},bindings=input.ownerUserId===undefined?leadCreateBindings:[...leadCreateBindings,ownerBinding];
   const fixed={'lead.status':'NEW','lead.leadSource':'CRM',...(input.ownerUserId===undefined?{'lead.ownerUserId':owner}:{})};
   const columns=validateCreation(effective,actor.companyId,p,bindings,input,fixed,effective.entries.filter(e=>e.id.startsWith('lead.')&&e.bindingKind==='DATA').map(e=>e.id));
   leadCreateSchema.parse(Object.fromEntries(bindings.filter(b=>Object.hasOwn(columns,b.column)).map(b=>[b.input,columns[b.column]])));
   delete columns.owner_user_id;const pairs=Object.entries(columns),params:Record<string,unknown>={companyKey:domain.companyKey,userKey,owner};pairs.forEach(([,v],i)=>params['v'+i]=v);
   const r=await domain.query<{public_id:string}>("INSERT INTO crm_lead(company_id,owner_user_id,status,lead_source,created_by,updated_by,"+pairs.map(([c])=>c).join(',')+") OUTPUT CONVERT(varchar(36),inserted.public_id) public_id VALUES(@companyKey,@owner,'NEW','CRM',@userKey,@userKey,"+pairs.map((_,i)=>'@v'+i).join(',')+')',params);configAssert(r.recordset.length===1,500,'DOMAIN_WRITE_FAILED');
   return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:r.recordset[0].public_id,...projectFields(effective,actor.companyId,p,leadCreateBindings,columns)}};
  },async(state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');await authorize(state,tx.domain);});
 }
 configAssert(req.method==='DELETE',404,'NOT_FOUND');const publicId=z.string().uuid().parse(req.path.replace(/\/$/,'').split('/').at(-1));const input=z.object({expectedVersion:z.string().regex(/^0x[0-9a-f]{16}$/i)}).strict().parse(req.body);
 const load=async(state:ConfigState,domain:Domain,includeDeleted=false)=>{const r=await domain.query<{lead_id:number;owner_user_id:number;status:string;deleted_yn:boolean;version:string}>('SELECT lead_id,owner_user_id,status,deleted_yn,CONVERT(varchar(18),row_version,1) version FROM crm_lead WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@publicId'+(includeDeleted?'':' AND deleted_yn=0'),{companyKey:domain.companyKey,publicId});configAssert(r.recordset.length===1,404,'NOT_FOUND');const row=r.recordset[0],p=policy(state,actor);configAssert(row.owner_user_id===userKey||p.allowed.includes('LEAD.MANAGE')&&!p.denied.includes('LEAD.MANAGE'),404,'NOT_FOUND');return row;};
 return service.executeBusiness(actor,context,'LEAD.delete',key,{publicId,input},async(state,tx)=>{
  configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const domain=tx.domain,row=await load(state,domain);configAssert(row.version===input.expectedVersion,409,'LEAD_CHANGED');configAssert(row.status==='NEW',409,'LEAD_DELETE_REFERENCED');
  const references=await domain.query("SELECT activity_id FROM crm_activity WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND related_type='LEAD' AND related_id=@leadId",{companyKey:domain.companyKey,leadId:row.lead_id});configAssert(references.recordset.length===0,409,'LEAD_DELETE_REFERENCED');
  const r=await domain.query("UPDATE crm_lead SET deleted_yn=1,updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND lead_id=@leadId AND status='NEW' AND deleted_yn=0",{companyKey:domain.companyKey,leadId:row.lead_id,userKey});configAssert(r.rowsAffected?.[0]===1,409,'LEAD_CHANGED');
  return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:publicId,deleted:true}};
 },async(state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');await load(state,tx.domain,true);});
}
@Controller('api/leads')
@UseGuards(AuthGuard)
@UseFilters(ConfigurationErrors)
export class ConfigurationLeadLifecycleController{
 constructor(private readonly service:CompanyConfigurationService,private readonly identity:ConfigurationIdentity,@Optional() @Inject(LEAD_EXTENSION_PORT) private readonly extensionPort?:LeadExtensionPortFactory|null){}
 private async run(req:AuthenticatedRequest,res:Response){const actor=await this.identity.actor(req),result=await executeLeadLifecycle(this.service,req,actor,req.authUser!.sub,this.extensionPort);res.setHeader('X-Config-Release-Id',result.releaseId);res.setHeader('X-Config-Permission-Version',String(result.permissionVersion));return result.data;}
 @Post()create(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){return this.run(req,res);}
 @Get('extension-fields')async extensionFields(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){const actor=await this.identity.actor(req),result=await readLeadExtensionRequest(req,actor,req.authUser!.sub,'create',this.extensionPort);res.setHeader('X-Config-Release-Id',result.releaseId);res.setHeader('X-Config-Permission-Version',String(result.permissionVersion));return result.data;}
 @Delete(':id')remove(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){return this.run(req,res);}
}
