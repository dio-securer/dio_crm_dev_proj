import {createHash} from 'node:crypto';
import {canonicalConfigJson} from '@dio-crm/contracts/crm-customization';
import {configAssert,type ConfigRelease,type ConfigState,type ConfigTransaction} from './config-store.js';
import {configReleaseHash} from './release-integrity.js';
import {validDefinition,type LeadExtensionPublication,type PublishedLeadField} from './lead-extension-contract.js';

type Domain=NonNullable<ConfigTransaction['domain']>;
type Reference={id:string;version:number};
type Snapshot=LeadExtensionPublication&{configContentHash:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash=(value:unknown)=>createHash('sha256').update(canonicalConfigJson(value)).digest('hex');
/** The HQ release registry is not in the draft DDL yet. A trusted implementation must
 * verify it inside this same SQL transaction; omission fails closed. */
export type VerifyHqRelease=(domain:Domain,hqReleaseId:string,references:Reference[])=>Promise<boolean>;
function configRelease(state:ConfigState,id:string){const release=state.releases[id];configAssert(release&&release.companyId===state.companyId&&release.id===id,409,'CONFIG_RELEASE_UNAVAILABLE');configAssert(release.contentHash===configReleaseHash(release),503,'CONFIG_INTEGRITY_FAILED');return release;}
function references(input:Reference[]){configAssert(Array.isArray(input)&&input.length<=100&&input.every(item=>item&&typeof item.id==='string'&&uuid.test(item.id)&&item.id===item.id.toLowerCase()&&Number.isSafeInteger(item.version)&&item.version>0&&item.version<=2147483647)&&new Set(input.map(item=>item.id)).size===input.length,422,'INVALID_EXTENSION_REFERENCES');return [...input].sort((a,b)=>a.id.localeCompare(b.id));}
async function resolveDefinitions(domain:Domain,items:Reference[]){const fields:PublishedLeadField[]=[];for(const item of items){
 const r=await domain.query<{field_id:string;definition_version:number;payload_json:string}>("SELECT f.public_id field_id,v.definition_version,v.payload_json FROM dbo.crm_standard_extension_field f WITH(UPDLOCK,HOLDLOCK) JOIN dbo.crm_standard_extension_field_version v WITH(UPDLOCK,HOLDLOCK) ON v.field_id=f.public_id JOIN dbo.crm_standard_extension_assignment a WITH(UPDLOCK,HOLDLOCK) ON a.field_id=v.field_id AND a.definition_version=v.definition_version WHERE a.company_id=@companyKey AND f.entity_type='lead' AND f.public_id=@fieldId AND v.definition_version=@version",{companyKey:domain.companyKey,fieldId:item.id,version:item.version});
 configAssert(r.recordset.length===1,422,'HQ_DEFINITION_NOT_ASSIGNED');const row=r.recordset[0],payload=JSON.parse(row.payload_json) as Record<string,unknown>;
 const field:PublishedLeadField={id:item.id,version:item.version,type:payload.type as PublishedLeadField['type'],required:false,labels:payload.labels as Record<string,string>,...(payload.maxLength!==undefined?{maxLength:payload.maxLength as number}:{}),...(payload.min!==undefined?{min:payload.min as number}:{}),...(payload.max!==undefined?{max:payload.max as number}:{})};
 configAssert(row.field_id.toLowerCase()===item.id&&Number(row.definition_version)===item.version&&payload.id===item.id&&payload.version===item.version&&validDefinition(field),503,'HQ_DEFINITION_INVALID');
 fields.push(field);
 }return fields;}
/** Call only after the ConfigRelease row has been inserted within the same transaction.
 * Current SqlAdminConfigRepository writes releases after its work callback, so it cannot
 * call this for a new release yet. A reviewed persist hook/order change is required.
 * This function never activates a release, creates a HQ field or authorizes a caller. */
export async function insertExtensionReleaseSnapshot(tx:ConfigTransaction,configReleaseId:string,hqReleaseId:string,selected:Reference[],verifyHqRelease?:VerifyHqRelease):Promise<Snapshot>{
 configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');configAssert(verifyHqRelease,503,'HQ_RELEASE_REGISTRY_UNAVAILABLE');
 const state=tx.state,domain=tx.domain,release=configRelease(state,configReleaseId),items=references(selected);
 configAssert(uuid.test(hqReleaseId)&&hqReleaseId===hqReleaseId.toLowerCase(),422,'INVALID_HQ_RELEASE');
 configAssert(release.hqExtension?.hqReleaseId===hqReleaseId&&canonicalConfigJson(references(release.hqExtension.fields))===canonicalConfigJson(items),409,'HQ_EXTENSION_RELEASE_MISMATCH');
 const persisted=await domain.query<{payload_json:string}>('SELECT payload_json FROM dbo.crm_config_release WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND document_id=@releaseId',{companyKey:domain.companyKey,releaseId:release.id});
 configAssert(persisted.recordset.length===1,409,'CONFIG_RELEASE_NOT_PERSISTED');
 const stored=JSON.parse(persisted.recordset[0].payload_json) as ConfigRelease;
 configAssert(stored.id===release.id&&stored.companyId===state.companyId&&stored.contentHash===release.contentHash&&stored.contentHash===configReleaseHash(stored),503,'CONFIG_INTEGRITY_FAILED');
 configAssert(await verifyHqRelease(domain,hqReleaseId,items),409,'HQ_RELEASE_UNAVAILABLE');
 const fields=await resolveDefinitions(domain,items);
 const snapshot:Snapshot={companyId:state.companyId,configReleaseId:release.id,hqReleaseId,configContentHash:release.contentHash,fields};
 const existing=await domain.query<{content_hash:string}>('SELECT content_hash FROM dbo.crm_extension_release_snapshot WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND config_release_id=@releaseId',{companyKey:domain.companyKey,releaseId:release.id});configAssert(existing.recordset.length===0,409,'EXTENSION_SNAPSHOT_EXISTS');
 const r=await domain.query('INSERT INTO dbo.crm_extension_release_snapshot(company_id,config_release_id,hq_release_id,payload_json,content_hash) VALUES(@companyKey,@releaseId,@hqReleaseId,@payload,@hash)',{companyKey:domain.companyKey,releaseId:release.id,hqReleaseId,payload:canonicalConfigJson(snapshot),hash:hash(snapshot)});
 configAssert(r.rowsAffected?.[0]===1,409,'EXTENSION_SNAPSHOT_WRITE_FAILED');return snapshot;
}
/** The business adapter reads only the active immutable release snapshot. */
export async function loadExtensionReleaseSnapshot(tx:ConfigTransaction,verifyHqRelease?:VerifyHqRelease):Promise<LeadExtensionPublication>{
 configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');configAssert(verifyHqRelease,503,'HQ_RELEASE_REGISTRY_UNAVAILABLE');
 const state=tx.state,domain=tx.domain;configAssert(state.activeReleaseId,409,'NO_ACTIVE_RELEASE');const release=configRelease(state,state.activeReleaseId);
 const r=await domain.query<{hq_release_id:string;payload_json:string;content_hash:string}>('SELECT hq_release_id,payload_json,content_hash FROM dbo.crm_extension_release_snapshot WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND config_release_id=@releaseId',{companyKey:domain.companyKey,releaseId:release.id});configAssert(r.recordset.length===1,409,'EXTENSION_RELEASE_UNAVAILABLE');
 const row=r.recordset[0],snapshot=JSON.parse(row.payload_json) as Snapshot;
 configAssert(row.content_hash===hash(snapshot)&&snapshot.companyId===state.companyId&&snapshot.configReleaseId===release.id&&snapshot.configContentHash===release.contentHash&&snapshot.hqReleaseId===row.hq_release_id.toLowerCase(),503,'EXTENSION_SNAPSHOT_INTEGRITY_FAILED');
 configAssert(release.hqExtension?.hqReleaseId===snapshot.hqReleaseId&&canonicalConfigJson(references(release.hqExtension.fields))===canonicalConfigJson(references(snapshot.fields.map(f=>({id:f.id,version:f.version})))),503,'EXTENSION_SNAPSHOT_INTEGRITY_FAILED');
 const items=references(snapshot.fields.map(f=>({id:f.id,version:f.version})));configAssert(await verifyHqRelease(domain,snapshot.hqReleaseId,items),409,'HQ_RELEASE_UNAVAILABLE');
 const verified=await resolveDefinitions(domain,items);configAssert(canonicalConfigJson(verified)===canonicalConfigJson(snapshot.fields),503,'EXTENSION_SNAPSHOT_INTEGRITY_FAILED');
 return {companyId:snapshot.companyId,configReleaseId:snapshot.configReleaseId,hqReleaseId:snapshot.hqReleaseId,fields:verified};
}
