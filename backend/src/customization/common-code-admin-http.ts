import {Controller,Get,Post,Patch,Req,Res,UseGuards,UseFilters} from '@nestjs/common';import type {Response} from 'express';import {z} from 'zod';
import {AuthGuard,type AuthenticatedRequest} from '../security/security';import {ConfigurationErrors,ConfigurationIdentity} from './config-http';
import {CompanyConfigurationService,type ConfigActor} from './config-service';import {configAssert,type ConfigTransaction} from './config-store';import {projectFields,validateFieldWrite,type FieldBinding} from './field-policy';
type Domain=NonNullable<ConfigTransaction['domain']>;
const pairs=[['groupCode','group_code'],['code','code'],['label','code_name'],['active','is_active'],['sortOrder','sort_order'],['labelKo','label_ko'],['labelEn','label_en'],['version','version'],['localOverride','local_override']];
const bindings:FieldBinding[]=pairs.map(([input,column])=>({input,column,output:column,fieldId:'adminCode.'+input}));
const mutable=z.object({label:z.string().trim().min(1).max(100).optional(),active:z.boolean().optional(),sortOrder:z.number().int().min(0).max(2147483647).optional(),labelKo:z.string().trim().min(1).max(1000).nullable().optional(),labelEn:z.string().trim().min(1).max(1000).nullable().optional()});
function metadata(row:Record<string,any>){let value:any={};try{value=row.metadata_json?JSON.parse(row.metadata_json):{};}catch{configAssert(false,409,'REFERENCE_TRANSLATION_INVALID');}configAssert(value&&typeof value==='object'&&!Array.isArray(value),409,'REFERENCE_TRANSLATION_INVALID');const translations=value.translations??{};configAssert(translations&&typeof translations==='object'&&!Array.isArray(translations)&&Object.values(translations).every(v=>typeof v==='string'&&v.length>0&&v.length<=1000),409,'REFERENCE_TRANSLATION_INVALID');return {...value,translations:{...translations}};}
const expose=(row:Record<string,any>,companyKey:number)=>{const m=metadata(row);return {...row,label_ko:m.translations['ko-KR']??null,label_en:m.translations['en-US']??null,local_override:row.company_id===companyKey};};
export async function executeCommonCodeAdmin(service:CompanyConfigurationService,req:AuthenticatedRequest,actor:ConfigActor){
 const match=/^\/api\/hq\/admin\/common-codes(?:\/([^/]+))?\/?$/.exec(req.path);configAssert(match,404,'NOT_FOUND');const id=match[1]?z.string().uuid().parse(match[1]):undefined;configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
 const select='SELECT common_code_id,company_id,CONVERT(varchar(36),public_id) public_id,group_code,code,code_name,sort_order,is_active,metadata_json,CONVERT(varchar(18),row_version,1) version FROM crm_common_code WITH(UPDLOCK,HOLDLOCK) ';
 const load=async(domain:Domain)=>{const r=await domain.query<Record<string,any>>(select+'WHERE public_id=@id AND (company_id=@companyKey OR company_id IS NULL) AND deleted_yn=0',{companyKey:domain.companyKey,id});configAssert(r.recordset.length===1,404,'NOT_FOUND');return r.recordset[0];};
 const check=(p:{allowed:string[];denied:string[]})=>configAssert(p.allowed.includes('ADMIN.READ')&&!p.denied.includes('ADMIN.READ'),403,'PERMISSION_DENIED');
 if(req.method==='GET'){
  if(id){const r=await service.readSqlFields(actor,'HQ_ADMIN_CODES',{bindings,load:async(domain,_actor,p)=>{check(p);return {companyKey:domain.companyKey,row:expose(await load(domain),domain.companyKey)};}});return {...r,data:{public_id:id,...r.data}};}
  return service.readSqlList(actor,'HQ_ADMIN_CODES',{bindings,load:async(domain,_actor,p)=>{check(p);const r=await domain.query<Record<string,any>>("WITH candidates AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY group_code,code ORDER BY CASE WHEN company_id=@companyKey THEN 0 ELSE 1 END,common_code_id) priority FROM crm_common_code WITH(HOLDLOCK) WHERE (company_id=@companyKey OR company_id IS NULL) AND deleted_yn=0) SELECT common_code_id,company_id,CONVERT(varchar(36),public_id) public_id,group_code,code,code_name,sort_order,is_active,metadata_json,CONVERT(varchar(18),row_version,1) version FROM candidates WHERE priority=1 ORDER BY group_code,sort_order,code",{companyKey:domain.companyKey});return r.recordset.map(row=>({companyKey:domain.companyKey,publicId:row.public_id,row:expose(row,domain.companyKey)}));}});
 }
 configAssert(req.method==='POST'&&!id||req.method==='PATCH'&&id,404,'NOT_FOUND');const create=req.method==='POST';
 const raw=create?mutable.extend({groupCode:z.string().regex(/^[A-Za-z0-9_.-]{1,50}$/),code:z.string().regex(/^[A-Za-z0-9_.-]{1,50}$/),label:z.string().trim().min(1).max(100)}).strict().parse(req.body):mutable.extend({expectedVersion:z.string().regex(/^0x[0-9a-f]{16}$/i)}).strict().parse(req.body);
 const {expectedVersion,...input}=raw as Record<string,any>;configAssert(Object.keys(input).length>0,422,'EMPTY_PATCH');
 const context={releaseId:z.string().uuid().parse(req.headers['x-config-release-id']),permissionVersion:z.coerce.number().int().positive().safe().parse(req.headers['x-config-permission-version'])},key=req.headers['idempotency-key'];configAssert(typeof key==='string',428,'IDEMPOTENCY_REQUIRED');
 return service.executeBusiness(actor,context,'ADM.codes.save',key,{id:id??null,raw},async(state,tx)=>{
  configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const domain=tx.domain,p={authenticated:true,companyId:actor.companyId,allowed:state.members[actor.id].permissions,denied:state.members[actor.id].denied};check(p);const effective=state.releases[state.activeReleaseId!].effective;
  const row=create?{group_code:input.groupCode,code:input.code,metadata_json:null,code_name:input.label,is_active:true,sort_order:0,company_id:domain.companyKey}:await load(domain);
  if(!create)configAssert(row.version===expectedVersion,409,'ADMIN_RECORD_CHANGED');
  const columns=validateFieldWrite(effective,actor.companyId,p,bindings,input,expose(row,domain.companyKey),create?'create':'update');
  const existing=await domain.query<Record<string,any>>(select+'WHERE '+(create?'(company_id=@companyKey OR company_id IS NULL)':'company_id=@companyKey')+' AND group_code=@groupCode AND code=@code',{companyKey:domain.companyKey,groupCode:row.group_code,code:row.code});
  configAssert(!existing.recordset.length||!create&&row.company_id===domain.companyKey&&existing.recordset[0].public_id===row.public_id,409,'ADMIN_RECORD_CHANGED');
  const m=metadata(row);for(const [column,locale] of [['label_ko','ko-KR'],['label_en','en-US']])if(Object.hasOwn(columns,column)){if(columns[column]===null)delete m.translations[locale];else m.translations[locale]=columns[column];delete columns[column];}
  const params={companyKey:domain.companyKey,id:id??null,expectedVersion:expectedVersion??null,groupCode:row.group_code,code:row.code,label:columns.code_name??row.code_name,active:columns.is_active??row.is_active,sortOrder:columns.sort_order??row.sort_order,metadata:JSON.stringify(m)};
  let savedId=id;
  if(create||row.company_id===null){const r=await domain.query<{public_id:string}>('INSERT INTO crm_common_code(company_id,group_code,code,code_name,sort_order,is_active,metadata_json) OUTPUT CONVERT(varchar(36),inserted.public_id) public_id VALUES(@companyKey,@groupCode,@code,@label,@sortOrder,@active,@metadata)',params);configAssert(r.recordset.length===1,500,'DOMAIN_WRITE_FAILED');savedId=r.recordset[0].public_id;}
  else{const r=await domain.query('UPDATE crm_common_code SET code_name=@label,is_active=@active,sort_order=@sortOrder,metadata_json=@metadata WHERE company_id=@companyKey AND public_id=@id AND deleted_yn=0 AND row_version=CONVERT(binary(8),@expectedVersion,1)',params);configAssert(r.rowsAffected?.[0]===1,409,'ADMIN_RECORD_CHANGED');}
  return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:savedId}};
 },async(state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');check({allowed:state.members[actor.id].permissions,denied:state.members[actor.id].denied});if(id)await load(tx.domain);});
}
@Controller('api/hq/admin/common-codes')@UseGuards(AuthGuard)@UseFilters(ConfigurationErrors)
export class ConfigurationCommonCodeAdminController{
 constructor(private readonly service:CompanyConfigurationService,private readonly identity:ConfigurationIdentity){}
 private async run(req:AuthenticatedRequest,res:Response){const r=await executeCommonCodeAdmin(this.service,req,await this.identity.actor(req));res.setHeader('X-Config-Release-Id',r.releaseId);res.setHeader('X-Config-Permission-Version',String(r.permissionVersion));return r.data;}
 @Get()list(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){return this.run(req,res);}
 @Get(':id')detail(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){return this.run(req,res);}
 @Post()create(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){return this.run(req,res);}
 @Patch(':id')save(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){return this.run(req,res);}
}
