import 'reflect-metadata';
import {Test} from '@nestjs/testing';
import {ExpressAdapter} from '@nestjs/platform-express';
import {JwtService} from '@nestjs/jwt';
import type {INestApplication} from '@nestjs/common';
import {AuthGuard} from '../security/security';
import {ConfigurationIdentity} from './config-http';
import {HqFieldController,HQ_FIELD_WRITER,HqFieldWriteModule} from './hq-field-http';
const actor='11111111-1111-4111-8111-111111111111';
describe('HQ field HTTP opt-in boundary',()=>{
 let app:INestApplication,url:string,token:string,calls:unknown[],writer:any;
 const body={key:'x_test',type:'text',labels:{'ko-KR':'Test','en-US':'Test'},reason:'Test'};
 beforeEach(async()=>{calls=[];writer={define:async(...args:unknown[])=>{calls.push(args);return {ok:true};},distribute:async(...args:unknown[])=>{calls.push(args);return {ok:true};}};
  const jwt=new JwtService({secret:'isolated-hq-test-only'});token=await jwt.signAsync({sub:1,publicId:actor,companyId:1});
  const module=await Test.createTestingModule({controllers:[HqFieldController],providers:[AuthGuard,{provide:JwtService,useValue:{verifyAsync:(value:string)=>jwt.verifyAsync(value)}},{provide:HQ_FIELD_WRITER,useFactory:()=>writer},{provide:ConfigurationIdentity,useValue:{actor:async(req:any)=>({id:req.authUser.publicId})}}]}).compile();app=module.createNestApplication(new ExpressAdapter());await app.listen(0,'127.0.0.1');url=await app.getUrl();});
 afterEach(async()=>{await app.close();});
 async function call(value:unknown,authorization=`Bearer ${token}`){return fetch(url+'/api/admin/hq/fields',{method:'POST',headers:{authorization,'content-type':'application/json','idempotency-key':'one'},body:JSON.stringify(value)});}
 it('uses signed session only and rejects unknown client authority',async()=>{expect((await call(body,'Bearer forged')).status).toBe(401);expect((await call({...body,actorId:actor,headquarters:true})).status).toBe(422);expect(calls).toHaveLength(0);expect((await call(body)).status).toBe(201);expect(calls[0]).toEqual([actor,body,'one']);});
 it('default module wiring contains null writer, not SQL or memory fallback',()=>{const providers=Reflect.getMetadata('providers',HqFieldWriteModule);expect(providers.find((p:any)=>p.provide===HQ_FIELD_WRITER).useValue).toBeNull();});
 it('disabled controller fails before identity or persistence',async()=>{const identity={actor:jest.fn()},controller=new HqFieldController(null,identity as any);await expect(controller.define({} as any,body,'one')).rejects.toMatchObject({code:'HQ_FIELD_WRITER_UNAVAILABLE'});expect(identity.actor).not.toHaveBeenCalled();});
 it('read forwards only signed actor and strict target query',async()=>{writer.read=async(...args:unknown[])=>{calls.push(args);return {capabilities:{define:true,distribute:true},definitions:[],target:null};};
  const get=(query:string,auth=`Bearer ${token}`)=>fetch(url+'/api/admin/hq/fields'+query,{headers:{authorization:auth}});
  expect((await get('','Bearer forged')).status).toBe(401);expect((await get('?headquarters=true')).status).toBe(422);expect(calls).toHaveLength(0);
  expect((await get('')).status).toBe(200);expect(calls[0]).toEqual([actor,undefined]);
  const company='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';expect((await get('?companyId='+company)).status).toBe(200);expect(calls[1]).toEqual([actor,company]);
 });
});
