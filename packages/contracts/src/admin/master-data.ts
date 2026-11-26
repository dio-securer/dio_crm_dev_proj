import {assert,Transaction,canonical} from './core';
import {parsePayload} from './schemas';
export const masterKeys=['TERM:terms','CODE:codes','NUMBERING:account','CALENDAR:business'];
export const termRegistry:Record<string,{ko:string;en:string;placeholders:string[]}>={
 'account.name':{ko:'거래처명',en:'Account name',placeholders:[]},'account.title':{ko:'거래처',en:'Accounts',placeholders:[]},
 'account.phone':{ko:'전화번호',en:'Phone',placeholders:[]},'account.queueCreated':{ko:'ERP 요청 생성: {{requestId}}',en:'ERP request queued: {{requestId}}',placeholders:['requestId']},
 'code.priority.NORMAL':{ko:'보통',en:'Normal',placeholders:[]},'code.priority.HIGH':{ko:'높음',en:'High',placeholders:[]}
};
export function masterBaseline(timezone='Asia/Seoul'):Record<string,any>{return {
 'TERM:terms':{terms:Object.keys(termRegistry).map(semanticKey=>({semanticKey,termKey:semanticKey})),translations:Object.entries(termRegistry).flatMap(([termKey,t])=>[{termKey,locale:'ko-KR',text:t.ko},{termKey,locale:'en-US',text:t.en}])},
 'CODE:codes':{groups:[{key:'priority',values:[{code:'NORMAL',labelKey:'code.priority.NORMAL',active:true,order:0},{code:'HIGH',labelKey:'code.priority.HIGH',active:true,order:1}]}]},
 'NUMBERING:account':{entity:'account',prefix:'ACC-',periodFormat:'YYYY',padding:6,resetPolicy:'YEAR'},
 'CALENDAR:business':{timezone,workingWeekdays:[1,2,3,4,5],holidays:['2026-10-22']}
};}
export const upgradeMasterConfig=(config:any,timezone='Asia/Seoul')=>({...masterBaseline(timezone),...structuredClone(config)});
export const placeholders=(text:string)=>[...new Set([...text.matchAll(/{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g)].map(x=>x[1]))].sort();
export function validDate(date:string){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;}
export function validateCalendar(c:any){parsePayload('CALENDAR',c);try{new Intl.DateTimeFormat('en',{timeZone:c.timezone}).format(0);}catch{assert(false,422,'TIMEZONE_INVALID');}assert(new Set(c.workingWeekdays).size===c.workingWeekdays.length,422,'DUPLICATE_WEEKDAY');assert(new Set(c.holidays).size===c.holidays.length&&c.holidays.every(validDate),422,'HOLIDAY_INVALID');}
export function validateNumbering(p:any){parsePayload('NUMBERING',p);assert(p.entity==='account',422,'ENTITY_NOT_REGISTERED');assert(({YEAR:'YYYY',MONTH:'YYYYMM',NONE:'ALL'} as any)[p.resetPolicy]===p.periodFormat,422,'RESET_PERIOD_MISMATCH');}
export function validateMasterConfig(config:any,tx?:Transaction,company?:string){
 for(const key of masterKeys)parsePayload(key.split(':')[0],config[key]);
 const term=config['TERM:terms'];assert(Object.keys(termRegistry).every(k=>term.terms.some((t:any)=>t.semanticKey===k)),422,'TERM_KEY_IMMUTABLE');assert(new Set(term.terms.map((t:any)=>t.semanticKey)).size===term.terms.length,422,'DUPLICATE_TERM');
 for(const t of term.terms){assert(t.semanticKey in termRegistry,422,'TERM_NOT_REGISTERED');const expected=termRegistry[t.semanticKey].placeholders;for(const locale of ['ko-KR','en-US']){const text=term.translations.find((x:any)=>x.termKey===t.termKey&&x.locale===locale)?.text;assert(typeof text==='string'&&text.trim(),422,'TRANSLATION_REQUIRED');assert(canonical(placeholders(text))===canonical(expected),422,'PLACEHOLDER_MISMATCH');}}
 for(const t of term.translations){assert(t.text.trim(),422,'TRANSLATION_REQUIRED');const mapped=term.terms.filter((m:any)=>m.termKey===t.termKey);const expected=mapped.length?termRegistry[mapped[0].semanticKey].placeholders:(termRegistry[t.termKey]?.placeholders||[]);assert(canonical(placeholders(t.text))===canonical(expected),422,'PLACEHOLDER_MISMATCH');}
 assert(new Set(term.translations.map((t:any)=>t.termKey+':'+t.locale)).size===term.translations.length,422,'DUPLICATE_TRANSLATION');
 const groups=config['CODE:codes'].groups;assert(new Set(groups.map((g:any)=>g.key)).size===groups.length,422,'DUPLICATE_CODE_GROUP');
 for(const g of groups)assert(new Set(g.values.map((v:any)=>v.code)).size===g.values.length,422,'DUPLICATE_CODE');
 const priority=groups.find((g:any)=>g.key==='priority');assert(priority,422,'CODE_GROUP_REQUIRED');
 const field=config['FIELD:account']?.fields.find((f:any)=>f.key==='x_priority');if(field?.default!==undefined)assert(priority.values.some((v:any)=>v.code===field.default),422,'DEFAULT_CODE_UNKNOWN');
 if(tx&&company)for(const row of tx.forCompany(company).query('accounts'))if(row.x_priority!==undefined)assert(priority.values.some((v:any)=>v.code===row.x_priority),422,'CODE_IN_USE');
 validateNumbering(config['NUMBERING:account']);validateCalendar(config['CALENDAR:business']);
}
export function translateTerm(term:any,semanticKey:string,locale:string,companyLocale:string,templateLocale:string,lookup:(locale:string,key:string)=>string|undefined,params:Record<string,string>={}){
 const key=term.terms.find((t:any)=>t.semanticKey===semanticKey)?.termKey||semanticKey;
 for(const lng of [...new Set([locale,companyLocale,templateLocale,'ko-KR'])]){const value=term.translations.find((t:any)=>t.termKey===key&&t.locale===lng)?.text??lookup(lng,key);if(value!==undefined)return {text:value.replace(/{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g,(_m:string,k:string)=>params[k]??`{{${k}}}`),missing:false,locale:lng,termKey:key};}
 return {text:key+' [missing]',missing:true,locale,termKey:key};
}
type Local={year:number;month:number;day:number;hour:number;minute:number;second:number};
export function localParts(epoch:number,timezone:string):Local{const p=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(epoch);return Object.fromEntries(p.filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)])) as Local;}
const naive=(p:Local)=>Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
// Examine surrounding offsets; select earliest instant for overlap, first valid wall minute for a gap.
export function localInstant(p:Local,timezone:string):number{const n=naive(p),offsets=new Set<number>();for(let h=-36;h<=36;h+=6){const t=n+h*3600000;offsets.add(naive(localParts(t,timezone))-t);}for(let shift=0;shift<=1440;shift++){const wanted=shift===0?n:Math.floor((n+shift*60000)/60000)*60000;const matches=[...offsets].map(o=>wanted-o).filter(t=>naive(localParts(t,timezone))===wanted);if(matches.length)return Math.min(...matches);}assert(false,422,'LOCAL_TIME_INVALID');}
export function calculateBusinessDeadline(calendar:any,start:string,businessDays:number){validateCalendar(calendar);assert(typeof start==='string'&&validDate(start.slice(0,10))&&Number(start.slice(0,4))>=1000&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(start)&&Number.isFinite(Date.parse(start)),422,'START_INVALID');assert(Number.isInteger(businessDays)&&businessDays>=0&&businessDays<=3660,422,'BUSINESS_DAYS_INVALID');const epoch=Date.parse(start);if(businessDays===0)return {dueAt:new Date(epoch).toISOString(),calendarSnapshot:structuredClone(calendar),start,businessDays};const p=localParts(epoch,calendar.timezone);let day=Date.UTC(p.year,p.month-1,p.day),remaining=businessDays;while(remaining){day+=86400000;const d=new Date(day);if(calendar.workingWeekdays.includes(d.getUTCDay())&&!calendar.holidays.includes(d.toISOString().slice(0,10)))remaining--;}
 const d=new Date(day),due=localInstant({...p,year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()},calendar.timezone);return {dueAt:new Date(due+(naive(localParts(due,calendar.timezone))===naive({...p,year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()})?epoch%1000:0)).toISOString(),calendarSnapshot:structuredClone(calendar),start,businessDays};}
export function numberParts(pattern:any,date:string,timezone:string,nextValue:number){validateNumbering(pattern);assert(typeof date==='string'&&validDate(date.slice(0,10))&&/(Z|[+-]\d{2}:\d{2})$/.test(date)&&Number.isFinite(Date.parse(date)),422,'SAMPLE_DATE_INVALID');const p=localParts(Date.parse(date),timezone),periodKey=pattern.periodFormat==='ALL'?'ALL':String(p.year)+(pattern.periodFormat==='YYYYMM'?String(p.month).padStart(2,'0'):'');assert(Number.isSafeInteger(nextValue)&&nextValue>0&&String(nextValue).length<=pattern.padding,409,'SEQUENCE_EXHAUSTED');return {periodKey,number:pattern.prefix+(periodKey==='ALL'?'':periodKey+'-')+String(nextValue).padStart(pattern.padding,'0')};}
