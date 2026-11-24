import { resolvedLeadColumnOrder, validLeadColumnOrder, mergeLeadColumnOrder } from '@dio-crm/contracts/lead-grid-columns';
import {createHash,randomUUID} from 'node:crypto';
import {placementPresentationErrors,effectivePlacementPresentation,validButtonPresentation,mergeButtonPresentation,effectiveButtonPresentation,type ButtonPresentationUpdate,validPopupPresentation,mergePopupPresentation,effectivePopupPresentation,type PopupPresentationUpdate,validLeadColumnAlignments,mergeLeadColumnAlignments,effectiveLeadColumnAlignments,type LeadColumnAlignmentsUpdate,validLeadColumnWidths,mergeLeadColumnWidths,effectiveLeadColumnWidths,type LeadColumnWidthsUpdate,mergeLeadGridUpdate,effectiveLeadGrid,type LeadGridSort,type LeadGridUpdate} from '@dio-crm/contracts/crm-customization';
import {canonicalConfigJson,resolveCompanyConfig,resolveActorPolicy,resolveLocale,resolveTranslation,validateCatalog,validateTranslations,placementErrors,screenActions,validLeadExtensionLayout,type CompanyConfig,type ConfigPatch,type ConfigResult,type ActorPolicy} from '@dio-crm/contracts/crm-customization';
import {configAssert,ConfigError,type AdminConfigRepository,type ConfigState,type ConfigDraft,type ConfigRelease,type ConfigTransaction,type StandardArtifact} from './config-store.js';
import {insertExtensionReleaseSnapshot,type VerifyHqRelease} from './extension-release-snapshot.js';
import type {PostPersistRelease} from './sql-config-store.js';
import {configReleaseHash} from './release-integrity.js';
import {rebaseConfiguration} from './config-rebase.js';
import {projectFields,validateFieldWrite,requireQueryFields,requireQueryControls,type FieldBinding} from './field-policy.js';
import {validDefinition} from './lead-extension-contract.js';
export interface SqlFieldAdapter {
 bindings:FieldBinding[];
 /** Additive read fields are projected only when present in the immutable standard. */
 optionalBindings?:FieldBinding[];
 /** Adapter must use domain.query and enforce row scope using CURRENT actorPolicy, never JWT claims. */
 load:(domain:NonNullable<ConfigTransaction['domain']>,actor:ConfigActor,policy:ActorPolicy)=>Promise<{companyKey:number;row:Record<string,unknown>}>;
 /** Uses the same query; no external side effects or second connection/transaction. */
 save?:(domain:NonNullable<ConfigTransaction['domain']>,columns:Record<string,unknown>)=>Promise<void>;
 /** Reviewed child collections projected inside the parent read transaction. */
 children?:Record<string,SqlListAdapter>;
}
export interface ConfigActor {id:string;companyId:string}
/** Trusted HQ distribution source, queried inside the target company's SQL transaction.
 * No request body, client flag or company-admin grant may supply these references. */
