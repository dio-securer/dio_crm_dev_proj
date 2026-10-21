import { z } from 'zod';
import { AdminRepository, AdminError, assert, canonical, domains, uuid } from './core';
import { parsePayload } from './schemas';
import { overrideOpSchema } from './versions';
export const overrideSchema = overrideOpSchema;
export const draftInputSchema=z.object({scope:z.enum(['COMMON','TEMPLATE','COUNTRY','COMPANY']),scopeKey:z.string().min(1),domain:z.enum(domains),stableKey:z.string().min(1),schemaVersion:z.literal(1),parentVersionIds:z.array(uuid),payload:z.record(z.unknown()).optional(),overrides:z.array(overrideSchema).optional()}).strict().superRefine((d,c)=>{
 if(d.domain==='COMPANY_PROFILE'&&d.scope!=='COMPANY')c.addIssue({code:'custom',message:'COMPANY_SCOPE_REQUIRED'});
 if(d.scope==='COMMON') {if(d.scopeKey!=='COMMON'||d.payload===undefined||d.overrides!==undefined)c.addIssue({code:'custom',message:'COMMON_PAYLOAD_REQUIRED'});}
 else if(d.payload!==undefined||d.overrides===undefined)c.addIssue({code:'custom',message:'OVERRIDES_REQUIRED'});
 if(d.scope==='COMPANY'&&!uuid.safeParse(d.scopeKey).success)c.addIssue({code:'custom',message:'COMPANY_UUID_REQUIRED'});
 if(d.scope==='TEMPLATE'&&!['HQ','GLOBAL'].includes(d.scopeKey))c.addIssue({code:'custom',message:'TEMPLATE_INVALID'});
 if(d.scope==='COUNTRY'&&!/^(HQ|GLOBAL):[A-Z]{2}$/.test(d.scopeKey))c.addIssue({code:'custom',message:'COUNTRY_SCOPE_INVALID'});
 if(d.payload!==undefined){const parsed=(()=>{try{return parsePayload(d.domain,d.payload)}catch{return null}})();if(!parsed)c.addIssue({code:'custom',message:'DOMAIN_PAYLOAD_INVALID'});}
 const paths=(d.overrides||[]).map(o=>o.path.map(canonical));
 for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++)if(paths[i].slice(0,Math.min(paths[i].length,paths[j].length)).every((x,k)=>x===paths[j][k]))c.addIssue({code:'custom',message:'OVERRIDE_PATH_CONFLICT'});
});
export type DraftInput=z.infer<typeof draftInputSchema>;
export interface DraftActor { userId:string;companyId:string;platformAdmin:boolean;canConfigure:boolean }
export interface CommandMeta { key:string;requestId:string;hash:string;id:string }
function access(actor:DraftActor,d:DraftInput){assert(actor.canConfigure,403,'FORBIDDEN');assert(actor.platformAdmin||(d.scope==='COMPANY'&&d.scopeKey===actor.companyId),403,'SCOPE_FORBIDDEN');}
export async function createDraft(repo:AdminRepository,actor:DraftActor,input:unknown,meta:CommandMeta){const d=draftInputSchema.parse(input);access(actor,d);assert(meta.key,400,'IDEMPOTENCY_REQUIRED');return repo.transact(actor.companyId,tx=>{const key=actor.userId+':POST:/config/drafts:'+meta.key;const prior=tx.receipt(key,meta.hash);if(prior)return prior;assert(!tx.query('drafts').some(r=>r.scope===d.scope&&r.scopeKey===d.scopeKey&&r.domain===d.domain&&r.stableKey===d.stableKey),409,'DRAFT_EXISTS');const row={...d,id:meta.id,companyId:actor.companyId,revision:1};tx.insert('drafts',row);tx.appendEvent({id:meta.requestId,companyId:actor.companyId,revision:1,action:'DRAFT_CREATED',actor:actor.userId,target:row.id});const result={data:row,meta:{revision:1,requestId:meta.requestId}};tx.receipt(key,meta.hash,result);return result;});}
export async function updateDraft(repo:AdminRepository,actor:DraftActor,id:string,input:unknown,match:string|undefined,meta:CommandMeta){assert(actor.canConfigure,403,'FORBIDDEN');assert(meta.key,400,'IDEMPOTENCY_REQUIRED');const b=z.object({revision:z.number().int().positive(),payload:z.record(z.unknown()).optional(),overrides:z.array(overrideSchema).optional()}).strict().parse(input);assert(match,400,'REVISION_REQUIRED');assert(match===`"${b.revision}"`,400,'REVISION_MISMATCH');return repo.transact(actor.companyId,tx=>{const key=actor.userId+':PATCH:/config/drafts/'+id+':'+meta.key,prior=tx.receipt(key,meta.hash);if(prior)return prior;const old=tx.read('drafts',id);assert(old,404,'NOT_FOUND');assert(old.scope==='COMMON'?b.overrides===undefined:b.payload===undefined,422,'PAYLOAD_OVERRIDES_EXCLUSIVE');const d=draftInputSchema.parse({scope:old.scope,scopeKey:old.scopeKey,domain:old.domain,stableKey:old.stableKey,schemaVersion:old.schemaVersion,parentVersionIds:old.parentVersionIds,...(old.scope==='COMMON'?{payload:b.payload}:{overrides:b.overrides})});access(actor,d);tx.compareAndSwap('drafts',id,b.revision,{...old,...d});tx.appendEvent({id:meta.requestId,companyId:actor.companyId,revision:1,action:'DRAFT_UPDATED',actor:actor.userId,target:id});const result={data:tx.read('drafts',id),meta:{revision:b.revision+1,requestId:meta.requestId}};tx.receipt(key,meta.hash,result);return result;});}

export function normalizeCommandError(error: unknown): never {
 if (error instanceof z.ZodError) throw new AdminError(422, 'VALIDATION_ERROR', error.issues.map(issue => ({ path: issue.path.join('.'), code: issue.code, messageKey: 'admin.validation.' + issue.code })));
 throw error;
}
