import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import '../hq-standard/register.mjs';
const {canonicalConfigJson,validateCatalog,validateTranslations}=await import('../../packages/contracts/src/crm-customization.ts');
import {dispositions} from './ui-dispositions.mjs';
import {koreanFields,englishFields,screenEnglish,actionLabels,sectionEnglish,tabLabels} from './catalog-labels.mjs';
import './translation-inventory.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const evidence=path.join(root,'docs/admin-platform/customization/evidence');
const baseline=JSON.parse(fs.readFileSync(path.join(evidence,'baseline.json'),'utf8')),semantic=JSON.parse(fs.readFileSync(path.join(evidence,'semantic-map.json'),'utf8'));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// The generator imports a frozen, reviewed baseline. A changed source requires a
// new reviewed baseline, never a silent re-scan overwriting C00.
for(const source of baseline.baseline.sourceHashes)assert.equal(hash(fs.readFileSync(path.join(root,source.file))),source.sha256,`Baseline drift: ${source.file}`);
assert.equal(semantic.unregisteredUi.length,dispositions.length);
const entries=[],translations={'ko-KR':{},'en-US':{}},bindings=[],aliases=[];
const standard=baseline.standard;
const label=(key,ko,en)=>{assert.ok(ko&&en,`Missing label ${key}`);for(const [locale,text] of [['ko-KR',ko],['en-US',en]]){if(translations[locale][key])assert.equal(translations[locale][key],text,`Conflicting label ${key}`);translations[locale][key]=text;}};
const add=(id,kind,labelKey,ko,en,extra={})=>{label(labelKey,ko,en);entries.push({id,kind,labelKey,support:'supported',settings:{enabled:true,visible:true,readOnly:false,required:false,order:0},capabilities:['enabled','visible','order'],locks:[],dependencies:[],permissions:[],readPermissions:[],writePermissions:[],requiredTranslation:true,...extra});};
const legacyMap=new Map();
for(const s of standard.screens){add(s.screenKey,'SCREEN',s.labelKey,s.label,screenEnglish[s.screenKey],{settings:{enabled:s.enabled,visible:true,readOnly:false,required:false,order:0},permissions:s.permissions});}
for(const m of standard.menus){const s=standard.screens.find(x=>x.screenKey===m.screenKey);add(m.menuKey,'MENU',m.labelKey,s.label,screenEnglish[s.screenKey],{screenId:m.screenKey,settings:{enabled:true,visible:m.enabled,readOnly:false,required:false,order:m.order},permissions:m.permissions});}
for(const s of standard.sections){const id='section:'+s.sectionKey;legacyMap.set(s.sectionKey,id);const ko=s.sectionKey.startsWith('account.profile.')?({identity:'식별 정보',hira:'심평원',address:'주소',basic:'기본 정보',erp:'ERP',manage:'관리'}[s.label]??s.label):s.label;add(id,'SECTION',s.labelKey,ko,sectionEnglish[s.sectionKey],{screenId:s.screenKey});aliases.push({kind:'SECTION',legacyId:s.sectionKey,id});}
for(const tab of standard.tabs){const replaced=semantic.tabs.some(x=>x.screenKey===tab.screenKey);add('tab:'+tab.tabKey,'TAB',tab.labelKey,'기본','Main',{screenId:tab.screenKey,support:replaced?'unsupported':'supported',settings:{enabled:!replaced,visible:!replaced,readOnly:false,required:false,order:tab.order},capabilities:replaced?[]:['enabled','visible','order']});aliases.push({kind:'TAB',legacyId:tab.tabKey,id:'tab:'+tab.tabKey,disposition:replaced?'REPLACED_BY_ACTUAL_TABS':'PRESERVED'});}
for(const tabs of semantic.tabs)for(const [i,key] of tabs.actualTabs.entries()){const id=`tab:${tabs.screenKey}.${key}`;if(entries.some(x=>x.id===id))continue;add(id,'TAB',`customization.tabs.${tabs.screenKey}.${key}`,...tabLabels[key],{screenId:tabs.screenKey,settings:{enabled:true,visible:true,readOnly:false,required:false,order:i}});bindings.push({id,source:tabs.source,expression:key,status:'SOURCE_DECLARATION',runtimeStatus:'NOT_RUN'});}
const queries=new Set(['lead.search','activity.mapDate','activity.calendarFrom','activity.calendarTo','order.search','order.category','order.itemType','ledger.accountPublicId','ledger.contractPublicId','ledger.from','ledger.to','ledger.general','statement.selectedRows','analytics.from','analytics.to']);
const devices=new Set(['activity.latitude','activity.longitude']);
const derived=new Set(['home.newLeadCount','home.todayActivityCount','home.pipelineAmount','home.pendingApprovalCount','ops.status','ops.checkedAt']);
for(const f of standard.fields){
 const mapping=semantic.fields.find(x=>x.fieldKey===f.fieldKey),leaf=f.fieldKey.split('.').at(-1),ko=f.label===f.fieldKey?koreanFields[leaf]:f.label,en=englishFields[leaf];
 const missing=['REGISTRY_UI_GAP','NO_RENDER_BINDING_FOUND'].includes(mapping.status);
 const bindingKind=queries.has(f.fieldKey)?'QUERY':devices.has(f.fieldKey)?'DEVICE':derived.has(f.fieldKey)?'DERIVED':'DATA';
 const required=f.requiredRule?.kind==='constant'&&f.requiredRule.value===true||mapping.dynamicDefinition?.required===true;
 add(f.fieldKey,'FIELD',f.labelKey,ko,en,{screenId:mapping.screenKey,parentId:legacyMap.get(f.sectionKey),bindingKind,
   support:missing?'decision_pending':'supported',settings:{enabled:!missing,visible:f.visible,readOnly:f.readOnly||bindingKind==='DERIVED',required,order:standard.fields.indexOf(f)},
   capabilities:f.locked?[]:['enabled','visible','readOnly','required','order'],locks:f.locked?['enabled','visible','readOnly','required','order']:[],
   invariantRequired:required,...(f.requiredRule?.kind!=='constant'?{requiredWhen:f.requiredRule}:{}),valueRule:f.valueRule,readPermissions:f.readPermissions,writePermissions:f.writePermissions,...(mapping.apiField?{apiField:mapping.apiField}:{})});
 const newEntry=entries.at(-1);if(!newEntry.parentId)delete newEntry.parentId;
 bindings.push({id:f.fieldKey,bindingKind,bindingReason:queries.has(f.fieldKey)?'Explicit search/date/filter/selection input; not a record write':devices.has(f.fieldKey)?'Geolocation device input':derived.has(f.fieldKey)?'Explicit dashboard aggregate or server health computation':'Business data or command value; readOnly does not imply derived',apiField:mapping.apiField,dbField:mapping.dbField,sourceEvidence:mapping.sourceEvidence,translationBindings:mapping.uiTranslationKeys,sourceStatus:mapping.status,runtimeStatus:'NOT_RUN',configurationConsumption:'NOT_INTEGRATED',followup:missing?'Q03_OR_DOMAIN_GAP':'I03_AND_DOMAIN_PACKAGE',dynamicDefinition:mapping.dynamicDefinition??null,baselineRequiredRule:f.requiredRule,observedRequired:f.observedRequired});
}
for(const a of standard.actions){
 const [ko,en]=actionLabels[a.actionKey]??[];const mapping=semantic.actions.find(x=>x.actionKey===a.actionKey);
 const replacement=a.actionKey==='ADM.standard.publish';
 add(a.actionKey,'ACTION',a.labelKey,ko,en,{screenId:a.screenKey,permissions:a.permissions,dependencies:a.requiredFieldKeys,support:replacement?'unsupported':'supported',settings:{enabled:!replacement,visible:true,readOnly:false,required:false,order:0},capabilities:replacement?[]:['enabled','visible','order']});
 const endpoint=a.actionKey==='CONTACT.create'?'POST /api/accounts/:id/contacts':a.actionKey==='ACC360.open'?'GET /api/accounts/:id/customer-detail':a.endpoint;
 bindings.push({id:a.actionKey,endpoint,legacyEndpoint:a.endpoint,sourceEvidence:mapping.sourceEvidence,triggerControls:mapping.triggerControls,status:replacement?'REPLACE_WITH_ARTIFACT_PUBLISH':mapping.status,runtimeStatus:'NOT_RUN',configurationConsumption:'NOT_INTEGRATED'});
}
const popupEnglish=['Create lead','Assign lead owner','Convert lead','Edit contact','Bulk account ledger','Merge accounts','Reset mock dataset'];
for(const [i,p] of semantic.popups.entries()){
 const mock=p.screenKey==='SHARED_HQ';add(p.id,'POPUP',`customization.popups.${p.id}`,p.label,popupEnglish[i],{...(mock?{}:{screenId:p.screenKey}),support:mock?'unsupported':'supported',settings:{enabled:!mock,visible:!mock,readOnly:false,required:false,order:i},capabilities:mock?[]:['enabled','visible','order']});
 bindings.push({id:p.id,actionKeys:p.actionKeys,sourceEvidence:[...p.triggerEvidence,...p.componentEvidence],runtimeStatus:'NOT_RUN',configurationConsumption:'NOT_INTEGRATED'});
}
const processEn=['Lead nurturing and conversion','Account and ERP registration','Activity planning and execution','Activity reports and approval','Direct work approval','Opportunities and sales','Contracts and ERP approval','Collection planning and receipts','Orders and delivery','Ledger and statements','Analytics','Operations status','Home','Administration'];
standard.processes.forEach((p,i)=>label(p.labelKey,p.label,processEn[i]));
const ui=semantic.unregisteredUi.map((control,index)=>{
 const [kind,key,target,reason]=dispositions[index];assert.ok(kind&&key&&target);
 const knownActionIds=target.split('|');if(kind==='ACTION')for(const id of knownActionIds)assert.ok(standard.actions.some(x=>x.actionKey===id),id);
 if(kind==='FIELD')assert.ok(standard.fields.some(x=>x.fieldKey===target),target);
 return {uiBindingId:'ui.'+key,captureId:control.id,file:control.file,line:control.line,tag:control.tag,handler:control.behaviour,kind,target,reason:reason??({FIXED:'Close, cancel, reload or local draft navigation; not independently disableable',ACTION:'Existing action is the policy owner, including opening its editor',FIELD:'Existing data field is the policy owner',NEW_INPUT:'Missing input registration; domain package must implement its policy binding',NEW_QUERY:'Query input, not a persistent record write',TAB:'Actual tab identity is selected at runtime',REGION:'Region collapse is presentation only',DYNAMIC_FIELD:'Concrete field IDs come from the referenced definition, not this source line',MOCK_ONLY:'Test harness only, excluded from company business configuration',REPLACED_ADMIN:'Raw editor is replaced by reviewed configuration/artifact API in I02/I03'}[kind]),runtimeStatus:'NOT_RUN',configurationConsumption:'NOT_INTEGRATED'};
});
assert.equal(new Set(ui.map(x=>x.uiBindingId)).size,ui.length);
const newFields={
 'account.search':['HQ_ACCOUNT','거래처 검색','Account search','search'], 'account.scope':['HQ_ACCOUNT','조회 범위','Data scope','scope'],
 'account360.record':['HQ_ACCOUNT360','거래처 선택','Select account','record'], 'merge.fieldSources':['HQ_ACCOUNT','병합 필드 원본','Merge field sources','fieldSources'],
 'report.from':['HQ_ACTIVITY_REPORT','보고 시작일','Report start date','from'], 'report.to':['HQ_ACTIVITY_REPORT','보고 종료일','Report end date','to'],
 'fulfillment.orderId':['HQ_FULFILLMENT','주문 선택','Select order','orderId'],
 'admin.userName':['HQ_ADMIN_USERS','사용자 이름','User name','name'], 'admin.userActive':['HQ_ADMIN_USERS','사용자 사용 여부','User active','active'],
 'admin.organizationName':['HQ_ADMIN_USERS','조직명','Organization name','name'], 'admin.organizationActive':['HQ_ADMIN_USERS','조직 사용 여부','Organization active','active'],
 'admin.roleKey':['HQ_ADMIN_PERMISSIONS','역할 선택','Select role','roleKey'], 'admin.codeGroup':['HQ_ADMIN_CODES','코드 그룹','Code group','groupCode'],
 'admin.codeLabel':['HQ_ADMIN_CODES','코드 표시명','Code label','label'], 'admin.codeActive':['HQ_ADMIN_CODES','코드 사용 여부','Code active','active'],
 'admin.auditQuery':['HQ_ADMIN_AUDIT','감사 이력 검색','Search audit history','query'], 'lead.scope':['HQ_LEAD','리드 조회 범위','Lead data scope','scope'],
 'lead.stageFilter':['HQ_LEAD','리드 단계 필터','Lead stage filter','stage'], 'opportunity.recordType':['HQ_OPPORTUNITY','기회 유형','Opportunity type','recordType']
};
for(const [id,[screenId,ko,en,apiField]] of Object.entries(newFields)){
 const occurrences=ui.filter(x=>x.target===id);assert.ok(occurrences.length,id);const bindingKind=occurrences[0].kind==='NEW_QUERY'?'QUERY':'DATA';
 add(id,'FIELD','customization.fields.'+id,ko,en,{screenId,bindingKind,apiField,support:'unsupported',settings:{enabled:false,visible:true,readOnly:false,required:false,order:entries.length},capabilities:[],valueRule:{type:id==='merge.fieldSources'?'rows':id.endsWith('Active')?'boolean':'string'}});
 bindings.push({id,bindingKind,apiField,uiBindingIds:occurrences.map(x=>x.uiBindingId),sourceEvidence:occurrences.map(x=>({file:x.file,line:x.line,handler:x.handler})),sourceStatus:'REGISTERED_FROM_C00_UI',runtimeStatus:'NOT_RUN',configurationConsumption:'NOT_INTEGRATED',followup:'DOMAIN_ADAPTER_REQUIRED'});
}
const errors={INVALID_CATALOG:['등록부 형식이 올바르지 않습니다.','Invalid catalog format.'],INVALID_ENTRY:['등록 항목이 올바르지 않습니다.','Invalid catalog entry.'],DUPLICATE_ID:['식별자가 중복되었습니다.','Duplicate identifier.'],INVALID_SETTINGS:['설정 값이 올바르지 않습니다.','Invalid settings.'],INVALID_PROPERTY:['설정 속성이 올바르지 않습니다.','Invalid configuration property.'],INVALID_LIST:['설정 목록이 올바르지 않습니다.','Invalid configuration list.'],INVALID_REFERENCE:['참조 식별자가 올바르지 않습니다.','Invalid reference identifier.'],INVALID_BINDING:['필드 연결이 올바르지 않습니다.','Invalid field binding.'],INVALID_VALUE_RULE:['값 검증 규칙이 올바르지 않습니다.','Invalid value constraints.'],INVALID_DEFAULT:['기본값이 필드 조건에 맞지 않습니다.','Default value does not satisfy field constraints.'],UNKNOWN_REFERENCE:['참조하는 항목이 없습니다.','Referenced entry does not exist.'],INVALID_SCREEN:['대상 화면이 올바르지 않습니다.','Invalid target screen.'],MENU_TARGET_REQUIRED:['메뉴에 대상 화면이 필요합니다.','Menu requires a target screen.'],DERIVED_READ_ONLY:['계산 필드는 읽기 전용이어야 합니다.','Derived fields must be read-only.'],DEPENDENCY_CYCLE:['설정 의존 관계가 순환합니다.','Configuration dependencies contain a cycle.'],INVALID_COMPANY:['법인 설정이 올바르지 않습니다.','Invalid company configuration.'],STANDARD_CONFLICT:['기준 표준 버전이 변경되었습니다.','The base standard version has changed.'],INVALID_PATCH:['변경 요청 형식이 올바르지 않습니다.','Invalid configuration change.'],DUPLICATE_PATCH:['같은 속성을 중복 변경할 수 없습니다.','The same property cannot be changed twice.'],UNKNOWN_TARGET:['설정 대상이 없습니다.','Configuration target does not exist.'],LOCKED_PROPERTY:['변경할 수 없는 속성입니다.','This property is locked.'],INVALID_VALUE:['설정 값의 형식이 올바르지 않습니다.','Invalid configuration value type.'],UNSUPPORTED_FEATURE:['지원이 준비되지 않은 기능입니다.','This feature is not ready for activation.'],MENU_TARGET_DISABLED:['메뉴의 대상 화면이 중지되어 있습니다.','The menu target screen is disabled.'],DEPENDENCY_MISSING:['필수 선행 기능을 사용할 수 없습니다.','A required dependency is unavailable.'],REQUIRED_INVARIANT:['필수 업무 조건을 해제할 수 없습니다.','A mandatory business requirement cannot be disabled.'],REQUIRED_UNREACHABLE:['필수값을 입력하거나 제공할 경로가 없습니다.','A required value cannot be entered or supplied.'],INVALID_LOCALE_CONFIGURATION:['언어 설정이 올바르지 않습니다.','Invalid language configuration.'],INVALID_TRANSLATION:['번역 문구가 올바르지 않습니다.','Invalid translation text.'],TRANSLATION_REQUIRED:['활성 언어의 필수 번역이 없습니다.','A required translation is missing for an active language.'],TRANSLATION_MARKUP:['번역 문구에 HTML을 사용할 수 없습니다.','HTML is not allowed in translation text.'],TRANSLATION_TOKENS:['번역의 삽입 변수가 일치하지 않습니다.','Translation placeholders do not match.']};
Object.assign(errors, {
  ACTION_TARGET_UNAVAILABLE: ['이 동작이 참조하는 항목을 사용할 수 없습니다.', 'The target of this action is unavailable.'],
  COLUMN_ORDER_PLACEMENT_REQUIRED: ['목록에 배치한 열만 순서를 변경할 수 있습니다.', 'Add the column to the list before changing its order.'],
  DUPLICATE_GRID_COLUMN: ['목록에 같은 열이 두 번 들어갔습니다.', 'A list column was added twice.'],
  GRID_COLUMN_UNAVAILABLE: ['이 목록에서 사용할 수 없는 열입니다.', 'This column is unavailable in the list.'],
  INVALID_BUTTON_PRESENTATION: ['버튼 표시 설정을 확인하세요.', 'Check the button display settings.'],
  INVALID_COLUMN_ALIGNMENT: ['열 정렬 설정을 확인하세요.', 'Check the column alignment.'],
  INVALID_COLUMN_PLACEMENT: ['열의 배치 위치를 확인하세요.', 'Check the column placement.'],
  INVALID_COLUMN_WIDTH: ['열 너비 설정을 확인하세요.', 'Check the column width.'],
  INVALID_EXTENSION_LAYOUT: ['추가 필드의 배치를 확인하세요.', 'Check the layout of the added fields.'],
  INVALID_GRID_COLUMNS: ['목록에 포함할 열을 확인하세요.', 'Check the selected list columns.'],
  INVALID_LEAD_GRID: ['리드 목록 설정을 확인하세요.', 'Check the lead list settings.'],
  INVALID_POPUP_PRESENTATION: ['팝업 표시 설정을 확인하세요.', 'Check the dialog display settings.'],
});
for(const [code,text] of Object.entries(errors))label('customization.errors.'+code,...text);
label('customization.errors.INVALID_REQUIRED_CONDITION','조건부 필수 규칙이 올바르지 않습니다.','Invalid conditional requirement.');
// Keep current UI labels, status/code names, errors and help strings in the same
// artifact namespace. These keys still need runtime consumer integration in I03.
const flatten=(value,prefix='',out={})=>{for(const [key,item] of Object.entries(value)){const full=prefix?prefix+'.'+key:key;if(typeof item==='string')out[full]=item;else if(item&&typeof item==='object')flatten(item,full,out);}return out;};
const existing={};
for(const locale of ['ko-KR','en-US'])existing[locale]=flatten(JSON.parse(fs.readFileSync(path.join(root,`frontend/src/i18n/locales/${locale}/common.json`),'utf8')));
for(const key of Object.keys(existing['ko-KR']))if(!translations['ko-KR'][key])label(key,existing['ko-KR'][key],existing['en-US'][key]);
const catalog={schemaVersion:1,standardReleaseId:'HQ.BASELINE.C01.1',entries};
assert.deepEqual(validateCatalog(catalog),[]);
assert.deepEqual(validateTranslations(entries,['ko-KR','en-US'],'ko-KR',translations,{}),[]);
const translationInventory=JSON.parse(fs.readFileSync(path.join(root,'docs/admin-platform/customization/implementation/evidence/I01/translation-inventory.json'),'utf8'));
const payload={artifactSchemaVersion:1,purpose:'REVIEWED_BASELINE_IMPORT_NOT_RUNTIME_RELEASE',publicationReady:false,blockingReasons:['Runtime policy consumers and server adapters are not integrated','New input/query bindings require domain integration','Domain gaps and Q decisions are disabled, not silently implemented','Hardcoded UI/server/export source strings have assigned migration keys but must be translated and consumed per domain before runtime publication'],catalog,translations,bindings,uiDispositions:ui,legacyAliases:aliases,dynamicFields:semantic.dynamicFields,sourceHashes:baseline.baseline.sourceHashes,translationMigration:{inventoryHash:hash(canonicalConfigJson(translationInventory)),sources:translationInventory.rows.filter(x=>x.status==='RUNTIME_REPLACEMENT_REQUIRED'),policy:'Assigned keys are pending migration, not approved translations. Use full template interpolation and locale formatting; keep persisted codes/user data unchanged.'},dependencyMigration:{preservedActionRequiredFields:true,sourceProcessDependencies:standard.processes.map(x=>({id:x.processKey,dependsOn:x.dependsOn})),pending:['Cross-domain lookup dependencies and state-sensitive ERP/approval guards require I02/domain adapters; source registry process dependencies are empty. Publication remains blocked until those guards are validated.']}};
const contentHash=hash(canonicalConfigJson(payload));
const artifact={contentHash,...payload};
const output=path.join(root,'packages/contracts/catalogs');fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'hq-customization-baseline.json'),JSON.stringify(artifact,null,2)+'\n');
fs.writeFileSync(path.join(root,'docs/admin-platform/customization/implementation/evidence/I01/catalog-summary.json'),JSON.stringify({contentHash,entries:entries.length,fields:standard.fields.length,actions:standard.actions.length,popups:semantic.popups.length,uiControls:ui.length,translationKeys:Object.keys(translations['ko-KR']).length,unresolvedFields:bindings.filter(x=>['REGISTRY_UI_GAP','NO_RENDER_BINDING_FOUND'].includes(x.sourceStatus)).map(x=>x.id),sourceMeaning:'Source presence is not feature acceptance',publicationReady:false},null,2)+'\n');
console.log(JSON.stringify({contentHash,entries:entries.length,ui:ui.length,translations:Object.keys(translations['ko-KR']).length}));
