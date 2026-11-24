import type {ConfigActor} from './config-service';
import {ConfigError,configAssert} from './config-store';
import {DomainDeliveryWorker} from './domain-delivery-worker';

/** Deployment-owned actor enumeration. Never accept this list from an HTTP request. */
export interface DeliveryActorSource { list(limit:number):Promise<ConfigActor[]>; }
/** Explicit bounded tick: construction never opens connections or starts timers. */
export class DomainDeliveryScheduler {
 private running=false;
 constructor(private readonly source:DeliveryActorSource,private readonly worker:DomainDeliveryWorker){}
 async tick(options:{actors?:number;jobsPerActor?:number}={}){
  const actors=options.actors??20,jobs=options.jobsPerActor??20;
  configAssert(Number.isSafeInteger(actors)&&actors>0&&actors<=100&&Number.isSafeInteger(jobs)&&jobs>0&&jobs<=50,422,'INVALID_REQUEST');
  configAssert(!this.running,409,'DELIVERY_TICK_RUNNING');this.running=true;
  try{
   const candidates=await this.source.list(actors);
   configAssert(candidates.length<=actors,500,'DELIVERY_ACTOR_LIMIT');
   const seen=new Set<string>(),results:Array<{actor:ConfigActor;status:'PROCESSED'|'FAILED';code?:string;results?:unknown}>=[];
   for(const actor of candidates){
    const key=actor.companyId+':'+actor.id;if(seen.has(key))continue;seen.add(key);
    try{results.push({actor,status:'PROCESSED',results:await this.worker.runOnce(actor,jobs)});}
    catch(error){results.push({actor,status:'FAILED',code:error instanceof ConfigError?error.code:'DELIVERY_TICK_FAILED'});}
   }
   return results;
  }finally{this.running=false;}
 }
}
