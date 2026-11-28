import {createHash} from 'node:crypto';
import {canonicalConfigJson} from '@dio-crm/contracts/crm-customization';
import {configAssert,type AdminConfigRepository,type ConfigState,type ConfigTransaction,type StandardArtifact} from './config-store.js';
import {configReleaseHash} from './release-integrity.js';
/** Compatible with DatabaseService.transaction; no implicit connection/env fallback. */
export type ConfigSqlQuery=<T=Record<string,unknown>>(sql:string,params?:Record<string,unknown>)=>Promise<{recordset:T[];rowsAffected?:number[]}>;
export interface ConfigSqlDatabase {transaction<T>(work:(query:ConfigSqlQuery)=>Promise<T>):Promise<T>;hasActiveTransaction?:()=>boolean}
export type PostPersistRelease=(context:{companyId:string;companyKey:number;release:Readonly<ConfigState['releases'][string]>;query:ConfigSqlQuery})=>Promise<void>;
const hash=(value:unknown)=>createHash('sha256').update(canonicalConfigJson(value)).digest('hex');
const collections={drafts:'crm_config_draft',validations:'crm_config_validation',releases:'crm_config_release',events:'crm_config_event',outbox:'crm_config_outbox',receipts:'crm_command_receipt'} as const;
type Collection=keyof typeof collections;
/** Relational company-scoped documents. Table names are compile-time allowlisted. */
export class SqlAdminConfigRepository implements AdminConfigRepository {
 private database:ConfigSqlDatabase;
 constructor(database:ConfigSqlDatabase){this.database=database;}
 assertDeliveryBoundary():void {configAssert(this.database.hasActiveTransaction,503,'DELIVERY_BOUNDARY_UNAVAILABLE');configAssert(!this.database.hasActiveTransaction(),409,'AMBIENT_DELIVERY_TRANSACTION');}
 async transact<T>(companyId:string,actorId:string,work:(tx:ConfigTransaction)=>Promise<T>|T,identityIds:string[]=[]):Promise<T>{return this.run(companyId,actorId,work,identityIds);}
 /** Future release publisher only. The callback runs after the ConfigRelease FK target is
  * persisted and the state CAS succeeds, but before this SQL transaction commits. */
 async transactWithPostPersist<T>(companyId:string,actorId:string,work:(tx:ConfigTransaction)=>Promise<T>|T,postPersist:PostPersistRelease,identityIds:string[]=[]):Promise<T>{configAssert(typeof postPersist==='function',503,'POST_PERSIST_HOOK_REQUIRED');return this.run(companyId,actorId,work,identityIds,postPersist);}
 private async run<T>(companyId:string,actorId:string,work:(tx:ConfigTransaction)=>Promise<T>|T,identityIds:string[],postPersist?:PostPersistRelease):Promise<T>{return this.database.transaction(async query=>{
  // Identity first, then company, then row/document locks, matching the memory fence.
  for(const resource of [...[...new Set([actorId,...identityIds].map(id=>id.toLowerCase()))].sort().map(id=>'crm.config.identity:'+id),'crm.config.company:'+companyId.toLowerCase()]){
   const lock=await query<{result:number}>("DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000; SELECT @r AS result;",{resource});configAssert(lock.recordset[0]?.result>=0,409,'CONFIG_LOCK_TIMEOUT');
  }
  const identities=await query<{user_id:number;is_active:boolean;deleted_yn:boolean}>('SELECT user_id,is_active,deleted_yn FROM dbo.crm_user WITH (UPDLOCK,HOLDLOCK) WHERE public_id=@actorId',{actorId});configAssert(identities.recordset.length===1,404,'NOT_FOUND');
  const companies=await query<{company_id:number;is_active:boolean}>('SELECT company_id,is_active FROM dbo.crm_company WITH (HOLDLOCK) WHERE public_id=@companyId',{companyId});configAssert(companies.recordset.length===1&&companies.recordset[0].is_active,404,'NOT_FOUND');const companyKey=companies.recordset[0].company_id;
  const headers=await query<{revision:number;permission_version:number;data_version:number;active_release_id:string|null;pending_actions_json:string}>('SELECT revision,permission_version,data_version,active_release_id,pending_actions_json FROM dbo.crm_config_company_state WITH (UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey',{companyKey});configAssert(headers.recordset.length===1,409,'CONFIG_NOT_INITIALIZED');const header=headers.recordset[0];
  const membershipRows=await query<{public_id:string;payload_json:string}>(`SELECT u.public_id,m.payload_json FROM dbo.crm_config_membership m WITH (UPDLOCK,HOLDLOCK) JOIN dbo.crm_user u ON u.user_id=m.user_id WHERE m.company_id=@companyKey`,{companyKey});
  const state:ConfigState={companyId,revision:Number(header.revision),permissionVersion:Number(header.permission_version),dataVersion:Number(header.data_version),activeReleaseId:header.active_release_id,pendingActions:JSON.parse(header.pending_actions_json),members:{},drafts:{},validations:{},releases:{},events:[],outbox:[],receipts:{}};
  const standards=await query<{standard_id:string;artifact_hash:string;payload_json:string}>('SELECT standard_id,artifact_hash,payload_json FROM crm_standard_release WITH(HOLDLOCK)');state.publishedArtifacts={};
  for(const row of standards.recordset){const release=JSON.parse(row.payload_json) as {artifact:StandardArtifact};const artifact=release.artifact;configAssert(artifact.catalog.standardReleaseId===row.standard_id&&artifact.contentHash===row.artifact_hash&&artifact.contentHash===hash({catalog:artifact.catalog,translations:artifact.translations,publicationReady:artifact.publicationReady}),503,'STANDARD_INTEGRITY_FAILED');state.publishedArtifacts[row.standard_id]=artifact;}
  for(const row of membershipRows.recordset)state.members[row.public_id.toLowerCase()]=JSON.parse(row.payload_json);
  const currentGrants=await query<{permission_code:string}>(`SELECT DISTINCT p.permission_code FROM crm_user_role ur WITH(HOLDLOCK) JOIN crm_role r WITH(HOLDLOCK) ON r.role_id=ur.role_id JOIN crm_role_permission rp WITH(HOLDLOCK) ON rp.role_id=r.role_id JOIN crm_permission p WITH(HOLDLOCK) ON p.permission_id=rp.permission_id WHERE ur.user_id=@userKey AND r.is_active=1 AND p.is_active=1`,{userKey:identities.recordset[0].user_id});
  const grants=new Set(currentGrants.recordset.map(r=>r.permission_code)),actorMember=state.members[actorId.toLowerCase()];
  if(actorMember)actorMember.permissions=actorMember.permissions.filter(p=>/^(config|runtime|security)\./.test(p)||grants.has(p));
  for(const [name,table] of Object.entries(collections) as [Collection,string][]){
   const rows=await query<{document_id:string;payload_json:string}>(`SELECT document_id,payload_json FROM dbo.${table} WITH (UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey ORDER BY ordinal`,{companyKey});
   for(const row of rows.recordset){const value=JSON.parse(row.payload_json);if(name==='events')state.events.push(value);else if(name==='outbox')state.outbox.push(value);else (state[name] as Record<string,unknown>)[row.document_id]=value;}
  }
  for(const release of Object.values(state.releases))configAssert(release.companyId===companyId&&release.contentHash===configReleaseHash(release),503,'CONFIG_INTEGRITY_FAILED');
  configAssert(!state.activeReleaseId||Object.hasOwn(state.releases,state.activeReleaseId),503,'CONFIG_INTEGRITY_FAILED');
  const before=structuredClone(state),identity=identities.recordset[0];const result=await work({state,identityActive:identity.is_active&&!identity.deleted_yn,domain:{companyKey,query}});const response=structuredClone(result);
  // No deletion of releases, receipts or audit history. Drafts are closed by state.
  for(const [name,table] of Object.entries(collections) as [Collection,string][]){
   const toMap=(value:ConfigState[Collection]):Record<string,unknown>=>Array.isArray(value)?Object.fromEntries(value.map(x=>[x.id,x])):value;
   const old=toMap(before[name]),next=toMap(state[name]);
   for(const id of Object.keys(old))configAssert(Object.hasOwn(next,id),409,'CONFIG_HISTORY_DELETE_FORBIDDEN');
   for(const [id,value] of Object.entries(next)){
    if(Object.hasOwn(old,id)&&canonicalConfigJson(old[id])===canonicalConfigJson(value))continue;
    if(Object.hasOwn(old,id)){
     configAssert(!['releases','events','receipts'].includes(name),409,'CONFIG_HISTORY_IMMUTABLE');
     await query(`UPDATE dbo.${table} SET payload_json=@payload WHERE company_id=@companyKey AND document_id=@id`,{companyKey,id,payload:canonicalConfigJson(value)});
    }else await query(`INSERT INTO dbo.${table}(company_id,document_id,payload_json) VALUES(@companyKey,@id,@payload)`,{companyKey,id,payload:canonicalConfigJson(value)});
   }
  }
  for(const [id,member] of Object.entries(state.members)){
   configAssert(Object.hasOwn(before.members,id),409,'MEMBERSHIP_IMPORT_REQUIRED');
   if(canonicalConfigJson(member)===canonicalConfigJson(before.members[id]))continue;
   await query('UPDATE m SET payload_json=@payload FROM dbo.crm_config_membership m JOIN dbo.crm_user u ON u.user_id=m.user_id WHERE m.company_id=@companyKey AND u.public_id=@id',{companyKey,id,payload:canonicalConfigJson(member)});
  }
  const updated=await query('UPDATE dbo.crm_config_company_state SET revision=revision+1,permission_version=@permissionVersion,data_version=@dataVersion,active_release_id=@releaseId,pending_actions_json=@pending WHERE company_id=@companyKey AND revision=@revision',{companyKey,revision:before.revision,permissionVersion:state.permissionVersion,dataVersion:state.dataVersion,releaseId:state.activeReleaseId,pending:canonicalConfigJson(state.pendingActions)});
  configAssert(updated.rowsAffected?.[0]===1,409,'CONFIG_REVISION_CONFLICT');
  if(postPersist){
   const ids=Object.keys(state.releases).filter(id=>!Object.hasOwn(before.releases,id));
   const member=state.members[actorId.toLowerCase()],priorMember=before.members[actorId.toLowerCase()];
   const canPublish=(m:typeof member)=>!!m?.active&&m.permissions.includes('config.publish')&&!m.denied.includes('config.publish');
   configAssert(identity.is_active&&!identity.deleted_yn&&canPublish(priorMember)&&canPublish(member),403,'PERMISSION_DENIED');
   if(ids.length===0){
    const replay=response as {id?:unknown};
    configAssert(typeof replay?.id==='string'&&state.activeReleaseId===replay.id&&Object.hasOwn(before.releases,replay.id)&&Object.values(before.receipts).some(receipt=>canonicalConfigJson(receipt.result)===canonicalConfigJson(response))&&canonicalConfigJson(state)===canonicalConfigJson(before),409,'POST_PERSIST_RELEASE_REQUIRED');
    return response;
   }
   configAssert(ids.length===1&&state.activeReleaseId===ids[0],409,'POST_PERSIST_RELEASE_REQUIRED');
   const release=state.releases[ids[0]];
   configAssert(release.id===ids[0]&&release.companyId===companyId&&release.contentHash===configReleaseHash(release),503,'CONFIG_INTEGRITY_FAILED');
   await postPersist({companyId,companyKey,release:structuredClone(release),query});
  }
  return response;
 });}
}