export interface HqExtensionDeploymentAuthority {
 assertPublisher:(domain:NonNullable<ConfigTransaction['domain']>,actorId:string,companyId:string)=>Promise<void>;
 selectedForTarget:(domain:NonNullable<ConfigTransaction['domain']>,companyId:string)=>Promise<{hqReleaseId:string;fields:Array<{id:string;version:number}>}>;
 verifyHqRelease:VerifyHqRelease;
}
type PostPersistRepository=AdminConfigRepository&{transactWithPostPersist?:<T>(companyId:string,actorId:string,work:(tx:ConfigTransaction)=>Promise<T>|T,postPersist:PostPersistRelease,identityIds?:string[])=>Promise<T>};
export interface SqlListAdapter {
 bindings:FieldBinding[];
 sourceFields?:string[];
 requiredActions?:string[];
 /** Required for nested collections: collection policy, checked before loading rows. */
 visibilityId?:string;
 /** Additive display columns are omitted for older immutable standards. */
 optionalBindings?:FieldBinding[];
 /** Trusted lead placement bindings, projected only when selected in the published list. */
 listColumnBindings?:FieldBinding[];
 load:(domain:NonNullable<ConfigTransaction['domain']>,actor:ConfigActor,policy:ActorPolicy,listColumns?:FieldBinding[],leadSort?:LeadGridSort)=>Promise<Array<{companyKey:number;publicId:string;row:Record<string,unknown>}>>;
}
export interface SqlReportSection {bindings:FieldBinding[];visibilityId:string;sourceFields:string[];load:(domain:NonNullable<ConfigTransaction['domain']>,config:CompanyConfig)=>Promise<Record<string,unknown>[]>}
const hash=(value:unknown)=>createHash('sha256').update(canonicalConfigJson(value)).digest('hex');
const stateHash=(state:ConfigState)=>hash({activeReleaseId:state.activeReleaseId,drafts:state.drafts,permissionVersion:state.permissionVersion,dataVersion:state.dataVersion});
const accessStamp=(state:ConfigState,actorId:string)=>{const member=state.members[actorId];return hash([state.activeReleaseId,state.permissionVersion,state.dataVersion,member?.active??false,[...(member?.permissions??[])].sort(),[...(member?.denied??[])].sort()]);};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const canonicalActor=(actor:ConfigActor):ConfigActor=>{configAssert(typeof actor.id==='string'&&typeof actor.companyId==='string'&&uuid.test(actor.id)&&uuid.test(actor.companyId),400,'INVALID_CONTEXT');return {id:actor.id.toLowerCase(),companyId:actor.companyId.toLowerCase()};};
export class CompanyConfigurationService {
 private standards=new Map<string,StandardArtifact>();
 private repository:AdminConfigRepository;private now:()=>string;private hqExtensions?:HqExtensionDeploymentAuthority;
 constructor(repository:AdminConfigRepository,artifacts:StandardArtifact[],now=()=>new Date().toISOString(),hqExtensions?:HqExtensionDeploymentAuthority){
  this.repository=repository;this.now=now;this.hqExtensions=hqExtensions;
  for(const artifact of artifacts){configAssert(validateCatalog(artifact.catalog).length===0,422,'INVALID_STANDARD');configAssert(artifact.contentHash===hash({catalog:artifact.catalog,translations:artifact.translations,publicationReady:artifact.publicationReady}),422,'ARTIFACT_HASH_MISMATCH');configAssert(!this.standards.has(artifact.catalog.standardReleaseId),409,'DUPLICATE_STANDARD');this.standards.set(artifact.catalog.standardReleaseId,structuredClone(artifact));}
 }
 private member(tx:ConfigTransaction,actor:ConfigActor,permission:string){configAssert(tx.identityActive,401,'IDENTITY_DISABLED');const member=tx.state.members[actor.id];configAssert(member?.active,404,'NOT_FOUND');configAssert(member.permissions.includes(permission)&&!member.denied.includes(permission),403,'PERMISSION_DENIED');return member;}
 private async transaction<T>(actor:ConfigActor,permission:string,fn:(state:ConfigState,tx:ConfigTransaction)=>Promise<T>|T,identityIds:string[]=[]):Promise<T>{configAssert(uuid.test(actor.companyId)&&uuid.test(actor.id),400,'INVALID_CONTEXT');return this.repository.transact(actor.companyId,actor.id,tx=>{this.member(tx,actor,permission);return fn(tx.state,tx);},identityIds);}
 private command<T>(actor:ConfigActor,permission:string,operation:string,key:string,payload:unknown,fn:(state:ConfigState,tx:ConfigTransaction)=>T|Promise<T>,guard?:(state:ConfigState,tx:ConfigTransaction)=>void|Promise<void>,identityIds:string[]=[]):Promise<T>{
  configAssert(typeof key==='string'&&key.length>0&&key.length<=160,428,'IDEMPOTENCY_REQUIRED');const payloadHash=hash(payload);
  return this.transaction(actor,permission,async(state,tx)=>{await guard?.(state,tx);const receiptKey=hash([actor.id,operation,key]);const old=state.receipts[receiptKey];if(old){configAssert(old.payloadHash===payloadHash,409,'IDEMPOTENCY_CONFLICT');if(old.contextStamp)configAssert(old.contextStamp===accessStamp(state,actor.id),409,'RECEIPT_CONTEXT_CHANGED');return old.result as T;}
   const beforeHash=stateHash(state);const result=await fn(state,tx);hash(result);
   state.events.push({id:randomUUID(),actorId:actor.id,operation,at:this.now(),beforeHash,afterHash:stateHash(state),reason:typeof (payload as {reason?:unknown})?.reason==='string'?(payload as {reason:string}).reason:''});
   state.receipts[receiptKey]={payloadHash,result:structuredClone(result),...(operation.startsWith('business.')?{contextStamp:accessStamp(state,actor.id)}:{})};return result;
  },identityIds);
 }
 private standard(id:string,state:ConfigState){const artifact=state.publishedArtifacts?(Object.hasOwn(state.publishedArtifacts,id)?state.publishedArtifacts[id]:undefined):this.standards.get(id);configAssert(artifact,404,'STANDARD_NOT_PUBLISHED');return artifact;}
 private draft(state:ConfigState,id:string,revision?:number):ConfigDraft{const draft=Object.hasOwn(state.drafts,id)?state.drafts[id]:undefined;configAssert(draft,404,'NOT_FOUND');configAssert(['DRAFT','VALIDATED'].includes(draft.state),409,'DRAFT_CLOSED');if(revision!==undefined)configAssert(draft.revision===revision,409,'DRAFT_CONFLICT');return draft;}
 private validateConfig(state:ConfigState,config:CompanyConfig){const standard=this.standard(config.baseStandardReleaseId,state);const result=resolveCompanyConfig(standard.catalog,config);const errors=[...result.issues,...validateTranslations(standard.catalog.entries,config.activeLocales,config.defaultLocale,standard.translations,config.translations)];
  for(const draft of Object.values(state.drafts))if(draft.config===config&&draft.rebase?.conflicts.length)errors.push({code:'REBASE_UNRESOLVED',targetId:draft.id,messageKey:'customization.errors.REBASE_UNRESOLVED'});
  if(!standard.publicationReady)errors.push({code:'STANDARD_NOT_PUBLICATION_READY',targetId:standard.id,messageKey:'customization.errors.STANDARD_NOT_PUBLICATION_READY'});
  const permissionCeiling=[...new Set(standard.catalog.entries.flatMap(x=>[...x.permissions,...x.readPermissions,...x.writePermissions]))];
  const availability=resolveActorPolicy(result,state.companyId,{authenticated:true,companyId:state.companyId,allowed:permissionCeiling,denied:[]});
  for(const [id,count] of Object.entries(state.pendingActions))if(count>0&&!availability.some(x=>x.id===id&&x.enabled))errors.push({code:'ACTIVE_WORK_BLOCKED',targetId:id,messageKey:'customization.errors.ACTIVE_WORK_BLOCKED'});
  return {result,errors};
 }
 async createDraft(actor:ConfigActor,standardId:string,expectedActiveReleaseId:string|null,key:string){actor=canonicalActor(actor);return this.command(actor,'config.edit','draft.create',key,{standardId,expectedActiveReleaseId},state=>{
  configAssert(state.activeReleaseId===expectedActiveReleaseId,409,'RELEASE_CONFLICT');configAssert(!Object.values(state.drafts).some(x=>['DRAFT','VALIDATED'].includes(x.state)),409,'DRAFT_EXISTS');const standard=this.standard(standardId,state);const current=state.activeReleaseId?state.releases[state.activeReleaseId]:null;
  configAssert(!current||current.standardReleaseId===standard.catalog.standardReleaseId,409,'REBASE_REQUIRED');
  const draft:ConfigDraft={id:randomUUID(),revision:1,state:'DRAFT',baseActiveReleaseId:state.activeReleaseId,config:current?structuredClone(current.config):{companyId:actor.companyId,baseStandardReleaseId:standard.catalog.standardReleaseId,patches:[],activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR',translations:{}}};state.drafts[draft.id]=draft;return draft;
 });}
 async catalog(actor:ConfigActor,standardId:string){actor=canonicalActor(actor);return this.transaction(actor,'config.read',state=>structuredClone(this.standard(standardId,state)));}
 /** Company editors can inspect only definitions assigned to their company. */
 async leadExtensionCatalog(actor:ConfigActor){actor=canonicalActor(actor);return this.transaction(actor,'config.edit',async(_state,tx)=>{
  configAssert(tx.domain&&this.hqExtensions,503,'HQ_EXTENSION_CATALOG_UNAVAILABLE');
  const selected=await this.hqExtensions.selectedForTarget(tx.domain,actor.companyId);
  configAssert(selected.fields.length<=100,500,'INVALID_EXTENSION_PUBLICATION');
  const definitions=[];
  for(const ref of selected.fields){const result=await tx.domain.query<{payload_json:string}>('SELECT payload_json FROM dbo.crm_standard_extension_field_version WITH(HOLDLOCK) WHERE field_id=@fieldId AND definition_version=@version',{fieldId:ref.id,version:ref.version});configAssert(result.recordset.length===1,503,'HQ_DEFINITION_INVALID');const field=JSON.parse(result.recordset[0].payload_json);configAssert(field.id===ref.id&&field.version===ref.version&&validDefinition(field),503,'HQ_DEFINITION_INVALID');definitions.push({id:field.id,version:field.version,key:field.key,type:field.type,labels:field.labels});}
  return {target:{companyId:actor.companyId,fields:selected.fields},definitions};
 });}
 async release(actor:ConfigActor,releaseId:string){actor=canonicalActor(actor);return this.transaction(actor,'config.read',state=>{configAssert(Object.hasOwn(state.releases,releaseId),404,'NOT_FOUND');return structuredClone(state.releases[releaseId]);});}
 async rebase(actor:ConfigActor,id:string,revision:number,targetId:string,choices:Record<string,'keep'|'drop'>,key:string){actor=canonicalActor(actor);return this.command(actor,'config.edit','draft.rebase',key,{id,revision,targetId,choices},state=>{
  const draft=this.draft(state,id,revision);const target=this.standard(targetId,state);
  const from=draft.rebase?.fromStandardReleaseId??draft.config.baseStandardReleaseId;
  configAssert(!draft.rebase||draft.rebase.targetStandardReleaseId===targetId,409,'REBASE_TARGET_CHANGED');
  const result=rebaseConfiguration(draft.config,this.standard(from,state).catalog,target.catalog,choices,this.standard(from,state).translations,target.translations);
  draft.config=result.config;draft.rebase={fromStandardReleaseId:from,targetStandardReleaseId:targetId,conflicts:result.conflicts};draft.revision++;draft.state='DRAFT';return draft;
 });}
 async saveDraft(actor:ConfigActor,id:string,revision:number,input:{patches:ConfigPatch[];activeLocales:string[];defaultLocale:string;translations:CompanyConfig['translations'];leadGridColumns?:string[];placementOrders?:CompanyConfig['placementOrders'];leadListOrder?:string[];placementPresentation?:CompanyConfig['placementPresentation'];leadGrid?:LeadGridUpdate|null;leadColumnWidths?:LeadColumnWidthsUpdate|null;leadColumnAlignments?:LeadColumnAlignmentsUpdate|null;popupPresentation?:PopupPresentationUpdate|null;buttonPresentation?:ButtonPresentationUpdate|null;leadExtensionLayout?:CompanyConfig['leadExtensionLayout']},key:string){actor=canonicalActor(actor);return this.command(actor,'config.edit','draft.save',key,{id,revision,input},state=>{
  const draft=this.draft(state,id,revision);configAssert(Array.isArray(input.patches)&&Array.isArray(input.activeLocales)&&typeof input.defaultLocale==='string'&&input.translations&&typeof input.translations==='object'&&!Array.isArray(input.translations),422,'INVALID_DRAFT');
  if(input.leadListOrder!==undefined)configAssert(validLeadColumnOrder(input.leadListOrder,input.leadGridColumns??draft.config.leadGridColumns??[]),422,'INVALID_COLUMN_PLACEMENT');
  configAssert(placementErrors(input.placementOrders,this.standard(draft.config.baseStandardReleaseId,state).catalog.entries).length===0,422,'INVALID_PLACEMENT');
  if(input.leadExtensionLayout!==undefined){configAssert(validLeadExtensionLayout(input.leadExtensionLayout),422,'INVALID_EXTENSION_LAYOUT');draft.config.leadExtensionLayout=structuredClone(input.leadExtensionLayout);}
  if(input.leadColumnWidths===null)delete draft.config.leadColumnWidths;else if(input.leadColumnWidths!==undefined){const merged=mergeLeadColumnWidths(draft.config.leadColumnWidths,input.leadColumnWidths);configAssert(merged.ok,422,'INVALID_COLUMN_WIDTH');const catalog=this.standard(draft.config.baseStandardReleaseId,state).catalog;configAssert(Object.keys(input.leadColumnWidths.values).every(id=>catalog.entries.some(e=>e.id===id&&e.kind==='FIELD'&&e.screenId==='HQ_LEAD')||Object.hasOwn(draft.config.leadColumnWidths?.values??{},id)),422,'INVALID_COLUMN_WIDTH');if(merged.value)draft.config.leadColumnWidths=merged.value;else delete draft.config.leadColumnWidths;}
  if(input.leadColumnAlignments===null)delete draft.config.leadColumnAlignments;else if(input.leadColumnAlignments!==undefined){const merged=mergeLeadColumnAlignments(draft.config.leadColumnAlignments,input.leadColumnAlignments);configAssert(merged.ok,422,'INVALID_COLUMN_ALIGNMENT');const catalog=this.standard(draft.config.baseStandardReleaseId,state).catalog;configAssert(Object.keys(input.leadColumnAlignments.values).every(id=>catalog.entries.some(e=>e.id===id&&e.kind==='FIELD'&&e.screenId==='HQ_LEAD')||Object.hasOwn(draft.config.leadColumnAlignments?.values??{},id)),422,'INVALID_COLUMN_ALIGNMENT');if(merged.value)draft.config.leadColumnAlignments=merged.value;else delete draft.config.leadColumnAlignments;}
  if(input.popupPresentation===null)delete draft.config.popupPresentation;else if(input.popupPresentation!==undefined){const merged=mergePopupPresentation(draft.config.popupPresentation,input.popupPresentation);configAssert(merged.ok&&(!merged.value||validPopupPresentation(merged.value,this.standard(draft.config.baseStandardReleaseId,state).catalog.entries)),422,'INVALID_POPUP_PRESENTATION');if(merged.value)draft.config.popupPresentation=merged.value;else delete draft.config.popupPresentation;}
  if(input.buttonPresentation===null)delete draft.config.buttonPresentation;else if(input.buttonPresentation!==undefined){const merged=mergeButtonPresentation(draft.config.buttonPresentation,input.buttonPresentation);configAssert(merged.ok&&(!merged.value||validButtonPresentation(merged.value,this.standard(draft.config.baseStandardReleaseId,state).catalog.entries)),422,'INVALID_BUTTON_PRESENTATION');if(merged.value)draft.config.buttonPresentation=merged.value;else delete draft.config.buttonPresentation;}
  if(input.leadGrid===null)delete draft.config.leadGrid; else if(input.leadGrid!==undefined){const merged=mergeLeadGridUpdate(draft.config.leadGrid,input.leadGrid,this.standard(draft.config.baseStandardReleaseId,state).catalog.entries);configAssert(merged.ok,422,'INVALID_LEAD_GRID');if(merged.value)draft.config.leadGrid=structuredClone(merged.value);else delete draft.config.leadGrid;}
  if(input.placementPresentation!==undefined){
   configAssert(placementPresentationErrors(input.placementPresentation,this.standard(draft.config.baseStandardReleaseId,state).catalog.entries).length===0,422,'INVALID_PLACEMENT_PRESENTATION');
   const nextPresentation=structuredClone(input.placementPresentation);
   // Older clients replace lead values but cannot intentionally remove account metadata.
   const accountPlacement='account.create.basic.crmName';
   if(!Object.hasOwn(nextPresentation.values,accountPlacement)&&draft.config.placementPresentation?.values[accountPlacement])nextPresentation.values[accountPlacement]=structuredClone(draft.config.placementPresentation.values[accountPlacement]);
   draft.config.placementPresentation=nextPresentation;
  }
  draft.config={...draft.config,patches:structuredClone(input.patches),activeLocales:[...input.activeLocales],defaultLocale:input.defaultLocale,translations:structuredClone(input.translations),leadGridColumns:[...(input.leadGridColumns??draft.config.leadGridColumns??[])],placementOrders:structuredClone(input.placementOrders??draft.config.placementOrders??{}),...(input.leadListOrder?{leadListOrder:[...input.leadListOrder]}:draft.config.leadListOrder?{leadListOrder:mergeLeadColumnOrder(draft.config.leadListOrder,input.leadGridColumns??draft.config.leadGridColumns??[])}:{})};if(draft.config.leadColumnWidths)configAssert(validLeadColumnWidths(draft.config.leadColumnWidths,this.standard(draft.config.baseStandardReleaseId,state).catalog.entries,draft.config),422,'INVALID_COLUMN_WIDTH');if(draft.config.leadColumnAlignments)configAssert(validLeadColumnAlignments(draft.config.leadColumnAlignments,this.standard(draft.config.baseStandardReleaseId,state).catalog.entries,draft.config),422,'INVALID_COLUMN_ALIGNMENT');draft.revision++;draft.state='DRAFT';return draft;
 });}
 async validate(actor:ConfigActor,id:string,revision:number){actor=canonicalActor(actor);return this.transaction(actor,'config.edit',state=>{const draft=this.draft(state,id,revision);const checked=this.validateConfig(state,draft.config);const validation={id:randomUUID(),draftId:id,draftRevision:revision,draftHash:hash(draft.config),activeReleaseId:state.activeReleaseId,permissionVersion:state.permissionVersion,dataVersion:state.dataVersion,effective:checked.result,errors:checked.errors};state.validations[validation.id]=validation;draft.state=checked.errors.length?'DRAFT':'VALIDATED';return validation;});}
 async preview(actor:ConfigActor,validationId:string){actor=canonicalActor(actor);return this.transaction(actor,'config.preview',state=>{const v=state.validations[validationId];configAssert(v,404,'NOT_FOUND');const draft=this.draft(state,v.draftId,v.draftRevision);configAssert(v.draftHash===hash(draft.config),409,'VALIDATION_STALE');const check=this.validateConfig(state,draft.config);return {mode:'PREVIEW',effective:check.result,errors:check.errors,sideEffects:false};});}
 private publishChange(state:ConfigState,actor:ConfigActor,validationId:string,expectedReleaseId:string|null,reason:string):ConfigRelease{
  configAssert(reason.trim(),422,'REASON_REQUIRED');configAssert(state.activeReleaseId===expectedReleaseId,409,'RELEASE_CONFLICT');const v=state.validations[validationId];configAssert(v,404,'NOT_FOUND');const draft=this.draft(state,v.draftId,v.draftRevision);
  configAssert(v.draftHash===hash(draft.config)&&v.activeReleaseId===state.activeReleaseId&&draft.baseActiveReleaseId===state.activeReleaseId&&v.permissionVersion===state.permissionVersion&&v.dataVersion===state.dataVersion,409,'VALIDATION_STALE');
  const checked=this.validateConfig(state,draft.config);configAssert(checked.errors.length===0,422,'VALIDATION_FAILED',checked.errors);
  const id=randomUUID();const release={id,companyId:actor.companyId,standardReleaseId:draft.config.baseStandardReleaseId,config:structuredClone(draft.config),effective:checked.result,contentHash:hash({config:draft.config,effective:checked.result}),reason,actorId:actor.id,createdAt:this.now()};
  if(draft.restoredFrom)Object.assign(release,{restoredFrom:draft.restoredFrom});state.releases[id]=release;state.activeReleaseId=id;draft.state='PUBLISHED';state.outbox.push({id:randomUUID(),type:'CONFIG_PUBLISHED',releaseId:id,status:'PENDING'});return release;
 }
 async publish(actor:ConfigActor,validationId:string,expectedReleaseId:string|null,reason:string,key:string){actor=canonicalActor(actor);return this.command(actor,'config.publish','release.publish',key,{validationId,expectedReleaseId,reason},async(state,tx)=>{
  if(state.activeReleaseId){configAssert(!state.releases[state.activeReleaseId]?.hqExtension,409,'HQ_EXTENSION_PUBLISH_REQUIRED');}
  if(this.hqExtensions&&state.activeReleaseId){configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const active=await tx.domain.query('SELECT config_release_id FROM dbo.crm_extension_release_snapshot WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND config_release_id=@releaseId',{companyKey:tx.domain.companyKey,releaseId:state.activeReleaseId});configAssert(active.recordset.length===0,409,'HQ_EXTENSION_PUBLISH_REQUIRED');}
  const release=this.publishChange(state,actor,validationId,expectedReleaseId,reason);
  configAssert(!release.config.leadExtensionLayout,409,'HQ_EXTENSION_PUBLISH_REQUIRED');
  return release;
 });}
 /** HQ-only deployment route for a validated company draft. This is not exposed by the
  * current controller; the SQL post-persist hook must insert the immutable snapshot. */
 async publishWithHqExtensions(actor:ConfigActor,validationId:string,expectedReleaseId:string|null,reason:string,key:string){
  actor=canonicalActor(actor);configAssert(typeof key==='string'&&key.length>0&&key.length<=160,428,'IDEMPOTENCY_REQUIRED');
  const authority=this.hqExtensions,repository=this.repository as PostPersistRepository;
  configAssert(authority&&typeof repository.transactWithPostPersist==='function',503,'HQ_EXTENSION_PUBLICATION_UNAVAILABLE');
  const payload={validationId,expectedReleaseId,reason},payloadHash=hash(payload),receiptKey=hash([actor.id,'release.publish.hq-extension',key]);
  let selection:{hqReleaseId:string;fields:Array<{id:string;version:number}>}|undefined;
  return repository.transactWithPostPersist(actor.companyId,actor.id,async tx=>{
   this.member(tx,actor,'config.publish');configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');
   await authority.assertPublisher(tx.domain,actor.id,actor.companyId);
   const state=tx.state,old=state.receipts[receiptKey];
   if(old){configAssert(old.payloadHash===payloadHash,409,'IDEMPOTENCY_CONFLICT');return old.result as ConfigRelease;}
   const beforeHash=stateHash(state),release=this.publishChange(state,actor,validationId,expectedReleaseId,reason);
   selection=await authority.selectedForTarget(tx.domain,actor.companyId);
   configAssert(selection&&Array.isArray(selection.fields)&&selection.fields.length>0,422,'HQ_EXTENSION_TARGET_EMPTY');
   if(release.config.leadExtensionLayout){configAssert(validLeadExtensionLayout(release.config.leadExtensionLayout,selection.fields),422,'INVALID_EXTENSION_LAYOUT');configAssert(release.config.leadExtensionLayout.listColumns.length===0,409,'EXTENSION_LIST_NOT_READY');}
   const prior=expectedReleaseId?state.releases[expectedReleaseId]?.hqExtension:undefined;
   if(prior)configAssert(prior.fields.every(previous=>selection!.fields.some(next=>next.id===previous.id&&next.version===previous.version)),422,'FIELD_REMOVAL_UNSUPPORTED');
   release.hqExtension=structuredClone(selection);release.contentHash=configReleaseHash(release);
   state.events.push({id:randomUUID(),actorId:actor.id,operation:'release.publish.hq-extension',at:this.now(),beforeHash,afterHash:stateHash(state),reason});
   state.receipts[receiptKey]={payloadHash,result:structuredClone(release)};
   return release;
  },async context=>{
   configAssert(selection,503,'HQ_EXTENSION_SELECTION_UNAVAILABLE');
   const release=context.release as ConfigRelease;
   const state={companyId:context.companyId,activeReleaseId:release.id,releases:{[release.id]:release}} as ConfigState;
   await insertExtensionReleaseSnapshot({state,identityActive:true,domain:{companyKey:context.companyKey,query:context.query}},release.id,selection.hqReleaseId,selection.fields,authority.verifyHqRelease);
  });
 }
 async abandon(actor:ConfigActor,id:string,revision:number,reason:string,key:string){actor=canonicalActor(actor);return this.command(actor,'config.edit','draft.abandon',key,{id,revision,reason},state=>{const draft=this.draft(state,id,revision);draft.state='ABANDONED';draft.revision++;return {id,state:draft.state};});}
 async restoreDraft(actor:ConfigActor,targetId:string,expectedReleaseId:string,key:string,reason='Restore configuration'){actor=canonicalActor(actor);return this.command(actor,'config.restore','release.restore.prepare',key,{targetId,expectedReleaseId,reason},state=>{
  configAssert(typeof reason==='string'&&reason.trim(),422,'REASON_REQUIRED');
  configAssert(state.members[actor.id].permissions.includes('config.edit')&&!state.members[actor.id].denied.includes('config.edit'),403,'PERMISSION_DENIED');configAssert(state.activeReleaseId===expectedReleaseId,409,'RELEASE_CONFLICT');const target=state.releases[targetId];configAssert(target,404,'NOT_FOUND');configAssert(!Object.values(state.drafts).some(x=>['DRAFT','VALIDATED'].includes(x.state)),409,'DRAFT_EXISTS');
  const current=state.releases[expectedReleaseId];configAssert(current,404,'NOT_FOUND');const draft:ConfigDraft={id:randomUUID(),revision:1,state:'DRAFT',baseActiveReleaseId:state.activeReleaseId,config:structuredClone(target.config),restoredFrom:targetId};
  if(target.standardReleaseId!==current.standardReleaseId){const result=rebaseConfiguration(draft.config,this.standard(target.standardReleaseId,state).catalog,this.standard(current.standardReleaseId,state).catalog,{},this.standard(target.standardReleaseId,state).translations,this.standard(current.standardReleaseId,state).translations);draft.config=result.config;draft.rebase={fromStandardReleaseId:target.standardReleaseId,targetStandardReleaseId:current.standardReleaseId,conflicts:result.conflicts};}state.drafts[draft.id]=draft;return draft;
 });}
 async read(actor:ConfigActor){actor=canonicalActor(actor);return this.transaction(actor,'config.read',state=>{const member=state.members[actor.id],allowed=(permission:string)=>member.permissions.includes(permission)&&!member.denied.includes(permission);return {companyId:state.companyId,activeReleaseId:state.activeReleaseId,permissionVersion:state.permissionVersion,capabilities:{edit:allowed('config.edit'),preview:allowed('config.preview'),publish:allowed('config.publish'),placementPresentation:true,accountPlacementPresentation:true,leadGrid:true,leadGridDensity:true,leadGridSort:true,leadColumnWidths:true,leadColumnAlignments:true,popupPresentation:true,buttonPresentation:true},drafts:Object.values(state.drafts),releases:Object.values(state.releases).map(({effective,config,...metadata})=>metadata)};});}
 /** Endpoint-owned application bootstrap, fenced like all other runtime reads. */
 async readRuntimeContext<T>(actor:ConfigActor,load:(domain:NonNullable<ConfigTransaction['domain']>,config:CompanyConfig,policy:ReturnType<typeof resolveActorPolicy>,actorPolicy:ActorPolicy)=>Promise<T>){
  actor=canonicalActor(actor);return this.transaction(actor,'runtime.read',async(state,tx)=>{
   configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const release=state.activeReleaseId?state.releases[state.activeReleaseId]:null;configAssert(release,409,'NO_ACTIVE_RELEASE');const member=state.members[actor.id],policy=resolveActorPolicy(release.effective,actor.companyId,{authenticated:tx.identityActive,companyId:actor.companyId,allowed:member.permissions,denied:member.denied});
   return {releaseId:release.id,permissionVersion:state.permissionVersion,data:await load(tx.domain,structuredClone(release.config),policy,{authenticated:tx.identityActive,companyId:actor.companyId,allowed:[...member.permissions],denied:[...member.denied]})};
  });
 }
 async effective(actor:ConfigActor,preference?:string){actor=canonicalActor(actor);return this.transaction(actor,'runtime.read',(state,tx)=>{const release=state.activeReleaseId?state.releases[state.activeReleaseId]:null;configAssert(release,409,'NO_ACTIVE_RELEASE');const member=state.members[actor.id],policy=resolveActorPolicy(release.effective,actor.companyId,{authenticated:tx.identityActive,companyId:actor.companyId,allowed:member.permissions,denied:member.denied}),locale=resolveLocale(preference,release.config.activeLocales,release.config.defaultLocale),standard=this.standard(release.standardReleaseId,state);
  const allowed=new Set(policy.filter(p=>p.readable).map(p=>p.id));const translations=Object.fromEntries(release.effective.entries.filter(e=>allowed.has(e.id)).map(e=>[e.labelKey,resolveTranslation(e.labelKey,locale.locale,release.config.defaultLocale,standard.translations,release.config.translations).text]));
  for(const key of new Set(Object.values(standard.translations).flatMap(values=>Object.keys(values).filter(key=>/^customization\.errors\.[A-Z][A-Z0-9_]+$/.test(key)))))translations[key]=resolveTranslation(key,locale.locale,release.config.defaultLocale,standard.translations,release.config.translations).text;
  const labels=Object.fromEntries(release.effective.entries.filter(e=>allowed.has(e.id)).map(e=>[e.id,translations[e.labelKey]]));
  const navigation=release.effective.entries.filter(e=>e.kind==='MENU'&&e.screenId&&allowed.has(e.id)&&allowed.has(e.screenId)).map(e=>({id:e.id,screenId:e.screenId!,label:labels[e.id],order:e.settings.order})).sort((a,b)=>a.order-b.order);
  const leadGridColumns=(release.config.leadGridColumns??[]).filter(id=>allowed.has(id));
  const placementPresentation=effectivePlacementPresentation(release.config.placementPresentation,locale.locale,release.config.defaultLocale,allowed);
  return {releaseId:release.id,permissionVersion:state.permissionVersion,dataVersion:state.dataVersion,locale,policy,translations,labels,navigation,leadGridColumns,leadExtensionsEnabled:!!release.hqExtension,leadExtensionLayout:release.hqExtension&&release.config.leadExtensionLayout?{...structuredClone(release.config.leadExtensionLayout),placements:release.config.leadExtensionLayout.placements.filter(item=>member.permissions.includes('fields.'+item.fieldId+'.read')&&!member.denied.includes('fields.'+item.fieldId+'.read')),listColumns:release.config.leadExtensionLayout.listColumns.filter(id=>member.permissions.includes('fields.'+id+'.read')&&!member.denied.includes('fields.'+id+'.read'))}:undefined,leadStatusReverseAllowed:member.permissions.includes('LEAD.STATUS.REVERSE')&&!member.denied.includes('LEAD.STATUS.REVERSE'),...(effectiveButtonPresentation(release.config.buttonPresentation,policy)?{buttonPresentation:effectiveButtonPresentation(release.config.buttonPresentation,policy)}:{}),...(effectivePopupPresentation(release.config.popupPresentation,locale.locale,release.config.defaultLocale,policy)?{popupPresentation:effectivePopupPresentation(release.config.popupPresentation,locale.locale,release.config.defaultLocale,policy)}:{}),...(effectiveLeadColumnWidths(release.config.leadColumnWidths,resolvedLeadColumnOrder(release.config),allowed)?{leadColumnWidths:effectiveLeadColumnWidths(release.config.leadColumnWidths,resolvedLeadColumnOrder(release.config),allowed)}:{}),...(effectiveLeadColumnAlignments(release.config.leadColumnAlignments,resolvedLeadColumnOrder(release.config),allowed)?{leadColumnAlignments:effectiveLeadColumnAlignments(release.config.leadColumnAlignments,resolvedLeadColumnOrder(release.config),allowed)}:{}),...(effectiveLeadGrid(release.config.leadGrid,policy)?{leadGrid:effectiveLeadGrid(release.config.leadGrid,policy)}:{}),...(placementPresentation!==undefined?{placementPresentation}:{}),...(release.config.leadListOrder?{leadListOrder:resolvedLeadColumnOrder(release.config).filter(id=>allowed.has(id))}:{}),placementOrders:Object.fromEntries(Object.entries(release.config.placementOrders??{}).map(([region,ids])=>[region,ids.filter(id=>allowed.has(id))]))};});}
 /** Endpoint bindings and callbacks are trusted code, not HTTP body data. */
 async readSqlReport(actor:ConfigActor,screenId:string,sections:Record<string,SqlReportSection>,queryFields:string[]=[],queryControls:string[]=[],requiredActions:string[]=[]){actor=canonicalActor(actor);return this.transaction(actor,'runtime.read',async(state,tx)=>{
  configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const release=state.activeReleaseId?state.releases[state.activeReleaseId]:null;configAssert(release,409,'NO_ACTIVE_RELEASE');const member=state.members[actor.id],policy:ActorPolicy={authenticated:true,companyId:actor.companyId,allowed:member.permissions,denied:member.denied},resolved=new Map(resolveActorPolicy(release.effective,actor.companyId,policy).map(p=>[p.id,p]));
  configAssert(resolved.get(screenId)?.readable&&release.effective.entries.some(e=>e.id===screenId&&e.kind==='SCREEN'),403,'SCREEN_DENIED');requireQueryFields(release.effective,actor.companyId,policy,queryFields);requireQueryControls(release.effective,actor.companyId,policy,queryControls);
  for(const id of requiredActions)configAssert(release.effective.entries.some(e=>e.id===id&&e.kind==='ACTION')&&resolved.get(id)?.enabled,403,'ACTION_DENIED');
  const data:Record<string,unknown>={};for(const [name,section] of Object.entries(sections)){configAssert(!['__proto__','constructor','prototype'].includes(name),500,'INVALID_FIELD_BINDING');if(!resolved.get(section.visibilityId)?.readable||!section.bindings.some(b=>resolved.get(b.fieldId)?.readable))continue;requireQueryFields(release.effective,actor.companyId,policy,section.sourceFields);const rows=await section.load(tx.domain,structuredClone(release.config));data[name]=rows.map(row=>projectFields(release.effective,actor.companyId,policy,section.bindings,row));}
  return {releaseId:release.id,permissionVersion:state.permissionVersion,data};
 });}
 async readSqlFields(actor:ConfigActor,screenId:string,adapter:SqlFieldAdapter,queryFields:string[]=[]){actor=canonicalActor(actor);return this.transaction(actor,'runtime.read',async(state,tx)=>{
  configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const release=state.activeReleaseId?state.releases[state.activeReleaseId]:null;configAssert(release,409,'NO_ACTIVE_RELEASE');const member=state.members[actor.id],policy:ActorPolicy={authenticated:true,companyId:actor.companyId,allowed:member.permissions,denied:member.denied};
  configAssert(release.effective.entries.some(e=>e.id===screenId&&e.kind==='SCREEN')&&resolveActorPolicy(release.effective,actor.companyId,policy).some(p=>p.id===screenId&&p.readable),403,'SCREEN_DENIED');requireQueryFields(release.effective,actor.companyId,policy,queryFields);
  const loaded=await adapter.load(tx.domain,actor,policy);configAssert(loaded.companyKey===tx.domain.companyKey,404,'NOT_FOUND');const bindings=[...adapter.bindings,...(adapter.optionalBindings??[]).filter(b=>release.effective.entries.some(e=>e.id===b.fieldId))];const data=projectFields(release.effective,actor.companyId,policy,bindings,loaded.row);
  const resolved=new Map(resolveActorPolicy(release.effective,actor.companyId,policy).map(p=>[p.id,p]));
  for(const [name,child] of Object.entries(adapter.children??{})){
   configAssert(!Object.hasOwn(data,name)&&!['__proto__','prototype','constructor'].includes(name)&&child.visibilityId,500,'INVALID_FIELD_BINDING');
   if(!resolved.get(child.visibilityId)?.readable||!child.bindings.some(b=>resolved.get(b.fieldId)?.readable))continue;
   requireQueryFields(release.effective,actor.companyId,policy,child.sourceFields??[]);
   const rows=await child.load(tx.domain,actor,policy);data[name]=rows.map(item=>{configAssert(item.companyKey===tx.domain!.companyKey,404,'NOT_FOUND');configAssert(uuid.test(item.publicId),500,'INVALID_ROW_ID');return {public_id:item.publicId.toLowerCase(),...projectFields(release.effective,actor.companyId,policy,child.bindings,item.row)};});
  }
  return {releaseId:release.id,permissionVersion:state.permissionVersion,data};
 });}
 async readSqlList(actor:ConfigActor,screenId:string,adapter:SqlListAdapter,queryFields:string[]=[],queryControls:string[]=[]){actor=canonicalActor(actor);return this.transaction(actor,'runtime.read',async(state,tx)=>{
  configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const release=state.activeReleaseId?state.releases[state.activeReleaseId]:null;configAssert(release,409,'NO_ACTIVE_RELEASE');
  const member=state.members[actor.id],policy:ActorPolicy={authenticated:true,companyId:actor.companyId,allowed:member.permissions,denied:member.denied};
  configAssert(release.effective.entries.some(e=>e.id===screenId&&e.kind==='SCREEN')&&resolveActorPolicy(release.effective,actor.companyId,policy).some(p=>p.id===screenId&&p.readable),403,'SCREEN_DENIED');
  requireQueryFields(release.effective,actor.companyId,policy,[...queryFields,...(adapter.sourceFields??[])]);requireQueryControls(release.effective,actor.companyId,policy,queryControls);
  for(const id of adapter.requiredActions??[])configAssert(release.effective.entries.some(e=>e.id===id&&e.kind==='ACTION')&&resolveActorPolicy(release.effective,actor.companyId,policy).some(p=>p.id===id&&p.enabled),403,'ACTION_DENIED');
  const actorFields=new Set(resolveActorPolicy(release.effective,actor.companyId,policy).filter(e=>e.readable).map(e=>e.id));
  const listColumns=(adapter.listColumnBindings??[]).filter(b=>resolvedLeadColumnOrder(release.config).includes(b.fieldId)&&actorFields.has(b.fieldId));
  const leadSort=screenId==='HQ_LEAD'?effectiveLeadGrid(release.config.leadGrid,resolveActorPolicy(release.effective,actor.companyId,policy))?.defaultSort:undefined;
  const rows=await adapter.load(tx.domain,actor,policy,listColumns,leadSort);
  const bindings=[...adapter.bindings,...(adapter.optionalBindings??[]).filter(b=>release.effective.entries.some(e=>e.id===b.fieldId)),...listColumns];
  const data=rows.map(item=>{configAssert(item.companyKey===tx.domain!.companyKey,404,'NOT_FOUND');configAssert(uuid.test(item.publicId),500,'INVALID_ROW_ID');return {...projectFields(release.effective,actor.companyId,policy,bindings,item.row),public_id:item.publicId.toLowerCase()};});
  return {releaseId:release.id,permissionVersion:state.permissionVersion,data};
 });}
 async writeSqlFields(actor:ConfigActor,context:{releaseId:string;permissionVersion:number},actionId:string,resourceId:string,key:string,input:Record<string,unknown>,adapter:SqlFieldAdapter,receiptInput:unknown=input){actor=canonicalActor(actor);return this.executeBusiness(actor,context,actionId,key,{resourceId,input:receiptInput},async(state,tx)=>{
  configAssert(tx.domain&&adapter.save,503,'SQL_DOMAIN_REQUIRED');const release=state.releases[state.activeReleaseId!],member=state.members[actor.id],policy:ActorPolicy={authenticated:true,companyId:actor.companyId,allowed:member.permissions,denied:member.denied};
  const loaded=await adapter.load(tx.domain,actor,policy);configAssert(loaded.companyKey===tx.domain.companyKey,404,'NOT_FOUND');const bindings=[...adapter.bindings,...(adapter.optionalBindings??[]).filter(b=>release.effective.entries.some(e=>e.id===b.fieldId))];const columns=validateFieldWrite(release.effective,actor.companyId,policy,bindings,input,loaded.row);
  await adapter.save(tx.domain,columns);const saved=await adapter.load(tx.domain,actor,policy);configAssert(saved.companyKey===tx.domain.companyKey,404,'NOT_FOUND');return {releaseId:release.id,permissionVersion:state.permissionVersion,data:projectFields(release.effective,actor.companyId,policy,bindings,saved.row)};
 },async(state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const member=state.members[actor.id];const loaded=await adapter.load(tx.domain,actor,{authenticated:true,companyId:actor.companyId,allowed:member.permissions,denied:member.denied});configAssert(loaded.companyKey===tx.domain.companyKey,404,'NOT_FOUND');});}
 /** Trusted domain callback only. No arbitrary callback/field names from transport. */
 private businessGuard(state:ConfigState,actor:ConfigActor,context:{releaseId:string;permissionVersion:number},actionId:string){const release=state.activeReleaseId?state.releases[state.activeReleaseId]:null;configAssert(release,409,'NO_ACTIVE_RELEASE');const member=state.members[actor.id];const policy=resolveActorPolicy(release.effective,actor.companyId,{authenticated:true,companyId:actor.companyId,allowed:member.permissions,denied:member.denied});configAssert(release.effective.entries.some(e=>e.id===actionId&&e.kind==='ACTION')&&policy.some(x=>x.id===actionId&&x.enabled),403,'ACTION_DENIED');const popup=screenActions.find(a=>a.actionId===actionId)?.popupId;if(popup)configAssert(policy.some(p=>p.id===popup&&p.enabled&&p.visible),403,'ACTION_TARGET_UNAVAILABLE');configAssert(context.releaseId&&context.permissionVersion,428,'PRECONDITION_REQUIRED');configAssert(context.releaseId===state.activeReleaseId&&context.permissionVersion===state.permissionVersion,409,'CONFIG_CHANGED');}
 /** Account batch receipts contain only success, never stored private row data.
  * Current row/field authorization is mandatory on every receipt replay. */
 async registerAccountBatch(actor:ConfigActor,context:{releaseId:string;permissionVersion:number},key:string,payload:unknown){actor=canonicalActor(actor);return this.command(actor,'runtime.write','account.batch.manifest',key,{context,payload},()=>({registered:true}),state=>this.businessGuard(state,actor,context,'ACC.bulkSave'));}
 async executeAccountBatchRow(actor:ConfigActor,context:{releaseId:string;permissionVersion:number},key:string,payload:unknown,work:(state:ConfigState,tx:ConfigTransaction)=>Promise<void>,authorize:(state:ConfigState,tx:ConfigTransaction)=>Promise<void>){actor=canonicalActor(actor);return this.command(actor,'runtime.write','account.batch.row',key,{context,payload},async(state,tx)=>{await work(state,tx);state.dataVersion++;return {success:true};},async(state,tx)=>{this.businessGuard(state,actor,context,'ACC.bulkSave');await authorize(state,tx);});}
 async executeBusiness<T>(actor:ConfigActor,context:{releaseId:string;permissionVersion:number},actionId:string,key:string,payload:unknown,work:(state:ConfigState,tx:ConfigTransaction)=>T|Promise<T>,authorize?:(state:ConfigState,tx:ConfigTransaction)=>void|Promise<void>,identityIds:string[]=[]){
  actor=canonicalActor(actor);
  const guard=(state:ConfigState)=>this.businessGuard(state,actor,context,actionId);
  return this.command(actor,'runtime.write','business.'+actionId,key,{context,actionId,payload},async(state,tx)=>{const result=await work(state,tx);state.dataVersion++;return result;},async(state,tx)=>{guard(state);await authorize?.(state,tx);},identityIds);
 }
 async changeMember(actor:ConfigActor,targetId:string,member:ConfigState['members'][string],key:string){actor=canonicalActor(actor);targetId=targetId.toLowerCase();return this.command(actor,'security.manage','security.member',key,{targetId,member},state=>{configAssert(Object.hasOwn(state.members,targetId),404,'NOT_FOUND');const grantor=state.members[actor.id];configAssert(member.permissions.every(p=>grantor.permissions.includes(p)&&!grantor.denied.includes(p)),403,'DELEGATION_EXCEEDED');state.members[targetId]=structuredClone(member);state.permissionVersion++;return {permissionVersion:state.permissionVersion};});}
}
export const makeStandardArtifact=(id:string,catalog:StandardArtifact['catalog'],translations:StandardArtifact['translations'],publicationReady:boolean):StandardArtifact=>({id,catalog,translations,publicationReady,contentHash:hash({catalog,translations,publicationReady})});
