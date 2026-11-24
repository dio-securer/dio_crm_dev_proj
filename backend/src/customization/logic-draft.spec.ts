import {LogicDraftService,type LogicDraftStore,type LogicDraftTransaction} from './logic-draft';
import {ConfigError} from './config-store';

const company='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const draft='cccccccc-cccc-4ccc-8ccc-cccccccccccc',actor='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const event={screenId:'HQ_LEAD',eventId:'lead.detail.field-change.v1',registryVersion:1 as const,source:'return input;'};
function setup(){
 const states=new Map<string,LogicDraftTransaction>();
 const initial=():LogicDraftTransaction=>({configDraft:{id:draft,revision:7,state:'DRAFT'},identityActive:true,canRead:true,canWrite:true,draft:null,receipts:{},audit:[]});
 states.set(company,initial());states.set(other,initial());let failCommit=false;
 const store:LogicDraftStore={async transact<T>(c:string,a:string,d:string,fn:(tx:LogicDraftTransaction)=>Promise<T>|T):Promise<T>{
  if(!states.has(c)||a!==actor||d!==draft)throw new ConfigError(404,'NOT_FOUND');
  const tx=structuredClone(states.get(c)!);const result=await fn(tx);if(failCommit)throw Error('commit failure');states.set(c,structuredClone(tx));return structuredClone(result);
 }};
 return {service:new LogicDraftService(store,()=> '2026-10-30T00:00:00.000Z'),states,fail:()=>{failCommit=true}};
}
const input=(c=company)=>({companyId:c,draftId:draft,configRevision:7,revision:0,items:[event]});
describe('logic draft text contract',()=>{
 it('saves isolated text with hashes, no execution and only hash audit; reads return copies',async()=>{
  const {service,states}=setup();const result=await service.save(actor,input(),'k1');
  expect(result).toMatchObject({revision:1,runtimeStatus:'not-implemented',releaseBinding:'not-connected',capabilities:{edit:true}});
  expect(result.items[0].sourceHash).toMatch(/^[0-9a-f]{64}$/);expect(JSON.stringify(states.get(company)!.audit)).not.toContain(event.source);
  result.items[0].source='mutated';expect((await service.read(actor,{companyId:company,draftId:draft})).items[0].source).toBe(event.source);
  expect((await service.read(actor,{companyId:other,draftId:draft})).items).toEqual([]);
 });
 it('replays the same command only after current authorization and rejects a different payload',async()=>{
  const {service,states}=setup();const a=await service.save(actor,input(),'k1');expect(await service.save(actor,input(),'k1')).toEqual(a);
  await expect(service.save(actor,{...input(),items:[{...event,source:'different'}]},'k1')).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
  states.get(company)!.canWrite=false;await expect(service.save(actor,input(),'k1')).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(states.get(company)!.audit).toHaveLength(1);
 });
 it('enforces both revisions, current draft state and separate read/write grants',async()=>{
  const {service,states}=setup();states.get(company)!.canWrite=false;
  expect((await service.read(actor,{companyId:company,draftId:draft})).capabilities.edit).toBe(false);
  await expect(service.save(actor,input(),'k')).rejects.toMatchObject({code:'FORBIDDEN'});
  states.get(company)!.canWrite=true;await expect(service.save(actor,{...input(),configRevision:6},'k')).rejects.toMatchObject({code:'CONFIG_REVISION_CONFLICT'});
  states.get(company)!.canRead=false;await expect(service.save(actor,input(),'k')).rejects.toMatchObject({code:'FORBIDDEN'});states.get(company)!.canRead=true;
  await expect(service.save(actor,{...input(),revision:1},'k')).rejects.toMatchObject({code:'LOGIC_REVISION_CONFLICT'});
  states.get(company)!.configDraft!.state='PUBLISHED';await expect(service.read(actor,{companyId:company,draftId:draft})).rejects.toMatchObject({code:'DRAFT_NOT_FOUND'});
 });
 it('rejects unknown events, duplicate entries, oversize or malformed UTF-8 and unexpected input',async()=>{
  const {service}=setup();for(const body of [
   {...input(),items:[{...event,eventId:'lead.unknown.v1'}]}, {...input(),items:[event,event]},
   {...input(),items:[{...event,source:'가'.repeat(10923)}]}, {...input(),items:[{...event,source:'\ud800'}]}, {...input(),authority:true}
  ])await expect(service.save(actor,body,'k')).rejects.toBeDefined();
 });
 it('uses atomic provider commit semantics and reports missing idempotency keys',async()=>{
  const {service,states,fail}=setup();await expect(service.save(actor,input(),'')).rejects.toMatchObject({code:'IDEMPOTENCY_REQUIRED'});
  fail();await expect(service.save(actor,input(),'k')).rejects.toThrow('commit failure');expect(states.get(company)!.draft).toBeNull();expect(states.get(company)!.audit).toEqual([]);
 });
 it('fails closed if a provider supplies a draft or receipt from another company',async()=>{
  const {service,states}=setup();await service.save(actor,input(),'k');
  states.get(company)!.draft!.companyId=other;
  await expect(service.read(actor,{companyId:company,draftId:draft})).rejects.toMatchObject({code:'DRAFT_CONTEXT_MISMATCH'});
  states.get(company)!.receipts[actor+':k'].result.companyId=other;
  await expect(service.save(actor,input(),'k')).rejects.toMatchObject({code:'DRAFT_CONTEXT_MISMATCH'});
 });
});
