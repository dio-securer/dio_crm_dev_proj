import {ContractService} from './contract.service';

describe('legacy initial collection plan preservation',()=>{
 const rows=[{installmentNo:1,collectionMethod:'BANK',amount:100,plannedDate:'2026-12-01'}];
 function fixture(existing:Array<{collection_plan_id:number;installment_no:number}>) {
  const writes:string[]=[];
  const query=async(sql:string)=>{
   if(sql.startsWith('SELECT TOP 1 c.*')) return {recordset:[{contract_id:7,status:'DRAFT',contract_amount:100}]};
   if(sql.startsWith('SELECT collection_plan_id,installment_no')) return {recordset:existing};
   writes.push(sql);return {recordset:[],rowsAffected:[1]};
  };
  const service=new ContractService({transaction:async(fn:any)=>fn(query)} as any,{} as any);
  return {writes,run:()=>service.replaceInitialPlan(1,'test',rows,2)};
 }
 it('updates an existing installment without deleting its identity',async()=>{const f=fixture([{collection_plan_id:10,installment_no:1}]);await f.run();expect(f.writes.some(q=>q.startsWith('DELETE'))).toBe(false);expect(f.writes.some(q=>q.startsWith('UPDATE crm_collection_plan SET collection_method'))).toBe(true);});
 it('refuses to discard an omitted installment',async()=>{const f=fixture([{collection_plan_id:10,installment_no:2}]);await expect(f.run()).rejects.toThrow('preservation');expect(f.writes).toHaveLength(0);});
});
