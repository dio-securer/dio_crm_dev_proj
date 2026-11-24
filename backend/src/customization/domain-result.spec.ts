import {completeDomainDelivery} from './domain-outbox';import {emptyConfigState,type ConfigTransaction} from './config-store';
const actor={id:'actor',companyId:'company'},input={requestId:'request',interfaceCode:'IF-ERP-002',entityId:'account',success:true,result:{success:true,code:'ERP1'}};
describe('correlated domain result completion',()=>{
 function fixture(){
  const state=emptyConfigState('company',{actor:{active:true,permissions:['runtime.write','INTEGRATION.RESULT.WRITE'],denied:[]}});state.outbox.push({id:'request',type:'DOMAIN_DELIVERY',releaseId:'old',status:'SENT',delivery:{actorId:'former-sender',permissionVersion:1,actionId:'ACC.erpRequest',interfaceCode:'IF-ERP-002',entityId:'account',sourceFieldIds:[],payload:{},attempts:1,unknownOutcome:false,lastError:null}});state.pendingActions['ACC.erpRequest']=1;let applied=0,fail=false;
  const tx:ConfigTransaction={state,identityActive:true,domain:{companyKey:9,query:async()=>{if(fail)throw Error('commit work failure');return {recordset:[],rowsAffected:[1]};}}};
  return {tx,get applied(){return applied;},fail:()=>fail=true,run:(change={})=>completeDomainDelivery(tx,actor,{...input,...change},async()=>{applied++;})};
 }
 it('authoritative result closes the original sender pending action once',async()=>{const f=fixture();await f.run();await f.run();expect(f.applied).toBe(1);expect(f.tx.state.pendingActions['ACC.erpRequest']).toBe(0);});
 it('conflicting result with same request cannot overwrite',async()=>{const f=fixture();await f.run();await expect(f.run({result:{success:true,code:'ERP2'}})).rejects.toMatchObject({code:'DELIVERY_RESULT_CONFLICT'});expect(f.applied).toBe(1);});
 it('unsent or cancelled job cannot receive result',async()=>{const f=fixture();f.tx.state.outbox[0].status='PENDING';await expect(f.run()).rejects.toMatchObject({code:'DELIVERY_RESULT_NOT_EXPECTED'});expect(f.applied).toBe(0);});
 it('unknown attempt under review can reconcile after sender revocation',async()=>{const f=fixture(),item=f.tx.state.outbox[0];item.status='REVIEW_REQUIRED';item.delivery!.unknownOutcome=true;await f.run();expect(item.delivery!.completion?.success).toBe(true);});
 it('wrong company request/entity or interface cannot correlate',async()=>{const f=fixture();await expect(f.run({entityId:'other'})).rejects.toMatchObject({code:'NOT_FOUND'});await expect(f.run({interfaceCode:'IF-ERP-004'})).rejects.toMatchObject({code:'NOT_FOUND'});expect(f.applied).toBe(0);});
 it('current integration permission required even on duplicate completion',async()=>{const f=fixture();await f.run();f.tx.state.members.actor.denied=['INTEGRATION.RESULT.WRITE'];await expect(f.run()).rejects.toMatchObject({code:'PERMISSION_DENIED'});});
});
