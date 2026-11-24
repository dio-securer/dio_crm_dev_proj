import {ConfiguredLeadGateway} from './lead-gateway';
const actor={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',companyId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};
describe('configured lead list',()=>{
 const request=(query:unknown={})=>({method:'GET',path:'/api/leads',query}) as any;
 function fixture(permissions=['LEAD.READ'],denied:string[]=[]){
  const query=jest.fn().mockResolvedValue({recordset:[{company_id:9,public_id:actor.id,owner_user_id:7,hospital_name:'Clinic'}]});
  const readSqlList=jest.fn(async(_actor,_screen,adapter,_fields)=>({data:await adapter.load({companyKey:9,query},actor,{allowed:permissions,denied})}));
  return {query,readSqlList,gateway:new ConfiguredLeadGateway({readSqlList} as any)};
 }
 it('binds owner, status and literal search parameters inside current company scope',async()=>{const f=fixture();await f.gateway.handle(request({ownerUserId:'7',status:'NEW',search:'a%_[~'}),actor,7);expect(f.readSqlList.mock.calls[0][3]).toEqual(['lead.ownerUserId','lead.status','lead.hospitalName','lead.businessNo']);expect(f.query.mock.calls[0][0]).toContain('l.company_id=@companyKey');expect(f.query.mock.calls[0][0]).toContain('ORDER BY l.lead_id DESC');expect(f.query.mock.calls[0][1]).toEqual({companyKey:9,userKey:7,manage:0,ownerUserId:7,status:'NEW',search:'a~%~_~[~~',offset:0,limit:500});});
 it.each([{sort:'phone'},{ownerUserId:'1 OR 1=1'},{ownerUserId:['7','8']},{status:'BAD'},{search:['a','b']}])('rejects unsupported query %j before service execution',async input=>{const f=fixture();await expect(f.gateway.handle(request(input),actor,7)).rejects.toThrow();expect(f.readSqlList).not.toHaveBeenCalled();});
 it('checks current read revocation before SQL',async()=>{const f=fixture(['LEAD.READ'],['LEAD.READ']);await expect(f.gateway.handle(request(),actor,7)).rejects.toMatchObject({code:'PERMISSION_DENIED'});expect(f.query).not.toHaveBeenCalled();});
 it('does not trust token manager grants and rejects a wrong-owner row',async()=>{const f=fixture(['LEAD.READ','LEAD.MANAGE'],['LEAD.MANAGE']);f.query.mockResolvedValue({recordset:[{company_id:9,public_id:actor.id,owner_user_id:8}]});await expect(f.gateway.handle(request(),actor,7)).rejects.toMatchObject({code:'NOT_FOUND'});expect(f.query.mock.calls[0][1].manage).toBe(0);});
 it('allows current manager rows within company scope',async()=>{const f=fixture(['LEAD.READ','LEAD.MANAGE']);f.query.mockResolvedValue({recordset:[{company_id:9,public_id:actor.id,owner_user_id:8}]});await f.gateway.handle(request(),actor,7);expect(f.query.mock.calls[0][1].manage).toBe(1);});
});
