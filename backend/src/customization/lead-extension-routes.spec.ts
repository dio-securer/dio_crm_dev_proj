import { ConfiguredLeadGateway } from './lead-gateway';
import { executeLeadLifecycle } from './lead-lifecycle-http';

const companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',id='11111111-1111-4111-8111-111111111111',recordId='55555555-5555-4555-8555-555555555555';
const actor={companyId,id};
const request=(method:string,path:string,body:unknown,query:Record<string,string>={})=>({method,path,body,query,headers:{'x-config-release-id':recordId,'x-config-permission-version':'1','idempotency-key':'key'}} as any);
describe('explicit lead extension routing',()=>{
 it('rejects extension create, detail read and detail write without a provider',async()=>{
  const gateway=new ConfiguredLeadGateway({} as any);
  await expect(executeLeadLifecycle({} as any,request('POST','/api/leads',{base:{},extensions:{}}),actor,7)).rejects.toMatchObject({code:'EXTENSION_ADAPTER_UNAVAILABLE'});
  await expect(gateway.handle(request('PATCH','/api/leads/'+recordId,{base:{},extensions:{}}),actor,7)).rejects.toMatchObject({code:'EXTENSION_ADAPTER_UNAVAILABLE'});
  await expect(gateway.handle(request('GET','/api/leads/'+recordId,null,{extensions:'1'}),actor,7)).rejects.toMatchObject({code:'EXTENSION_ADAPTER_UNAVAILABLE'});
 });
 it('ordinary detail reads stay on existing gateway',async()=>{
  const readSqlFields=jest.fn(async()=>({releaseId:recordId,permissionVersion:1,data:{hospital_name:'Clinic'}}));
  const gateway=new ConfiguredLeadGateway({readSqlFields} as any);
  const result=await gateway.handle(request('GET','/api/leads/'+recordId,null),actor,7);
  expect(readSqlFields).toHaveBeenCalledTimes(1);expect(result.data).toMatchObject({hospital_name:'Clinic'});
 });
});
