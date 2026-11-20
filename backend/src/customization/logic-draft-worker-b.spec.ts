import 'reflect-metadata';
import {Test} from '@nestjs/testing';
import {ExpressAdapter} from '@nestjs/platform-express';
import {JwtService} from '@nestjs/jwt';
import {AuthGuard} from '../security/security';
import {configureHttpHardening} from '../ops/hardening';
import {ConfigurationIdentity} from './config-http';
import {ConfigurationLogicDraftController,LOGIC_DRAFT_PROVIDER,LogicDraftModule} from './logic-draft-http';
import {LogicDraftService,type LogicDraftStore,type LogicDraftTransaction} from './logic-draft';

const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const actor='11111111-1111-4111-8111-111111111111', d='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const event={screenId:'HQ_LEAD',eventId:'lead.create.before-save.v1',registryVersion:1,source:'const note = "비밀 값";'};
const initial=():LogicDraftTransaction=>({configDraft:{id:d,revision:1,state:'DRAFT'},identityActive:true,canRead:true,canWrite:true,draft:null,receipts:{},audit:[]});
function fixture(){
 const states=new Map([[A,initial()],[B,initial()]]);let fail=false;
 const store:LogicDraftStore={async transact(company,id,draft,fn){if(id!==actor||draft!==d||!states.has(company))throw new Error('provider denies cross scope');const copy=structuredClone(states.get(company)!);const result=await fn(copy);if(fail)throw new Error('commit failure');states.set(company,copy);return result;}};
 return {states,service:new LogicDraftService(store,()=> '2026-10-30T00:00:00Z'),fail:()=>{fail=true;}};
}
const body=(company=A)=>({companyId:company,draftId:d,configRevision:1,revision:0,items:[event]});

