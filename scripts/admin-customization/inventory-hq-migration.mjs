import fs from 'node:fs';
import {createHqApplication} from '../hq-standard/runtime.mjs';
// Read-only inventory: no HTTP server, repository reads, DB or network.
const app=createHqApplication(),artifact=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-codes-review.json','utf8'));
const entries=new Map(artifact.catalog.entries.map(e=>[e.id,e]));
const managed=JSON.parse(fs.readFileSync('docs/admin-platform/customization/implementation/evidence/I02/managed-route-inventory.json','utf8'));
const normalize=route=>route.replace(/:[^/]+/g,':id');
const managedRoutes=new Set(managed.routes.filter(r=>r.managedStatus!=='PUBLIC'&&r.managedStatus!=='BLOCKED_NOT_ADAPTED').map(r=>r.method+' '+normalize(r.route)));
const matchesManaged=endpoint=>{const source=normalize(endpoint).split('/');return [...managedRoutes].some(route=>{const parts=route.split('/');return parts.length===source.length&&parts.every((part,i)=>part===':id'||part===source[i]);});};
const rows=[];
for(const [kind,items,key] of [['SCREEN',app.standard.screens,'screenKey'],['FIELD',app.standard.fields,'fieldKey'],['ACTION',app.standard.actions,'actionKey']]){
 for(const item of items){
  const id=item[key],target=entries.get(id),issues=[];
  if(kind==='ACTION'&&item.endpoint&&!matchesManaged(item.endpoint))issues.push('NO_MATCHING_MANAGED_ROUTE');
  if(!target)issues.push('MISSING_COMMON_ENTRY');
  else{
   if(target.kind!==kind)issues.push('KIND_MISMATCH');
   if(target.support!=='supported')issues.push('COMMON_ENTRY_UNSUPPORTED');
   if(kind==='FIELD'&&item.current?.apiField&&target.apiField&&item.current.apiField!==target.apiField)issues.push('API_FIELD_MAPPING_REQUIRED');
   if(kind==='ACTION'&&item.endpoint&&target.endpoint&&item.endpoint!==target.endpoint)issues.push('ENDPOINT_MAPPING_REQUIRED');
  }
  rows.push({kind,id,sourceEndpoint:item.endpoint??null,sourceApiField:item.current?.apiField??null,targetApiField:target?.apiField??null,status:issues.length?'REQUIRES_MIGRATION':'IDENTITY_MATCH_ONLY',issues});
 }
}
const report={stage:'I02 step 4',status:'INCOMPLETE',scope:'HQ mock identities compared with common review catalog. Matching IDs do not prove DTO, policy or workflow compatibility.',artifactId:artifact.id,publicationReady:artifact.publicationReady,counts:{total:rows.length,requiresMigration:rows.filter(r=>r.issues.length).length,identityMatchOnly:rows.filter(r=>!r.issues.length).length},rows};
fs.writeFileSync('docs/admin-platform/customization/implementation/evidence/I02/hq-migration-inventory.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.counts));
