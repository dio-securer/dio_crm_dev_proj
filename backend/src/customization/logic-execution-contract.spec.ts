import { LogicExecutionContract, type LogicExecutionAuthority, type LogicExecutionGrant, type LogicIsolatedExecutor } from './logic-execution-contract';

const companyId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', actorId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', releaseId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const invocation={companyId,actorId,releaseId,screenId:'HQ_LEAD',eventId:'lead.detail.field-change.v1',registryVersion:1,artifactHash:'a'.repeat(64),input:{changedFieldId:'lead.phone',values:{'lead.phone':'123'}}};
const grant=():LogicExecutionGrant=>({companyId,actorId,releaseId,eventId:invocation.eventId,artifactHash:invocation.artifactHash,authorized:true,readableFields:['lead.phone'],writableFields:['lead.phone'],commandIds:[]});
const fake=(result:unknown):LogicIsolatedExecutor=>({run:async()=>result});

describe('logic executor host contract: no actual untrusted execution',()=>{
 it('fails closed without an authority or executor',async()=>{
  await expect(new LogicExecutionContract().run(invocation)).rejects.toMatchObject({code:'LOGIC_UNAVAILABLE'});
 });
 it('accepts only registered event, bounded JSON, expected input and no extraneous source',async()=>{
  const service=new LogicExecutionContract({current:async()=>grant()},fake({proposals:[]}));
  for(const request of [ {...invocation,eventId:'lead.unknown'}, {...invocation,registryVersion:2}, {...invocation,source:'code'}, {...invocation,input:{values:{'lead.phone':'x'.repeat(17000)}}}, {...invocation,input:{values:{'lead.phone':NaN}}} ]) {
   await expect(service.run(request)).rejects.toMatchObject({code:'LOGIC_INVALID_REQUEST'});
  }
  await expect(service.run({...invocation,input:{values:{'lead.phone':'123'}}})).rejects.toMatchObject({code:'LOGIC_INVALID_REQUEST'});
 });
 it('rejects inherited properties, getters, toJSON, cycles and exotic structures without invoking hooks',async()=>{
  const hook=jest.fn(()=>{throw Error('must not execute');});
  const getter=Object.defineProperty({},'lead.phone',{enumerable:true,get:hook});
  const jsonHook={toJSON:hook};
  const inherited=Object.assign(Object.create({'lead.secret':'x'.repeat(20000)}),{'lead.phone':'123'});
  const cyclic:Record<string,unknown>={};cyclic.self=cyclic;
  const symbol=Object.assign({'lead.phone':'123'},{[Symbol('secret')]:'x'});
  const service=new LogicExecutionContract({current:async()=>grant()},fake({proposals:[]}));
  for(const values of [getter,jsonHook,inherited,cyclic,symbol]) {
   await expect(service.run({...invocation,input:{changedFieldId:'lead.phone',values}})).rejects.toMatchObject({code:'LOGIC_INVALID_REQUEST'});
  }
  const resultGetter=Object.defineProperty({},'proposals',{enumerable:true,get:hook});
  for(const result of [resultGetter,{toJSON:hook},Object.assign(Object.create({extra:true}),{proposals:[]}),{proposals:[,]}]) {
   await expect(new LogicExecutionContract({current:async()=>grant()},fake(result)).run(invocation)).rejects.toMatchObject({code:'LOGIC_INVALID_RESULT'});
  }
  expect(hook).not.toHaveBeenCalled();
  const clean=Object.assign(Object.create(null),{'lead.phone':'123'});
  await expect(service.run({...invocation,input:{changedFieldId:'lead.phone',values:clean}})).resolves.toEqual({proposals:[]});
 });
 it('checks tenant, actor, release, hash and input fields against trusted authority before dispatch',async()=>{
  const run=jest.fn(async()=>({proposals:[]}));
  for(const update of [{companyId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'},{actorId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'},{releaseId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'},{artifactHash:'b'.repeat(64)}]) {
   await expect(new LogicExecutionContract({current:async()=>({...grant(),...update})},{run}).run(invocation)).rejects.toMatchObject({code:'LOGIC_INVALID_CONTEXT'});
  }
  await expect(new LogicExecutionContract({current:async()=>({...grant(),readableFields:[]})},{run}).run(invocation)).rejects.toMatchObject({code:'LOGIC_FORBIDDEN'});
  await expect(new LogicExecutionContract({current:async()=>{throw Error('secret detail')}},{run}).run(invocation)).rejects.toMatchObject({message:'LOGIC_UNAVAILABLE'});
  await expect(new LogicExecutionContract({current:async()=>({authorized:true} as LogicExecutionGrant)},{run}).run(invocation)).rejects.toMatchObject({code:'LOGIC_INVALID_CONTEXT'});
  expect(run).not.toHaveBeenCalled();
 });
 it('rechecks current authority and validates output type, targets, event kinds and writable fields',async()=>{
  let call=0;const authority:LogicExecutionAuthority={current:async()=>++call===1?grant():{...grant(),authorized:false}};
  await expect(new LogicExecutionContract(authority,fake({proposals:[{kind:'calculation-proposal',fieldId:'lead.phone',value:'456'}]})).run(invocation)).rejects.toMatchObject({code:'LOGIC_FORBIDDEN'});
  const service=(response:unknown, g=grant())=>new LogicExecutionContract({current:async()=>g},fake(response));
  await expect(service({proposals:[{kind:'calculation-proposal',fieldId:'lead.secret',value:'x'}]}).run(invocation)).rejects.toMatchObject({code:'LOGIC_FORBIDDEN'});
  await expect(service({proposals:[{kind:'calculation-proposal',fieldId:'lead.phone',value:'x'}]},{...grant(),writableFields:[]}).run(invocation)).rejects.toMatchObject({code:'LOGIC_FORBIDDEN'});
  for(const output of [{proposals:[{kind:'command-proposal',commandId:'delete',args:{}}]}, {proposals:[{kind:'display-proposal',fieldId:'lead.phone',visible:true,extra:true}]}, {proposals:[{kind:'display-proposal',fieldId:'lead.phone',visible:'true'}]}, {proposals:[],extra:'x'}, {proposals:[{kind:'validation-errors',fieldId:'lead.phone',code:'x'.repeat(20000)}]}]) {
   await expect(service(output).run(invocation)).rejects.toMatchObject({code:'LOGIC_INVALID_RESULT'});
  }
  expect(await service({proposals:[{kind:'validation-errors',fieldId:'lead.phone',code:'PHONE_INVALID'}]}).run(invocation)).toEqual({proposals:[{kind:'validation-errors',fieldId:'lead.phone',code:'PHONE_INVALID'}]});
 });
 it('limits server command proposals to registered event, allowed command and argument fields; never runs the command',async()=>{
  const server={...invocation,eventId:'lead.detail.before-save.v1',input:{values:{'lead.phone':'123'}}};
  const g={...grant(),eventId:server.eventId,commandIds:['lead.followup']};
  const allowed=new LogicExecutionContract({current:async()=>g},fake({proposals:[{kind:'command-proposal',commandId:'lead.followup',args:{'lead.phone':'123'}}]}));
  expect((await allowed.run(server)).proposals).toHaveLength(1);
  await expect(new LogicExecutionContract({current:async()=>g},fake({proposals:[{kind:'command-proposal',commandId:'delete',args:{}}]})).run(server)).rejects.toMatchObject({code:'LOGIC_FORBIDDEN'});
  await expect(new LogicExecutionContract({current:async()=>g},fake({proposals:[{kind:'command-proposal',commandId:'lead.followup',args:{'lead.secret':'x'}}]})).run(server)).rejects.toMatchObject({code:'LOGIC_FORBIDDEN'});
 });
 it('aborts on deadline and sanitizes executor exceptions rather than disclosing source',async()=>{
  jest.useFakeTimers();let signal:AbortSignal|undefined;
  const service=new LogicExecutionContract({current:async()=>grant()},{run:async(_i,o)=>{signal=o.signal;return new Promise(()=>{});}});
  const outcome=service.run(invocation).catch(e=>e);await Promise.resolve();await Promise.resolve();await jest.advanceTimersByTimeAsync(1001);
  expect((await outcome).code).toBe('LOGIC_TIMEOUT');expect(signal?.aborted).toBe(true);jest.useRealTimers();
  await expect(new LogicExecutionContract({current:async()=>grant()},{run:async()=>{throw Error('sensitive source');}}).run(invocation)).rejects.toMatchObject({message:'LOGIC_EXECUTION_FAILED'});
 });
 it('covers both authority checks with the overall deadline and does not dispatch after a late grant',async()=>{
  jest.useFakeTimers();
  try {
   let resolveGrant!:(value:LogicExecutionGrant)=>void;let signal:AbortSignal|undefined;
   const first:LogicExecutionAuthority={current:(_i,o)=>{signal=o.signal;return new Promise(resolve=>{resolveGrant=resolve;});}};
   const run=jest.fn(async()=>({proposals:[]}));
   const firstOutcome=new LogicExecutionContract(first,{run}).run(invocation).catch(e=>e);
   await Promise.resolve();await jest.advanceTimersByTimeAsync(1001);
   expect((await firstOutcome).code).toBe('LOGIC_TIMEOUT');expect(signal?.aborted).toBe(true);
   resolveGrant(grant());await Promise.resolve();await Promise.resolve();expect(run).not.toHaveBeenCalled();
   let count=0,secondSignal:AbortSignal|undefined;
   const second:LogicExecutionAuthority={current:async(_i,o)=>{if(++count===1)return grant();secondSignal=o.signal;return new Promise(()=>{});}};
   const secondOutcome=new LogicExecutionContract(second,fake({proposals:[]})).run(invocation).catch(e=>e);
   await Promise.resolve();await Promise.resolve();await jest.advanceTimersByTimeAsync(1001);
   expect((await secondOutcome).code).toBe('LOGIC_TIMEOUT');expect(secondSignal?.aborted).toBe(true);
  } finally {jest.useRealTimers();}
 });
});
