import { createHqPolicy } from '@dio-crm/contracts';
import { hqCanRead, hqFind, hqNumber, hqObject, hqOnlyKeys, hqRequire, hqText } from './app.js';
import type { HqApplication, HqRouteContext } from './app.js';
import { auditHq, canonicalHq, cloneHq, hqAssert, HqMockError, newHqId } from './model.js';
import type { HqActor, HqDataset, HqRow } from './model.js';
import { enqueueInterface } from './interfaces.js';
import { canTransitionLead } from '../modules/customer/customer.rules.js';
import type { LeadStatus } from '../modules/customer/customer.rules.js';

const META = ['expectedVersion', 'idempotencyKey'] as const;
const LEAD_FIELDS: Record<string, string> = {
  hospitalName:'hospital_name',phone:'phone',address:'address',businessNo:'business_no',keymanName:'keyman_name',keymanType:'keyman_type',
  keymanMobile:'keyman_mobile',keymanEmail:'keyman_email',school:'school',cohort:'cohort',major:'major',keymanNote:'keyman_note',
  mainSystem:'main_system',subSystem:'sub_system',hospitalSize:'hospital_size',doctorCount:'doctor_count',chairCount:'chair_count',
  contactExcludeReason:'contact_exclude_reason',exclusionDetail:'exclusion_detail',mapExcluded:'map_excluded_yn',hiraExcluded:'hira_sync_exclude_yn'
};
const ACCOUNT_FIELDS: Record<string, string> = {
  accountName:'account_name',accountStatus:'account_status',accountGrade:'account_grade',businessNo:'business_no',businessName:'business_name',
  ceoName:'ceo_name',phone:'phone',fax:'fax',homepage:'homepage',address:'address',addressLine1:'address_line1',addressLine2:'address_line2',
  hospitalAddress:'hospital_address',zipCode:'zip_code',taxEmail:'tax_email',providerNo:'provider_no',encryptedProviderNo:'encrypted_provider_no',
  openDate:'open_date',doctorLicenseNo:'doctor_license_no',accountType:'account_type',hospitalSize:'hospital_size',mainSystem:'main_system',subSystem:'sub_system',dioProductUsage:'dio_product_usage'
};
const HOSPITAL_FIELDS = ['hospitalSize','mainSystem','subSystem','dioProductUsage'] as const;
const CONTACT_FIELDS: Record<string, string> = {contactName:'contact_name',contactType:'contact_type',mobile:'mobile',email:'email',isKeyman:'is_keyman',school:'school',cohort:'cohort',major:'major',note:'note'};
const SOURCE_LOCKED = ['erpCustomerCode','erp_customer_code','erpApprovedYn','erp_approved_yn','erpTradeCode','erp_trade_code','erpApprovalCode','erp_approval_code','integrationStatus','integration_status','useYn','use_yn','churnRiskYn','churn_risk_yn','accountStatCode','account_stat_code','companyId','company_id'];
const STATUS: LeadStatus[] = ['NEW','FIRST_VISIT','KEYMAN_MEETING','CONTACT_EXCLUDED','CONVERTED'];
const active = (row: HqRow) => row.deleted_yn !== true && row.account_status !== 'MERGED';
const normalizeBusiness = (value: unknown) => typeof value === 'string' ? value.replace(/[^0-9A-Za-z]/g,'').toUpperCase() : '';
const isoDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
function id(value: unknown, label: string): string {
  const valueText = hqText(value,label,36); hqAssert(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valueText),400,'INVALID_ID',label); return valueText;
}
function expected(row: HqRow, body: Record<string,unknown>, required = true) {
  if (!required && body.expectedVersion === undefined) return;
  hqAssert(Number.isSafeInteger(body.expectedVersion) && Number(body.expectedVersion)>0,400,'EXPECTED_VERSION_REQUIRED');
  hqAssert(row.version === body.expectedVersion,409,'VERSION_CONFLICT','The record changed; reload before saving');
}
function existing(d: HqDataset, c: HqRouteContext, collection: 'leads'|'accounts'|'contacts'|'opportunities', publicId: string): HqRow {
  const row = hqFind(d,c.actor,collection,publicId); hqAssert(active(row),404,'NOT_FOUND'); return row;
}
function ownerWrite(actor: HqActor, row: HqRow, permission: string) {
  hqAssert(row.owner_user_id === actor.userId || actor.permissions.includes(permission),403,'OWNER_REQUIRED','Only the owner or an authorized manager can change this record');
}
function history(d: HqDataset, actor: HqActor, row: HqRow, action: string, detail: Record<string,unknown>) {
  const entries = Array.isArray(row.history) ? row.history : [];
  row.history = [...entries,{public_id:newHqId(d),action,at:d.clock,user_id:actor.userId,...cloneHq(detail)}];
  auditHq(d,actor,action,row.public_id,detail);
}
function writeValues(input: Record<string,unknown>, map: Record<string,string>, entity: 'lead'|'account'|'contact'): Record<string,unknown> {
  const output: Record<string,unknown> = {};
  const lengths:Record<string,number>={accountName:300,businessName:300,businessNo:20,zipCode:20,accountType:20,accountGrade:30,ceoName:50,phone:50,fax:50,providerNo:50,homepage:100,taxEmail:100,encryptedProviderNo:100,address:500,addressLine1:400,addressLine2:400,hospitalAddress:400,openDate:10,doctorLicenseNo:500,hospitalName:300,contactName:200,keymanName:200,keymanNote:4000,exclusionDetail:4000,note:4000,dioProductUsage:4000};
  for (const [key,db] of Object.entries(map)) if (Object.hasOwn(input,key)) {
    const value = input[key];
    if (['mapExcluded','hiraExcluded','isKeyman'].includes(key)) {hqAssert(typeof value==='boolean',400,'FIELD_INVALID',key);output[db]=value;continue;}
    if (['hospitalSize','doctorCount','chairCount'].includes(key)) {hqAssert(value===null || Number.isSafeInteger(value) && Number(value)>=0,400,'FIELD_INVALID',key);output[db]=value;continue;}
    hqAssert(value===null || typeof value==='string',400,'FIELD_INVALID',key);
    if (value===null) {hqAssert(!['hospitalName','accountName','contactName'].includes(key),400,'FIELD_REQUIRED',key);output[db]=null;continue;}
    const text = (value as string).trim(); hqAssert(text.length <= (lengths[key] ?? 1000),400,'FIELD_TOO_LONG',key);
    if (['hospitalName','accountName','contactName'].includes(key)) hqAssert(text.length>0,400,'FIELD_REQUIRED',key);
    if (key==='accountStatus') hqAssert(['ACTIVE','NEW','NON_TRADING','NON_TRADING_OPP','CHURN_RISK','CHURNED','CLOSED'].includes(text),400,'FIELD_INVALID',key);
    if (key==='openDate' && text) hqAssert(isoDay(text),400,'FIELD_INVALID',key);
    output[db]=text;
  }
  return output;
}
function lockSources(body:Record<string,unknown>) {hqAssert(!SOURCE_LOCKED.some(key=>Object.hasOwn(body,key)),403,'SOURCE_FIELD_READ_ONLY','ERP result and company fields cannot be changed by a CRM form');}
function applyValues(row:HqRow,values:Record<string,unknown>,d:HqDataset,actor:HqActor,action:string) {
  const changes = Object.fromEntries(Object.entries(values).filter(([key,value])=>canonicalHq(row[key] ?? null)!==canonicalHq(value)).map(([key,value])=>[key,{before:row[key]??null,after:value}]));
  Object.assign(row,cloneHq(values)); row.updated_at=d.clock; row.updated_by=actor.userId;
  row.manual_fields=[...new Set([...(Array.isArray(row.manual_fields)?row.manual_fields:[]),...Object.keys(values)])];
  history(d,actor,row,action,{changes});
}
/** Receipts live in the same persisted transaction as the business rows. */
function mutation(c:HqRouteContext,action:string,target:string,requiredKey:boolean,access:(d:HqDataset)=>void,work:(d:HqDataset)=>unknown) {
  const definition=c.app.standard.actions.find(row=>row.actionKey===action);
  hqAssert(definition?.enabled&&definition.support!=='planned'&&definition.screenKey,409,'ACTION_NOT_REGISTERED',action);
  definition.permissions.forEach(permission=>hqRequire(c.actor,permission));
  const context=c.app.context(c.actor);
  hqAssert(context.activeProcesses.includes(definition.processKey)&&definition.features.every(feature=>context.features.includes(feature))&&createHqPolicy(c.app.standard,c.app.capabilities).screenAllowed(definition.screenKey,context),403,'ACTION_ACCESS_DENIED',action);
  const rawKey=c.body.idempotencyKey ?? c.headers['idempotency-key'];
  const key=rawKey===undefined&&!requiredKey ? undefined : hqText(rawKey,'idempotencyKey',200);
  const fingerprint=canonicalHq({action,target,body:Object.fromEntries(Object.entries(c.body).filter(([k])=>k!=='idempotencyKey'))});
  return c.repository.transact(d=>{
    access(d);
    if(key){
      const receipt=d.collections.auditLogs.find(row=>row.action==='HQ_MUTATION_RECEIPT'&&row.company_id===c.actor.companyId&&row.owner_user_id===c.actor.userId&&(row.detail as Record<string,unknown>)?.key===key);
      if(receipt){const detail=receipt.detail as Record<string,unknown>;hqAssert(detail.fingerprint===fingerprint,409,'IDEMPOTENCY_CONFLICT');return cloneHq(detail.response);}
    }
    const response=work(d);
    if(key)auditHq(d,c.actor,'HQ_MUTATION_RECEIPT',target,{key,fingerprint,response:cloneHq(response)});
    return response;
  });
}
function duplicateAccounts(d:HqDataset,company:number,business:unknown,excluded:string[]=[]):HqRow[]{
  const normalized=normalizeBusiness(business);return normalized?d.collections.accounts.filter(row=>row.company_id===company&&active(row)&&!excluded.includes(row.public_id)&&normalizeBusiness(row.business_no)===normalized):[];
}
function orderAllowed(account:HqRow) {return account.erp_approved_yn===true&&account.use_yn!=='0'&&!['MERGED','CLOSED'].includes(String(account.account_status));}

