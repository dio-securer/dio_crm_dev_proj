import {randomUUID} from 'node:crypto';
import {configAssert,type AdminConfigRepository,type ConfigState,type ConfigTransaction} from './config-store.js';
import type {LeadExtensionAtomicPort,LeadExtensionAtomicTransaction,LeadExtensionActor,LeadExtensionPublication,LeadExtensionRow,LeadExtensionValues} from './lead-extension-contract.js';

type Domain=NonNullable<ConfigTransaction['domain']>;
type Mode='create'|'detail';
/** These hooks must be implemented from reviewed SQL release-snapshot and base-row contracts.
 * The HQ assignment draft table alone is not a publication authority. */
export interface SqlLeadExtensionTrust {
 loadPublishedSnapshot:(domain:Domain,state:ConfigState)=>Promise<LeadExtensionPublication|null>;
 loadLead:(domain:Domain,recordId:string)=>Promise<LeadExtensionRow|null>;
 readBase?:(domain:Domain,state:ConfigState,actor:LeadExtensionActor,row:LeadExtensionRow)=>Promise<Record<string,unknown>>;
 canWriteRow?:(domain:Domain,state:ConfigState,actor:LeadExtensionActor,row:LeadExtensionRow)=>Promise<boolean>;
 assertBaseWrite:(domain:Domain,state:ConfigState,actor:LeadExtensionActor,mode:Mode,base:Record<string,unknown>,row:LeadExtensionRow|null)=>Promise<void>;
 writeBase:(domain:Domain,state:ConfigState,actor:LeadExtensionActor,mode:Mode,base:Record<string,unknown>,row:LeadExtensionRow|null)=>Promise<LeadExtensionRow>;
 /** Current database role grant, intersected below with the current ConfigState membership. */
 currentFieldGrant:(domain:Domain,actorId:string,fieldId:string,operation:'read'|'write')=>Promise<boolean>;
}
/** SQL-oriented port for the E06 contract, intentionally not registered in a controller.
 * A configured SqlAdminConfigRepository supplies one transaction for config, base row,
 * extension values, audit and receipt. No live DB or migration is invoked here. */
export class SqlLeadExtensionAtomicPort implements LeadExtensionAtomicPort {
 constructor(private readonly repository:AdminConfigRepository,private readonly trust?:SqlLeadExtensionTrust){}
 transact<T>(companyId:string,actorId:string,work:(tx:LeadExtensionAtomicTransaction)=>Promise<T>):Promise<T>{
  configAssert(this.trust,503,'EXTENSION_ADAPTER_UNAVAILABLE');
  const trust=this.trust;
  return this.repository.transact(companyId,actorId,async configTx=>{
   configAssert(configTx.domain,503,'SQL_DOMAIN_REQUIRED');
   const domain=configTx.domain,state=configTx.state,actor={id:actorId,companyId};
   const publication=await trust.loadPublishedSnapshot(domain,state);
   // A loader must return an immutable snapshot keyed to the active ConfigRelease. The
   // contract checks company, release ID, field versions and actor policy after this call.
   const leadId=async(recordId:string)=>{const r=await domain.query<{lead_id:number}>('SELECT lead_id FROM dbo.crm_lead WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@recordId AND deleted_yn=0',{companyKey:domain.companyKey,recordId});configAssert(r.recordset.length===1,404,'NOT_FOUND');const id=Number(r.recordset[0].lead_id);configAssert(Number.isSafeInteger(id)&&id>0,500,'INVALID_LEAD_KEY');return id;};
   const tx:LeadExtensionAtomicTransaction={
    state,identityActive:configTx.identityActive,publication,
    assertBaseWrite:(mode,base,row)=>trust.assertBaseWrite(domain,state,actor,mode,base,row),
    loadLead:id=>trust.loadLead(domain,id),
    ...(trust.readBase?{readBase:(row:LeadExtensionRow)=>trust.readBase!(domain,state,actor,row)}:{}),
    ...(trust.canWriteRow?{canWriteRow:(row:LeadExtensionRow)=>trust.canWriteRow!(domain,state,actor,row)}:{}),
    writeBase:(mode,base,row)=>trust.writeBase(domain,state,actor,mode,base,row),
    readExtensions:async recordId=>{
     const id=await leadId(recordId);
     const r=await domain.query<{revision:number;payload_json:string}>('SELECT revision,payload_json FROM dbo.crm_extension_values WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND lead_id=@leadId',{companyKey:domain.companyKey,leadId:id});
     configAssert(r.recordset.length<=1,500,'INVALID_EXTENSION_STATE');
     return r.recordset[0]?{revision:Number(r.recordset[0].revision),values:JSON.parse(r.recordset[0].payload_json)}:{revision:0,values:{}};
    },
    writeExtensions:async(recordId,expectedRevision,next)=>{
     const id=await leadId(recordId),params={companyKey:domain.companyKey,leadId:id,expectedRevision,revision:next.revision,payload:JSON.stringify(next.values)};
     if(expectedRevision===0){const r=await domain.query('INSERT INTO dbo.crm_extension_values(company_id,lead_id,revision,payload_json) VALUES(@companyKey,@leadId,@revision,@payload)',params);configAssert(r.rowsAffected?.[0]===1,409,'RECORD_CONFLICT');}
     else {const r=await domain.query('UPDATE dbo.crm_extension_values SET revision=@revision,payload_json=@payload WHERE company_id=@companyKey AND lead_id=@leadId AND revision=@expectedRevision',params);configAssert(r.rowsAffected?.[0]===1,409,'RECORD_CONFLICT');}
    },
    fieldAccess:async(id,fieldId,operation)=>{
     const member=state.members[id];if(!member?.active)return false;
     const permission=`fields.${fieldId}.${operation}`;
     return member.permissions.includes(permission)&&!member.denied.includes(permission)&&await trust.currentFieldGrant(domain,id,fieldId,operation);
    },
    audit:async(operation,recordId,id)=>{const r=await domain.query('INSERT INTO dbo.crm_extension_audit(company_id,public_id,actor_public_id,operation,target_public_id,occurred_at) VALUES(@companyKey,@id,@actorId,@operation,@targetId,SYSUTCDATETIME())',{companyKey:domain.companyKey,id:randomUUID(),actorId:id,operation,targetId:recordId});configAssert(r.rowsAffected?.[0]===1,500,'EXTENSION_AUDIT_FAILED');}
   };
   return work(tx);
  });
 }
}
