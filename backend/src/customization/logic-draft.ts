import { createHash } from 'node:crypto';
import { z } from 'zod';
import { findLogicEvent } from '@dio-crm/contracts/logic-events';
import { configAssert } from './config-store';

/** Draft text only. This service neither evaluates code nor attaches it to a release. */
const uuid = z.string().uuid().transform(value => value.toLowerCase());
const source = z.string().refine(value => Buffer.byteLength(value, 'utf8') <= 32768 && Buffer.from(value, 'utf8').toString('utf8') === value, 'Invalid source encoding or length');
const item = z.object({screenId:z.string().max(100),eventId:z.string().max(160),registryVersion:z.literal(1),source}).strict();
export const logicDraftQuery = z.object({companyId:uuid,draftId:uuid}).strict();
export const logicDraftInput = logicDraftQuery.extend({configRevision:z.number().int().positive().safe(),revision:z.number().int().nonnegative().safe(),items:z.array(item).max(5)}).strict().superRefine((value,ctx)=>{
 const seen=new Set<string>();for(const [i,entry] of value.items.entries()){
  if(!findLogicEvent(entry.screenId,entry.eventId,entry.registryVersion))ctx.addIssue({code:'custom',path:['items',i,'eventId'],message:'Unknown event'});
  const k=entry.screenId+'\u0000'+entry.eventId;if(seen.has(k))ctx.addIssue({code:'custom',path:['items',i,'eventId'],message:'Duplicate event'});seen.add(k);
 }
});
export type LogicDraftInput=z.infer<typeof logicDraftInput>;
type LogicItem=LogicDraftInput['items'][number]&{sourceHash:string};
type LogicDraft={companyId:string;draftId:string;configRevision:number;revision:number;items:LogicItem[]};
type Receipt={payloadHash:string;result:LogicDraft};
/** Provider must hold actor, company, configuration-draft and logic-draft locks until
 * commit; it must atomically persist the draft, receipt and audit or roll back all three.
 * The provider supplies trusted current authorization; never derive it from the request. */
export interface LogicDraftTransaction {
 configDraft:{id:string;revision:number;state:'DRAFT'|'VALIDATED'|'PUBLISHED'|'ABANDONED'}|null;
 identityActive:boolean;
 canRead:boolean;
 canWrite:boolean;
 draft:LogicDraft|null;
 receipts:Record<string,Receipt>;
 audit:Array<{actorId:string;draftId:string;revision:number;beforeHash:string;afterHash:string;at:string}>;
}
export interface LogicDraftStore {
 transact<T>(companyId:string,actorId:string,draftId:string,fn:(tx:LogicDraftTransaction)=>Promise<T>|T):Promise<T>;
}
const digest=(v:string)=>createHash('sha256').update(v,'utf8').digest('hex');
const visible=(draft:LogicDraft,edit:boolean)=>({...structuredClone(draft),capabilities:{edit},runtimeStatus:'not-implemented' as const,releaseBinding:'not-connected' as const});
export class LogicDraftService {
 constructor(private readonly store:LogicDraftStore,private readonly now:()=>string=()=>new Date().toISOString()){}
 private actor(actorId:string){const result=uuid.safeParse(actorId);configAssert(result.success,400,'INVALID_CONTEXT');return result.data;}
 private allowed(tx:LogicDraftTransaction,draftId:string,write:boolean){
  // A successful write returns source text, so write access must never bypass read access.
  configAssert(tx.identityActive && tx.canRead && (!write || tx.canWrite),403,'FORBIDDEN');
  configAssert(tx.configDraft && tx.configDraft.id===draftId && ['DRAFT','VALIDATED'].includes(tx.configDraft.state),404,'DRAFT_NOT_FOUND');
 }
 async read(actorId:string,raw:unknown){const actor=this.actor(actorId),input=logicDraftQuery.parse(raw);return this.store.transact(input.companyId,actor,input.draftId,tx=>{
  this.allowed(tx,input.draftId,false);const current=tx.draft??{companyId:input.companyId,draftId:input.draftId,configRevision:tx.configDraft!.revision,revision:0,items:[]};
  configAssert(current.companyId===input.companyId&&current.draftId===input.draftId,409,'DRAFT_CONTEXT_MISMATCH');
  // Expose the current configuration revision; a later save must match it under lock.
  return visible({...current,configRevision:tx.configDraft!.revision},tx.canWrite);
 });}
 async save(actorId:string,raw:unknown,key:string){
  const actor=this.actor(actorId),input=logicDraftInput.parse(raw);configAssert(typeof key==='string'&&key.length>0&&key.length<=160,428,'IDEMPOTENCY_REQUIRED');
  const payloadHash=digest(JSON.stringify(input));const receiptKey=actor+':'+key;
  return this.store.transact(input.companyId,actor,input.draftId,tx=>{
   this.allowed(tx,input.draftId,true);configAssert(tx.configDraft!.revision===input.configRevision,409,'CONFIG_REVISION_CONFLICT');
   const previous=tx.receipts[receiptKey];if(previous){configAssert(previous.payloadHash===payloadHash,409,'IDEMPOTENCY_CONFLICT');configAssert(previous.result.companyId===input.companyId&&previous.result.draftId===input.draftId,409,'DRAFT_CONTEXT_MISMATCH');return visible(previous.result,tx.canWrite);}
   const current=tx.draft??{companyId:input.companyId,draftId:input.draftId,configRevision:input.configRevision,revision:0,items:[]};
   configAssert(current.companyId===input.companyId&&current.draftId===input.draftId,409,'DRAFT_CONTEXT_MISMATCH');
   configAssert(current.revision===input.revision,409,'LOGIC_REVISION_CONFLICT');
   const next:LogicDraft={companyId:input.companyId,draftId:input.draftId,configRevision:input.configRevision,revision:current.revision+1,items:input.items.map(entry=>({...entry,sourceHash:digest(entry.source)}))};
   const beforeHash=digest(JSON.stringify(current.items)),afterHash=digest(JSON.stringify(next.items));
   tx.draft=structuredClone(next);tx.receipts[receiptKey]={payloadHash,result:structuredClone(next)};
   tx.audit.push({actorId:actor,draftId:input.draftId,revision:next.revision,beforeHash,afterHash,at:this.now()});
   return visible(next,tx.canWrite);
  });
 }
}
