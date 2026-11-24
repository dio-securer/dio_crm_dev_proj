import {DomainDeliveryScheduler} from './domain-delivery-scheduler';
import {ConfigError} from './config-store';
describe('explicit delivery scheduler',()=>{
 const a={id:'a',companyId:'one'},b={id:'a',companyId:'two'};
 it('isolates actor failure, deduplicates within a company and bounds jobs',async()=>{
  const source={list:jest.fn().mockResolvedValue([a,a,b])},worker={runOnce:jest.fn().mockRejectedValueOnce(new ConfigError(503,'TRANSPORT_NOT_CONFIGURED')).mockResolvedValue([])};
  const scheduler=new DomainDeliveryScheduler(source,worker as any);
  expect(source.list).not.toHaveBeenCalled();
  expect(await scheduler.tick({actors:3,jobsPerActor:2})).toEqual([{actor:a,status:'FAILED',code:'TRANSPORT_NOT_CONFIGURED'},{actor:b,status:'PROCESSED',results:[]}]);
  expect(worker.runOnce.mock.calls).toEqual([[a,2],[b,2]]);
 });
 it('rejects overlap and releases the guard after a source failure',async()=>{
  let reject!:(e:Error)=>void;const source={list:jest.fn().mockImplementationOnce(()=>new Promise((_r,j)=>{reject=j;})).mockResolvedValue([])};
  const scheduler=new DomainDeliveryScheduler(source,{} as any),pending=scheduler.tick();
  await expect(scheduler.tick()).rejects.toMatchObject({code:'DELIVERY_TICK_RUNNING'});
  reject(new Error('source unavailable'));await expect(pending).rejects.toThrow('source unavailable');
  await expect(scheduler.tick()).resolves.toEqual([]);
 });
 it('rejects oversized actor sources before processing',async()=>{
  const worker={runOnce:jest.fn()},scheduler=new DomainDeliveryScheduler({list:async()=>[a,b]},worker as any);
  await expect(scheduler.tick({actors:1})).rejects.toMatchObject({code:'DELIVERY_ACTOR_LIMIT'});expect(worker.runOnce).not.toHaveBeenCalled();
  await expect(scheduler.tick({jobsPerActor:51})).rejects.toMatchObject({code:'INVALID_REQUEST'});
 });
});