/** H03 customer-only routes; runtime explicitly installs this extension after the H02 foundation. */
export function installCustomerRoutes(app:HqApplication):void {
  const policy=createHqPolicy(app.standard,app.capabilities);
  const fields = (c:HqRouteContext,entity:string,row:HqRow,input:Record<string,unknown>,map:Record<string,string>) => {
    const context=app.context(c.actor,app.values(row,input));
    for(const key of Object.keys(input).filter(key=>Object.hasOwn(map,key))){
      const field=app.standard.fields.find(field=>field.entity===entity&&field.current.apiField===key);
      hqAssert(field&&policy.fieldWritable(field.fieldKey,context),403,'FIELD_READ_ONLY',key);
    }
  };
  const project=(c:HqRouteContext,row:HqRow,entity:string):HqRow=>{
    const output=cloneHq(row),context=app.context(c.actor,app.values(row));
    for(const field of app.standard.fields.filter(field=>field.entity===entity&&field.current.dbField)){
      const db=field.current.dbField!;if(!Object.hasOwn(row,db))continue;
      const value=policy.readField(field.fieldKey,context);if(value===undefined)delete output[db];else output[db]=value;
    }
    return output;
  };
  const owners=(c:HqRouteContext)=>app.personas.filter(person=>person.companyId===c.actor.companyId&&(c.actor.permissions.includes('LEAD.MANAGE')||person.userId===c.actor.userId)&&(c.actor.scope!=='BRANCH'||person.organizationId===c.actor.organizationId)).map(person=>({userId:person.userId,name:person.name,organizationId:person.organizationId}));
  const owner=(c:HqRouteContext,userId:unknown,fallback:number)=>{
    const selected=userId===undefined?fallback:hqNumber(userId,'ownerUserId',1);hqAssert(Number.isInteger(selected),400,'OWNER_INVALID');
    const person=app.personas.find(person=>person.userId===selected&&person.companyId===c.actor.companyId);
    hqAssert(person,400,'OWNER_NOT_REGISTERED');
    hqAssert(selected===c.actor.userId||c.actor.permissions.includes('LEAD.MANAGE'),403,'OWNER_ASSIGNMENT_DENIED');
    hqAssert(c.actor.scope!=='BRANCH'||person.organizationId===c.actor.organizationId,403,'OWNER_OUTSIDE_SCOPE');return person;
  };
  const leadDto=(c:HqRouteContext,row:HqRow)=>({...project(c,row,'lead'),publicId:row.public_id,hira_check_needed:row.hira_check_needed??null,engagement_score:row.engagement_score??null,calculation_status:'UNCONFIRMED',mode:'MOCK'});
  const accountDto=(c:HqRouteContext,d:HqDataset,row:HqRow)=>({...project(c,row,'account'),publicId:row.public_id,contact_count:d.collections.contacts.filter(contact=>active(contact)&&contact.account_public_id===row.public_id&&hqCanRead(c.actor,contact)).length,order_allowed:orderAllowed(row),mode:'MOCK'});
  const contactDto=(c:HqRouteContext,row:HqRow)=>({...project(c,row,'contact'),publicId:row.public_id,mode:'MOCK'});
  const opportunityDto=(c:HqRouteContext,d:HqDataset,row:HqRow)=>{
    const account=existing(d,c,'accounts',String(row.account_public_id));return {...row,account_name:account.account_name,erp_approved_yn:account.erp_approved_yn,erp_customer_code:account.erp_customer_code??null,win_allowed:orderAllowed(account),order_allowed:orderAllowed(account)};
  };
  const requireLeadWrite=(c:HqRouteContext,d:HqDataset)=>{const row=existing(d,c,'leads',c.params.publicId);ownerWrite(c.actor,row,'LEAD.MANAGE');return row;};
  const requireAccountWrite=(c:HqRouteContext,d:HqDataset,publicId=c.params.publicId)=>{const row=existing(d,c,'accounts',publicId);ownerWrite(c.actor,row,'ACCOUNT.MERGE');return row;};

  app.replaceRoute('GET','/api/leads',c=>{
    hqRequire(c.actor,'LEAD.READ');app.requireAction(c.actor,'LEAD.search',{},Object.fromEntries(c.query));
    const search=(c.query.get('search')??'').toLocaleLowerCase(),status=c.query.get('status'),ownerId=c.query.get('ownerUserId');
    return c.repository.read().collections.leads.filter(row=>active(row)&&hqCanRead(c.actor,row)&&(!status||row.status===status)&&(!ownerId||String(row.owner_user_id)===ownerId)&&(!search||[row.hospital_name,row.business_no,row.phone,row.keyman_name].some(value=>String(value??'').toLocaleLowerCase().includes(search)))).map(row=>leadDto(c,row));
  });
  app.route('GET','/api/leads/options',c=>{hqRequire(c.actor,'LEAD.READ');app.requireAction(c.actor,'LEAD.search');return {owners:owners(c),statuses:STATUS,mode:'MOCK'};});
  app.replaceRoute('GET','/api/leads/:publicId',c=>{hqRequire(c.actor,'LEAD.READ');const row=existing(c.repository.read(),c,'leads',c.params.publicId);app.requireAction(c.actor,'LEAD.open',row);return leadDto(c,row);});
  app.route('GET','/api/leads/:publicId/history',c=>{hqRequire(c.actor,'LEAD.READ');const row=existing(c.repository.read(),c,'leads',c.params.publicId);app.requireAction(c.actor,'LEAD.open',row);return cloneHq(row.history??[]);});
  app.route('POST','/api/leads',c=>{
    hqRequire(c.actor,'LEAD.WRITE');hqOnlyKeys(c.body,[...Object.keys(LEAD_FIELDS),'ownerUserId','idempotencyKey']);
    const response=mutation(c,'LEAD.create','NEW',true,()=>app.requireAction(c.actor,'LEAD.create',{},c.body),d=>{
      hqText(c.body.hospitalName,'hospitalName');const person=owner(c,c.body.ownerUserId,c.actor.userId);
      const row:HqRow={public_id:newHqId(d),company_id:c.actor.companyId,owner_user_id:person.userId,organization_id:person.organizationId,version:1,status:'NEW',source_system:'CRM',manual_fields:[],history:[],map_excluded_yn:false,hira_sync_exclude_yn:false,created_at:d.clock};
      fields(c,'lead',row,c.body,LEAD_FIELDS);applyValues(row,writeValues(c.body,LEAD_FIELDS,'lead'),d,c.actor,'LEAD.create');d.collections.leads.push(row);return row;
    }) as HqRow;return leadDto(c,response);
  });
  app.route('PATCH','/api/leads/:publicId',c=>{
    hqRequire(c.actor,'LEAD.WRITE');hqOnlyKeys(c.body,[...Object.keys(LEAD_FIELDS),...META]);
    const response=mutation(c,'LEAD.save',c.params.publicId,true,d=>{requireLeadWrite(c,d);},d=>{
      const row=requireLeadWrite(c,d);expected(row,c.body);app.requireAction(c.actor,'LEAD.save',row,c.body);fields(c,'lead',row,c.body,LEAD_FIELDS);
      applyValues(row,writeValues(c.body,LEAD_FIELDS,'lead'),d,c.actor,'LEAD.save');row.version++;return row;
    }) as HqRow;return leadDto(c,response);
  });
  app.route('POST','/api/leads/:publicId/status',c=>{
    hqRequire(c.actor,'LEAD.WRITE');hqOnlyKeys(c.body,['toStatus','reason',...META]);
    const response=mutation(c,'LEAD.changeStage',c.params.publicId,true,d=>{requireLeadWrite(c,d);},d=>{
      const row=requireLeadWrite(c,d);expected(row,c.body);const to=c.body.toStatus as LeadStatus;
      hqAssert(STATUS.includes(to)&&to!=='CONVERTED',400,'CONVERSION_ACTION_REQUIRED','CONVERTED can only be reached through the atomic conversion action');
      const reason=c.body.reason===undefined?'':hqText(c.body.reason,'reason',1000);
      const decision=canTransitionLead(row.status as LeadStatus,to,c.actor.permissions,reason);
      hqAssert(decision.allowed,409,'LEAD_TRANSITION_DENIED',decision.error??'Transition is not allowed');
      if(decision.reverse){app.requireAction(c.actor,'LEAD.reverse',row,c.body);app.requireTransition(c.actor,`LEAD.reverseTo.${to}`,row,c.body);}
      else {app.requireAction(c.actor,'LEAD.changeStage',row,c.body);if(row.status!==to)app.requireTransition(c.actor,({FIRST_VISIT:'LEAD.firstVisit',KEYMAN_MEETING:'LEAD.keymanMeeting',CONTACT_EXCLUDED:'LEAD.exclude'} as Record<string,string>)[to],row,c.body);}
      if(to==='CONTACT_EXCLUDED')hqAssert(reason.trim().length>0,400,'EXCLUSION_REASON_REQUIRED');
      const from=row.status;row.status=to;if(to==='CONTACT_EXCLUDED')row.contact_exclude_reason=reason;
      history(d,c.actor,row,decision.reverse?'LEAD.reverse':'LEAD.changeStage',{from_status:from,to_status:to,reason,reverse:decision.reverse});row.version++;row.updated_at=d.clock;return row;
    }) as HqRow;return leadDto(c,response);
  });
  app.route('POST','/api/leads/:publicId/assign-owner',c=>{
    hqRequire(c.actor,'LEAD.MANAGE');hqOnlyKeys(c.body,['ownerUserId',...META]);
    const response=mutation(c,'LEAD.assignOwner',c.params.publicId,true,d=>{requireLeadWrite(c,d);},d=>{
      const row=requireLeadWrite(c,d);expected(row,c.body);app.requireAction(c.actor,'LEAD.assignOwner',row,c.body);const selected=owner(c,c.body.ownerUserId,c.actor.userId),before=row.owner_user_id;
      row.owner_user_id=selected.userId;row.owner_name=selected.name;row.organization_id=selected.organizationId;row.manual_fields=[...new Set([...(row.manual_fields as string[]??[]),'owner_user_id'])];
      history(d,c.actor,row,'LEAD.assignOwner',{from_owner_user_id:before??null,to_owner_user_id:selected.userId});row.version++;return row;
    }) as HqRow;return leadDto(c,response);
  });
  app.route('DELETE','/api/leads/:publicId',c=>{
    hqRequire(c.actor,'LEAD.WRITE');hqOnlyKeys(c.body,[...META]);return mutation(c,'LEAD.delete',c.params.publicId,true,d=>{ownerWrite(c.actor,hqFind(d,c.actor,'leads',c.params.publicId),'LEAD.MANAGE');},d=>{
      const row=requireLeadWrite(c,d);expected(row,c.body);app.requireAction(c.actor,'LEAD.delete',row,c.body);
      hqAssert(row.status==='NEW'&&!d.collections.activities.some(activity=>activity.related_type==='LEAD'&&activity.related_public_id===row.public_id),409,'LEAD_DELETE_REFERENCED');
      row.deleted_yn=true;row.version++;history(d,c.actor,row,'LEAD.delete',{});return {publicId:row.public_id,deleted:true,mode:'MOCK'};
    });
  });
  app.route('GET','/api/leads/:publicId/conversion-options',c=>{
    hqRequire(c.actor,'LEAD.READ');const d=c.repository.read(),lead=existing(d,c,'leads',c.params.publicId);app.requireAction(c.actor,'LEAD.open',lead);
    const accounts=d.collections.accounts.filter(row=>active(row)&&hqCanRead(c.actor,row));const allowed=new Set(accounts.map(row=>row.public_id));
    return {lead:leadDto(c,lead),accounts:accounts.map(row=>accountDto(c,d,row)),contacts:d.collections.contacts.filter(row=>active(row)&&hqCanRead(c.actor,row)&&allowed.has(String(row.account_public_id))).map(row=>contactDto(c,row)),opportunities:d.collections.opportunities.filter(row=>active(row)&&hqCanRead(c.actor,row)&&allowed.has(String(row.account_public_id))).map(row=>opportunityDto(c,d,row)),duplicates:duplicateAccounts(d,c.actor.companyId,lead.business_no).filter(row=>hqCanRead(c.actor,row)).map(row=>accountDto(c,d,row)),owners:owners(c),mode:'MOCK'};
  });
  app.route('POST','/api/leads/:publicId/convert',c=>{
    hqRequire(c.actor,'LEAD.CONVERT');hqOnlyKeys(c.body,['accountMode','existingAccountPublicId','contactMode','existingContactPublicId','contactName','opportunityMode','existingOpportunityPublicId','opportunityName','ownerUserId','simulateFailure',...META]);
    return mutation(c,'LEAD.convert',c.params.publicId,true,d=>{requireLeadWrite(c,d);},d=>{
      const lead=requireLeadWrite(c,d);expected(lead,c.body);app.requireAction(c.actor,'LEAD.convert',lead,c.body);app.requireTransition(c.actor,'LEAD.converted',lead,c.body);
      hqAssert(['NEW','EXISTING'].includes(String(c.body.accountMode)),400,'CONVERSION_ACCOUNT_MODE_INVALID');
      hqAssert(['NEW','EXISTING','SKIP'].includes(String(c.body.contactMode))&&['NEW','EXISTING','SKIP'].includes(String(c.body.opportunityMode)),400,'CONVERSION_MODE_INVALID');
      hqAssert(c.body.simulateFailure===undefined||typeof c.body.simulateFailure==='boolean',400,'FIELD_INVALID','simulateFailure');
      const person=owner(c,c.body.ownerUserId,Number(lead.owner_user_id));
      let account:HqRow;
      if(c.body.accountMode==='EXISTING'){account=existing(d,c,'accounts',id(c.body.existingAccountPublicId,'existingAccountPublicId'));ownerWrite(c.actor,account,'ACCOUNT.MERGE');}
      else {
        hqRequire(c.actor,'ACCOUNT.WRITE');hqAssert(!c.body.existingAccountPublicId,400,'CONVERSION_UNUSED_SELECTION');
        hqAssert(!duplicateAccounts(d,c.actor.companyId,lead.business_no).length,409,'DUPLICATE_ACCOUNT','A matching business number exists; select an existing account');
        account={public_id:newHqId(d),company_id:c.actor.companyId,owner_user_id:person.userId,organization_id:person.organizationId,version:1,account_name:lead.hospital_name,business_name:lead.hospital_name,business_no:lead.business_no??null,phone:lead.phone??null,address:lead.address??null,provider_no:lead.provider_no??null,encrypted_provider_no:lead.encrypted_provider_no??null,open_date:lead.open_date??null,latitude:lead.latitude??null,longitude:lead.longitude??null,account_status:'NEW',account_grade:'GENERAL',account_type:'BC505600',company_code:'DIO',erp_approved_yn:false,erp_customer_code:null,integration_status:'NOT_REQUESTED',source_system:'CRM',converted_from_lead_public_id:lead.public_id,hospital_size:lead.hospital_size??null,main_system:lead.main_system??null,sub_system:lead.sub_system??null,history:[],manual_fields:[],created_at:d.clock};
        app.requireAction(c.actor,'ACC.create',account,{accountName:account.account_name});d.collections.accounts.push(account);history(d,c.actor,account,'ACC.fromLead',{lead_public_id:lead.public_id});
      }
      app.requireAction(c.actor,'ACC.fromLead',account);
      hqAssert(c.body.simulateFailure!==true&&c.scenario!=='TRANSIENT_FAILURE',503,'CONVERSION_SIMULATED_FAILURE','Mock conversion rolled back before commit');
      let contact:HqRow|undefined;
      if(c.body.contactMode==='EXISTING'){
        hqRequire(c.actor,'CONTACT.READ');contact=existing(d,c,'contacts',id(c.body.existingContactPublicId,'existingContactPublicId'));hqAssert(contact.account_public_id===account.public_id,409,'CONTACT_ACCOUNT_MISMATCH');
      } else if(c.body.contactMode==='NEW'){
        hqRequire(c.actor,'CONTACT.WRITE');hqAssert(!c.body.existingContactPublicId,400,'CONVERSION_UNUSED_SELECTION');const contactName=hqText(c.body.contactName??lead.keyman_name,'contactName',200);
        app.requireAction(c.actor,'CONTACT.create',account,{contactName,accountPublicId:account.public_id});
        contact={public_id:newHqId(d),company_id:c.actor.companyId,owner_user_id:person.userId,organization_id:person.organizationId,version:1,account_public_id:account.public_id,contact_name:contactName,contact_type:lead.keyman_type??'DOCTOR',mobile:lead.keyman_mobile??null,email:lead.keyman_email??null,school:lead.school??null,cohort:lead.cohort??null,major:lead.major??null,is_keyman:true,note:lead.keyman_note??null,created_at:d.clock,history:[]};
        d.collections.contacts.push(contact);history(d,c.actor,contact,'CONTACT.create',{lead_public_id:lead.public_id});
      } else hqAssert(!c.body.existingContactPublicId,400,'CONVERSION_UNUSED_SELECTION');
      let opportunity:HqRow|undefined;
      if(c.body.opportunityMode==='EXISTING'){
        hqRequire(c.actor,'OPPORTUNITY.READ');opportunity=existing(d,c,'opportunities',id(c.body.existingOpportunityPublicId,'existingOpportunityPublicId'));hqAssert(opportunity.account_public_id===account.public_id,409,'OPPORTUNITY_ACCOUNT_MISMATCH');
      } else if(c.body.opportunityMode==='NEW'){
        hqRequire(c.actor,'OPPORTUNITY.WRITE');hqAssert(!c.body.existingOpportunityPublicId,400,'CONVERSION_UNUSED_SELECTION');
        opportunity={public_id:newHqId(d),company_id:c.actor.companyId,owner_user_id:person.userId,organization_id:person.organizationId,version:1,account_public_id:account.public_id,opportunity_name:hqText(c.body.opportunityName??`${lead.hospital_name} 신규 영업기회`,'opportunityName',200),stage:'NEEDS_ANALYSIS',record_type:'NEW',amount:0,success_probability:0,forecast_category:'PIPELINE',expected_close_date:d.clock.slice(0,10),contract_created_yn:false,converted_from_lead_public_id:lead.public_id,products:[],history:[],created_at:d.clock};
        app.requireAction(c.actor,'OPP.create',opportunity,{accountPublicId:account.public_id,opportunityName:opportunity.opportunity_name,expectedCloseDate:opportunity.expected_close_date});d.collections.opportunities.push(opportunity);
      } else hqAssert(!c.body.existingOpportunityPublicId,400,'CONVERSION_UNUSED_SELECTION');
      const conversion={leadPublicId:lead.public_id,accountPublicId:account.public_id,contactPublicId:contact?.public_id??null,opportunityPublicId:opportunity?.public_id??null,opportunitySkipped:c.body.opportunityMode==='SKIP',convertedAt:d.clock,convertedBy:c.actor.userId};
      for(const activity of d.collections.activities.filter(row=>row.company_id===c.actor.companyId&&row.related_type==='LEAD'&&row.related_public_id===lead.public_id)){
        hqAssert(hqCanRead(c.actor,activity),403,'CONVERSION_ACTIVITY_SCOPE_DENIED');activity.converted_from_lead_public_id=lead.public_id;activity.related_type='ACCOUNT';activity.related_public_id=account.public_id;activity.related_name_snapshot=account.account_name;activity.version++;
      }
      lead.status='CONVERTED';lead.converted_at=d.clock;lead.converted_by=c.actor.userId;lead.converted_account_public_id=account.public_id;lead.conversion=conversion;lead.version++;
      history(d,c.actor,lead,'LEAD.convert',{from_status:'KEYMAN_MEETING',to_status:'CONVERTED',conversion});return {...conversion,mode:'MOCK'};
    });
  });

  const saveAccount=(c:HqRouteContext,create:boolean,hospitalOnly=false)=>{
    hqRequire(c.actor,'ACCOUNT.WRITE');lockSources(c.body);hqOnlyKeys(c.body,[...(hospitalOnly?HOSPITAL_FIELDS:Object.keys(ACCOUNT_FIELDS)),...META]);
    const response=mutation(c,hospitalOnly?'ACC.hospitalSave':create?'ACC.create':'ACC.save',create?'NEW':c.params.publicId,hospitalOnly,d=>{if(!create)requireAccountWrite(c,d);},d=>{
      const row:HqRow=create?{public_id:newHqId(d),company_id:c.actor.companyId,owner_user_id:c.actor.userId,organization_id:c.actor.organizationId??10,version:1,account_status:'NEW',account_grade:'GENERAL',account_type:'BC505600',company_code:'DIO',erp_approved_yn:false,erp_customer_code:null,integration_status:'NOT_REQUESTED',history:[],manual_fields:[],source_system:'CRM',created_at:d.clock}:requireAccountWrite(c,d);
      if(create)hqText(c.body.accountName,'accountName');else expected(row,c.body,hospitalOnly);
      app.requireAction(c.actor,hospitalOnly?'ACC.hospitalSave':create?'ACC.create':'ACC.save',row,c.body);fields(c,'account',row,c.body,ACCOUNT_FIELDS);
      const values=writeValues(c.body,ACCOUNT_FIELDS,'account');
      if(Object.hasOwn(values,'business_no')&&(create||normalizeBusiness(values.business_no)!==normalizeBusiness(row.business_no)))hqAssert(!duplicateAccounts(d,c.actor.companyId,values.business_no,[row.public_id]).length,409,'DUPLICATE_ACCOUNT');
      applyValues(row,values,d,c.actor,create?'ACC.create':hospitalOnly?'ACC.hospitalSave':'ACC.save');if(create)d.collections.accounts.push(row);else row.version++;return row;
    }) as HqRow;return accountDto(c,c.repository.read(),response);
  };
  app.replaceRoute('POST','/api/accounts',c=>saveAccount(c,true));
  app.replaceRoute('PATCH','/api/accounts/:publicId',c=>saveAccount(c,false));
  app.route('PATCH','/api/accounts/:publicId/hospital',c=>saveAccount(c,false,true));
  app.replaceRoute('GET','/api/accounts',c=>{hqRequire(c.actor,'ACCOUNT.READ');app.requireAction(c.actor,'ACC.search');const d=c.repository.read(),search=(c.query.get('search')??'').toLocaleLowerCase();return d.collections.accounts.filter(row=>active(row)&&hqCanRead(c.actor,row)&&(!search||[row.account_name,row.business_name,row.business_no,row.phone].some(value=>String(value??'').toLocaleLowerCase().includes(search)))).map(row=>accountDto(c,d,row));});
  app.replaceRoute('GET','/api/accounts/:publicId',c=>{hqRequire(c.actor,'ACCOUNT.READ');const d=c.repository.read(),row=existing(d,c,'accounts',c.params.publicId);app.requireAction(c.actor,'ACC.open',row);return accountDto(c,d,row);});
  app.route('GET','/api/accounts/duplicates/:businessNo',c=>{hqRequire(c.actor,'ACCOUNT.READ');app.requireAction(c.actor,'ACC.search');const d=c.repository.read();return duplicateAccounts(d,c.actor.companyId,c.params.businessNo).filter(row=>hqCanRead(c.actor,row)).map(row=>accountDto(c,d,row));});
  app.route('POST','/api/accounts/bulk-update',c=>{
    hqRequire(c.actor,'ACCOUNT.WRITE');hqOnlyKeys(c.body,['rows','idempotencyKey']);app.requireAction(c.actor,'ACC.bulkSave',{},c.body);
    const key=hqText(c.body.idempotencyKey,'idempotencyKey',140);hqAssert(Array.isArray(c.body.rows)&&c.body.rows.length>0&&c.body.rows.length<=100,400,'BULK_ROWS_INVALID');
    const rows=c.body.rows as unknown[],keys=new Set<string>();
    for(const value of rows){const row=hqObject(value);hqOnlyKeys(row,['rowKey','publicId','expectedVersion','values']);const rowKey=hqText(row.rowKey,'rowKey',40);hqAssert(!keys.has(rowKey),400,'BULK_DUPLICATE_ROW_KEY');keys.add(rowKey);}
    const fingerprint=canonicalHq(rows);
    c.repository.transact(d=>{
      const prior=d.collections.auditLogs.find(row=>row.company_id===c.actor.companyId&&row.owner_user_id===c.actor.userId&&row.action==='ACC.bulkSave.request'&&(row.detail as Record<string,unknown>)?.key===key);
      if(prior)hqAssert((prior.detail as Record<string,unknown>).fingerprint===fingerprint,409,'IDEMPOTENCY_CONFLICT');
      else auditHq(d,c.actor,'ACC.bulkSave.request','BULK',{key,fingerprint});
    });
    const results=rows.map(value=>{
      const row=hqObject(value),input=cloneHq(row);
      try {const publicId=id(row.publicId,'publicId'),values=hqObject(row.values);const rowContext={...c,params:{publicId},body:{...values,expectedVersion:row.expectedVersion,idempotencyKey:`${key}:${row.rowKey}`}};hqAssert(Number.isSafeInteger(row.expectedVersion),400,'EXPECTED_VERSION_REQUIRED');return {rowKey:row.rowKey,status:'SUCCESS',saved:saveAccount(rowContext,false),input};}
      catch(error){if(!(error instanceof HqMockError))throw error;return {rowKey:row.rowKey,status:'ERROR',input,error:{code:error.code,message:error.message,details:error.details??{}}};}
    });return {results,successCount:results.filter(row=>row.status==='SUCCESS').length,errorCount:results.filter(row=>row.status==='ERROR').length,mode:'MOCK'};
  });

  const contactAccount=(d:HqDataset,c:HqRouteContext,contact:HqRow)=>existing(d,c,'accounts',String(contact.account_public_id));
  app.replaceRoute('GET','/api/contacts',c=>{hqRequire(c.actor,'CONTACT.READ');app.requireAction(c.actor,'ACC.search');const d=c.repository.read();return d.collections.contacts.filter(row=>active(row)&&hqCanRead(c.actor,row)&&(!c.query.get('accountPublicId')||row.account_public_id===c.query.get('accountPublicId'))&&d.collections.accounts.some(account=>active(account)&&account.public_id===row.account_public_id&&hqCanRead(c.actor,account))).map(row=>contactDto(c,row));});
  app.replaceRoute('GET','/api/contacts/:publicId',c=>{hqRequire(c.actor,'CONTACT.READ');const d=c.repository.read(),row=existing(d,c,'contacts',c.params.publicId);const account=contactAccount(d,c,row);app.requireAction(c.actor,'ACC.open',account);return contactDto(c,row);});
  const createContact=(c:HqRouteContext,accountId:string)=>{
    hqRequire(c.actor,'CONTACT.WRITE');hqOnlyKeys(c.body,[...Object.keys(CONTACT_FIELDS),'accountPublicId','idempotencyKey']);
    const response=mutation(c,'CONTACT.create',accountId,true,d=>{requireAccountWrite(c,d,accountId);},d=>{
      const account=requireAccountWrite(c,d,accountId);hqText(c.body.contactName,'contactName',200);app.requireAction(c.actor,'CONTACT.create',account,{...c.body,accountPublicId:accountId});
      const row:HqRow={public_id:newHqId(d),company_id:c.actor.companyId,owner_user_id:account.owner_user_id,organization_id:account.organization_id??c.actor.organizationId??10,version:1,account_public_id:accountId,contact_type:'DOCTOR',is_keyman:false,created_at:d.clock,history:[]};fields(c,'contact',row,c.body,CONTACT_FIELDS);applyValues(row,writeValues(c.body,CONTACT_FIELDS,'contact'),d,c.actor,'CONTACT.create');d.collections.contacts.push(row);return row;
    }) as HqRow;return contactDto(c,response);
  };
  app.route('POST','/api/contacts',c=>createContact(c,id(c.body.accountPublicId,'accountPublicId')));
  app.route('POST','/api/accounts/:publicId/contacts',c=>createContact(c,c.params.publicId));
  app.route('PATCH','/api/contacts/:publicId',c=>{
    hqRequire(c.actor,'CONTACT.WRITE');hqOnlyKeys(c.body,[...Object.keys(CONTACT_FIELDS),...META]);
    const response=mutation(c,'CONTACT.save',c.params.publicId,true,d=>{const row=existing(d,c,'contacts',c.params.publicId);ownerWrite(c.actor,row,'ACCOUNT.MERGE');contactAccount(d,c,row);},d=>{
      const row=existing(d,c,'contacts',c.params.publicId);expected(row,c.body);app.requireAction(c.actor,'CONTACT.save',row,c.body);fields(c,'contact',row,c.body,CONTACT_FIELDS);applyValues(row,writeValues(c.body,CONTACT_FIELDS,'contact'),d,c.actor,'CONTACT.save');row.version++;return row;
    }) as HqRow;return contactDto(c,response);
  });
  app.route('DELETE','/api/contacts/:publicId',c=>{
    hqRequire(c.actor,'CONTACT.WRITE');hqOnlyKeys(c.body,[...META]);return mutation(c,'CONTACT.delete',c.params.publicId,true,d=>{const row=hqFind(d,c.actor,'contacts',c.params.publicId);ownerWrite(c.actor,row,'ACCOUNT.MERGE');contactAccount(d,c,row);},d=>{
      const row=existing(d,c,'contacts',c.params.publicId);expected(row,c.body);app.requireAction(c.actor,'CONTACT.delete',row,c.body);row.deleted_yn=true;row.version++;history(d,c.actor,row,'CONTACT.delete',{});return {publicId:row.public_id,accountPublicId:row.account_public_id,deleted:true,mode:'MOCK'};
    });
  });
  app.replaceRoute('GET','/api/opportunities',c=>{hqRequire(c.actor,'OPPORTUNITY.READ');const d=c.repository.read();return d.collections.opportunities.filter(row=>active(row)&&hqCanRead(c.actor,row)&&d.collections.accounts.some(account=>active(account)&&account.public_id===row.account_public_id&&hqCanRead(c.actor,account))).map(row=>opportunityDto(c,d,row));});
  app.replaceRoute('GET','/api/opportunities/:publicId',c=>{hqRequire(c.actor,'OPPORTUNITY.READ');const d=c.repository.read(),row=existing(d,c,'opportunities',c.params.publicId);return opportunityDto(c,d,row);});

  const detail=(c:HqRouteContext,analyticsAction=false)=>{
    hqRequire(c.actor,analyticsAction?'ACCOUNT360.READ':'ACCOUNT.READ');const d=c.repository.read(),account=existing(d,c,'accounts',c.params.publicId);app.requireAction(c.actor,analyticsAction?'ACC360.open':'ACC.open',account);
    const byAccount=(collection:'contacts'|'opportunities'|'contracts'|'orders'|'sales',permission:string)=>c.actor.permissions.includes(permission)?d.collections[collection].filter(row=>active(row)&&row.account_public_id===account.public_id&&hqCanRead(c.actor,row)):[];
    const contacts=byAccount('contacts','CONTACT.READ').map(row=>contactDto(c,row)),opportunities=byAccount('opportunities','OPPORTUNITY.READ').map(row=>opportunityDto(c,d,row)),contracts=byAccount('contracts','CONTRACT.READ'),orders=byAccount('orders','ORDER.READ'),sales=byAccount('sales','SALES.READ');
    const contractIds=new Set(contracts.map(row=>row.public_id));const collections=d.collections.collections.filter(row=>contractIds.has(String(row.contract_public_id))&&hqCanRead(c.actor,row));
    const activities=c.actor.permissions.includes('ACTIVITY.READ')?d.collections.activities.filter(row=>row.related_type==='ACCOUNT'&&row.related_public_id===account.public_id&&hqCanRead(c.actor,row)):[];
    const services=activities.filter(row=>row.activity_type==='SERVICE'||row.category==='SERVICE');
    const interfaces=d.collections.interfaceLogs.filter(row=>row.company_id===c.actor.companyId&&row.businessKey.entityType==='ACCOUNT'&&row.businessKey.entityId===account.public_id).map(row=>({requestId:row.requestId,interfaceCode:row.interfaceCode,status:row.status,scenario:row.scenario,attempt:row.attempt,retryOf:row.retryOf??null,requestedAt:row.requestedAt,respondedAt:row.respondedAt??null,events:row.events,result:row.result?{success:row.result.success,message:row.result.message??null}:null}));
    const total=(rows:HqRow[],key:string)=>rows.reduce((sum,row)=>sum+Number(row[key]??0),0);
    const analytics={contactCount:contacts.length,opportunityCount:opportunities.length,contractCount:contracts.length,orderCount:orders.length,activityCount:activities.length,salesAmount:total(sales,'amount'),collectionAmount:total(collections,'amount'),outstandingAmount:total(contracts,'contract_amount')-total(collections,'amount'),orderAmount:total(orders.filter(row=>row.status!=='FAILED'),'order_amount'),erpApproved:account.erp_approved_yn===true,orderAllowed:orderAllowed(account)};
    const timeline=[...(Array.isArray(account.history)?account.history:[]),...activities.map(row=>({public_id:row.public_id,action:'ACTIVITY',at:row.start_at??d.clock,subject:row.subject,status:row.status})),...interfaces.map(row=>({public_id:row.requestId,action:'ERP',at:row.requestedAt,status:row.status,interfaceCode:row.interfaceCode}))].sort((a,b)=>String(b.at).localeCompare(String(a.at)));
    return {account:accountDto(c,d,account),contacts,opportunities,contracts,orders,sales,collections,services,activities,timeline,analytics,hospital:Object.fromEntries(HOSPITAL_FIELDS.map(key=>[ACCOUNT_FIELDS[key],account[ACCOUNT_FIELDS[key]]??null])),interfaces,permissions:c.actor.permissions,mode:'MOCK'};
  };
  app.route('GET','/api/accounts/:publicId/customer-detail',c=>detail(c));
  app.route('GET','/api/analytics/accounts/:publicId/360',c=>detail(c,true));

  app.route('POST','/api/accounts/merge',c=>{
    hqRequire(c.actor,'ACCOUNT.MERGE');hqOnlyKeys(c.body,['primaryPublicId','duplicatePublicIds','fieldSources','expectedVersions','idempotencyKey']);
    const primaryId=id(c.body.primaryPublicId,'primaryPublicId');hqAssert(Array.isArray(c.body.duplicatePublicIds)&&c.body.duplicatePublicIds.length>=1&&c.body.duplicatePublicIds.length<=2,400,'MERGE_COUNT_INVALID');
    const duplicateIds=(c.body.duplicatePublicIds as unknown[]).map(value=>id(value,'duplicatePublicIds'));hqAssert(new Set(duplicateIds).size===duplicateIds.length&&!duplicateIds.includes(primaryId),400,'MERGE_IDS_INVALID');
    const ids=[primaryId,...duplicateIds],versions=hqObject(c.body.expectedVersions),sources=c.body.fieldSources===undefined?{}:hqObject(c.body.fieldSources);hqOnlyKeys(versions,ids);hqOnlyKeys(sources,Object.keys(ACCOUNT_FIELDS));
    return mutation(c,'ACC.merge',primaryId,true,d=>{ids.forEach(value=>hqFind(d,c.actor,'accounts',value));},d=>{
      app.requireAction(c.actor,'ACC.merge',{},c.body);const rows=ids.map(value=>existing(d,c,'accounts',value)),primary=rows[0];rows.forEach(row=>expected(row,{expectedVersion:versions[row.public_id]}));
      hqAssert(new Set(rows.map(row=>row.erp_customer_code).filter(Boolean)).size<=1,409,'MERGE_DIFFERENT_ERP_CODES');
      hqAssert(!d.collections.interfaceLogs.some(log=>log.company_id===c.actor.companyId&&duplicateIds.includes(log.businessKey.entityId)&&log.businessKey.entityType==='ACCOUNT'),409,'MERGE_INTERFACE_HISTORY_REQUIRES_REVIEW','A duplicate with ERP requests cannot be merged while its result history targets the original identity');
      const selected:Record<string,unknown>={};for(const [key,source] of Object.entries(sources)){hqAssert(ids.includes(String(source)),400,'MERGE_FIELD_SOURCE_INVALID');selected[key]=rows.find(row=>row.public_id===source)![ACCOUNT_FIELDS[key]]??null;}
      fields(c,'account',primary,selected,ACCOUNT_FIELDS);const values=writeValues(selected,ACCOUNT_FIELDS,'account');
      if(Object.hasOwn(values,'business_no'))hqAssert(!duplicateAccounts(d,c.actor.companyId,values.business_no,ids).length,409,'DUPLICATE_ACCOUNT');
      applyValues(primary,values,d,c.actor,'ACC.merge.fields');
      if(!primary.erp_customer_code){const authoritative=rows.find(row=>row.erp_customer_code);if(authoritative)for(const key of ['erp_customer_code','erp_approved_yn','erp_trade_code','erp_approval_code','integration_status'])if(authoritative[key]!==undefined)primary[key]=authoritative[key];}
      const movedCounts:Record<string,number>={};
      for(const collection of ['contacts','opportunities','contracts','orders','sales'] as const){movedCounts[collection]=0;for(const row of d.collections[collection].filter(row=>row.company_id===c.actor.companyId&&duplicateIds.includes(String(row.account_public_id)))){hqAssert(hqCanRead(c.actor,row),403,'MERGE_RELATED_SCOPE_DENIED');row.account_public_id=primaryId;row.version++;movedCounts[collection]++;}}
      for(const row of d.collections.activities.filter(row=>row.company_id===c.actor.companyId&&row.related_type==='ACCOUNT'&&duplicateIds.includes(String(row.related_public_id)))){hqAssert(hqCanRead(c.actor,row),403,'MERGE_RELATED_SCOPE_DENIED');row.related_public_id=primaryId;row.related_name_snapshot=primary.account_name;row.version++;}
      for(const row of d.collections.leads.filter(row=>row.company_id===c.actor.companyId&&duplicateIds.includes(String(row.converted_account_public_id)))){hqAssert(hqCanRead(c.actor,row),403,'MERGE_RELATED_SCOPE_DENIED');row.converted_account_public_id=primaryId;if(row.conversion&&typeof row.conversion==='object')row.conversion={...(row.conversion as Record<string,unknown>),accountPublicId:primaryId};row.version++;history(d,c.actor,row,'ACC.merge.reference',{account_public_id:primaryId});}
      for(const row of rows.slice(1)){row.account_status='MERGED';row.deleted_yn=true;row.merged_into_public_id=primaryId;row.version++;history(d,c.actor,row,'ACC.merge.source',{primary_public_id:primaryId});}
      primary.version++;history(d,c.actor,primary,'ACC.merge',{merged_public_ids:duplicateIds,movedCounts});return {primaryPublicId:primaryId,mergedPublicIds:duplicateIds,movedCounts,account:primary,mode:'MOCK'};
    });
  });
  app.replaceRoute('POST','/api/erp-accounts/:publicId/request',c=>{
    hqRequire(c.actor,'ERP_ACCOUNT.REQUEST');hqOnlyKeys(c.body,['requestId',...META]);
    return mutation(c,'ACC.erpRequest',c.params.publicId,false,d=>{requireAccountWrite(c,d);},d=>{
      const row=requireAccountWrite(c,d);expected(row,c.body,false);app.requireAction(c.actor,'ACC.erpRequest',row);
      const log=enqueueInterface(d,c.actor,{interfaceCode:'IF-ERP-002',entityType:'ACCOUNT',entityPublicId:row.public_id,idempotencyKey:String(c.body.idempotencyKey??c.body.requestId??`account:${row.public_id}:${row.version}`),payload:{},scenario:c.scenario});
      history(d,c.actor,row,'ACC.erpRequest',{requestId:log.requestId,status:log.status});return {requestId:log.requestId,status:log.status,accountVersion:row.version,mode:'MOCK'};
    });
  });
}
