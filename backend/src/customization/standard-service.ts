import {createHash,randomUUID} from 'node:crypto';
import {canonicalConfigJson,validateCatalog,validateTranslations} from '@dio-crm/contracts/crm-customization';
import {configAssert,type StandardArtifact} from './config-store.js';
export interface StandardRelease {id:string;artifactId:string;artifactHash:string;artifact:StandardArtifact;reason:string;actorId:string;createdAt:string}
export interface StandardState {head:string|null;releases:Record<string,StandardRelease>;receipts:Record<string,{payloadHash:string;releaseId:string}>;events:Array<{id:string;actorId:string;releaseId:string;reason:string;createdAt:string}>}
export interface StandardTransaction {state:StandardState;identityActive:boolean;canPublish:boolean;canRead:boolean}
export interface StandardRepository {transact<T>(actorId:string,work:(tx:StandardTransaction)=>T|Promise<T>):Promise<T>}
const hash=(value:unknown)=>createHash('sha256').update(canonicalConfigJson(value)).digest('hex');
export const emptyStandardState=():StandardState=>({head:null,releases:{},receipts:{},events:[]});
export class StandardPublicationService {
 private artifacts:Map<string,StandardArtifact>;
 private repository:StandardRepository;
 constructor(repository:StandardRepository,artifacts:StandardArtifact[]){this.repository=repository;this.artifacts=new Map();for(const artifact of artifacts){configAssert(!this.artifacts.has(artifact.id),500,'DUPLICATE_ARTIFACT');this.artifacts.set(artifact.id,structuredClone(artifact));}}
 async history(actorId:string){return this.repository.transact(actorId.toLowerCase(),tx=>{configAssert(tx.identityActive,401,'IDENTITY_DISABLED');configAssert(tx.canRead||tx.canPublish,403,'PERMISSION_DENIED');return {catalogHead:tx.state.head,releases:Object.values(tx.state.releases).map(({artifact,...metadata})=>metadata)};});}
 async publish(actorId:string,input:{artifactId:string;expectedCatalogHead:string|null;reason:string},key:string){actorId=actorId.toLowerCase();configAssert(typeof key==='string'&&key.length>0&&key.length<=160,428,'IDEMPOTENCY_REQUIRED');configAssert(typeof input.reason==='string'&&input.reason.trim(),422,'REASON_REQUIRED');
  return this.repository.transact(actorId,tx=>{
   configAssert(tx.identityActive,401,'IDENTITY_DISABLED');configAssert(tx.canPublish,403,'PERMISSION_DENIED');
   const receiptKey=hash([actorId,key]),payloadHash=hash(input),receipt=tx.state.receipts[receiptKey];
   if(receipt){configAssert(receipt.payloadHash===payloadHash,409,'IDEMPOTENCY_CONFLICT');return tx.state.releases[receipt.releaseId];}
   const artifact=this.artifacts.get(input.artifactId);configAssert(artifact,404,'ARTIFACT_NOT_ALLOWLISTED');configAssert(artifact.publicationReady,422,'STANDARD_NOT_PUBLICATION_READY');
   configAssert(artifact.contentHash===hash({catalog:artifact.catalog,translations:artifact.translations,publicationReady:artifact.publicationReady}),422,'ARTIFACT_HASH_MISMATCH');
   configAssert(validateCatalog(artifact.catalog).length===0,422,'INVALID_STANDARD');const locales=Object.keys(artifact.translations);configAssert(locales.length>0,422,'MISSING_TRANSLATIONS');configAssert(validateTranslations(artifact.catalog.entries,locales,locales[0],artifact.translations,{}).length===0,422,'INVALID_TRANSLATIONS');
   const existing=Object.values(tx.state.releases).find(r=>r.artifactHash===artifact.contentHash);
   if(existing){tx.state.receipts[receiptKey]={payloadHash,releaseId:existing.id};return existing;}
   configAssert(tx.state.head===input.expectedCatalogHead,409,'CATALOG_HEAD_CONFLICT');
   const standardId=artifact.catalog.standardReleaseId;configAssert(!Object.hasOwn(tx.state.releases,standardId),409,'STANDARD_ID_REUSE');
   // Reusing a retired ID for a different kind/binding silently changes old company overrides.
   for(const previous of Object.values(tx.state.releases))for(const entry of artifact.catalog.entries){const old=previous.artifact.catalog.entries.find(e=>e.id===entry.id);if(old)configAssert(old.kind===entry.kind&&old.bindingKind===entry.bindingKind&&old.apiField===entry.apiField,422,'INCOMPATIBLE_ID_REUSE');}
   const release:StandardRelease={id:standardId,artifactId:artifact.id,artifactHash:artifact.contentHash,artifact:structuredClone(artifact),reason:input.reason,actorId,createdAt:new Date().toISOString()};
   tx.state.releases[standardId]=release;tx.state.head=standardId;tx.state.receipts[receiptKey]={payloadHash,releaseId:standardId};tx.state.events.push({id:randomUUID(),actorId,releaseId:standardId,reason:input.reason,createdAt:release.createdAt});return release;
  });
 }
}
/** Deterministic test repository only. SQL repository is wired in the application. */
export class MemoryStandardRepository implements StandardRepository {
 state=emptyStandardState();permissions=new Map<string,{active:boolean;publish:boolean;read:boolean}>();private tail=Promise.resolve();beforeCommit?:()=>void;
 async transact<T>(actorId:string,work:(tx:StandardTransaction)=>T|Promise<T>):Promise<T>{const previous=this.tail;let unlock!:()=>void;this.tail=new Promise<void>(r=>unlock=r);await previous;try{const member=this.permissions.get(actorId),state=structuredClone(this.state),result=await work({state,identityActive:member?.active===true,canPublish:member?.publish===true,canRead:member?.read===true});this.beforeCommit?.();const response=structuredClone(result);this.state=structuredClone(state);return response;}finally{unlock();}}
}
