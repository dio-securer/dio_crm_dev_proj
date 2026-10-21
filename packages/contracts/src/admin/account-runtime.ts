import { assert, Row, Transaction, COMPANY_IDS } from './core';
import { parsePayload, conditionSchema } from './schemas';
import { HQ_ACCOUNT_FIELD_PROFILE } from './account-profile-HQ_ACCOUNT';
import { GLOBAL_ACCOUNT_FIELD_PROFILE } from './account-profile-GLOBAL_ACCOUNT';
import { fieldAccess, Role } from './permissions';
export const accountScreens = ['HQ_ACCOUNT', 'GLOBAL_ACCOUNT'];
export const accountRoutes:Record<string,string>={accounts:'account.read','accounts.new':'account.create'};
export const accountActions = ['account.create', 'account.update'];
export const featureRegistry: Record<string, string[]> = { account: [], activity: [], contract: ['account'], order: ['contract'] };
const alias: Record<string,string> = { hosp_nm: 'name', tel: 'phone', biz_no: 'taxId' };
export const extensionSeed = [
 {key:'x_priority',type:'enum',labelKey:'우선순위',nullable:false,active:true,searchable:true,enumValues:['NORMAL','HIGH']},
 {key:'x_nextContactDate',type:'date',labelKey:'다음 상담일',nullable:true,active:true,searchable:true},
 {key:'x_visitGroup',type:'text',labelKey:'방문 그룹',nullable:true,active:true,searchable:true,maxLength:100},
 {key:'x_creditLimit',type:'decimal',labelKey:'신용 한도',nullable:true,active:true,searchable:true,precision:18,scale:4},
 {key:'x_optIn',type:'boolean',labelKey:'수신 동의',nullable:false,active:true,searchable:true}
];
export function accountBaseline(template='GLOBAL'): Record<string,any> {
 const profile=template==='HQ'?HQ_ACCOUNT_FIELD_PROFILE:GLOBAL_ACCOUNT_FIELD_PROFILE;
 const sections=profile.sections.map(s=>({id:s.code,tabId:'main',titleKey:s.titleKey,order:s.order,columns:2}));
 const fields=profile.sections.flatMap(s=>s.fields.map((f,i)=>({key:alias[f.code]||f.code,sectionId:s.code,visible:f.visible,required:f.code==='hosp_nm'||f.code==='biz_no',readOnly:!!f.readonly,labelKey:f.labelKey||alias[f.code]||f.code,order:i,maxLength:1000,...(f.code==='biz_no'?{default:'DEMO-TAX'}:{})})));
 fields.push({key:'secret',sectionId:'basic',visible:true,required:false,readOnly:false,labelKey:'내부 정보',order:90,maxLength:1000});
 sections.push({id:'extensions',tabId:'main',titleKey:'추가 정보',order:100,columns:2});
 for(const [i,x]of extensionSeed.entries()) fields.push({key:x.key,sectionId:'extensions',visible:true,required:!x.nullable,readOnly:false,labelKey:x.labelKey,order:i,maxLength:x.type==='text'?100:1000,...(x.key==='x_priority'?{default:'NORMAL'}:x.key==='x_optIn'?{default:false}:{})} as any);
 return {
 'FEATURE:platform':{items:Object.keys(featureRegistry).map(key=>({key,enabled:!['contract','order'].includes(key)}))},
 'MENU:account':{nodes:[{id:'accounts',parentId:null,routeKey:'accounts',labelKey:'거래처',order:10,featureKey:'account',permission:'account.read'},{id:'account-new',parentId:'accounts',routeKey:'accounts.new',labelKey:'신규 거래처',order:20,featureKey:'account',permission:'account.create'}]},
 'SCREEN:account':{entity:'account',screenKey:template==='HQ'?'HQ_ACCOUNT':'GLOBAL_ACCOUNT',tabs:[{id:'main',labelKey:'거래처 정보',order:0}],sections},
 'FIELD:account':{entity:'account',fields,extensionDefinitions:structuredClone(extensionSeed)},
 'RULE:account':{entity:'account',rules:[{id:'next-contact-required',trigger:'SAVE',condition:{op:'eq',field:'x_priority',value:'HIGH'},effects:[{target:'x_nextContactDate',required:true}],errorKey:'다음 상담일을 입력하세요'}]},
 'LIST_VIEW:account':{entity:'account',views:[{key:'default',labelKey:'전체 거래처',columns:['name','phone','x_priority'],filter:{op:'not',arg:{op:'isEmpty',field:'name'}},sort:[{field:'name',direction:'ASC'}],pageSize:20,shared:true}]},
 'ACTION:account':{entity:'account',actions:accountActions.map(key=>({key,labelKey:key==='account.create'?'거래처 등록':'저장',featureKey:'account',permission:key,condition:{op:'not',arg:{op:'isEmpty',field:'context.companyId'}},confirmKey:'confirm.save',enabled:true}))}
 };
}
// Compatibility adapter: fills only A04 snapshots lacking the A05 SCREEN domain.
export function upgradeAccountConfig(input: Record<string,any>, template='GLOBAL') {
 if(input['SCREEN:account']) return structuredClone(input);
 const base=accountBaseline(template), result={...base,...structuredClone(input)};
 result['FIELD:account']={...base['FIELD:account'],...input['FIELD:account'],fields:base['FIELD:account'].fields.map((f:any)=>({...f,...input['FIELD:account']?.fields?.find((o:any)=>o.key===f.key)})),extensionDefinitions:base['FIELD:account'].extensionDefinitions};
 result['FEATURE:platform']={items:base['FEATURE:platform'].items.map((f:any)=>({...f,...input['FEATURE:platform']?.items?.find((o:any)=>o.key===f.key)}))};return result;
}
export function activeAccountConfig(tx:Transaction,company:string) {
 const c=tx.read('companies',company)!;const release=c.activeReleaseId?tx.read('releases',String(c.activeReleaseId)):undefined;
 const pin=tx.read('configScopes','COMPANY:'+company);const ids=pin?.parentVersionIds as string[]|undefined;const parent=ids?.length?tx.read('scopeVersions',ids[ids.length-1]):undefined;
 const config=upgradeAccountConfig((release?.effective||parent?.effective||{}) as any,String(c.templateCode));if(company===COMPANY_IDS.US_B&&!release){const f=config['FIELD:account'].fields.find((f:any)=>f.key==='x_visitGroup');if(f)f.visible=false;}return {releaseId:String(c.activeReleaseId||'A03_BASELINE'),config};
}
export function conditionFields(n:any):string[]{return n.args?n.args.flatMap(conditionFields):n.arg?conditionFields(n.arg):[n.field];}
function decimal(v:unknown):bigint{assert(typeof v==='string'&&/^-?\d{1,14}(\.\d{1,4})?$/.test(v),422,'DECIMAL_INVALID');const negative=v.startsWith('-');const [a,b='']=v.replace('-','').split('.');return BigInt(a)*10000n*(negative?-1n:1n)+BigInt(b.padEnd(4,'0'))*(negative?-1n:1n);}
export function validateValue(def:any,value:any){
 if(value===null){assert(def.nullable,422,'NULL_NOT_ALLOWED');return;}
 if(def.type==='decimal'){decimal(value);return;}
 if(def.type==='boolean'){assert(typeof value==='boolean',422,'FIELD_TYPE_INVALID');return;}
 assert(typeof value==='string',422,'FIELD_TYPE_INVALID');
 if(def.type==='date')assert(/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value,422,'DATE_INVALID');
 else if(def.type==='enum')assert(def.enumValues.includes(value),422,'ENUM_INVALID');
 else assert(value.length<=(def.maxLength||1000),422,'MAX_LENGTH');
}
export function evaluateCondition(n:any,values:Record<string,any>,defs:Record<string,any>={}):boolean {
 if(n.op==='all')return n.args.every((x:any)=>evaluateCondition(x,values,defs));if(n.op==='any')return n.args.some((x:any)=>evaluateCondition(x,values,defs));if(n.op==='not')return !evaluateCondition(n.arg,values,defs);
 const actual=values[n.field];if(n.op==='isEmpty')return actual===undefined||actual===null||actual===''||(Array.isArray(actual)&&actual.length===0);
 if(n.value===null&&n.op!=='isEmpty')return n.op==='eq'?actual===null:n.op==='ne'?actual!==null:false;if(actual===undefined||actual===null)return n.op==='eq'?actual===n.value:n.op==='ne'?actual!==n.value:false;if(n.field==='actor.roleCodes'){assert(Array.isArray(actual),422,'CONDITION_TYPE_MISMATCH');const match=n.op==='in'?n.value.some((v:any)=>actual.includes(v)):actual.includes(n.value);return n.op==='ne'?!match:match;}const compare=(v:any)=>{assert(typeof actual===typeof v,422,'CONDITION_TYPE_MISMATCH');const a=defs[n.field]?.type==='decimal'?decimal(actual):actual,b=defs[n.field]?.type==='decimal'?decimal(v):v;return a===b?0:a>b?1:-1;};
 if(n.op==='in')return n.value.some((v:any)=>compare(v)===0);const c=compare(n.value);return n.op==='eq'?c===0:n.op==='ne'?c!==0:n.op==='gt'?c>0:n.op==='gte'?c>=0:n.op==='lt'?c<0:c<=0;
}
export function fieldDefinitions(config:any):Record<string,any>{return Object.fromEntries(config['FIELD:account'].fields.map((f:any)=>{const extension=config['FIELD:account'].extensionDefinitions.find((x:any)=>x.key===f.key);return [f.key,{type:'text',nullable:!f.required,...f,...extension,maxLength:Math.min(f.maxLength||1000,extension?.maxLength||1000)}];}));}
export function validateAccountConfig(config:any,tx?:Transaction,company?:string){
 for(const key of Object.keys(accountBaseline())){assert(config[key],422,'DOMAIN_REQUIRED');parsePayload(key.split(':')[0],config[key]);}
 const feature=Object.fromEntries(config['FEATURE:platform'].items.map((x:any)=>[x.key,x.enabled]));for(const k of Object.keys(feature)){assert(k in featureRegistry,422,'FEATURE_UNKNOWN');if(feature[k])assert(featureRegistry[k].every(dep=>feature[dep]),422,'FEATURE_DEPENDENCY');}
 const screen=config['SCREEN:account'];assert(accountScreens.includes(screen.screenKey),422,'SCREEN_NOT_REGISTERED');
 const sections=new Set(screen.sections.map((s:any)=>s.id));assert(screen.sections.every((s:any)=>screen.tabs.some((t:any)=>t.id===s.tabId)),422,'TAB_UNKNOWN');
 const nodes=config['MENU:account'].nodes;assert(new Set(nodes.map((n:any)=>n.routeKey)).size===nodes.length,422,'DUPLICATE_ROUTE');for(const n of nodes){assert(accountRoutes[n.routeKey]===n.permission&&n.featureKey in featureRegistry,422,'MENU_NOT_REGISTERED');let current=n;const seen=new Set();while(current){assert(!seen.has(current.id),422,'MENU_CYCLE');seen.add(current.id);if(!current.parentId)break;current=nodes.find((x:any)=>x.id===current.parentId);assert(current,422,'MENU_PARENT_UNKNOWN');}}
 const fields=config['FIELD:account'].fields,ext=config['FIELD:account'].extensionDefinitions,known=new Set([...accountBaseline('HQ')['FIELD:account'].fields.map((f:any)=>f.key),...ext.map((x:any)=>x.key)]),defs=fieldDefinitions(config);
 if(tx&&company){const previous=activeAccountConfig(tx,company).config['FIELD:account'].extensionDefinitions;assert(previous.every((x:any)=>ext.some((e:any)=>e.key===x.key)),422,'EXTENSION_KEY_IMMUTABLE');}
 assert(fields.some((f:any)=>f.key==='name'&&f.visible&&f.required),422,'NAME_REQUIRED');
 assert(new Set(ext.map((x:any)=>x.key)).size===ext.length,422,'DUPLICATE_EXTENSION');
 for(const x of ext){if(x.type==='enum')assert(x.enumValues?.length&&new Set(x.enumValues).size===x.enumValues.length,422,'ENUM_INVALID');if(tx&&company){const prior=activeAccountConfig(tx,company).config['FIELD:account'].extensionDefinitions.find((d:any)=>d.key===x.key);if(prior&&prior.type!==x.type)assert(!tx.forCompany(company).query('accounts').some(r=>r[x.key]!==undefined&&r[x.key]!==null),422,'EXTENSION_TYPE_IN_USE');}}
 for(const f of fields){assert(known.has(f.key)&&sections.has(f.sectionId),422,'FIELD_NOT_REGISTERED');assert(!(f.required&&!f.visible&&f.default===undefined),422,'HIDDEN_REQUIRED');if(f.default!==undefined)validateValue(defs[f.key],f.default);}
 const validateCondition=(node:any)=>{conditionSchema.parse(node);for(const key of conditionFields(node))assert(key in defs||['context.companyId','actor.roleCodes','document.state'].includes(key),422,'CONDITION_FIELD_UNKNOWN');function check(n:any){if(n.args)return n.args.forEach(check);if(n.arg)return check(n.arg);if(n.op==='isEmpty')return;const values=n.op==='in'?n.value:[n.value];assert(Array.isArray(values)&&values.length>0,422,'CONDITION_VALUE_INVALID');for(const v of values){if(defs[n.field])validateValue(defs[n.field],v);else assert(typeof v==='string',422,'CONDITION_TYPE_MISMATCH');}assert(n.field!=='actor.roleCodes'||['eq','ne','in'].includes(n.op),422,'CONDITION_OPERATOR_INVALID');}check(node);};
 const effects=new Map<string,any>();for(const r of config['RULE:account'].rules){validateCondition(r.condition);for(const e of r.effects){assert(e.target in defs||accountActions.includes(e.target),422,'RULE_TARGET_UNKNOWN');assert(!(['name','taxId'].includes(e.target)&&(e.required===false||e.visible===false)),422,'REQUIRED_FIELD_INVARIANT');for(const key of ['visible','required','readOnly','actionEnabled'])if(e[key]!==undefined){const k=e.target+':'+key;assert(!effects.has(k)||effects.get(k)===e[key],422,'RULE_CONFLICT');effects.set(k,e[key]);}const f=defs[e.target];if(f)assert(!((e.visible===false&& (e.required===true||f.required)||e.required===true&&!f.visible)&&f.default===undefined),422,'HIDDEN_REQUIRED');}}
 for(const f of fields)assert(!((effects.get(f.key+':visible')===false||!f.visible)&&(effects.get(f.key+':required')===true||f.required)&&f.default===undefined),422,'HIDDEN_REQUIRED');
 for(const v of config['LIST_VIEW:account'].views){assert(v.columns.every((k:string)=>k in defs)&&v.sort.every((s:any)=>s.field in defs),422,'VIEW_FIELD_UNKNOWN');validateCondition(v.filter);}
 for(const a of config['ACTION:account'].actions){assert(accountActions.includes(a.key)&&a.permission===a.key&&a.featureKey==='account',422,'ACTION_NOT_REGISTERED');validateCondition(a.condition);}
}
export function effectiveFields(config:any,values:any,trigger='SAVE'){const defs=fieldDefinitions(config),fields=structuredClone(config['FIELD:account'].fields);for(const r of config['RULE:account'].rules)if((r.trigger===trigger||r.trigger==='DISPLAY')&&evaluateCondition(r.condition,values,defs))for(const e of r.effects){const f=fields.find((x:any)=>x.key===e.target);if(f){const readOnly=f.readOnly;Object.assign(f,e);f.readOnly=readOnly||!!e.readOnly;}}return fields;}
export function runtimeFieldAccess(roles:Role[],field:string,company:string,action='update'){
 const p=fieldAccess(roles,field,action);if(company===COMPANY_IDS.US_B&&field==='x_creditLimit'&&roles.some(r=>r.code==='SALES'))return {...p,read:false,write:false};return p;
}
export function projectRuntimeAccount(config:any,roles:Role[],row:Row){const values:Record<string,any>={},maskedFields:Record<string,any>={};for(const f of effectiveFields(config,{...row,'context.companyId':row.companyId,'actor.roleCodes':roles.map(r=>r.code),'document.state':'DRAFT'},'DISPLAY')){const def=fieldDefinitions(config)[f.key],p=runtimeFieldAccess(roles,f.key,String(row.companyId));if(!f.visible||!p.read||def.active===false)continue;const value=row[f.key]===undefined?f.default:row[f.key];if(value===undefined)continue;if(p.mask==='LAST4')maskedFields[f.key]={displayValue:'••••'+String(value).slice(-4),maskType:'LAST4',canReplace:p.write&&!f.readOnly};else values[f.key]=value;}return {id:row.id,revision:row.revision,companyId:row.companyId,values,maskedFields};}
