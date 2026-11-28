import {listPaging,pageParameters} from './list-pagination';
import {Injectable,Inject,Optional} from '@nestjs/common';
import {z} from 'zod';
import type {AuthenticatedRequest} from '../security/security';
import {CompanyConfigurationService,type ConfigActor,type SqlFieldAdapter} from './config-service';
import {configAssert} from './config-store';
import {executeLeadCommand} from './lead-commands';
import {leadGridCandidates} from '@dio-crm/contracts/lead-grid-columns';
import {validLeadGridSort,type LeadGridSort} from '@dio-crm/contracts/crm-customization';
/** SQL fragments originate only from this allowlist; NULL timestamps always follow known values. */
export function leadSortSql(sort?:LeadGridSort):string{return validLeadGridSort(sort)?`CASE WHEN l.updated_at IS NULL THEN 1 ELSE 0 END ASC, l.updated_at ${sort.direction==='asc'?'ASC':'DESC'}, l.lead_id DESC`:'l.lead_id DESC';}
import {executeLeadExtensionRequest,readLeadExtensionRequest,hasExtensionPayload,wantsExtensionRead,LEAD_EXTENSION_PORT,type LeadExtensionPortFactory} from './lead-extension-request';
import {LEAD_READ_CAPABILITIES,hiraExclusionBinding,type LeadReadCapabilities} from './lead-read-capabilities';
import {prepareLeadExclusionChange,auditLeadExclusionChange} from './lead-exclusion-audit';
export const leadEditMappings=[['hospitalName','hospital_name','hospitalName'],['phone','phone','phone'],['address','address','address'],['businessNo','business_no','businessNo'],['keymanName','keyman_name','keymanSurname'],['keymanType','keyman_type','keymanType'],['keymanMobile','keyman_mobile','keymanMobile'],['keymanEmail','keyman_email','keymanEmail'],['school','school','keymanSchool'],['cohort','cohort','keymanClassYear'],['major','major','keymanMajor'],['mainSystem','main_system','mainSystem'],['subSystem','sub_system','subSystem'],['contactExcludeReason','contact_exclude_reason','exclusionReason']];
const mappings=leadEditMappings;
@Injectable()
export class ConfiguredLeadGateway {
 constructor(private readonly configuration:CompanyConfigurationService,@Optional() @Inject(LEAD_EXTENSION_PORT) private readonly extensionPort?:LeadExtensionPortFactory|null,@Optional() @Inject(LEAD_READ_CAPABILITIES) private readonly readCapabilities?:LeadReadCapabilities|null){}
 async handle(req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
  if(req.method==='GET'&&wantsExtensionRead(req.query))return readLeadExtensionRequest(req,actor,userKey,'detail',this.extensionPort);
  if(req.method==='PATCH'&&hasExtensionPayload(req.body))return executeLeadExtensionRequest(req,actor,userKey,'detail',this.extensionPort);
  if(req.method==='POST')return executeLeadCommand(this.configuration,req,actor,userKey);
  if(req.method==='GET'&&req.path.replace(/\/$/,'')==='/api/leads')return this.list(req,actor,userKey);
  const publicId=z.string().uuid().parse(req.path.replace(/\/$/,'').split('/').at(-1)).toLowerCase();
  const hiraRead=req.method==='GET'&&this.readCapabilities?.hiraExclusion===true;
  const adapter:SqlFieldAdapter={bindings:[...mappings.map(([input,column,key])=>({input,column,output:column,fieldId:'lead.'+key})),{input:'status',column:'status',output:'status',fieldId:'lead.status'},{input:'ownerUserId',column:'owner_user_id',output:'owner_user_id',fieldId:'lead.ownerUserId'},...(hiraRead?[hiraExclusionBinding]:[])],optionalBindings:[{input:'version',column:'version',output:'version',fieldId:'lead.version'}],
   load:async(domain,_actor,policy)=>{
    const found=await domain.query<Record<string,unknown>>(`SELECT company_id,owner_user_id,status,CONVERT(varchar(18),row_version,1) version,${mappings.map(([,column])=>column).join(',')}${hiraRead?',hira_sync_exclude_yn':''} FROM crm_lead WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@publicId AND deleted_yn=0`,{companyKey:domain.companyKey,publicId});configAssert(found.recordset.length===1,404,'NOT_FOUND');const row=found.recordset[0];
    // Conservative migration: only owner or explicitly current LEAD.MANAGE may use this
    // first adapter. Broader branch/division scopes require their separately reviewed map.
    configAssert(row.owner_user_id===userKey||(policy.allowed.includes('LEAD.MANAGE')&&!policy.denied.includes('LEAD.MANAGE')),404,'NOT_FOUND');
    if(req.method==='PATCH')configAssert(row.status!=='CONVERTED',409,'LEAD_CONVERTED');
    return {companyKey:Number(row.company_id),row};
   },save:async(domain,columns)=>{
    const pairs=Object.entries(columns);if(!pairs.length)return;
    const exclusionChange=await prepareLeadExclusionChange(domain,publicId,columns);
    const params:Record<string,unknown>={companyKey:domain.companyKey,publicId,userKey,expectedVersion};pairs.forEach(([,value],i)=>{params['v'+i]=value;});
    const saved=await domain.query(`UPDATE crm_lead SET ${pairs.map(([column],i)=>column+'=@v'+i).join(',')},updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND public_id=@publicId AND deleted_yn=0 AND status<>'CONVERTED' AND row_version=CONVERT(binary(8),@expectedVersion,1)`,params);configAssert(saved.rowsAffected?.[0]===1,409,'LEAD_CHANGED');
    await auditLeadExclusionChange(domain,publicId,userKey,exclusionChange);
   }};
  configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
  if(req.method==='GET'){const result=await this.configuration.readSqlFields(actor,'HQ_LEAD',adapter);return {...result,data:{...result.data,public_id:publicId,public_id_text:publicId}};}
  const raw=z.record(z.union([z.string().max(2000),z.null()])).parse(req.body);
  configAssert(Object.keys(raw).every(key=>key==='expectedVersion'||mappings.some(([name])=>key===name)),422,'UNREGISTERED_FIELD');
  configAssert(typeof raw.expectedVersion==='string',428,'LEAD_VERSION_REQUIRED');const expectedVersion=z.string().regex(/^0x[0-9a-f]{16}$/i).parse(raw.expectedVersion);
  const input=Object.fromEntries(Object.entries(raw).filter(([key])=>key!=='expectedVersion'));configAssert(Object.keys(input).length>0,422,'EMPTY_PATCH');
  const releaseId=z.string().uuid().parse(req.headers['x-config-release-id']);const version=z.coerce.number().int().positive().safe().parse(req.headers['x-config-permission-version']);
  const key=req.headers['idempotency-key'];configAssert(typeof key==='string',428,'IDEMPOTENCY_REQUIRED');const result=await this.configuration.writeSqlFields(actor,{releaseId,permissionVersion:version},'LEAD.save',publicId,key,input,adapter,raw);return {...result,data:{...result.data,public_id:publicId,public_id_text:publicId}};
 }
 private async list(req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
  const input=z.object({...listPaging,ownerUserId:z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().safe().int().positive()).optional(),status:z.enum(['NEW','FIRST_VISIT','KEYMAN_MEETING','CONTACT_EXCLUDED','CONVERTED']).optional(),search:z.string().trim().max(200).optional()}).strict().parse(req.query??{});
  const queryFields=[...(input.ownerUserId!==undefined?['lead.ownerUserId']:[]),...(input.status?['lead.status']:[]),...(input.search?['lead.hospitalName','lead.businessNo']:[])];
  const bindings=[['hospitalName','hospital_name'],['status','status'],['ownerUserId','owner_user_id'],['phone','phone'],['address','address'],['businessNo','business_no'],['ownerName','owner_name'],['sido','sido'],['sigungu','sigungu'],['updatedAt','updated_at'],['version','version']].map(([key,column])=>({fieldId:'lead.'+key,input:key,column,output:column}));
  const extras=leadGridCandidates.filter(c=>!bindings.some(b=>b.fieldId===c.fieldId)).map(c=>({fieldId:c.fieldId,input:c.fieldKey,column:c.rowKey,output:c.rowKey}));
  return this.configuration.readSqlList(actor,'HQ_LEAD',{bindings:bindings.filter(b=>!['lead.ownerName','lead.updatedAt','lead.version'].includes(b.fieldId)),optionalBindings:bindings.filter(b=>['lead.ownerName','lead.updatedAt','lead.version'].includes(b.fieldId)),listColumnBindings:extras,load:async(domain,_actor,policy,listColumns=[],leadSort)=>{
   configAssert(policy.allowed.includes('LEAD.READ')&&!policy.denied.includes('LEAD.READ'),403,'PERMISSION_DENIED');
   const manage=policy.allowed.includes('LEAD.MANAGE')&&!policy.denied.includes('LEAD.MANAGE');
   // Search is literal substring matching, never client SQL/wildcards. Fixed ordering
   // uses only the policy-approved timestamp plus internal identity tie-breaker.
   const search=input.search?input.search.replace(/[~%_\[]/g,c=>'~'+c):null;
   const select=[...bindings,...listColumns].map(b=>b.column==='version'?"CONVERT(varchar(18),l.row_version,1) version":b.column==='owner_name'?'u.user_name AS owner_name':b.column==='updated_at'?"CONVERT(varchar(27),l.updated_at,126) + 'Z' AS updated_at":'l.'+b.column).join(',');
   const result=await domain.query<Record<string,unknown>>(`SELECT l.company_id,CONVERT(varchar(36),l.public_id) public_id,${select} FROM crm_lead l WITH(HOLDLOCK) LEFT JOIN crm_user u WITH(HOLDLOCK) ON u.user_id=l.owner_user_id AND u.company_id=l.company_id AND u.deleted_yn=0 WHERE l.company_id=@companyKey AND l.deleted_yn=0 AND (@manage=1 OR l.owner_user_id=@userKey) AND (@ownerUserId IS NULL OR l.owner_user_id=@ownerUserId) AND (@status IS NULL OR l.status=@status) AND (@search IS NULL OR l.hospital_name LIKE '%' + @search + '%' ESCAPE '~' OR l.business_no LIKE '%' + @search + '%' ESCAPE '~') ORDER BY ${leadSortSql(leadSort)} OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,{...pageParameters(input),companyKey:domain.companyKey,userKey,manage:manage?1:0,ownerUserId:input.ownerUserId??null,status:input.status??null,search});
   return result.recordset.map(row=>{configAssert(manage||row.owner_user_id===userKey,404,'NOT_FOUND');return {companyKey:Number(row.company_id),publicId:String(row.public_id),row};});
  }},queryFields,[...(input.search!==undefined?['lead.search']:[]),...(input.status!==undefined?['lead.statusFilter']:[]),...(input.ownerUserId!==undefined?['lead.ownerFilter']:[])]);
 }
}
