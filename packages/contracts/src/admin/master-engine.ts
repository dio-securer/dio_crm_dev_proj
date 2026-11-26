import {z} from 'zod';
import {AdminRepository,assert,canonical} from './core';
import {SecurityActor} from './permissions';
import {SecurityEngine,securityHash} from './security';
import {activeAccountConfig} from './account-runtime';
import {upgradeMasterConfig,calculateBusinessDeadline,numberParts,validateNumbering} from './master-data';
export class MasterDataEngine{
 constructor(private repo:AdminRepository,private id=()=>crypto.randomUUID(),private now=()=>Date.now()){}
 async request(a:SecurityActor,company:string,operation:string,body:any={},key=''){
 const permission=operation==='allocate'?'numbering.allocate':operation==='runtime'?'account.read':operation==='codes'?'account.read':operation==='calculate'?'calendar.manage':'numbering.manage';
 return new SecurityEngine(this.repo).authorizedRepository(a,company,permission).transact('*',async tx=>{
 const c=tx.read('companies',company);assert(c,404,'NOT_FOUND');if(operation==='runtime'||operation==='codes')assert(company===a.companyId,404,'NOT_FOUND');const active=activeAccountConfig(tx,company),config=upgradeMasterConfig(active.config,String(c.timezone));
 const pattern=config['NUMBERING:account'],calendar=config['CALENDAR:business'];
 if(operation==='runtime')return {releaseId:active.releaseId,terms:config['TERM:terms'],codes:config['CODE:codes'],companyLocale:c.defaultLocale,templateLocale:c.templateCode==='HQ'?'ko-KR':'en-US',supportedLocales:['ko-KR','en-US']};
 if(operation==='codes'){const b=z.object({group:z.string().min(1),includeInactive:z.boolean().default(false)}).strict().parse(body);const group=config['CODE:codes'].groups.find((g:any)=>g.key===b.group);assert(group,404,'CODE_GROUP_UNKNOWN');return {items:group.values.filter((v:any)=>b.includeInactive||v.active).sort((a:any,b:any)=>a.order-b.order||a.code.localeCompare(b.code)),releaseId:active.releaseId};}
 if(operation==='preview'){const b=z.object({pattern:z.unknown().optional(),sampleDate:z.string()}).strict().parse(body),p=b.pattern||pattern;validateNumbering(p);const part=numberParts(p,b.sampleDate,String(c.timezone),1),seq=tx.forCompany(company).query('sequences').find(s=>s.entity===p.entity&&s.periodKey===part.periodKey);return {...numberParts(p,b.sampleDate,String(c.timezone),Number(seq?.nextValue||1)),timezone:c.timezone,consumed:false};}
 assert(['allocate','calculate'].includes(operation),404,'NOT_FOUND');assert(key,400,'IDEMPOTENCY_REQUIRED');const hash=await securityHash(canonical({operation,body})),receipt=`master:${company}:${a.userId}:${operation}:${key}`,prior=tx.receipt(receipt,hash);if(prior)return prior;
 let result:any;
 if(operation==='allocate'){const b=z.object({entity:z.literal('account')}).strict().parse(body),date=new Date(this.now()).toISOString(),period=numberParts(pattern,date,String(c.timezone),1).periodKey;const seq=tx.forCompany(company).query('sequences').find(s=>s.entity===b.entity&&s.periodKey===period),next=Number(seq?.nextValue||1),number=numberParts(pattern,date,String(c.timezone),next).number;
 assert(!tx.forCompany(company).query('requests').some(r=>r.kind==='NUMBER_ALLOCATION'&&r.number===number&&r.entity===b.entity),409,'NUMBER_COLLISION');
 if(seq)tx.compareAndSwap('sequences',seq.id,seq.revision,{...seq,nextValue:next+1});else tx.insert('sequences',{id:this.id(),companyId:company,revision:1,entity:b.entity,periodKey:period,nextValue:next+1});
 result={id:this.id(),companyId:company,revision:1,kind:'NUMBER_ALLOCATION',number,entity:b.entity,periodKey:period,releaseId:active.releaseId,patternSnapshot:structuredClone(pattern),timezone:c.timezone};
 }else{const b=z.object({start:z.string(),businessDays:z.number()}).strict().parse(body);result={id:this.id(),companyId:company,revision:1,kind:'CALENDAR_CALCULATION',releaseId:active.releaseId,...calculateBusinessDeadline(calendar,b.start,b.businessDays)};}
 tx.insert('requests',result);tx.appendEvent({id:this.id(),companyId:company,revision:1,action:operation==='allocate'?'NUMBER_ALLOCATED':'CALENDAR_CALCULATED',actor:a.userId,target:result.id});tx.receipt(receipt,hash,result);return result;
 });}
}
export async function masterDataRequest(engine:MasterDataEngine,a:SecurityActor,path:string,method:string,body:any,key:string){const url=new URL(path,'http://demo.invalid'),m=url.pathname.match(/^\/api\/admin\/companies\/([^/]+)\/(numbering\/(preview|allocate)|calendars\/calculate|runtime\/(master-data|codes))$/);if(!m)return undefined;const operation=m[3]|| (m[2]==='calendars/calculate'?'calculate':m[4]==='codes'?'codes':'runtime');assert(method===(['runtime','codes'].includes(operation)?'GET':'POST'),405,'METHOD_NOT_ALLOWED');if(operation==='codes'){assert([...url.searchParams.keys()].every(k=>['group','includeInactive'].includes(k)),422,'QUERY_INVALID');const inactive=url.searchParams.get('includeInactive');assert(inactive===null||['true','false'].includes(inactive),422,'QUERY_INVALID');body={group:url.searchParams.get('group'),includeInactive:inactive==='true'};}return engine.request(a,m[1],operation,body,key);}
