import {configAssert,type ConfigTransaction} from './config-store';

type Domain=NonNullable<ConfigTransaction['domain']>;
type Change={before:string|null;after:string|null};

/** Called inside the caller's existing SQL transaction after field authorization.
 * The row lock serializes status changes with edits; it is not a client version check. */
export async function prepareLeadExclusionChange(domain:Domain,publicId:string,columns:Record<string,unknown>):Promise<Change|null>{
 if(!Object.hasOwn(columns,'contact_exclude_reason'))return null;
 const next=columns.contact_exclude_reason;
 configAssert(next===null||typeof next==='string'&&next.length<=500,422,'INVALID_EXCLUSION_REASON');
 const found=await domain.query<{status:string;contact_exclude_reason:string|null}>('SELECT status,contact_exclude_reason FROM dbo.crm_lead WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@publicId AND deleted_yn=0',{companyKey:domain.companyKey,publicId});
 configAssert(found.recordset.length===1,404,'NOT_FOUND');
 const row=found.recordset[0],before=row.contact_exclude_reason??null,after=next as string|null;
 if(before===after)return null;
 // Keep legacy rows editable: enforce the existing transition invariant only when
 // changing the exclusion reason, not when saving an unrelated field.
 if(row.status==='CONTACT_EXCLUDED')configAssert(typeof after==='string'&&after.trim().length>0,422,'EXCLUSION_REASON_REQUIRED');
 return {before,after};
}

/** No history entry for unchanged values; a failed insert must roll back the row update. */
export async function auditLeadExclusionChange(domain:Domain,publicId:string,userKey:number,change:Change|null):Promise<void>{
 if(!change)return;
 const result=await domain.query("INSERT INTO dbo.crm_audit_log(company_id,actor_user_id,entity_type,entity_id,action,before_json,after_json) VALUES(@companyKey,@userKey,'LEAD',@publicId,'LEAD.exclusionReasonChanged',@beforeJson,@afterJson)",{companyKey:domain.companyKey,userKey,publicId,beforeJson:JSON.stringify({contactExcludeReason:change.before}),afterJson:JSON.stringify({contactExcludeReason:change.after})});
 configAssert(result.rowsAffected?.[0]===1,500,'LEAD_HISTORY_FAILED');
}
