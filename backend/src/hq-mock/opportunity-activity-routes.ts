import type {HqApplication,HqRouteContext} from './app.js';
import {hqFind,hqOnlyKeys,hqRequire,hqText} from './app.js';
import {auditHq,canonicalHq,cloneHq,hqAssert,newHqId} from './model.js';
import type {HqDataset} from './model.js';

// Independent mock tasks/calls/events, not visit plans, approval reports or ERP events.
const keys=['kind','subject','note','dueDate','status','priority','ownerUserId','startAt','endAt','location'];
const kinds=['TASK','CALL','EVENT'],statuses=['PLANNED','COMPLETED','CANCELED'],priorities=['LOW','NORMAL','HIGH'];
const parent=(c:HqRouteContext,d:HqDataset,write=false)=>{
 hqRequire(c.actor,'OPPORTUNITY.READ');hqRequire(c.actor,'ACCOUNT.READ');hqRequire(c.actor,'ACTIVITY.READ');
 c.app.requireScreen(c.actor,'HQ_OPPORTUNITY');c.app.requireScreen(c.actor,'HQ_ACCOUNT');c.app.requireScreen(c.actor,'HQ_ACTIVITY');
 const row=hqFind(d,c.actor,'opportunities',c.params.publicId);hqAssert(row.deleted!==true&&row.deleted_yn!==true,404,'NOT_FOUND');
 const account=hqFind(d,c.actor,'accounts',String(row.account_public_id));hqAssert(account.deleted!==true&&account.deleted_yn!==true,404,'NOT_FOUND');
 if(write){hqRequire(c.actor,'OPPORTUNITY.WRITE');hqRequire(c.actor,'ACTIVITY.WRITE');c.app.requireAction(c.actor,'OPP.saveNegotiation',row,{});hqAssert(row.owner_user_id===c.actor.userId||['SYSTEM','ALL'].includes(c.actor.scope),403,'OWNER_WRITE_DENIED');}
 return row;
};
const owners=(c:HqRouteContext)=>c.app.personas.filter(x=>x.companyId===c.actor.companyId&&x.active!==false&&(x.userId===c.actor.userId||['SYSTEM','ALL'].includes(c.actor.scope))).map(x=>({userId:x.userId,name:x.name}));
const calendarDate=(value:unknown,label:string)=>{
 hqAssert(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value),400,'DATE_INVALID',label);
 const time=Date.parse(`${value}T00:00:00Z`);hqAssert(Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value,400,'DATE_INVALID',label);return value;
};
const localTime=(value:unknown,label:string)=>{
 hqAssert(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value),400,'TIME_INVALID',label);calendarDate(value.slice(0,10),label);return value;
};
const validate=(c:HqRouteContext,input:Record<string,unknown>,prior?:Record<string,unknown>)=>{
 const row={kind:'TASK',subject:'',note:'',dueDate:'',status:'PLANNED',priority:'NORMAL',ownerUserId:c.actor.userId,startAt:'',endAt:'',location:'',...prior,...input};
 hqAssert(kinds.includes(String(row.kind)),400,'KIND_INVALID');hqAssert(!prior||row.kind===prior.kind,400,'KIND_IMMUTABLE');
 row.subject=hqText(row.subject,'subject',200);
 for(const key of ['note','location'] as const)hqAssert(typeof row[key]==='string'&&row[key].length<=(key==='note'?4000:200),400,'TEXT_INVALID',key);
 hqAssert(typeof row.dueDate==='string',400,'DATE_INVALID');if(row.dueDate)calendarDate(row.dueDate,'dueDate');
 hqAssert(statuses.includes(String(row.status)),400,'STATUS_INVALID');hqAssert(priorities.includes(String(row.priority)),400,'PRIORITY_INVALID');
 hqAssert(Number.isSafeInteger(row.ownerUserId)&& (owners(c).some(x=>x.userId===row.ownerUserId)||prior?.ownerUserId===row.ownerUserId),403,'ACTIVITY_OWNER_DENIED');
 if(row.kind==='EVENT'){localTime(row.startAt,'startAt');localTime(row.endAt,'endAt');hqAssert(String(row.startAt)<String(row.endAt),400,'EVENT_RANGE_INVALID');}
 else hqAssert(row.startAt===''&&row.endAt===''&&row.location==='',400,'EVENT_FIELDS_NOT_ALLOWED');
 return row;
};
export function installOpportunityActivityRoutes(app:HqApplication){
 app.route('GET','/api/opportunities/:publicId/timeline',c=>{
  const row=parent(c,c.repository.read());const items=((row.mock_timeline??[]) as Array<Record<string,unknown>>).filter(x=>x.deleted!==true).map(x=>({...x,ownerName:c.app.personas.find(u=>u.companyId===c.actor.companyId&&u.userId===x.ownerUserId)?.name??'담당자 확인 필요'}));
  return {items,owners:owners(c),mode:'MOCK'};
 });
 for(const method of ['POST','PATCH','DELETE'] as const)app.route(method,`/api/opportunities/:publicId/timeline${method==='POST'?'':'/:itemId'}`,c=>{
  hqOnlyKeys(c.body,method==='DELETE'?['expectedVersion','idempotencyKey']:[...keys,'expectedVersion','idempotencyKey']);
  const {expectedVersion,idempotencyKey,...body}=c.body;const key=idempotencyKey===undefined?'':hqText(idempotencyKey,'idempotencyKey',200);
  const fingerprint=canonicalHq({method,parent:c.params.publicId,item:c.params.itemId??'',body,expectedVersion:expectedVersion??null});
  return c.repository.transact(d=>{
   const row=parent(c,d,true);
   if(key){const receipt=d.collections.auditLogs.find(x=>x.action==='OPPORTUNITY_ACTIVITY_RECEIPT'&&x.company_id===c.actor.companyId&&x.owner_user_id===c.actor.userId&&(x.detail as Record<string,unknown>)?.key===key);if(receipt){const detail=receipt.detail as Record<string,unknown>;hqAssert(detail.fingerprint===fingerprint,409,'IDEMPOTENCY_CONFLICT');return cloneHq(detail.response);}}
   const items=(row.mock_timeline??[]) as Array<Record<string,unknown>>;let item:Record<string,unknown>;
   if(method==='POST'){item={...validate(c,body),public_id:newHqId(d),version:1,created_at:d.clock,updated_at:d.clock};items.push(item);row.mock_timeline=items;}
   else{const found=items.find(x=>x.public_id===c.params.itemId&&x.deleted!==true);hqAssert(found,404,'NOT_FOUND');hqAssert(Number.isSafeInteger(expectedVersion)&&expectedVersion===found.version,409,'VERSION_CONFLICT','활동이 변경되었습니다. 입력을 보존하고 최신 내용을 확인하세요.');item=found;
    if(method==='DELETE'){item.deleted=true;item.deleted_at=d.clock;}
    else Object.assign(item,validate(c,body,item));
    item.version=Number(item.version)+1;item.updated_at=d.clock;
   }
   auditHq(d,c.actor,`OPPORTUNITY_ACTIVITY_${method==='POST'?'CREATE':method==='PATCH'?'UPDATE':'DELETE'}`,String(item.public_id),{opportunityPublicId:row.public_id,kind:item.kind});
   const response={item:cloneHq(item),mode:'MOCK'};if(key)auditHq(d,c.actor,'OPPORTUNITY_ACTIVITY_RECEIPT',String(item.public_id),{key,fingerprint,response});return response;
  },true);
 });
}
