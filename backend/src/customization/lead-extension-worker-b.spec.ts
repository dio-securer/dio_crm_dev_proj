import {executeLeadExtensionRequest,readLeadExtensionRequest} from './lead-extension-request';
import {ConfiguredLeadGateway} from './lead-gateway';
import {executeLeadLifecycle} from './lead-lifecycle-http';

const companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',id='11111111-1111-4111-8111-111111111111',record='55555555-5555-4555-8555-555555555555',actor={companyId,id};
const req=(method:string,body:unknown,query:Record<string,string>={})=>({method,path:method==='POST'?'/api/leads':'/api/leads/'+record,body,query,headers:{'x-config-release-id':record,'x-config-permission-version':'1','idempotency-key':'x'}} as any);
describe('worker B lead extension routing boundary',()=>{
 it('explicit envelope and metadata cannot fall back when provider absent',async()=>{
  const gateway=new ConfiguredLeadGateway({} as any);
  await expect(executeLeadLifecycle({} as any,req('POST',{base:{},extensions:{}}),actor,7)).rejects.toMatchObject({code:'EXTENSION_ADAPTER_UNAVAILABLE'});
  await expect(gateway.handle(req('PATCH',{base:{},extensions:{}}),actor,7)).rejects.toMatchObject({code:'EXTENSION_ADAPTER_UNAVAILABLE'});
  await expect(readLeadExtensionRequest(req('GET',null),actor,7,'create')).rejects.toMatchObject({code:'EXTENSION_ADAPTER_UNAVAILABLE'});
 });
 it('rejects unknown envelope properties and invalid revision before entering port',async()=>{
  const port=jest.fn(()=>{throw new Error('must not enter')});
  await expect(executeLeadExtensionRequest(req('POST',{base:{},extensions:{},companyId}),actor,7,'create',port)).rejects.toThrow();
  await expect(executeLeadExtensionRequest(req('PATCH',{base:{},extensions:{},expectedBaseVersion:'0x0000000000000001',expectedExtensionRevision:2147483647}),actor,7,'detail',port)).rejects.toThrow();
  expect(port).not.toHaveBeenCalled();
 });
 it('ordinary GET continues through existing readSqlFields',async()=>{
  const readSqlFields=jest.fn(async()=>({releaseId:record,permissionVersion:1,data:{hospital_name:'Clinic'}}));const gateway=new ConfiguredLeadGateway({readSqlFields} as any);
  expect((await gateway.handle(req('GET',null),actor,7)).data).toEqual({hospital_name:'Clinic',public_id:record,public_id_text:record});expect(readSqlFields).toHaveBeenCalledTimes(1);
 });
});
