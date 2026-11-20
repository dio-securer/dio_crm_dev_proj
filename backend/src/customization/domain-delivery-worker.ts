import {configAssert} from './config-store';import type {ConfigActor} from './config-service';
import {deliverDomainOutbox,type DeliveryRepository,type DomainDeliveryAdapter} from './domain-outbox';
import {createDomainDeliveryAdapter,createChangedPlanDeliveryAdapter,type IdempotentDomainTransport} from './domain-delivery-adapters';
/** Bounded worker entry point shared by a deployment scheduler and an authorized retry.
 * No timers, DB access, or network activity occurs at construction/startup.
 */
export class DomainDeliveryWorker{
 private readonly adapters=new Map<string,DomainDeliveryAdapter>();
 constructor(private readonly repository:DeliveryRepository,transport:IdempotentDomainTransport|null){
  if(transport){for(const code of ['IF-ERP-002','IF-ERP-004','IF-ERP-007','IF-ERP-012'] as const)this.adapters.set(code,createDomainDeliveryAdapter(code,transport));this.adapters.set('IF-ERP-011',createChangedPlanDeliveryAdapter(transport));}
 }
 async retry(actor:ConfigActor,requestId:string){
  this.repository.assertDeliveryBoundary();configAssert(this.adapters.size>0,503,'TRANSPORT_NOT_CONFIGURED');
  const code=await this.repository.transact(actor.companyId,actor.id,tx=>{const job=tx.state.outbox.find(j=>j.id===requestId);configAssert(job?.delivery?.actorId===actor.id,404,'NOT_FOUND');return job.delivery.interfaceCode;});
  const adapter=this.adapters.get(code);configAssert(adapter,503,'DELIVERY_ADAPTER_NOT_CONFIGURED');return deliverDomainOutbox(this.repository,actor,requestId,adapter);
 }
 /** Trusted scheduler supplies original actor/company, allowing delivery cancellation after revocation. */
 async runOnce(actor:ConfigActor,limit=20){
  this.repository.assertDeliveryBoundary();configAssert(Number.isSafeInteger(limit)&&limit>0&&limit<=50,422,'INVALID_REQUEST');configAssert(this.adapters.size>0,503,'TRANSPORT_NOT_CONFIGURED');
  const ids=await this.repository.transact(actor.companyId,actor.id,tx=>tx.state.outbox.filter(j=>j.status==='PENDING'&&j.delivery?.actorId===actor.id&&this.adapters.has(j.delivery.interfaceCode)).slice(0,limit).map(j=>j.id)),results=[];
  for(const id of ids)results.push(await this.retry(actor,id));
  return results;
 }
}
