import {z} from 'zod';
import {resolveActorPolicy,type ActorPolicy} from '@dio-crm/contracts/crm-customization';
import {CompanyConfigurationService,type ConfigActor} from './config-service';
import {configAssert,type ConfigState,type ConfigTransaction} from './config-store';
import {validateFieldWrite,projectFields,type FieldBinding} from './field-policy';
import {canTransitionLead,type LeadStatus} from '../modules/customer/customer.rules';
import type {AuthenticatedRequest} from '../security/security';

const statuses=['NEW','FIRST_VISIT','KEYMAN_MEETING','CONTACT_EXCLUDED'] as const;
const version=z.string().regex(/^0x[0-9a-f]{16}$/i);
const bind=(fieldId:string,input:string,column=input):FieldBinding=>({fieldId,input,column,output:column});
const conversionSchema=z.object({expectedVersion:version,accountMode:z.enum(['NEW','EXISTING']),existingAccountPublicId:z.string().uuid().transform(x=>x.toLowerCase()).optional(),opportunityName:z.string().trim().min(1).max(200)}).strict().superRefine((v,c)=>{if((v.accountMode==='EXISTING')!==!!v.existingAccountPublicId)c.addIssue({code:'custom',message:'Account mode and target must agree'});});
type Domain=NonNullable<ConfigTransaction['domain']>;
type Row=Record<string,any>;
/** Only domain.query is used: business rows, configuration receipts and audit commit together. */
export async function executeLeadCommand(service:CompanyConfigurationService,req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
 const match=/^\/api\/leads\/([a-f0-9-]{36})\/(status|assign-owner|convert)\/?$/i.exec(req.path);configAssert(match&&req.method==='POST',404,'NOT_FOUND');
 const publicId=z.string().uuid().parse(match[1]).toLowerCase(),command=match[2];
 configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
 const input=command==='status'?z.object({expectedVersion:version,toStatus:z.enum(statuses),reason:z.string().trim().max(500).optional()}).strict().parse(req.body):command==='assign-owner'?z.object({expectedVersion:version,ownerUserId:z.number().safe().int().positive()}).strict().parse(req.body):conversionSchema.parse(req.body);
 const context={releaseId:z.string().uuid().parse(req.headers['x-config-release-id']),permissionVersion:z.coerce.number().safe().int().positive().parse(req.headers['x-config-permission-version'])};
 const key=req.headers['idempotency-key'];configAssert(typeof key==='string',428,'IDEMPOTENCY_REQUIRED');
 const action=command==='status'?'LEAD.changeStage':command==='assign-owner'?'LEAD.assignOwner':'LEAD.convert';
 const policyFor=(state:ConfigState):ActorPolicy=>({authenticated:true,companyId:actor.companyId,allowed:state.members[actor.id].permissions,denied:state.members[actor.id].denied});
 const load=async(domain:Domain)=>{const r=await domain.query<Row>('SELECT *,CONVERT(varchar(18),row_version,1) version FROM crm_lead WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@publicId AND deleted_yn=0',{companyKey:domain.companyKey,publicId});configAssert(r.recordset.length===1,404,'NOT_FOUND');return r.recordset[0];};
 const authorize=async(state:ConfigState,tx:ConfigTransaction)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const row=await load(tx.domain),policy=policyFor(state);configAssert(row.owner_user_id===userKey||(policy.allowed.includes('LEAD.MANAGE')&&!policy.denied.includes('LEAD.MANAGE')),404,'NOT_FOUND');};
 return service.executeBusiness(actor,context,action,key,{publicId,input},async(state,tx)=>{
  const domain=tx.domain!,query=domain.query,companyKey=domain.companyKey,row=await load(domain),policy=policyFor(state),effective=state.releases[state.activeReleaseId!].effective;
  configAssert(row.version===(input as {expectedVersion:string}).expectedVersion,409,'LEAD_CHANGED');
  configAssert(row.status!=='CONVERTED',409,'LEAD_CONVERTED');
  const requireAction=(id:string)=>configAssert(effective.entries.some(e=>e.id===id&&e.kind==='ACTION')&&resolveActorPolicy(effective,actor.companyId,policy).some(p=>p.id===id&&p.enabled),403,'ACTION_DENIED');
  const write=(bindings:FieldBinding[],values:Record<string,unknown>,mode:'create'|'update'='update')=>validateFieldWrite(effective,actor.companyId,policy,bindings,values,{},mode);
  const create=(prefix:string,bindings:FieldBinding[],values:Record<string,unknown>,server:Record<string,unknown>={})=>{
   const columns=validateFieldWrite(effective,actor.companyId,policy,bindings,values,{},'create',server);
   const known=new Set([...bindings.map(b=>b.fieldId),...Object.keys(server)]),fieldValues={...server,...Object.fromEntries(bindings.map(b=>[b.fieldId,Object.hasOwn(columns,b.column)?columns[b.column]:values[b.input]]))};
   const availability=new Map(resolveActorPolicy(effective,actor.companyId,policy,fieldValues).map(p=>[p.id,p]));
   // Product line editors and later stage commands are separate creation scopes.
   const separateCommands=new Set(['opportunity.targetStage','opportunity.reason','account.bulkRows']);
   for(const entry of effective.entries.filter(e=>e.kind==='FIELD'&&e.bindingKind==='DATA'&&e.id.startsWith(prefix)&&e.parentId!=='section:opportunity.products'&&!separateCommands.has(e.id))){
    // A domain mapping must explicitly handle every required/defaulted creation value.
    configAssert(known.has(entry.id)||(!availability.get(entry.id)?.required&&!Object.hasOwn(entry.settings,'default')),422,'CREATION_FIELD_UNMAPPED');
   }
   for(const [id,value] of Object.entries(server)){const entry=effective.entries.find(e=>e.id===id),p=availability.get(id);configAssert(entry&&p?.enabled,403,'CREATION_FIELD_DENIED');configAssert(!Object.hasOwn(entry.settings,'default')||entry.settings.default===value,422,'CREATION_DEFAULT_CONFLICT');if(entry.valueRule?.options)configAssert(entry.valueRule.options.includes(value as never),422,'INVALID_FIELD_VALUE');}
   return columns;
  };
  const response=(value:Row,bindings:FieldBinding[])=>({releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:publicId,...projectFields(effective,actor.companyId,policy,bindings,value)}});
  if(command==='status'){
   const {toStatus,reason}=input as {toStatus:LeadStatus;reason?:string};
   write([bind('lead.targetStatus','toStatus'),bind('lead.reason','reason')],{toStatus,...(reason!==undefined?{reason}:{})});
   if(toStatus==='CONTACT_EXCLUDED'){configAssert(reason,422,'REASON_REQUIRED');write([bind('lead.exclusionReason','reason')],{reason});}
   const decision=canTransitionLead(row.status,toStatus,policy.allowed.filter(p=>!policy.denied.includes(p)),reason);configAssert(decision.allowed,422,'LEAD_TRANSITION_DENIED');
   const updated=await query("UPDATE crm_lead SET status=@toStatus,contact_exclude_reason=CASE WHEN @toStatus='CONTACT_EXCLUDED' THEN @reason ELSE contact_exclude_reason END,updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND lead_id=@leadId AND row_version=CONVERT(binary(8),@expectedVersion,1)",{companyKey,leadId:row.lead_id,userKey,toStatus,reason:reason??null,expectedVersion:input.expectedVersion});configAssert(updated.rowsAffected?.[0]===1,409,'LEAD_CHANGED');
   await query('INSERT INTO crm_lead_status_history(lead_id,from_status,to_status,reason,changed_by) VALUES(@leadId,@fromStatus,@toStatus,@reason,@userKey)',{leadId:row.lead_id,fromStatus:row.status,toStatus,reason:reason??null,userKey});
   return response({status:toStatus},[bind('lead.status','status')]);
  }
  if(command==='assign-owner'){
   const {ownerUserId}=input as {ownerUserId:number};write([bind('lead.ownerUserId','ownerUserId')],{ownerUserId});
   const target=await query('SELECT user_id FROM crm_user WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND user_id=@ownerUserId AND is_active=1 AND deleted_yn=0',{companyKey,ownerUserId});configAssert(target.recordset.length===1,422,'OWNER_UNAVAILABLE');
   const updated=await query('UPDATE crm_lead SET owner_user_id=@ownerUserId,updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND lead_id=@leadId AND row_version=CONVERT(binary(8),@expectedVersion,1)',{companyKey,leadId:row.lead_id,ownerUserId,userKey,expectedVersion:input.expectedVersion});configAssert(updated.rowsAffected?.[0]===1,409,'LEAD_CHANGED');
   return response({owner_user_id:ownerUserId},[bind('lead.ownerUserId','ownerUserId','owner_user_id')]);
  }
  const conversion=input as z.infer<typeof conversionSchema>;
  write([bind('lead.convertAccountMode','accountMode'),bind('lead.convertAccountPublicId','existingAccountPublicId'),bind('opportunity.name','opportunityName')],{accountMode:conversion.accountMode,...(conversion.existingAccountPublicId?{existingAccountPublicId:conversion.existingAccountPublicId}:{}),opportunityName:conversion.opportunityName});
  configAssert(row.status==='KEYMAN_MEETING'&&row.owner_user_id,422,'LEAD_NOT_CONVERTIBLE');
  requireAction('OPP.create');
  const sourceIds=['lead.ownerUserId',...(conversion.accountMode==='NEW'?['lead.hospitalName','lead.businessNo','lead.providerNo','lead.phone','lead.address','lead.latitude','lead.longitude']:[]),...(row.keyman_name?['lead.keymanSurname','lead.keymanType','lead.keymanMobile','lead.keymanEmail','lead.keymanSchool','lead.keymanClassYear','lead.keymanMajor']:[])];
  const policies=new Map(resolveActorPolicy(effective,actor.companyId,policy).map(p=>[p.id,p]));for(const id of sourceIds)configAssert(policies.get(id)?.readable&&policies.get(id)?.masking==='none',403,'CONVERSION_SOURCE_DENIED');
  const owner=await query('SELECT user_id FROM crm_user WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND user_id=@ownerUserId AND is_active=1 AND deleted_yn=0',{companyKey,ownerUserId:row.owner_user_id});configAssert(owner.recordset.length===1,422,'OWNER_UNAVAILABLE');
  let account:Row;
  if(conversion.accountMode==='EXISTING'){
   requireAction('ACC.open');const found=await query<Row>("SELECT account_id,CONVERT(varchar(36),public_id) public_id,owner_user_id FROM crm_account WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@targetId AND deleted_yn=0 AND account_status<>'MERGED'",{companyKey,targetId:conversion.existingAccountPublicId});configAssert(found.recordset.length===1,404,'NOT_FOUND');account=found.recordset[0];configAssert(account.owner_user_id===userKey,404,'NOT_FOUND');
  }else{
   requireAction('ACC.create');
   const columns=create('account.',[bind('account.crmName','accountName'),bind('account.erp.biz_no','businessNo'),bind('account.erp.medical_care_no','providerNo'),bind('account.erp.tel','phone'),bind('account.crmAddress','address'),bind('account.latitude','latitude'),bind('account.longitude','longitude')],Object.fromEntries(Object.entries({accountName:row.hospital_name,businessNo:row.business_no,providerNo:row.provider_no,phone:row.phone,address:row.address,latitude:row.latitude,longitude:row.longitude}).filter(([,v])=>v!==null&&v!==undefined)),{'account.ownerUserId':row.owner_user_id});
   if(columns.businessNo){const duplicates=await query('SELECT account_id FROM crm_account WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND business_no=@businessNo AND deleted_yn=0',{companyKey,businessNo:columns.businessNo});configAssert(!duplicates.recordset.length,409,'DUPLICATE_ACCOUNT');}
   const saved=await query<Row>('INSERT INTO crm_account(company_id,owner_user_id,account_name,business_no,provider_no,phone,address,latitude,longitude,created_by) OUTPUT inserted.account_id,CONVERT(varchar(36),inserted.public_id) public_id VALUES(@companyKey,@ownerUserId,@accountName,@businessNo,@providerNo,@phone,@address,@latitude,@longitude,@userKey)',{companyKey,ownerUserId:row.owner_user_id,accountName:columns.accountName,businessNo:columns.businessNo??null,providerNo:columns.providerNo??null,phone:columns.phone??null,address:columns.address??null,latitude:columns.latitude??null,longitude:columns.longitude??null,userKey});account=saved.recordset[0];configAssert(account,500,'DOMAIN_WRITE_FAILED');
  }
  let contactId:number|null=null;
  if(row.keyman_name){requireAction('CONTACT.create');const columns=create('contact.',[bind('contact.contactName','name'),bind('contact.contactType','type'),bind('contact.mobile','mobile'),bind('contact.email','email'),bind('contact.school','school'),bind('contact.cohort','cohort'),bind('contact.major','major'),bind('contact.accountPublicId','accountPublicId')],Object.fromEntries(Object.entries({name:row.keyman_name,type:row.keyman_type,mobile:row.keyman_mobile,email:row.keyman_email,school:row.school,cohort:row.cohort,major:row.major,accountPublicId:account.public_id}).filter(([,v])=>v!==null&&v!==undefined)));const saved=await query<Row>('INSERT INTO crm_contact(company_id,account_id,contact_type,contact_name,mobile,email,school,cohort,major,created_by) OUTPUT inserted.contact_id VALUES(@companyKey,@accountId,@type,@name,@mobile,@email,@school,@cohort,@major,@userKey)',{companyKey,accountId:account.account_id,type:columns.type??null,name:columns.name,mobile:columns.mobile??null,email:columns.email??null,school:columns.school??null,cohort:columns.cohort??null,major:columns.major??null,userKey});configAssert(saved.recordset[0],500,'DOMAIN_WRITE_FAILED');contactId=Number(saved.recordset[0].contact_id);}
  create('opportunity.',[bind('opportunity.name','opportunityName'),bind('opportunity.accountPublicId','accountPublicId')],{opportunityName:conversion.opportunityName,accountPublicId:account.public_id},{'opportunity.stage':'NEEDS_ANALYSIS','opportunity.recordType':'NEW','opportunity.ownerUserId':row.owner_user_id});
  const opportunity=await query<Row>("INSERT INTO crm_opportunity(company_id,account_id,owner_user_id,opportunity_name,stage,record_type,converted_from_lead_id,created_by) OUTPUT inserted.opportunity_id,CONVERT(varchar(36),inserted.public_id) public_id VALUES(@companyKey,@accountId,@ownerUserId,@opportunityName,'NEEDS_ANALYSIS','NEW',@leadId,@userKey)",{companyKey,accountId:account.account_id,ownerUserId:row.owner_user_id,opportunityName:conversion.opportunityName,leadId:row.lead_id,userKey});configAssert(opportunity.recordset[0],500,'DOMAIN_WRITE_FAILED');
  await query('INSERT INTO crm_lead_conversion_history(lead_id,account_id,contact_id,opportunity_id,converted_by) VALUES(@leadId,@accountId,@contactId,@opportunityId,@userKey)',{leadId:row.lead_id,accountId:account.account_id,contactId,opportunityId:opportunity.recordset[0].opportunity_id,userKey});
  await query("INSERT INTO crm_lead_status_history(lead_id,from_status,to_status,reason,changed_by) VALUES(@leadId,@fromStatus,'CONVERTED',N'LEAD_CONVERT',@userKey)",{leadId:row.lead_id,fromStatus:row.status,userKey});
  const updated=await query("UPDATE crm_lead SET status='CONVERTED',converted_at=SYSUTCDATETIME(),converted_by=@userKey,updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND lead_id=@leadId AND row_version=CONVERT(binary(8),@expectedVersion,1)",{companyKey,leadId:row.lead_id,userKey,expectedVersion:input.expectedVersion});configAssert(updated.rowsAffected?.[0]===1,409,'LEAD_CHANGED');
  // Response only exposes the authorized source identifier, not new cross-domain data.
  return response({status:'CONVERTED'},[bind('lead.status','status')]);
 },authorize);
}
