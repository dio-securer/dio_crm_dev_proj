const mockTransactions:any[]=[];const mockRequests:any[]=[];
jest.mock('mssql',()=>{
 class Transaction {begin=jest.fn(async()=>{});commit=jest.fn(async()=>{});rollback=jest.fn(async()=>{});constructor(){mockTransactions.push(this);}}
 class Request {input=jest.fn();query=jest.fn(async()=>({recordset:[],rowsAffected:[]}));constructor(public tx:any){mockRequests.push(this);}}
 return {__esModule:true,default:{ConnectionPool:class{}},Transaction,Request};
});
import {DatabaseService} from './database.service';
import {SqlAdminConfigRepository} from '../customization/sql-config-store';
describe('shared transaction scope',()=>{
 beforeEach(()=>{mockTransactions.length=0;mockRequests.length=0;});
 const db=()=>{const value=new DatabaseService();jest.spyOn(value as any,'getPool').mockResolvedValue({});return value;};
 it('SQL delivery reservation cannot join any ambient provider transaction',async()=>{const first=db(),second=db(),repo=new SqlAdminConfigRepository(second);expect(()=>repo.assertDeliveryBoundary()).not.toThrow();await first.transaction(async()=>{expect(first.hasActiveTransaction()).toBe(true);expect(()=>repo.assertDeliveryBoundary()).toThrow('AMBIENT_DELIVERY_TRANSACTION');});expect(second.hasActiveTransaction()).toBe(false);});
 it('nested config/domain providers use one transaction and commit once',async()=>{const first=db(),second=db();await first.transaction(async()=>{await second.transaction(async()=>{await first.query('domain write');await second.query('config write');});});expect(mockTransactions).toHaveLength(1);expect(mockRequests).toHaveLength(2);expect(mockRequests.every(r=>r.tx===mockTransactions[0])).toBe(true);expect(mockTransactions[0].commit).toHaveBeenCalledTimes(1);});
 it('caught inner failure marks the outer transaction rollback-only',async()=>{const value=db();await expect(value.transaction(async()=>{try{await value.transaction(async()=>{await value.query('partial write');throw Error('inner');});}catch{}return true;})).rejects.toThrow('NESTED_TRANSACTION_ABORTED');expect(mockTransactions[0].rollback).toHaveBeenCalledTimes(1);expect(mockTransactions[0].commit).not.toHaveBeenCalled();});
 it('concurrent unrelated requests do not share transactions',async()=>{const value=db();await Promise.all([value.transaction(async()=>{await Promise.resolve();await value.query('one');}),value.transaction(async()=>{await value.query('two');})]);expect(mockTransactions).toHaveLength(2);expect(new Set(mockRequests.map(r=>r.tx)).size).toBe(2);});
 it('rollback completion hook runs after outer rollback with fresh transaction scope',async()=>{const value=db(),flags:boolean[]=[];await expect(value.transaction(async()=>{await value.transaction(async()=>{value.afterTransaction(async committed=>{flags.push(committed);await value.transaction(async()=>{await value.query('failure audit');});});});throw Error('outer failed');})).rejects.toThrow('outer failed');expect(flags).toEqual([false]);expect(mockTransactions).toHaveLength(2);expect(mockTransactions[0].rollback).toHaveBeenCalledTimes(1);expect(mockTransactions[1].commit).toHaveBeenCalledTimes(1);});
});
