import {Controller,Get,Inject,Optional,Req,Res,UseFilters,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {z} from 'zod';
import {AuthGuard,type AuthenticatedRequest} from '../security/security';
import {ConfigurationErrors,ConfigurationIdentity} from './config-http';
import {CompanyConfigurationService,type ConfigActor} from './config-service';
import {configAssert} from './config-store';
import type {ActorPolicy} from '@dio-crm/contracts/crm-customization';

/** Deployment-owned policy. Absent until history access is explicitly approved. */
export const LEAD_HISTORY_POLICY=Symbol('LEAD_HISTORY_POLICY');
export interface LeadHistoryPolicy {authorize:(policy:ActorPolicy)=>boolean}
const params=z.object({limit:z.coerce.number().int().min(1).max(50).default(50),cursor:z.string().regex(/^[1-9]\d{0,18}$/).optional()}).strict();
const auditValue=(v:unknown):string|null=>{try{configAssert(typeof v==='string',500,'INVALID_LEAD_HISTORY');const p=JSON.parse(v);configAssert(p&&typeof p==='object'&&!Array.isArray(p)&&Object.keys(p).length===1&&Object.hasOwn(p,'contactExcludeReason')&&(p.contactExcludeReason===null||typeof p.contactExcludeReason==='string'&&p.contactExcludeReason.length<=500),500,'INVALID_LEAD_HISTORY');return p.contactExcludeReason;}catch{configAssert(false,500,'INVALID_LEAD_HISTORY');return null;}};
export async function readLeadExclusionHistory(service:CompanyConfigurationService,req:AuthenticatedRequest,actor:ConfigActor,userKey:number,gate?:LeadHistoryPolicy|null){
 configAssert(gate&&typeof gate.authorize==='function',503,'LEAD_HISTORY_UNAVAILABLE');
 const match=/^\/api\/leads\/([^/]+)\/history\/?$/.exec(req.path);configAssert(match,404,'NOT_FOUND');const publicId=z.string().uuid().parse(match[1]).toLowerCase(),input=params.parse(req.query??{});configAssert(!input.cursor||BigInt(input.cursor)<=9223372036854775807n,422,'INVALID_CURSOR');
 return service.readRuntimeContext(actor,async(domain,_config,policy,principal)=>{
  const allowed=(permission:string)=>principal.allowed.includes(permission)&&!principal.denied.includes(permission);
  configAssert(allowed('LEAD.READ')&&gate.authorize(principal)===true,403,'PERMISSION_DENIED');
  const effective=new Map(policy.map(item=>[item.id,item]));
  const tab=effective.get('tab:HQ_LEAD.history');configAssert(tab?.enabled===true&&tab.visible===true&&tab.readable===true,403,'FIELD_DENIED');
  for(const key of ['HQ_LEAD','section:lead.history','lead.history','lead.exclusionReason'])configAssert(effective.get(key)?.readable,403,'FIELD_DENIED');
  configAssert(effective.get('lead.history')?.masking==='none',403,'FIELD_DENIED');
  configAssert(effective.get('LEAD.open')?.enabled,403,'ACTION_DENIED');
  const mask=effective.get('lead.exclusionReason')!.masking;configAssert(mask==='none'||mask==='redact',403,'FIELD_DENIED');
  const parent=await domain.query<{company_id:number;owner_user_id:number}>('SELECT company_id,owner_user_id FROM crm_lead WITH(HOLDLOCK) WHERE company_id=@companyKey AND public_id=@publicId AND deleted_yn=0',{companyKey:domain.companyKey,publicId});
  configAssert(parent.recordset.length===1&&parent.recordset[0].company_id===domain.companyKey&&(parent.recordset[0].owner_user_id===userKey||allowed('LEAD.MANAGE')),404,'NOT_FOUND');
  const rows=await domain.query<{id:string;at:string;before:string;after:string}>("SELECT CONVERT(varchar(20),audit_log_id) id,CONVERT(varchar(19),created_at,126)+'Z' at,before_json [before],after_json [after] FROM dbo.crm_audit_log WITH(HOLDLOCK) WHERE company_id=@companyKey AND entity_type='LEAD' AND entity_id=@publicId AND action='LEAD.exclusionReasonChanged' AND (@cursor IS NULL OR audit_log_id<CONVERT(bigint,@cursor)) ORDER BY audit_log_id DESC OFFSET 0 ROWS FETCH NEXT @take ROWS ONLY",{companyKey:domain.companyKey,publicId,cursor:input.cursor??null,take:input.limit+1});
  const items=rows.recordset.slice(0,input.limit).map(row=>{configAssert(/^[1-9]\d{0,18}$/.test(row.id)&&typeof row.at==='string'&&Number.isFinite(Date.parse(row.at)),500,'INVALID_LEAD_HISTORY');const before=auditValue(row.before),after=auditValue(row.after);return {at:row.at,action:'LEAD.exclusionReasonChanged',changes:{contactExcludeReason:{before:mask==='redact'?'***':before,after:mask==='redact'?'***':after}}};});
  return {items,nextCursor:rows.recordset.length>input.limit?rows.recordset[input.limit-1].id:null};
 });
}
@Controller('api/leads') @UseGuards(AuthGuard) @UseFilters(ConfigurationErrors)
export class ConfigurationLeadHistoryController {
 constructor(private readonly service:CompanyConfigurationService,private readonly identity:ConfigurationIdentity,@Optional() @Inject(LEAD_HISTORY_POLICY) private readonly gate?:LeadHistoryPolicy|null){}
 @Get(':id/history') async history(@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){const actor=await this.identity.actor(req),result=await readLeadExclusionHistory(this.service,req,actor,req.authUser!.sub,this.gate);res.setHeader('X-Config-Release-Id',result.releaseId);res.setHeader('X-Config-Permission-Version',String(result.permissionVersion));return result.data;}
}
