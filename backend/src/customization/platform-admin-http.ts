import {Controller,Get,Patch,Req,Res,UseGuards,UseFilters} from '@nestjs/common';
import type {Response} from 'express';
import {z} from 'zod';
import {AuthGuard,type AuthenticatedRequest} from '../security/security';
import {ConfigurationErrors,ConfigurationIdentity} from './config-http';
import {CompanyConfigurationService,type ConfigActor} from './config-service';
import {configAssert,type ConfigTransaction,type ConfigState} from './config-store';
import {projectFields,validateFieldWrite,type FieldBinding} from './field-policy';
type Domain=NonNullable<ConfigTransaction['domain']>;
const definitions={
 users:{table:'crm_user',key:'user_id',prefix:'platformUser',permission:'USER.READ',action:'ADM.users.save',pairs:[['name','user_name'],['organizationPublicId','organization_public_id'],['active','is_active'],['loginId','login_id'],['email','email'],['erpCode','erp_user_code']],extra:'LEFT JOIN crm_organization o WITH(HOLDLOCK) ON o.company_id=a.company_id AND o.organization_id=a.organization_id',select:'a.user_name,a.is_active,a.login_id,a.email,a.erp_user_code,CONVERT(varchar(36),o.public_id) organization_public_id,a.organization_id'},
 organizations:{table:'crm_organization',key:'organization_id',prefix:'platformOrganization',permission:'ORG.READ',action:'ADM.organizations.save',pairs:[['name','organization_name'],['active','is_active'],['code','organization_code'],['type','organization_type'],['parentPublicId','parent_public_id'],['erpCode','erp_org_code']],extra:'LEFT JOIN crm_organization o WITH(HOLDLOCK) ON o.company_id=a.company_id AND o.organization_id=a.parent_organization_id',select:'a.organization_name,a.is_active,a.organization_code,a.organization_type,a.erp_org_code,CONVERT(varchar(36),o.public_id) parent_public_id'}
} as const;
const policy=(s:ConfigState,a:ConfigActor)=>({authenticated:true,companyId:a.companyId,allowed:s.members[a.id].permissions,denied:s.members[a.id].denied});
const version=z.string().regex(/^0x[0-9a-f]{16}$/i);
export async function executePlatformAdmin(service:CompanyConfigurationService,req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
 const match=/^\/api\/hq\/admin\/(users|organizations)(?:\/([^/]+))?\/?$/.exec(req.path);configAssert(match,404,'NOT_FOUND');
 const kind=match[1] as keyof typeof definitions,d=definitions[kind],publicId=match[2]?z.string().uuid().parse(match[2]).toLowerCase():undefined;
 configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
 const bindings:FieldBinding[]=[...d.pairs,['version','version']].map(([input,column])=>({input,column,output:column,fieldId:d.prefix+'.'+input}));
 const query=(domain:Domain)=>domain.query<Record<string,unknown>>('SELECT a.'+d.key+' entity_id,a.company_id,CONVERT(varchar(36),a.public_id) public_id,CONVERT(varchar(18),a.row_version,1) version,'+d.select+' FROM '+d.table+' a WITH(UPDLOCK,HOLDLOCK) '+d.extra+' WHERE a.company_id=@companyKey AND a.deleted_yn=0'+(publicId?' AND a.public_id=@publicId':'')+' ORDER BY a.'+d.key,{companyKey:domain.companyKey,publicId:publicId??null});
 const load=async(domain:Domain)=>{const r=await query(domain);configAssert(r.recordset.length===1,404,'NOT_FOUND');return r.recordset[0];};
 const allowed=(p:{allowed:string[];denied:string[]})=>configAssert(p.allowed.includes(d.permission)&&!p.denied.includes(d.permission),403,'PERMISSION_DENIED');
 if(req.method==='GET'){
  if(!publicId)return service.readSqlList(actor,'HQ_ADMIN_USERS',{bindings,load:async(domain,_actor,p)=>{allowed(p);return (await query(domain)).recordset.map(row=>({companyKey:domain.companyKey,publicId:String(row.public_id),row}));}});
  const r=await service.readSqlFields(actor,'HQ_ADMIN_USERS',{bindings,load:async(domain,_actor,p)=>{allowed(p);return {companyKey:domain.companyKey,row:await load(domain)};},save:async()=>{throw Error('Read adapter');}});return {...r,data:{...r.data,public_id:publicId}};
 }
 configAssert(req.method==='PATCH'&&publicId,404,'NOT_FOUND');
 const input=z.object({expectedVersion:version,name:z.string().trim().min(1).max(100).optional(),active:z.boolean().optional(),...(kind==='users'?{organizationPublicId:z.string().uuid().optional()}:{})}).strict().parse(req.body);
 const {expectedVersion,...changes}=input;configAssert(Object.keys(changes).length>0,422,'EMPTY_PATCH');
 const context={releaseId:z.string().uuid().parse(req.headers['x-config-release-id']),permissionVersion:z.coerce.number().int().positive().safe().parse(req.headers['x-config-permission-version'])},key=req.headers['idempotency-key'];configAssert(typeof key==='string',428,'IDEMPOTENCY_REQUIRED');
 return service.executeBusiness(actor,context,d.action,key,{publicId,input},async(state,tx)=>{
  configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const domain=tx.domain,row=await load(domain),p=policy(state,actor),effective=state.releases[state.activeReleaseId!].effective;allowed(p);
  configAssert(row.version===expectedVersion,409,'ADMIN_RECORD_CHANGED');
  const columns=validateFieldWrite(effective,actor.companyId,p,bindings,changes,row);
  if(kind==='users'){
   configAssert(publicId!==actor.id||changes.active!==false,409,'SELF_DISABLE_DENIED');
   if(Object.hasOwn(columns,'organization_public_id')){const org=await domain.query<{organization_id:number}>('SELECT organization_id FROM crm_organization WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@organizationPublicId AND is_active=1 AND deleted_yn=0',{companyKey:domain.companyKey,organizationPublicId:columns.organization_public_id});configAssert(org.recordset.length===1,422,'ORG_NOT_FOUND');columns.organization_id=org.recordset[0].organization_id;delete columns.organization_public_id;}
   if(changes.active===false){const references=await domain.query("SELECT TOP 1 approval_route_id FROM crm_approval_route WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND is_active=1 AND (branch_approver_user_id=@target OR division_approver_user_id=@target) UNION ALL SELECT TOP 1 report_id FROM crm_activity_report WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND ((status='REQUESTED' AND (branch_approver_user_id=@target OR division_approver_user_id=@target)) OR (status='BRANCH_APPROVED' AND division_approver_user_id=@target)) UNION ALL SELECT TOP 1 direct_work_id FROM crm_direct_work WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND ((status='REQUESTED' AND (branch_approver_user_id=@target OR division_approver_user_id=@target)) OR (status='BRANCH_APPROVED' AND division_approver_user_id=@target))",{companyKey:domain.companyKey,target:row.entity_id});configAssert(!references.recordset.length,409,'ADMIN_ACTIVE_DEPENDENCIES');}
  }else if(changes.active===false){const refs=await domain.query('SELECT TOP 1 user_id FROM crm_user WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND organization_id=@target AND is_active=1 AND deleted_yn=0 UNION ALL SELECT TOP 1 organization_id FROM crm_organization WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND parent_organization_id=@target AND is_active=1 AND deleted_yn=0 UNION ALL SELECT TOP 1 approval_route_id FROM crm_approval_route WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND organization_id=@target AND is_active=1',{companyKey:domain.companyKey,target:row.entity_id});configAssert(!refs.recordset.length,409,'ADMIN_ACTIVE_DEPENDENCIES');}
  const pairs=Object.entries(columns),params:Record<string,unknown>={companyKey:domain.companyKey,publicId,expectedVersion,userKey};pairs.forEach(([,v],i)=>params['v'+i]=v);
  const saved=await domain.query('UPDATE '+d.table+' SET '+pairs.map(([c],i)=>c+'=@v'+i).join(',')+',updated_at=SYSUTCDATETIME()'+(kind==='organizations'?',updated_by=@userKey':'')+' WHERE company_id=@companyKey AND public_id=@publicId AND deleted_yn=0 AND row_version=CONVERT(binary(8),@expectedVersion,1)',params);configAssert(saved.rowsAffected?.[0]===1,409,'ADMIN_RECORD_CHANGED');
  if(Object.hasOwn(changes,'active')||Object.hasOwn(changes,'organizationPublicId'))state.permissionVersion++;
  return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:publicId,...projectFields(effective,actor.companyId,p,bindings,await load(domain))}};
 },async(state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');allowed(policy(state,actor));await load(tx.domain);},kind==='users'?[publicId]:[]);
}
@Controller('api/hq/admin')
@UseGuards(AuthGuard)
@UseFilters(ConfigurationErrors)
export class ConfigurationPlatformAdminController{
 constructor(private readonly service:CompanyConfigurationService,private readonly identity:ConfigurationIdentity){}
 private async run(req:AuthenticatedRequest,res:Response){const actor=await this.identity.actor(req),result=await executePlatformAdmin(this.service,req,actor,req.authUser!.sub);res.setHeader('X-Config-Release-Id',result.releaseId);res.setHeader('X-Config-Permission-Version',String(result.permissionVersion));return result.data;}
 @Get('users')users(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){return this.run(req,res);}
 @Get('users/:id')user(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){return this.run(req,res);}
 @Patch('users/:id')saveUser(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){return this.run(req,res);}
 @Get('organizations')organizations(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){return this.run(req,res);}
 @Get('organizations/:id')organization(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){return this.run(req,res);}
 @Patch('organizations/:id')saveOrganization(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){return this.run(req,res);}
}
