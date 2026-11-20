import {Controller,Get,Req,Res,UseFilters,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {z} from 'zod';
import {AuthGuard,type AuthenticatedRequest} from '../security/security';
import {ConfigurationErrors,ConfigurationIdentity} from './config-http';
import {CompanyConfigurationService,type ConfigActor} from './config-service';
import {configAssert} from './config-store';

const query=z.object({from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),limit:z.coerce.number().int().min(1).max(50).default(25)}).strict();
export async function readLeadOwnActivities(service:CompanyConfigurationService,req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
 const match=/^\/api\/leads\/([^/]+)\/activities\/?$/.exec(req.path);configAssert(match,404,'NOT_FOUND');
 const publicId=z.string().uuid().parse(match[1]).toLowerCase(),input=query.parse(req.query??{});
 configAssert(Number.isFinite(Date.parse(input.from))&&new Date(input.from).toISOString().slice(0,10)===input.from&&Number.isFinite(Date.parse(input.to))&&new Date(input.to).toISOString().slice(0,10)===input.to&&input.from<=input.to&&Date.parse(input.to)-Date.parse(input.from)<=366*86400000,422,'INVALID_REQUEST');
 return service.readRuntimeContext(actor,async(domain,_config,policy,principal)=>{
  const grants=(name:string)=>principal.allowed.includes(name)&&!principal.denied.includes(name);
  configAssert(grants('LEAD.READ'),403,'PERMISSION_DENIED');
  const p=new Map(policy.map(item=>[item.id,item]));
  for(const id of ['HQ_LEAD','tab:HQ_LEAD.activities']){const entry=p.get(id);configAssert(entry?.enabled&&entry.visible&&entry.readable,403,'FIELD_DENIED');}
  configAssert(p.get('LEAD.open')?.enabled,403,'ACTION_DENIED');
  for(const id of ['activity.subject','activity.plannedAt','activity.status']){const entry=p.get(id);configAssert(entry?.readable&&entry.masking==='none',403,'FIELD_DENIED');}
  const lead=await domain.query<{lead_id:number;company_id:number;owner_user_id:number}>('SELECT lead_id,company_id,owner_user_id FROM crm_lead WITH(HOLDLOCK) WHERE company_id=@companyKey AND public_id=@publicId AND deleted_yn=0',{companyKey:domain.companyKey,publicId});
  configAssert(lead.recordset.length===1&&lead.recordset[0].company_id===domain.companyKey&&(lead.recordset[0].owner_user_id===userKey||grants('LEAD.MANAGE')),404,'NOT_FOUND');
  const activities=await domain.query<{public_id:string;subject:string;planned_at:string;status:string}>("SELECT TOP (@take) CONVERT(varchar(36),a.public_id) public_id,e.subject,CONVERT(varchar(19),a.planned_at,126) planned_at,a.status FROM crm_activity a WITH(HOLDLOCK) JOIN crm_activity_event e WITH(HOLDLOCK) ON e.event_id=a.event_id AND e.company_id=a.company_id WHERE a.company_id=@companyKey AND a.related_type='LEAD' AND a.related_id=@leadId AND a.owner_user_id=@userKey AND a.planned_date>=@from AND a.planned_date<=@to ORDER BY a.planned_at DESC,a.activity_id DESC",{companyKey:domain.companyKey,leadId:lead.recordset[0].lead_id,userKey,from:input.from,to:input.to,take:input.limit});
  return {items:activities.recordset.map(row=>({publicId:row.public_id,subject:row.subject,plannedAt:row.planned_at,status:row.status}))};
 });
}

@Controller('api/leads') @UseGuards(AuthGuard) @UseFilters(ConfigurationErrors)
export class ConfigurationLeadActivitiesController{
 constructor(private readonly service:CompanyConfigurationService,private readonly identity:ConfigurationIdentity){}
 @Get(':id/activities') async activities(@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){const actor=await this.identity.actor(req),result=await readLeadOwnActivities(this.service,req,actor,req.authUser!.sub);res.setHeader('X-Config-Release-Id',result.releaseId);res.setHeader('X-Config-Permission-Version',String(result.permissionVersion));return result.data;}
}
