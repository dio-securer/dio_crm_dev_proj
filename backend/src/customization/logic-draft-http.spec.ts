import 'reflect-metadata';
import {Test} from '@nestjs/testing';
import {ExpressAdapter} from '@nestjs/platform-express';
import {JwtService} from '@nestjs/jwt';
import type {INestApplication} from '@nestjs/common';
import {AuthGuard} from '../security/security';
import {ConfigurationIdentity} from './config-http';
import {ConfigurationLogicDraftController,LogicDraftModule,LOGIC_DRAFT_PROVIDER} from './logic-draft-http';
import {LogicDraftService,type LogicDraftStore,type LogicDraftTransaction} from './logic-draft';

const actor='11111111-1111-4111-8111-111111111111',company='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',draft='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
describe('logic draft HTTP boundary',()=>{
 let app:INestApplication,url:string,token:string;let state:LogicDraftTransaction;
 beforeEach(async()=>{
  state={configDraft:{id:draft,revision:1,state:'DRAFT'},identityActive:true,canRead:true,canWrite:true,draft:null,receipts:{},audit:[]};
  const store:LogicDraftStore={async transact(_company,_actor,_draft,fn){return fn(state);}};
  const jwt=new JwtService({secret:'isolated-logic-test-only'});token=await jwt.signAsync({sub:1,publicId:actor,companyId:1});
  const module=await Test.createTestingModule({controllers:[ConfigurationLogicDraftController],providers:[AuthGuard,{provide:JwtService,useValue:{verifyAsync:(value:string)=>jwt.verifyAsync(value)}},{provide:LOGIC_DRAFT_PROVIDER,useValue:new LogicDraftService(store)},{provide:ConfigurationIdentity,useValue:{actor:async(req:any)=>({id:req.authUser.publicId})}}]}).compile();
  app=module.createNestApplication(new ExpressAdapter());await app.listen(0,'127.0.0.1');url=await app.getUrl();
 });
 afterEach(async()=>{await app.close();});
 const body={companyId:company,draftId:draft,configRevision:1,revision:0,items:[{screenId:'HQ_LEAD',eventId:'lead.detail.field-change.v1',registryVersion:1,source:'return input;'}]};
 const put=(value:unknown,auth:string)=>fetch(url+'/api/admin/logic-drafts',{method:'PUT',headers:{authorization:auth,'content-type':'application/json','idempotency-key':'one'},body:JSON.stringify(value)});
 it('requires a signed session and rejects client-supplied actor or grant',async()=>{
  expect((await put(body,'Bearer forged')).status).toBe(401);
  expect((await put({...body,actorId:actor,canWrite:true},`Bearer ${token}`)).status).toBe(422);
  expect(state.draft).toBeNull();const result=await put(body,`Bearer ${token}`);expect(result.status).toBe(200);
  expect(await result.json()).toMatchObject({revision:1,capabilities:{edit:true},runtimeStatus:'not-implemented',releaseBinding:'not-connected'});
 });
 it('returns read-only capability and enforces server grant for write',async()=>{
  state.canWrite=false;const read=await fetch(`${url}/api/admin/logic-drafts?companyId=${company}&draftId=${draft}`,{headers:{authorization:`Bearer ${token}`}});
  expect(read.status).toBe(200);expect(await read.json()).toMatchObject({capabilities:{edit:false}});
  expect((await put(body,`Bearer ${token}`)).status).toBe(403);
 });
 it('installs no provider by default and fails without calling identity',async()=>{
  expect(Reflect.getMetadata('providers',LogicDraftModule).find((p:any)=>p.provide===LOGIC_DRAFT_PROVIDER).useValue).toBeNull();
  const identity={actor:jest.fn()},controller=new ConfigurationLogicDraftController(null,identity as any);
  await expect(controller.read({} as any,{companyId:company,draftId:draft})).rejects.toMatchObject({code:'LOGIC_DRAFT_UNAVAILABLE'});
  expect(identity.actor).not.toHaveBeenCalled();
 });
});
