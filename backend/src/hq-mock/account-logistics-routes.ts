import {hqOnlyKeys,hqText,type HqApplication,type HqRouteContext} from './app.js';
import {requireAccountRelatedAccess} from './account-related-routes.js';
import {auditHq,canonicalHq,hqAssert,newHqId,type HqRow} from './model.js';

const schemas={destinations:['name','recipient','phone','postalCode','address','detailAddress','note'],rentals:['name','serialNumber','installedOn','endsOn','ended','note']} as const;
type Item=HqRow&{deleted:boolean;requestKey:string;fingerprint:string};
const rows=(parent:HqRow,key:string):Item[]=>Array.isArray(parent[key])?parent[key] as Item[]:[];
const visible=({requestKey,fingerprint,...row}:Item)=>row;
function values(c:HqRouteContext,kind:keyof typeof schemas){
 const out:Record<string,unknown>={name:hqText(c.body.name,'name',200)};
 for(const field of schemas[kind]){
  if(field==='name')continue;
  if(field==='ended'){hqAssert(c.body.ended===undefined||typeof c.body.ended==='boolean',400,'RENTAL_ENDED_INVALID');out.ended=c.body.ended??false;continue;}
  const value=c.body[field]??'';hqAssert(typeof value==='string'&&value.length<=(field==='note'?4000:500),400,'RELATED_FIELD_INVALID',field);out[field]=value.trim();
 }
 if(kind==='destinations')out.address=hqText(c.body.address,'address',500);
 else {
  for(const field of ['installedOn','endsOn']){const date=String(out[field]);hqAssert(!date||(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date),400,'RENTAL_DATE_INVALID',field);}
  hqAssert(!out.endsOn||!!out.installedOn,400,'RENTAL_INSTALL_DATE_REQUIRED');
  hqAssert(!out.endsOn||String(out.endsOn)>=String(out.installedOn),400,'RENTAL_DATE_ORDER');
 }
 return out;
}
export function installAccountLogisticsRoutes(app:HqApplication){
 for(const kind of Object.keys(schemas) as (keyof typeof schemas)[]){
  const key=`mock_${kind}`,path=`/api/accounts/:publicId/${kind}`;
  app.route('GET',path,c=>{const d=c.repository.read(),parent=requireAccountRelatedAccess(c,d);return {items:rows(parent,key).filter(row=>!row.deleted).map(visible),mode:'MOCK'};});
  for(const method of ['POST','PATCH','DELETE'])app.route(method,method==='POST'?path:`${path}/item/:itemId`,c=>{
   hqOnlyKeys(c.body,method==='DELETE'?['expectedVersion','idempotencyKey']:[...schemas[kind],'expectedVersion','idempotencyKey']);
   return c.repository.transact(d=>{
    const parent=requireAccountRelatedAccess(c,d,true);let row:Item;
    if(method==='POST'){
     const input=values(c,kind),requestKey=hqText(c.body.idempotencyKey,'idempotencyKey',200),fingerprint=canonicalHq(input),prior=rows(parent,key).find(item=>item.requestKey===requestKey);
     if(prior){hqAssert(prior.fingerprint===fingerprint,409,'IDEMPOTENCY_CONFLICT');return visible(prior);}
     row={...input,public_id:newHqId(d),company_id:parent.company_id,account_public_id:parent.public_id,owner_user_id:c.actor.userId,ownerName:c.actor.name,version:1,deleted:false,requestKey,fingerprint,created_at:d.clock,updated_at:d.clock};parent[key]=[...rows(parent,key),row];
    }else{
     const found=rows(parent,key).find(item=>item.public_id===c.params.itemId&&!item.deleted);hqAssert(found,404,'RELATED_NOT_FOUND');row=found;
     hqAssert(c.body.expectedVersion===row.version,409,'VERSION_CONFLICT');
     if(method==='DELETE')row.deleted=true;else Object.assign(row,values(c,kind));row.version++;row.updated_at=d.clock;
    }
    auditHq(d,c.actor,`ACC.${kind}.${method}`,parent.public_id,{relatedId:row.public_id,version:row.version});return visible(row);
   },true);
  });
 }
}
