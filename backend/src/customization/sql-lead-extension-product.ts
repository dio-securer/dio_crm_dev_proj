import { z } from 'zod';
import { configAssert, type AdminConfigRepository, type ConfigState, type ConfigTransaction } from './config-store';
import { leadCreateBindings, leadCreateSchema } from './lead-lifecycle-http';
import { leadEditMappings } from './lead-gateway';
import { validateCreation } from './creation-policy';
import { validateFieldWrite, projectFields } from './field-policy';
import { loadExtensionReleaseSnapshot, type VerifyHqRelease } from './extension-release-snapshot';
import { SqlLeadExtensionAtomicPort, type SqlLeadExtensionTrust } from './sql-lead-extension-adapter';
import { incompleteSqlLeadExtensionTrust } from './sql-lead-extension-trust';
import type { LeadExtensionActor, LeadExtensionRow } from './lead-extension-contract';
import type { LeadExtensionPortFactory } from './lead-extension-request';
import {hiraExclusionBinding,type LeadReadCapabilities} from './lead-read-capabilities';
import {prepareLeadExclusionChange,auditLeadExclusionChange} from './lead-exclusion-audit';

type Domain=NonNullable<ConfigTransaction['domain']>;
const bindings=leadEditMappings.map(([input,column,id])=>({input,column,output:column,fieldId:'lead.'+id}));
const readBindings=[...bindings,{input:'status',column:'status',output:'status',fieldId:'lead.status'},{input:'ownerUserId',column:'owner_user_id',output:'owner_user_id',fieldId:'lead.ownerUserId'}];
const editSchema=z.record(z.union([z.string().max(2000),z.null()]));

/** Opt-in only. The caller must supply an independently reviewed HQ registry verifier. */
export function makeSqlLeadExtensionPortFactory(repository:AdminConfigRepository,verifyHqRelease:VerifyHqRelease,readCapabilities?:LeadReadCapabilities|null):LeadExtensionPortFactory {
 configAssert(typeof verifyHqRelease==='function',503,'HQ_RELEASE_REGISTRY_UNAVAILABLE');
 return (actor,userKey)=>{
  configAssert(Number.isSafeInteger(userKey)&&userKey>0,400,'INVALID_CONTEXT');
  const trusted=makeTrust(actor,userKey,verifyHqRelease,readCapabilities);
  return new SqlLeadExtensionAtomicPort(repository,trusted);
 };
}

