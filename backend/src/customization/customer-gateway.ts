import {listPaging,pageParameters,businessQueryKeys} from './list-pagination';
import {handleAccountMerge} from './account-merge';
import {Injectable} from '@nestjs/common';
import {z} from 'zod';
import {resolveActorPolicy,type ActorPolicy} from '@dio-crm/contracts/crm-customization';
import {CompanyConfigurationService,type ConfigActor,type SqlFieldAdapter} from './config-service';
import {configAssert,type ConfigState} from './config-store';
import {projectFields,validateFieldWrite,type FieldBinding} from './field-policy';
import type {AuthenticatedRequest} from '../security/security';
export const accountBindings:FieldBinding[]=[
 ['accountName','account_name','crmName'],['accountStatus','account_status','accountStatus'],['accountGrade','account_grade','accountGrade'],['businessNo','business_no','erp.biz_no'],['businessName','business_name','erp.hosp_nm'],['ceoName','ceo_name','erp.ceo_nm'],['phone','phone','erp.tel'],['fax','fax','erp.fax'],['homepage','homepage','erp.homepage'],['address','address','crmAddress'],['addressLine1','address_line1','erp.addr1'],['addressLine2','address_line2','erp.addr2'],['hospitalAddress','hospital_address','erp.addr_prt'],['zipCode','zip_code','erp.zip_cd'],['taxEmail','tax_email','erp.email'],['providerNo','provider_no','erp.medical_care_no'],['encryptedProviderNo','encrypted_provider_no','erp.U_Key'],['openDate','open_date','erp.open_dt'],['doctorLicenseNo','doctor_license_no','erp.doctor_no'],['accountType','account_type','erp.sal_kd'],['useYn','use_yn','erp.use_yn'],['churnRiskYn','churn_risk_yn','erp.mgt_yn'],['accountStatCode','account_stat_code','erp.stat_bc']
].map(([input,column,key])=>({input,column,output:column,fieldId:'account.'+key}));
const optionalBindings:FieldBinding[]=[['bulkVersion','version','bulkVersion'],['ownerUserId','owner_user_id','ownerUserId'],['ownerName','owner_name','ownerName'],['updatedAt','updated_at','updatedAt']].map(([input,column,key])=>({input,column,output:column,fieldId:'account.'+key}));
const context=(req:AuthenticatedRequest)=>({releaseId:z.string().uuid().parse(req.headers['x-config-release-id']),permissionVersion:z.coerce.number().safe().int().positive().parse(req.headers['x-config-permission-version'])});
const key=(req:AuthenticatedRequest)=>{const value=req.headers['idempotency-key'];configAssert(typeof value==='string',428,'IDEMPOTENCY_REQUIRED');return value;};
const policyFor=(state:ConfigState,actor:ConfigActor):ActorPolicy=>({authenticated:true,companyId:actor.companyId,allowed:state.members[actor.id].permissions,denied:state.members[actor.id].denied});
const manager=(policy:ActorPolicy)=>policy.allowed.includes('ACCOUNT.MERGE')&&!policy.denied.includes('ACCOUNT.MERGE');
const select=accountBindings.map(b=>b.column==='open_date'?'CONVERT(varchar(10),a.open_date,23) open_date':'a.'+b.column).join(',');
const bodySchema=z.record(z.union([z.string().trim().max(2000),z.boolean(),z.null()]));
@Injectable()
export class ConfiguredCustomerGateway{
 constructor(private readonly configuration:CompanyConfigurationService){}
 async handle(req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
  const route=req.path.replace(/\/$/,'');if((req.method==='POST'&&route==='/api/accounts/merge')||(req.method==='GET'&&route.startsWith('/api/accounts/duplicates/')))return handleAccountMerge(this.configuration,req,actor,userKey);if(route==='/api/accounts'&&req.method==='GET')return this.list(req,actor,userKey);
  if(route==='/api/accounts'&&req.method==='POST')return this.create(req,actor,userKey);
  configAssert(['GET','PATCH'].includes(req.method),404,'NOT_FOUND');const publicId=z.string().uuid().parse(route.split('/').at(-1)).toLowerCase();configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
  const adapter:SqlFieldAdapter={bindings:accountBindings,load:async(domain,_actor,policy)=>{
   configAssert(policy.allowed.includes('ACCOUNT.READ')&&!policy.denied.includes('ACCOUNT.READ'),403,'PERMISSION_DENIED');
   const result=await domain.query<Record<string,unknown>>('SELECT a.company_id,a.owner_user_id,a.integration_status,'+select+' FROM crm_account a WITH(UPDLOCK,HOLDLOCK) WHERE a.company_id=@companyKey AND a.public_id=@publicId AND a.deleted_yn=0',{companyKey:domain.companyKey,publicId});configAssert(result.recordset.length===1,404,'NOT_FOUND');const row=result.recordset[0];configAssert(row.owner_user_id===userKey||manager(policy),404,'NOT_FOUND');if(req.method==='PATCH'){configAssert(row.account_status!=='MERGED',409,'ACCOUNT_MERGED');configAssert(!['REQUESTING','PENDING'].includes(String(row.integration_status)),409,'ERP_REQUEST_CONFLICT');}return {companyKey:Number(row.company_id),row};
  },save:async(domain,columns)=>{
   if(Object.hasOwn(columns,'business_no')&&columns.business_no){const duplicates=await domain.query('SELECT account_id FROM crm_account WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND business_no=@businessNo AND public_id<>@publicId AND deleted_yn=0',{companyKey:domain.companyKey,businessNo:columns.business_no,publicId});configAssert(!duplicates.recordset.length,409,'DUPLICATE_ACCOUNT');}
   const entries=Object.entries(columns);if(!entries.length)return;
   const parameters:Record<string,unknown>={companyKey:domain.companyKey,publicId,userKey};entries.forEach(([,value],i)=>parameters['v'+i]=value);
   const result=await domain.query('UPDATE crm_account SET '+entries.map(([column],i)=>column+'=@v'+i).join(',')+',updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND public_id=@publicId AND deleted_yn=0 AND account_status<>\'MERGED\'',parameters);configAssert(result.rowsAffected?.[0]===1,409,'ACCOUNT_CHANGED');
  }};
  if(req.method==='GET'){const result=await this.configuration.readSqlFields(actor,'HQ_ACCOUNT',adapter);return {...result,data:{...result.data,public_id:publicId}};}
  const input=bodySchema.parse(req.body);this.checkInput(input);
  const result=await this.configuration.writeSqlFields(actor,context(req),'ACC.save',publicId,key(req),input,adapter);return {...result,data:{...result.data,public_id:publicId}};
 }
 private checkInput(input:Record<string,unknown>){configAssert(Object.keys(input).every(k=>accountBindings.some(b=>b.input===k)),422,'UNREGISTERED_FIELD');if(Object.hasOwn(input,'accountName'))configAssert(typeof input.accountName==='string'&&input.accountName.length>0&&input.accountName.length<=200,422,'INVALID_FIELD_VALUE');if(Object.hasOwn(input,'accountStatus'))configAssert(['ACTIVE','NEW','NON_TRADING','NON_TRADING_OPP','CHURN_RISK','CHURNED','CLOSED'].includes(String(input.accountStatus)),422,'INVALID_FIELD_VALUE');}
 private async list(req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
  const input=z.object({...listPaging,search:z.string().trim().max(200).optional(),scope:z.enum(['mine','managed','all']).optional()}).strict().parse(req.query??{}),scope=input.scope??'managed';
  const search=input.search?input.search.replace(/[~%_\[]/g,c=>'~'+c):null;
  return this.configuration.readSqlList(actor,'HQ_ACCOUNT',{bindings:accountBindings,optionalBindings,load:async(domain,_actor,policy)=>{
   configAssert(policy.allowed.includes('ACCOUNT.READ')&&!policy.denied.includes('ACCOUNT.READ'),403,'PERMISSION_DENIED');
   const result=await domain.query<Record<string,unknown>>("SELECT a.company_id,CONVERT(varchar(36),a.public_id) public_id,a.owner_user_id,u.user_name owner_name,CONVERT(varchar(18),a.row_version,1) version,CONVERT(varchar(27),a.updated_at,126)+'Z' updated_at,"+select+" FROM crm_account a WITH(HOLDLOCK) LEFT JOIN crm_user u WITH(HOLDLOCK) ON u.user_id=a.owner_user_id AND u.company_id=a.company_id AND u.deleted_yn=0 WHERE a.company_id=@companyKey AND a.deleted_yn=0 AND (@manage=1 OR a.owner_user_id=@userKey) AND (@scope<>'mine' OR a.owner_user_id=@userKey) AND (@scope<>'managed' OR (ISNULL(a.use_yn,'1')<>'0' AND a.account_status<>'MERGED')) AND (@search IS NULL OR a.account_name LIKE '%' + @search + '%' ESCAPE '~' OR a.business_no LIKE '%' + @search + '%' ESCAPE '~' OR a.phone LIKE '%' + @search + '%' ESCAPE '~' OR a.hospital_address LIKE '%' + @search + '%' ESCAPE '~' OR a.provider_no LIKE '%' + @search + '%' ESCAPE '~') ORDER BY a.account_id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY",{...pageParameters(input),companyKey:domain.companyKey,userKey,manage:manager(policy)?1:0,scope,search});
   return result.recordset.map(row=>{configAssert(manager(policy)&&scope!=='mine'||row.owner_user_id===userKey,404,'NOT_FOUND');return {companyKey:Number(row.company_id),publicId:String(row.public_id),row};});
  }},[...(input.search?['account.crmName','account.erp.biz_no','account.erp.tel','account.erp.addr_prt','account.erp.medical_care_no']:[]),...(input.scope!==undefined?['account.ownerUserId','account.erp.use_yn','account.accountStatus']:[])],[...(input.search!==undefined?['account.search']:[]),...(input.scope!==undefined?['account.scope']:[])]);
 }
 private async create(req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
  configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');const input=bodySchema.parse(req.body);this.checkInput(input);configAssert(input.accountName,422,'REQUIRED_FIELD');
  return this.configuration.executeBusiness(actor,context(req),'ACC.create',key(req),input,async(state,tx)=>{
   configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const policy=policyFor(state,actor),effective=state.releases[state.activeReleaseId!].effective,domain=tx.domain;
   const serverValues={'account.ownerUserId':userKey,'account.erpApprovedYn':false,'account.integrationStatus':'NOT_REQUESTED'};
   const defaults:Record<string,unknown>={'account.accountStatus':'ACTIVE','account.erp.use_yn':'1','account.erp.mgt_yn':false};
   // Pin SQL defaults explicitly and validate them before INSERT; catalog defaults win
   // for editable fields, while fixed workflow metadata cannot be redefined silently.
   const creation={...effective,entries:effective.entries.map(e=>Object.hasOwn(defaults,e.id)&&!Object.hasOwn(e.settings,'default')?{...e,settings:{...e.settings,default:defaults[e.id] as string|boolean}}:e)};
   const columns=validateFieldWrite(creation,actor.companyId,policy,accountBindings,input,{},'create',serverValues);
   for(const id of Object.keys(defaults)){const b=accountBindings.find(b=>b.fieldId===id)!;configAssert(Object.hasOwn(columns,b.column),403,'CREATION_FIELD_DENIED');}
   const values={...serverValues,...Object.fromEntries(accountBindings.map(b=>[b.fieldId,columns[b.column]]))};
   const availability=new Map(resolveActorPolicy(effective,actor.companyId,policy,values).map(p=>[p.id,p]));
   for(const entry of effective.entries.filter(e=>e.id.startsWith('account.')&&e.kind==='FIELD'&&e.bindingKind==='DATA'&&e.id!=='account.bulkRows'))configAssert(accountBindings.some(b=>b.fieldId===entry.id)||Object.hasOwn(serverValues,entry.id)||(!availability.get(entry.id)?.required&&!Object.hasOwn(entry.settings,'default')),422,'CREATION_FIELD_UNMAPPED');
   for(const [id,value] of Object.entries(serverValues)){const e=effective.entries.find(e=>e.id===id);configAssert(e&&availability.get(id)?.enabled,403,'CREATION_FIELD_DENIED');configAssert(!Object.hasOwn(e.settings,'default')||e.settings.default===value,422,'CREATION_DEFAULT_CONFLICT');if(e.valueRule?.options)configAssert(e.valueRule.options.includes(value as never),422,'INVALID_FIELD_VALUE');if(typeof value==='number')configAssert((e.valueRule?.min===undefined||value>=e.valueRule.min)&&(e.valueRule?.max===undefined||value<=e.valueRule.max),422,'INVALID_FIELD_VALUE');}
   if(columns.business_no){const dup=await domain.query('SELECT account_id FROM crm_account WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND business_no=@businessNo AND deleted_yn=0',{companyKey:domain.companyKey,businessNo:columns.business_no});configAssert(!dup.recordset.length,409,'DUPLICATE_ACCOUNT');}
   const entries=Object.entries(columns),params:Record<string,unknown>={companyKey:domain.companyKey,userKey};entries.forEach(([,value],i)=>params['v'+i]=value);
   const saved=await domain.query<Record<string,unknown>>("INSERT INTO crm_account(company_id,owner_user_id,created_by,updated_by,erp_approved_yn,integration_status,"+entries.map(([c])=>c).join(',')+") OUTPUT CONVERT(varchar(36),inserted.public_id) public_id VALUES(@companyKey,@userKey,@userKey,@userKey,0,'NOT_REQUESTED',"+entries.map((_,i)=>'@v'+i).join(',')+')',params);configAssert(saved.recordset.length===1,500,'DOMAIN_WRITE_FAILED');
   const publicId=String(saved.recordset[0].public_id);
   const loaded=await domain.query<Record<string,unknown>>('SELECT '+select+' FROM crm_account a WITH(HOLDLOCK) WHERE a.company_id=@companyKey AND a.public_id=@publicId AND a.deleted_yn=0',{companyKey:domain.companyKey,publicId});configAssert(loaded.recordset.length===1,500,'DOMAIN_WRITE_FAILED');
   return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:publicId,...projectFields(effective,actor.companyId,policy,accountBindings,loaded.recordset[0])}};
  });
 }
}