describe('independent logic draft service boundaries',()=>{
 it('separates companies and never places source into audit',async()=>{const f=fixture();const saved=await f.service.save(actor,body(),'first');expect(saved.items[0].source).toBe(event.source);expect(saved.runtimeStatus).toBe('not-implemented');expect(saved.releaseBinding).toBe('not-connected');expect((await f.service.read(actor,{companyId:B,draftId:d})).items).toEqual([]);expect(JSON.stringify(f.states.get(A)!.audit)).not.toContain(event.source);});
 it('rechecks identity, read and write grants as well as config revision and state on replay',async()=>{const f=fixture();await f.service.save(actor,body(),'first');for(const key of ['identityActive','canRead','canWrite'] as const){f.states.get(A)![key]=false;await expect(f.service.save(actor,body(),'first')).rejects.toMatchObject({code:'FORBIDDEN'});f.states.get(A)![key]=true;}f.states.get(A)!.configDraft!.state='PUBLISHED';await expect(f.service.save(actor,body(),'first')).rejects.toMatchObject({code:'DRAFT_NOT_FOUND'});f.states.get(A)!.configDraft!.state='DRAFT';f.states.get(A)!.configDraft!.revision=2;await expect(f.service.save(actor,body(),'first')).rejects.toMatchObject({code:'CONFIG_REVISION_CONFLICT'});});
 it('denies a removed draft and cross-scope actor, company and draft',async()=>{const f=fixture();f.states.get(A)!.configDraft=null;await expect(f.service.read(actor,{companyId:A,draftId:d})).rejects.toMatchObject({code:'DRAFT_NOT_FOUND'});f.states.get(B)!.canRead=false;await expect(f.service.read(actor,{companyId:B,draftId:d})).rejects.toMatchObject({code:'FORBIDDEN'});await expect(f.service.read('22222222-2222-4222-8222-222222222222',{companyId:B,draftId:d})).rejects.toThrow();await expect(f.service.read(actor,{companyId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',draftId:d})).rejects.toThrow();});
 it('accepts valid Unicode at byte boundary and rejects malformed, oversize, null and non-JSON inputs',async()=>{const f=fixture();const valid={...body(),items:[{...event,source:'가'.repeat(10922)+'aa'}]};expect(Buffer.byteLength(valid.items[0].source,'utf8')).toBe(32768);await f.service.save(actor,valid,'valid');for(const source of ['가'.repeat(10923),'\ud800',null,undefined,123])await expect(f.service.save(actor,{...body(),revision:1,items:[{...event,source}]},'invalid')).rejects.toBeDefined();for(const eventId of ['constructor','__proto__','lead.create.unknown.v1'])await expect(f.service.save(actor,{...body(),revision:1,items:[{...event,eventId}]},'invalid')).rejects.toBeDefined();await expect(f.service.save(actor,{...body(),revision:NaN},'invalid')).rejects.toBeDefined();});
 it('checks key/body replay and commits audit and draft atomically via the port',async()=>{const f=fixture();const first=await f.service.save(actor,body(),'same');expect(await f.service.save(actor,body(),'same')).toEqual(first);await expect(f.service.save(actor,{...body(),items:[{...event,source:'changed'}]},'same')).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});expect(f.states.get(A)!.audit).toHaveLength(1);const g=fixture();g.fail();await expect(g.service.save(actor,body(),'k')).rejects.toThrow('commit failure');expect(g.states.get(A)!.draft).toBeNull();expect(g.states.get(A)!.receipts).toEqual({});expect(g.states.get(A)!.audit).toEqual([]);});
 it('rejects stored draft and replay receipt context mismatch under the trusted provider',async()=>{const f=fixture();await f.service.save(actor,body(),'same');f.states.get(A)!.draft!.companyId=B;await expect(f.service.read(actor,{companyId:A,draftId:d})).rejects.toMatchObject({code:'DRAFT_CONTEXT_MISMATCH'});f.states.get(A)!.draft!.companyId=A;const receipt=Object.values(f.states.get(A)!.receipts)[0];receipt.result.draftId='ffffffff-ffff-4fff-8fff-ffffffffffff';await expect(f.service.save(actor,body(),'same')).rejects.toMatchObject({code:'DRAFT_CONTEXT_MISMATCH'});});
});

describe('independent signed HTTP and CORS',()=>{
 it('returns 503 on the real guarded route when the default provider is absent',async()=>{
  expect(Reflect.getMetadata('providers',LogicDraftModule).find((p:any)=>p.provide===LOGIC_DRAFT_PROVIDER).useValue).toBeNull();
  const jwt=new JwtService({secret:'worker-b-isolated-test-secret'}),token=await jwt.signAsync({sub:1,publicId:actor,companyId:1});const identity={actor:jest.fn()};
  const module=await Test.createTestingModule({controllers:[ConfigurationLogicDraftController],providers:[AuthGuard,{provide:JwtService,useValue:{verifyAsync:(v:string)=>jwt.verifyAsync(v)}},{provide:LOGIC_DRAFT_PROVIDER,useValue:null},{provide:ConfigurationIdentity,useValue:identity}]}).compile();const app=module.createNestApplication(new ExpressAdapter());await app.listen(0,'127.0.0.1');
  try{const response=await fetch((await app.getUrl())+'/api/admin/logic-drafts',{method:'PUT',headers:{authorization:`Bearer ${token}`,'content-type':'application/json','idempotency-key':'http-key'},body:JSON.stringify(body())});expect(response.status).toBe(503);expect(identity.actor).not.toHaveBeenCalled();}finally{await app.close();}
 });
 it('requires signed identity, denies forged body, and preflights authorization/idempotency headers',async()=>{
  const f=fixture();const jwt=new JwtService({secret:'worker-b-isolated-test-secret'});const token=await jwt.signAsync({sub:1,publicId:actor,companyId:1});
  const module=await Test.createTestingModule({controllers:[ConfigurationLogicDraftController],providers:[AuthGuard,{provide:JwtService,useValue:{verifyAsync:(v:string)=>jwt.verifyAsync(v)}},{provide:LOGIC_DRAFT_PROVIDER,useValue:f.service},{provide:ConfigurationIdentity,useValue:{actor:async(req:any)=>({id:req.authUser.publicId})}}]}).compile();
  const app=module.createNestApplication(new ExpressAdapter());configureHttpHardening(app);await app.listen(0,'127.0.0.1');
  try{const u=(await app.getUrl())+'/api/admin/logic-drafts';const headers={'authorization':`Bearer ${token}`,'content-type':'application/json','idempotency-key':'http-key'};
   const preflight=await fetch(u,{method:'OPTIONS',headers:{origin:'http://localhost:5173','access-control-request-method':'PUT','access-control-request-headers':'authorization,content-type,idempotency-key'}});expect(preflight.status).toBe(204);expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');expect(preflight.headers.get('access-control-allow-headers')).toContain('idempotency-key');
   expect((await fetch(u,{method:'PUT',headers:{...headers,authorization:'Bearer forged'},body:JSON.stringify(body())})).status).toBe(401);
   expect((await fetch(u,{method:'PUT',headers,body:JSON.stringify({...body(),actorId:actor,canWrite:true})})).status).toBe(422);
   const ok=await fetch(u,{method:'PUT',headers,body:JSON.stringify(body())});expect(ok.status).toBe(200);expect(await ok.json()).toMatchObject({runtimeStatus:'not-implemented',releaseBinding:'not-connected'});
  }finally{await app.close();}
 });
});