function makeTrust(actor:LeadExtensionActor,userKey:number,verifyHqRelease:VerifyHqRelease,readCapabilities?:LeadReadCapabilities|null):SqlLeadExtensionTrust {
 const policy=(state:ConfigState)=>{const member=state.members[actor.id];configAssert(member?.active,403,'PERMISSION_DENIED');return {authenticated:true,companyId:actor.companyId,allowed:member.permissions,denied:member.denied};};
 const release=(state:ConfigState)=>{const r=state.activeReleaseId&&state.releases[state.activeReleaseId];configAssert(r&&r.companyId===actor.companyId,409,'NO_ACTIVE_RELEASE');return r;};
 const verifyActor=async(domain:Domain)=>{const q=await domain.query<{user_id:number}>('SELECT user_id FROM dbo.crm_user WITH(HOLDLOCK) WHERE company_id=@companyKey AND public_id=@actorId AND user_id=@userKey AND is_active=1 AND deleted_yn=0',{companyKey:domain.companyKey,actorId:actor.id,userKey});configAssert(q.recordset.length===1,403,'PERMISSION_DENIED');};
 const load=async(domain:Domain,state:ConfigState,row:LeadExtensionRow,hiraRead=false)=>{
  const r=await domain.query<Record<string,unknown>>(`SELECT owner_user_id,status,${leadEditMappings.map(([,column])=>column).join(',')}${hiraRead?',hira_sync_exclude_yn':''} FROM dbo.crm_lead WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@recordId AND deleted_yn=0`,{companyKey:domain.companyKey,recordId:row.id});
  configAssert(r.recordset.length===1,404,'NOT_FOUND');const value=r.recordset[0],p=policy(state);
  configAssert(value.owner_user_id===userKey||p.allowed.includes('LEAD.MANAGE')&&!p.denied.includes('LEAD.MANAGE'),404,'NOT_FOUND');return value;
 };
 const prepare=async(domain:Domain,state:ConfigState,mode:'create'|'detail',base:Record<string,unknown>,row:LeadExtensionRow|null)=>{
  await verifyActor(domain);const p=policy(state),effective=release(state).effective;
  if(mode==='create'){
   const input=leadCreateSchema.parse(base),owner=Number(input.ownerUserId??userKey);
   configAssert(owner===userKey||p.allowed.includes('LEAD.MANAGE')&&!p.denied.includes('LEAD.MANAGE'),403,'PERMISSION_DENIED');
   const found=await domain.query('SELECT user_id FROM crm_user WITH(HOLDLOCK) WHERE company_id=@companyKey AND user_id=@owner AND is_active=1 AND deleted_yn=0',{companyKey:domain.companyKey,owner});configAssert(found.recordset.length===1,422,'OWNER_NOT_FOUND');
   const ownerBinding={fieldId:'lead.ownerUserId',input:'ownerUserId',column:'owner_user_id',output:'owner_user_id'},all=input.ownerUserId===undefined?leadCreateBindings:[...leadCreateBindings,ownerBinding];
   const fixed={'lead.status':'NEW','lead.leadSource':'CRM',...(input.ownerUserId===undefined?{'lead.ownerUserId':owner}:{})};
   const columns=validateCreation(effective,actor.companyId,p,all,input,fixed,effective.entries.filter(e=>e.id.startsWith('lead.')&&e.bindingKind==='DATA').map(e=>e.id));
   leadCreateSchema.parse(Object.fromEntries(all.filter(b=>Object.hasOwn(columns,b.column)).map(b=>[b.input,columns[b.column]])));delete columns.owner_user_id;
   return {columns,owner};
  }
  configAssert(row,404,'NOT_FOUND');const data=await load(domain,state,row);configAssert(data.status!=='CONVERTED',409,'LEAD_CONVERTED');
  const input=editSchema.parse(base);configAssert(Object.keys(input).every(key=>leadEditMappings.some(([name])=>key===name)),422,'UNREGISTERED_FIELD');
  return {columns:validateFieldWrite(effective,actor.companyId,p,bindings,input,data),owner:userKey};
 };
 return {
  ...incompleteSqlLeadExtensionTrust,
  loadPublishedSnapshot:(domain,state)=>loadExtensionReleaseSnapshot({domain,state,identityActive:true},verifyHqRelease),
  readBase:async(domain,state,_actor,row)=>{await verifyActor(domain);const hiraRead=readCapabilities?.hiraExclusion===true;const data=await load(domain,state,row,hiraRead);return projectFields(release(state).effective,actor.companyId,policy(state),hiraRead?[...readBindings,hiraExclusionBinding]:readBindings,data);},
  canWriteRow:async(domain,state,_actor,row)=>(await load(domain,state,row)).status!=='CONVERTED',
  assertBaseWrite:async(domain,state,_actor,mode,base,row)=>{await prepare(domain,state,mode,base,row);},
  writeBase:async(domain,state,_actor,mode,base,row)=>{
   const {columns,owner}=await prepare(domain,state,mode,base,row);const pairs=Object.entries(columns),params:Record<string,unknown>={companyKey:domain.companyKey,userKey,owner};pairs.forEach(([,value],i)=>params['v'+i]=value);
   let id=row?.id;
   if(mode==='create'){
    const r=await domain.query<{public_id:string}>(`INSERT INTO crm_lead(company_id,owner_user_id,status,lead_source,created_by,updated_by,${pairs.map(([c])=>c).join(',')}) OUTPUT CONVERT(varchar(36),inserted.public_id) public_id VALUES(@companyKey,@owner,'NEW','CRM',@userKey,@userKey,${pairs.map((_,i)=>'@v'+i).join(',')})`,params);configAssert(r.recordset.length===1,500,'DOMAIN_WRITE_FAILED');id=r.recordset[0].public_id.toLowerCase();
   } else if(pairs.length){
    configAssert(row,404,'NOT_FOUND');params.recordId=row.id;params.expectedVersion=row.version;
    const exclusionChange=await prepareLeadExclusionChange(domain,row.id,columns);
    const r=await domain.query(`UPDATE crm_lead SET ${pairs.map(([column],i)=>column+'=@v'+i).join(',')},updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND public_id=@recordId AND deleted_yn=0 AND status<>'CONVERTED' AND row_version=CONVERT(binary(8),@expectedVersion,1)`,params);configAssert(r.rowsAffected?.[0]===1,409,'LEAD_CHANGED');
    await auditLeadExclusionChange(domain,row.id,userKey,exclusionChange);
   }
   configAssert(id,500,'BASE_WRITE_INVALID');const saved=await incompleteSqlLeadExtensionTrust.loadLead(domain,id);configAssert(saved,500,'BASE_WRITE_INVALID');return saved;
  }
 };
}
