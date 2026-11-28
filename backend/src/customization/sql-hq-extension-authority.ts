import {createHash} from 'node:crypto';
import {canonicalConfigJson} from '@dio-crm/contracts/crm-customization';
import {configAssert,type ConfigTransaction} from './config-store.js';
import type {HqExtensionDeploymentAuthority} from './config-service.js';

type Domain=NonNullable<ConfigTransaction['domain']>;
type Reference={id:string;version:number};
type Registry={id:string;fields:Reference[]};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash=(value:unknown)=>createHash('sha256').update(canonicalConfigJson(value)).digest('hex');
const same=(a:unknown,b:unknown)=>canonicalConfigJson(a)===canonicalConfigJson(b);
function refs(value:unknown):Reference[]{
 configAssert(Array.isArray(value)&&value.length>0&&value.length<=100&&value.every(item=>item&&typeof item==='object'&&Object.keys(item).length===2&&typeof item.id==='string'&&uuid.test(item.id)&&item.id===item.id.toLowerCase()&&Number.isSafeInteger(item.version)&&item.version>0&&item.version<=2147483647),503,'HQ_REGISTRY_INVALID');
 const ordered=[...value].sort((a,b)=>a.id.localeCompare(b.id));configAssert(new Set(ordered.map(item=>item.id)).size===ordered.length,503,'HQ_REGISTRY_INVALID');return ordered;
}
/** Opt-in SQL authority for the draft HQ registry schema. The default module provider
 * remains null until the reviewed schema and distribution writer are installed. */
export class SqlHqExtensionDeploymentAuthority implements HqExtensionDeploymentAuthority {
 async assertPublisher(domain:Domain,actorId:string,companyId:string):Promise<void>{
  configAssert(uuid.test(actorId)&&uuid.test(companyId),400,'INVALID_CONTEXT');
  const r=await domain.query<{user_id:number}>("SELECT u.user_id FROM dbo.crm_user u WITH(UPDLOCK,HOLDLOCK) JOIN dbo.crm_hq_field_administrator h WITH(UPDLOCK,HOLDLOCK) ON h.user_id=u.user_id WHERE u.public_id=@actorId AND u.is_active=1 AND u.deleted_yn=0 AND h.is_active=1 AND h.can_distribute=1",{actorId});
  configAssert(r.recordset.length===1,403,'HQ_PUBLISHER_REQUIRED');
 }
 private async registry(domain:Domain,id:string):Promise<Registry>{
  configAssert(uuid.test(id)&&id===id.toLowerCase(),503,'HQ_REGISTRY_INVALID');
  const r=await domain.query<{payload_json:string;content_hash:string}>("SELECT payload_json,content_hash FROM dbo.crm_hq_extension_release WITH(UPDLOCK,HOLDLOCK) WHERE release_id=@hqReleaseId",{hqReleaseId:id});
  configAssert(r.recordset.length===1,409,'HQ_RELEASE_UNAVAILABLE');const row=r.recordset[0],value=JSON.parse(row.payload_json) as Registry;
  configAssert(value&&Object.keys(value).length===2&&value.id===id&&row.content_hash===hash(value),503,'HQ_REGISTRY_INVALID');const fields=refs(value.fields);
  configAssert(same(value.fields,fields),503,'HQ_REGISTRY_INVALID');
  const versions=await domain.query<{field_id:string;definition_version:number}>("SELECT field_id,definition_version FROM dbo.crm_hq_extension_release_field WITH(UPDLOCK,HOLDLOCK) WHERE release_id=@hqReleaseId ORDER BY field_id",{hqReleaseId:id});
  configAssert(same(versions.recordset.map(row=>({id:String(row.field_id).toLowerCase(),version:Number(row.definition_version)})),fields),503,'HQ_REGISTRY_INVALID');
  return {id,fields};
 }
 verifyHqRelease=async(domain:Domain,hqReleaseId:string,references:Reference[]):Promise<boolean>=>{
  const registered=await this.registry(domain,hqReleaseId);return same(registered.fields,refs(references));
 };
 async selectedForTarget(domain:Domain,_companyId:string):Promise<{hqReleaseId:string;fields:Reference[]}>{
  const selected=await domain.query<{release_id:string}>("SELECT h.release_id FROM dbo.crm_hq_extension_target_head h WITH(UPDLOCK,HOLDLOCK) JOIN dbo.crm_company c WITH(HOLDLOCK) ON c.company_id=h.company_id WHERE h.company_id=@companyKey AND c.is_active=1",{companyKey:domain.companyKey});
  configAssert(selected.recordset.length===1,409,'HQ_TARGET_NOT_ASSIGNED');const hqReleaseId=String(selected.recordset[0].release_id).toLowerCase(),registered=await this.registry(domain,hqReleaseId);
  const assigned=await domain.query<{field_id:string;definition_version:number}>("SELECT field_id,definition_version FROM dbo.crm_standard_extension_assignment WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey ORDER BY field_id",{companyKey:domain.companyKey});
  const items=assigned.recordset.map(row=>({id:String(row.field_id).toLowerCase(),version:Number(row.definition_version)}));
  configAssert(same(items,registered.fields),409,'HQ_TARGET_DEFINITIONS_CHANGED');
  return {hqReleaseId,fields:registered.fields};
 }
}
