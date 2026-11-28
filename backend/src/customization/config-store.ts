import type { ConfigCatalog, CompanyConfig, ConfigResult, Translations } from '@dio-crm/contracts/crm-customization';
export interface ConfigMember {active:boolean;permissions:string[];denied:string[]}
export interface ConfigDraft {id:string;revision:number;state:'DRAFT'|'VALIDATED'|'PUBLISHED'|'ABANDONED';baseActiveReleaseId:string|null;config:CompanyConfig;restoredFrom?:string;rebase?:{fromStandardReleaseId:string;targetStandardReleaseId:string;conflicts:Array<{id:string;code:string}>}}
export interface ConfigValidation {id:string;draftId:string;draftRevision:number;draftHash:string;activeReleaseId:string|null;permissionVersion:number;dataVersion:number;effective:ConfigResult;errors:unknown[]}
export interface ConfigRelease {id:string;companyId:string;standardReleaseId:string;config:CompanyConfig;effective:ConfigResult;contentHash:string;reason:string;actorId:string;createdAt:string;restoredFrom?:string;hqExtension?:{hqReleaseId:string;fields:Array<{id:string;version:number}>}}
export interface ConfigOutboxRecord {
 id:string;type:string;releaseId:string;status:'PENDING'|'SENT'|'CANCELLED'|'REVIEW_REQUIRED';
 delivery?:{actorId:string;permissionVersion:number;actionId:string;interfaceCode:string;entityId:string;sourceFieldIds:string[];payload:unknown;attempts:number;unknownOutcome:boolean;lastError:string|null;completion?:{resultHash:string;success:boolean;at:string}};
}
export interface ConfigState {
 /** SQL-loaded immutable published standards; absent only in isolated memory fixtures. */
 publishedArtifacts?:Record<string,StandardArtifact>;
 companyId:string;revision:number;permissionVersion:number;dataVersion:number;activeReleaseId:string|null;
 members:Record<string,ConfigMember>;drafts:Record<string,ConfigDraft>;validations:Record<string,ConfigValidation>;releases:Record<string,ConfigRelease>;
 events:Array<{id:string;actorId:string;operation:string;at:string;beforeHash:string;afterHash:string;reason:string}>;
 outbox:ConfigOutboxRecord[];
 receipts:Record<string,{payloadHash:string;result:unknown;contextStamp?:string}>;
 /** Test/domain adapter supplies counts; never inferred from a UI toggle. */
 pendingActions:Record<string,number>;
}
export interface ConfigTransaction {state:ConfigState;identityActive:boolean;domain?:{companyKey:number;query:<T=Record<string,unknown>>(sql:string,params?:Record<string,unknown>)=>Promise<{recordset:T[];rowsAffected?:number[]}>}}
export interface AdminConfigRepository {
 transact<T>(companyId:string,actorId:string,work:(tx:ConfigTransaction)=>Promise<T>|T,identityIds?:string[]):Promise<T>;
}
export interface StandardArtifact {id:string;catalog:ConfigCatalog;translations:Translations;publicationReady:boolean;contentHash:string}
export class ConfigError extends Error {status:number;code:string;details:unknown;constructor(status:number,code:string,details:unknown=null){super(code);this.status=status;this.code=code;this.details=details;}}
export const configAssert:(condition:unknown,status:number,code:string,details?:unknown)=>asserts condition=(condition,status,code,details)=>{if(!condition)throw new ConfigError(status,code,details);};
const clone=<T>(value:T):T=>structuredClone(value);
/** Shared identity->company locks; all commands touching this store use these fences. */
export class MemoryAdminConfigRepository implements AdminConfigRepository {
 private states=new Map<string,ConfigState>();private identities=new Map<string,boolean>();private tails=new Map<string,Promise<void>>();
 private beforeCommit?: (state:ConfigState)=>void;
 constructor(states:ConfigState[],beforeCommit?:(state:ConfigState)=>void){this.beforeCommit=beforeCommit;for(const state of states){this.states.set(state.companyId,clone(state));for(const id of Object.keys(state.members))if(!this.identities.has(id))this.identities.set(id,true);}}
 private async lock<T>(key:string,work:()=>Promise<T>):Promise<T>{const previous=this.tails.get(key)??Promise.resolve();let unlock!:()=>void;const turn=new Promise<void>(resolve=>{unlock=resolve;});const tail=previous.then(()=>turn);this.tails.set(key,tail);await previous;try{return await work();}finally{unlock();if(this.tails.get(key)===tail)this.tails.delete(key);}}
 async transact<T>(companyId:string,actorId:string,work:(tx:ConfigTransaction)=>Promise<T>|T,identityIds:string[]=[]):Promise<T>{const ids=[...new Set([actorId,...identityIds].map(id=>id.toLowerCase()))].sort();const locks=<R>(i:number,fn:()=>Promise<R>):Promise<R>=>i===ids.length?fn():this.lock('identity:'+ids[i],()=>locks(i+1,fn));return locks(0,()=>this.lock('company:'+companyId,async()=>{
  const current=this.states.get(companyId);configAssert(current,404,'NOT_FOUND');const state=clone(current);const result=await work({state,identityActive:this.identities.get(actorId)===true});
  this.beforeCommit?.(state);state.revision=current.revision+1;const copy=clone(result);this.states.set(companyId,clone(state));return copy;
 }));}
 /** Internal identity-provider callback, not an HTTP/admin permission shortcut. */
 async setIdentityActive(identityId:string,active:boolean):Promise<void>{await this.lock('identity:'+identityId,async()=>{this.identities.set(identityId,active);});}
 /** Test observation; transport must never expose raw state. */
 snapshot(companyId:string):ConfigState {const state=this.states.get(companyId);configAssert(state,404,'NOT_FOUND');return clone(state);}
}
export const emptyConfigState=(companyId:string,members:Record<string,ConfigMember>):ConfigState=>({companyId,revision:0,permissionVersion:1,dataVersion:0,activeReleaseId:null,members,drafts:{},validations:{},releases:{},events:[],outbox:[],receipts:{},pendingActions:{}});
