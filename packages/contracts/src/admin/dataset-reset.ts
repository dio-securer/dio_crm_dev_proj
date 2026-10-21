import {z} from 'zod';
import {AdminRepository,assert,seed,Transaction} from './core';
import {SecurityActor,requirePermission} from './permissions';
import {SecurityEngine} from './security';
/** Reset is confined to the dedicated DEMO envelope; original CRM storage is never addressed. */
export class DatasetResetEngine {
 constructor(private repo:AdminRepository,private id=()=>crypto.randomUUID(),private now=()=>Date.now()){}
 private authorize(tx:Transaction,a:SecurityActor){const companies=tx.query('companies');for(const c of companies){assert(a.role==='PLATFORM_ADMIN'||a.companyId===c.id,403,'FORBIDDEN');requirePermission(tx,a,c.id,'mock.dataset.reset');}return companies.map(c=>c.id);}
 async request(a:SecurityActor,datasetId:string,op:'preview'|'reset',input:unknown){
  if(a.id)await new SecurityEngine(this.repo, this.id, this.now).authenticate(a.id,false);
  return new SecurityEngine(this.repo,this.id,this.now).authorizedRepository(a,a.companyId,'mock.dataset.reset').transact('*',tx=>{if(a.id){const session=tx.read('sessions',a.id);assert(session&&!session.revoked&&Number(session.expiresAt)>this.now(),401,'SESSION_EXPIRED');}const state=tx.dataset();assert(datasetId==='ADMIN_DEMO_V1'&&state.datasetId===datasetId,404,'NOT_FOUND');const companyIds=this.authorize(tx,a);
   if(op==='preview'){z.object({}).strict().parse(input||{});const fresh=seed(),counts=Object.fromEntries(Object.entries(state.collections).map(([key,rows])=>[key,{deleted:Object.keys(rows).length,restored:Object.keys(fresh.collections[key]||{}).length}]));counts.previews={deleted:(counts.previews?.deleted||0)+1,restored:0};const p={id:this.id(),revision:1,companyId:'*',kind:'DATASET_RESET',actorId:a.userId,membershipId:a.membershipId,datasetId,datasetRevision:state.revision+1,counts,affectedCompanyIds:companyIds,expiresAt:new Date(this.now()+600000).toISOString()};tx.insert('previews',p);return {previewId:p.id,datasetRevision:p.datasetRevision,counts,affectedCompanyIds:companyIds,expiresAt:p.expiresAt,revokedSessions:tx.query('sessions').length,excluded:['original CRM storage','other dataset namespaces']};}
   const b=z.object({previewId:z.string().uuid(),expectedRevision:z.number().int().positive(),reason:z.string().trim().min(1).max(500)}).strict().parse(input),p=tx.read('previews',b.previewId);assert(p?.kind==='DATASET_RESET'&&p.datasetId===datasetId,409,'RESET_PREVIEW_STALE');assert(p.actorId===a.userId&&p.membershipId===a.membershipId,403,'FORBIDDEN');assert(p.datasetRevision===b.expectedRevision&&state.revision===b.expectedRevision&&Date.parse(String(p.expiresAt))>this.now(),409,'RESET_PREVIEW_STALE');const counts=p.counts;tx.resetDataset(b.expectedRevision,seed());tx.appendEvent({id:this.id(),revision:1,companyId:'*',action:'DATASET_RESET',actor:a.userId,reason:b.reason,previousRevision:b.expectedRevision,at:new Date(this.now()).toISOString()});return {counts,newDatasetRevision:b.expectedRevision+1};
  });
 }
}
