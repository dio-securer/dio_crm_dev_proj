import {hqCanRead,hqFind,hqOnlyKeys,hqRequire,hqText,type HqApplication,type HqRouteContext} from './app.js';
import {auditHq,canonicalHq,cloneHq,hqAssert,newHqId,type HqDataset,type HqRow} from './model.js';
type Role=HqRow&{contactPublicId:string;role:string;isPrimary:boolean;deleted:boolean};
const roles=['','대표원장','구매 담당자','임플란트 메인 시술자'];
const rows=(parent:HqRow):Role[]=>Array.isArray(parent.mock_contact_roles)?parent.mock_contact_roles as Role[]:[];
function access(c:HqRouteContext,d:HqDataset,write=false){
 hqRequire(c.actor,'OPPORTUNITY.READ');hqRequire(c.actor,'CONTACT.READ');c.app.requireScreen(c.actor,'HQ_OPPORTUNITY');c.app.requireScreen(c.actor,'HQ_ACCOUNT');
 const parent=hqFind(d,c.actor,'opportunities',c.params.publicId);hqAssert(!parent.deleted_yn,404,'NOT_FOUND');const account=hqFind(d,c.actor,'accounts',String(parent.account_public_id));hqAssert(!account.deleted_yn&&account.account_status!=='MERGED',404,'NOT_FOUND');c.app.requireActionAccess(c.actor,'ACC.open');
 if(write){hqRequire(c.actor,'OPPORTUNITY.WRITE');c.app.requireActionAccess(c.actor,'OPP.saveNegotiation');hqAssert(parent.owner_user_id===c.actor.userId||['SYSTEM','ALL'].includes(c.actor.scope),403,'OWNER_WRITE_DENIED');}
 return parent;
}
function contact(c:HqRouteContext,d:HqDataset,parent:HqRow,id:string){return d.collections.contacts.find(row=>row.public_id===id&&!row.deleted_yn&&row.account_public_id===parent.account_public_id&&hqCanRead(c.actor,row));}
function name(c:HqRouteContext,row:HqRow){const field=c.app.standardFor(c.actor).fields.find(f=>f.entity==='contact'&&f.current.dbField==='contact_name');if(!field)return null;const projected=c.app.policyFor(c.actor).readField(field.fieldKey,c.app.context(c.actor,{...c.app.values(row),[field.fieldKey]:row.contact_name}));return projected===undefined?null:projected;}
function present(c:HqRouteContext,d:HqDataset,parent:HqRow,row:Role){const person=contact(c,d,parent,row.contactPublicId);return {public_id:row.public_id,version:row.version,contactPublicId:row.contactPublicId,contactName:person?name(c,person):null,role:row.role,isPrimary:row.isPrimary,deleted:row.deleted,contactAvailable:!!person,mode:'MOCK'};}
function input(c:HqRouteContext,existing?:Role){const role=c.body.role===undefined?(existing?.role??''):c.body.role;hqAssert(typeof role==='string'&&roles.includes(role),400,'CONTACT_ROLE_INVALID');const isPrimary=c.body.isPrimary===undefined?(existing?.isPrimary??false):c.body.isPrimary;hqAssert(typeof isPrimary==='boolean',400,'CONTACT_PRIMARY_INVALID');return {role,isPrimary};}
export function installOpportunityContactRoleRoutes(app:HqApplication){
 const path='/api/opportunities/:publicId/contact-roles';
 app.route('GET',path,c=>{const d=c.repository.read(),parent=access(c,d);return {items:rows(parent).filter(row=>!row.deleted&&d.collections.contacts.some(person=>person.public_id===row.contactPublicId&&hqCanRead(c.actor,person))).map(row=>present(c,d,parent,row)),contacts:d.collections.contacts.filter(row=>!row.deleted_yn&&row.account_public_id===parent.account_public_id&&hqCanRead(c.actor,row)).map(row=>({public_id:row.public_id,contactName:name(c,row)})),roles,mode:'MOCK'};});
 for(const method of ['POST','PATCH','DELETE'])app.route(method,method==='POST'?path:`${path}/:roleId`,c=>{
  hqOnlyKeys(c.body,method==='POST'?['contactPublicId','role','isPrimary','idempotencyKey']:method==='PATCH'?['role','isPrimary','expectedVersion','idempotencyKey']:['expectedVersion','idempotencyKey']);
  const key=hqText(c.body.idempotencyKey,'idempotencyKey',200),fingerprint=canonicalHq({method,params:c.params,body:c.body});
  return c.repository.transact(d=>{
   const parent=access(c,d,true);const previous=d.collections.auditLogs.find(log=>log.action==='OPPORTUNITY_CONTACT_ROLE_RECEIPT'&&log.company_id===c.actor.companyId&&log.owner_user_id===c.actor.userId&&(log.detail as Record<string,unknown>)?.key===key);
   if(previous){const detail=previous.detail as Record<string,unknown>;hqAssert(detail.fingerprint===fingerprint,409,'IDEMPOTENCY_CONFLICT');return present(c,d,parent,detail.row as Role);}
   let row:Role;
   if(method==='POST'){
    const id=hqText(c.body.contactPublicId,'contactPublicId'),person=hqFind(d,c.actor,'contacts',id);hqAssert(!person.deleted_yn,404,'CONTACT_NOT_FOUND');hqAssert(person.account_public_id===parent.account_public_id,422,'CONTACT_ACCOUNT_MISMATCH','현재 로컬 정책상 같은 거래처 연락처만 연결할 수 있습니다.');
    hqAssert(!rows(parent).some(item=>!item.deleted&&item.contactPublicId===id),409,'CONTACT_ROLE_DUPLICATE');const values=input(c);
    row={public_id:newHqId(d),company_id:parent.company_id,owner_user_id:parent.owner_user_id,version:1,contactPublicId:id,...values,deleted:false,created_at:d.clock,updated_at:d.clock};parent.mock_contact_roles=[...rows(parent),row];
   }else{
    const found=rows(parent).find(item=>item.public_id===c.params.roleId&&!item.deleted);hqAssert(found,404,'CONTACT_ROLE_NOT_FOUND');row=found;
    hqAssert(Number.isSafeInteger(c.body.expectedVersion)&&Number(c.body.expectedVersion)>0,400,'VERSION_REQUIRED');hqAssert(c.body.expectedVersion===row.version,409,'VERSION_CONFLICT','연락처 역할이 변경되었습니다. 입력은 유지하고 최신 내용을 조회하세요.');
    if(method==='DELETE')row.deleted=true;else{hqAssert(contact(c,d,parent,row.contactPublicId),404,'CONTACT_NOT_FOUND');Object.assign(row,input(c,row));}row.version++;row.updated_at=d.clock;
   }
   if(!row.deleted&&row.isPrimary)for(const other of rows(parent))if(other.public_id!==row.public_id&&!other.deleted&&other.isPrimary){other.isPrimary=false;other.version++;other.updated_at=d.clock;}
   auditHq(d,c.actor,`OPP.contactRole.${method}`,parent.public_id,{roleId:row.public_id,version:row.version});auditHq(d,c.actor,'OPPORTUNITY_CONTACT_ROLE_RECEIPT',parent.public_id,{key,fingerprint,row:cloneHq(row)});return present(c,d,parent,row);
  },true);
 });
}
