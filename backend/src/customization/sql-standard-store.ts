import {canonicalConfigJson} from '@dio-crm/contracts/crm-customization';
import {configAssert} from './config-store.js';
import {emptyStandardState,type StandardRepository,type StandardTransaction,type StandardState} from './standard-service.js';
import type {ConfigSqlDatabase} from './sql-config-store.js';
import {createHash} from 'node:crypto';
export class SqlStandardRepository implements StandardRepository {
 private database:ConfigSqlDatabase;constructor(database:ConfigSqlDatabase){this.database=database;}
 async transact<T>(actorId:string,work:(tx:StandardTransaction)=>T|Promise<T>):Promise<T>{return this.database.transaction(async query=>{
  for(const resource of ['crm.config.identity:'+actorId,'crm.config.catalog']){const lock=await query<{result:number}>("DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000; SELECT @r AS result",{resource});configAssert(lock.recordset[0]?.result>=0,409,'CONFIG_LOCK_TIMEOUT');}
  const people=await query<{is_active:boolean;deleted_yn:boolean;can_publish:boolean;can_read:boolean}>(`SELECT u.is_active,u.deleted_yn,p.can_publish,p.can_read FROM crm_user u WITH(UPDLOCK,HOLDLOCK) LEFT JOIN crm_standard_publisher p WITH(UPDLOCK,HOLDLOCK) ON p.user_id=u.user_id WHERE u.public_id=@actorId`,{actorId});configAssert(people.recordset.length===1,401,'IDENTITY_DISABLED');const person=people.recordset[0];
  const headers=await query<{head:string|null;revision:number}>('SELECT head,revision FROM crm_standard_catalog WITH(UPDLOCK,HOLDLOCK) WHERE singleton_id=1');configAssert(headers.recordset.length===1,503,'CATALOG_NOT_INITIALIZED');const header=headers.recordset[0],state:StandardState=emptyStandardState();state.head=header.head;
  const releases=await query<{standard_id:string;artifact_hash:string;payload_json:string}>('SELECT standard_id,artifact_hash,payload_json FROM crm_standard_release WITH(HOLDLOCK)');for(const row of releases.recordset){const release=JSON.parse(row.payload_json),artifact=release.artifact;const digest=createHash('sha256').update(canonicalConfigJson({catalog:artifact.catalog,translations:artifact.translations,publicationReady:artifact.publicationReady})).digest('hex');configAssert(release.id===row.standard_id&&artifact.catalog.standardReleaseId===row.standard_id&&artifact.contentHash===digest&&release.artifactHash===digest&&row.artifact_hash===digest,503,'STANDARD_INTEGRITY_FAILED');state.releases[row.standard_id]=release;}
  configAssert(!state.head||Object.hasOwn(state.releases,state.head),503,'STANDARD_INTEGRITY_FAILED');
  const receipts=await query<{receipt_id:string;payload_json:string}>('SELECT receipt_id,payload_json FROM crm_standard_receipt WITH(HOLDLOCK)');for(const row of receipts.recordset)state.receipts[row.receipt_id]=JSON.parse(row.payload_json);
  const events=await query<{payload_json:string}>('SELECT payload_json FROM crm_standard_event WITH(HOLDLOCK) ORDER BY ordinal');state.events=events.recordset.map(r=>JSON.parse(r.payload_json));
  const before=structuredClone(state),result=await work({state,identityActive:person.is_active&&!person.deleted_yn,canPublish:person.can_publish===true,canRead:person.can_read===true});
  for(const [id,release] of Object.entries(before.releases))configAssert(Object.hasOwn(state.releases,id)&&canonicalConfigJson(state.releases[id])===canonicalConfigJson(release),409,'STANDARD_IMMUTABLE');
  for(const [id,release] of Object.entries(state.releases))if(!Object.hasOwn(before.releases,id))await query('INSERT crm_standard_release(standard_id,artifact_hash,payload_json) VALUES(@id,@hash,@payload)',{id,hash:release.artifactHash,payload:canonicalConfigJson(release)});
  for(const [id,receipt] of Object.entries(state.receipts))if(!Object.hasOwn(before.receipts,id))await query('INSERT crm_standard_receipt(receipt_id,payload_json) VALUES(@id,@payload)',{id,payload:canonicalConfigJson(receipt)});
  for(const event of state.events.slice(before.events.length))await query('INSERT crm_standard_event(event_id,payload_json) VALUES(@id,@payload)',{id:event.id,payload:canonicalConfigJson(event)});
  const updated=await query('UPDATE crm_standard_catalog SET head=@head,revision=revision+1 WHERE singleton_id=1 AND revision=@revision',{head:state.head,revision:header.revision});configAssert(updated.rowsAffected?.[0]===1,409,'CATALOG_HEAD_CONFLICT');return structuredClone(result);
 });}
}
