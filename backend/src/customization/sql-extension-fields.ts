import { configAssert } from './config-store.js';
import type { ExtensionRepository, ExtensionTransaction, ExtensionField, ExtensionValues } from './extension-fields.js';
type Result={recordset:Record<string,unknown>[];rowsAffected?:number[]};
export type ExtensionSqlConnection={companyKey:number;query:(sql:string,parameters:Record<string,unknown>)=>Promise<Result>};
/** Caller supplies an actual atomic transaction with company identity resolved by trusted code.
 * Not registered in ConfigModule; DDL and storage-policy approval are deployment prerequisites. */
export class SqlExtensionRepository implements ExtensionRepository {
 constructor(private readonly atomic:<T>(companyId:string,work:(db:ExtensionSqlConnection)=>Promise<T>)=>Promise<T>){}
 transaction<T>(companyId:string,work:(tx:ExtensionTransaction)=>Promise<T>):Promise<T>{return this.atomic(companyId,async db=>{
  const params={companyKey:db.companyKey};
  const decode=(row:Record<string,unknown>)=>{const field=JSON.parse(String(row.payload_json)) as ExtensionField;configAssert(field.companyId===companyId,500,'FIELD_SCOPE_INVALID');return field;};
  const tx:ExtensionTransaction={
   authorize:async(actor,operation,recordId,fieldId)=>{
    if(actor.companyId!==companyId)return false;
    // Company membership alone can never authorize standard field creation.
    // HQ creation and distribution require the separately fenced publication contract.
    if(operation==='define')return false;
    // Identity -> company -> membership/row, matching configuration publication fences.
    const identity=await db.query('SELECT user_id FROM crm_user WITH(UPDLOCK,HOLDLOCK) WHERE public_id=@actorId AND is_active=1 AND deleted_yn=0',{actorId:actor.id});if(identity.recordset.length!==1)return false;
    const state=await db.query('SELECT s.company_id FROM crm_config_company_state s WITH(UPDLOCK,HOLDLOCK) JOIN crm_company c WITH(HOLDLOCK) ON c.company_id=s.company_id WHERE s.company_id=@companyKey AND c.is_active=1',params);if(state.recordset.length!==1)return false;
    const r=await db.query('SELECT user_id,payload_json FROM crm_config_membership WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND user_id=@userId',{...params,userId:identity.recordset[0].user_id});
    if(r.recordset.length!==1)return false;
    const member=JSON.parse(String(r.recordset[0].payload_json));
    if(!member?.active||!Array.isArray(member.permissions)||!Array.isArray(member.denied))return false;
    const grants=(permission:string)=>member.permissions.includes(permission)&&!member.denied.includes(permission);
    const needed=operation==='read'?['runtime.read','LEAD.READ','fields.read']:['runtime.write','LEAD.WRITE','fields.write'];
    if(fieldId)needed.push(`fields.${fieldId}.${operation}`);
    if(!needed.every(grants))return false;
    if(recordId){const rows=await db.query('SELECT owner_user_id,status FROM crm_lead WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@recordId AND deleted_yn=0',{...params,recordId});if(rows.recordset.length!==1||rows.recordset[0].owner_user_id!==r.recordset[0].user_id&&!grants('LEAD.MANAGE')||operation==='write'&&rows.recordset[0].status==='CONVERTED')return false;}
    return true;
   },
   definition:async id=>{const r=await db.query('SELECT payload_json FROM crm_extension_field WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@id',{...params,id});return r.recordset[0]?decode(r.recordset[0]):null;},
   definitions:async()=>{const r=await db.query('SELECT payload_json FROM crm_extension_field WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey',params);return r.recordset.map(decode);},
   putDefinition:async(field,expectedVersion)=>{
    configAssert(field.companyId===companyId,422,'FIELD_SCOPE_INVALID');
    const input={...params,id:field.id,key:field.key,version:field.version,payload:JSON.stringify(field),expectedVersion};
    if(expectedVersion===null)await db.query('INSERT INTO crm_extension_field(company_id,public_id,field_key,definition_version,payload_json) VALUES(@companyKey,@id,@key,@version,@payload)',input);
    else {const r=await db.query('UPDATE crm_extension_field SET definition_version=@version,payload_json=@payload WHERE company_id=@companyKey AND public_id=@id AND definition_version=@expectedVersion',input);configAssert(r.rowsAffected?.[0]===1,409,'FIELD_VERSION_CHANGED');}
   },
   values:async recordId=>{
    const lead=await db.query('SELECT lead_id FROM crm_lead WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@recordId AND deleted_yn=0',{...params,recordId});configAssert(lead.recordset.length===1,404,'NOT_FOUND');
    const r=await db.query('SELECT revision,payload_json FROM crm_extension_values WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND lead_id=@leadId',{...params,leadId:lead.recordset[0].lead_id});
    return {companyId,recordId,revision:Number(r.recordset[0]?.revision??0),values:r.recordset[0]?JSON.parse(String(r.recordset[0].payload_json)): {}};
   },
   putValues:async(row,expectedRevision)=>{
    configAssert(row.companyId===companyId,422,'FIELD_SCOPE_INVALID');
    const lead=await db.query('SELECT lead_id FROM crm_lead WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@recordId AND deleted_yn=0',{...params,recordId:row.recordId});configAssert(lead.recordset.length===1,404,'NOT_FOUND');
    const input={...params,leadId:lead.recordset[0].lead_id,revision:row.revision,expectedRevision,payload:JSON.stringify(row.values)};
    if(expectedRevision===0)await db.query('INSERT INTO crm_extension_values(company_id,lead_id,revision,payload_json) VALUES(@companyKey,@leadId,@revision,@payload)',input);
    else {const result=await db.query('UPDATE crm_extension_values SET revision=@revision,payload_json=@payload WHERE company_id=@companyKey AND lead_id=@leadId AND revision=@expectedRevision',input);configAssert(result.rowsAffected?.[0]===1,409,'RECORD_CONFLICT');}
   },
   audit:async event=>{await db.query('INSERT INTO crm_extension_audit(company_id,public_id,actor_public_id,operation,target_public_id,occurred_at) VALUES(@companyKey,@id,@actorId,@operation,@targetId,@at)',{...params,...event});}
  };
  return work(tx);
 });}
}
