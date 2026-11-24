// C00 semantic comparison: explicit aliases + expanded field definitions + source evidence.
// Source binding is NOT a runtime PASS or proof that company settings are applied.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import '../hq-standard/register.mjs';
import { LEAD_FIELDS, HOSPITAL_FIELDS, CONTACT_FIELDS, LEDGER_FIELDS } from '../../frontend/src/hq-mock/customer-model.ts';
import { ACCOUNT_INTERFACE_FIELDS } from '../../packages/contracts/src/account-interface.ts';
import { screenSources } from './comparison-data.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root,'docs/admin-platform/customization/evidence');
const baseline = JSON.parse(fs.readFileSync(path.join(out,'baseline.json'),'utf8'));
const require = createRequire(import.meta.url), ts = require(path.join(root,'frontend/node_modules/typescript/lib/typescript.js'));
const H = 'frontend/src/hq-mock/';
const read = f => fs.readFileSync(path.join(root,f),'utf8');
const astCache=new Map();
const ast=file=>{if(!astCache.has(file))astCache.set(file,ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX));return astCache.get(file);};
function outerAt(file,line){const sf=ast(file);return sf.statements.find(n=>ts.isFunctionDeclaration(n)&&sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1<=line&&sf.getLineAndCharacterOfPosition(n.end).line+1>=line)?.name?.text;}
function uiLabel(control){
  const sf=ast(control.file),offset=Number(control.id.split(':').at(-1));let found;
  const walk=n=>{if(n.getStart(sf)===offset&&(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)))found=n;if(!found)ts.forEachChild(n,walk);};walk(sf);
  let label=found?.parent;
  if(['input','textarea','select'].includes(control.tag))while(label&&!(ts.isJsxElement(label)&&label.openingElement.tagName.getText(sf)==='label'))label=label.parent;
  const expression=label&&ts.isJsxElement(label)?label.children.filter(n=>ts.isJsxText(n)||ts.isJsxExpression(n)&&n.expression&&!ts.isJsxElement(n.expression)).map(n=>n.getText(sf).trim()).join(' ').slice(0,500):control.labelExpression;
  const keys=[...new Set([...expression.matchAll(/\bt\('([^']+)'/g)].map(m=>m[1]))];
  return {expression,translationKeys:keys,translations:Object.fromEntries(Object.entries(locales).map(([l,o])=>[l,keys.map(k=>lookup(o,k)??`MISSING:${k}`)]))};
}
const getLocale = l => JSON.parse(read(`frontend/src/i18n/locales/${l}/common.json`));
const locales = {'ko-KR':getLocale('ko-KR'),'en-US':getLocale('en-US')};
const lookup = (o,k) => k.split('.').reduce((v,p)=>v?.[p],o);
const references = (file, needle, owner) => {
  const text=read(file), sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let start=0,end=text.length;
  if(owner){const fn=sf.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===owner);if(!fn)return [];start=fn.getStart(sf);end=fn.end;}
  const refs=[];let at=text.indexOf(needle,start);
  while(at>=0&&at<end){const line=sf.getLineAndCharacterOfPosition(at).line+1;refs.push({file,line,needle,excerpt:text.split(/\r?\n/)[line-1]?.trim().slice(0,600)});at=text.indexOf(needle,at+needle.length);}
  return refs;
};
const ownerByScreen={HQ_HOME:'HqHomePage',HQ_LEAD:'HqLeadDetail',HQ_ACCOUNT:'AccountsPage',HQ_ACTIVITY:'HqActivitiesPage',HQ_ACTIVITY_REPORT:'HqActivityReportsPage',HQ_DIRECT_WORK:'HqDirectWorkPage',HQ_OPPORTUNITY:'HqOpportunitiesPage',HQ_PIPELINE:'HqPipelineView',HQ_CONTRACT:'HqContractsPage',HQ_ORDER:'HqOrdersPage',HQ_FULFILLMENT:'HqFulfillmentView',HQ_LEDGER:'HqLedgerView',HQ_ANALYTICS:'HqAnalyticsView',HQ_ACCOUNT360:'HqAccount360Page',HQ_OPS:'HqMockOpsPage',HQ_ADMIN_USERS:'HqAdminUsersPage',HQ_ADMIN_PERMISSIONS:'HqAdminPermissionsPage',HQ_ADMIN_CODES:'HqAdminCodesPage',HQ_ADMIN_INTERFACES:'HqAdminInterfacesPage',HQ_ADMIN_AUDIT:'HqAdminAuditPage'};
const aliases={
  'lead.search':'value={search}', 'lead.status':'saved-lead-stage', 'lead.targetStatus':'aria-pressed={selectedStage === value}', 'lead.ownerUserId':'value={ownerUserId}', 'lead.history':'rows={history.data', 'lead.reason':'value={reason}',
  'conversion.accountMode':'value={accountMode}', 'conversion.existingAccountPublicId':'value={accountId}', 'conversion.contactMode':'value={contactMode}', 'conversion.existingContactPublicId':'value={contactId}', 'conversion.opportunityMode':'value={opportunityMode}', 'conversion.existingOpportunityPublicId':'value={opportunityId}', 'conversion.ownerUserId':'value={ownerUserId}', 'conversion.contactName':'value={contactName}', 'conversion.opportunityName':'value={opportunityName}',
  'merge.primaryPublicId':'value={primaryId}', 'merge.duplicatePublicIds':'checked={selected.includes(row.public_id)}', 'account.bulkRows':'drafts.map(',
  'activity.consultation':'value={consultation}', 'activity.mapDate':'value={day}', 'activity.calendarFrom':'const from =', 'activity.calendarTo':'const to =', 'activity.latitude':'latitude: point.coords.latitude','activity.longitude':'longitude: point.coords.longitude',
  'report.date':'value={day}', 'report.consultationSnapshot':'value={itemText[item.report_item_id]', 'report.branchComment':'value={comment}', 'report.divisionComment':'value={comment}',
  'directWork.comment':'value={comment}','directWork.decision':"decide('APPROVE')",'directWork.reassignStep':'const reassignStep =','directWork.approverUserId':'value={reassignUser}','directWork.reassignReason':'value={reassignReason}',
  'opportunity.targetStage':'value={targetStage}','opportunity.reason':'value={reason}',
  'order.contractPublicId':'value={contractId}', 'order.itemType':'value={itemType}', 'order.category':'value={category}','order.search':'value={search}','order.productPublicId':'value={productId}','order.quantity':'value={quantity}', 'order.deliveryAddressType':'value={deliveryType}','order.deliveryAddress':'value={deliveryAddress}','order.expressYn':'checked={express}','order.note':'value={note}','order.lab':'value={labId}','order.labPublicId':'value={labId}',
  'ledger.accountPublicId':'value={accountId}','ledger.contractPublicId':'value={contractId}','ledger.general':'<option value="">일반 거래</option>','ledger.from':'value={from}','ledger.to':'value={to}','statement.selectedRows':'checked={selected.includes(row.public_id)}','analytics.from':'value={from}','analytics.to':'value={to}',
  'admin.userId':'value={userId}','admin.organizationId':'value={organizationId}','admin.permissionCode':'value={permissions}','admin.scope':'value={scope}','admin.commonCode':'value={code}','admin.interfaceStatus':"'status','scenario'",'admin.auditAt':"['at','action'",'home.pendingApprovalCount':'data.data?.pendingReports',
  'ops.status':'data.data?.database.status', 'contact.accountPublicId':'accountPublicId: account.public_id'
};
const absentReasons={
  'report.futurePlan':'등록부 필드가 있으나 HqActivityReportsPage에 futurePlan 입력·표시가 없음',
  'report.accompaniedYn':'등록부 필드가 있으나 HqActivityReportsPage에 accompaniedYn 입력·표시가 없음',
  'contract.contractType':'등록부 계약유형과 실제 계약 폼의 packageClassification은 별개이며 contractType 입력이 없음',
  'opportunity.competitorUsage':'등록부·API 메타데이터는 있으나 현재 기회 폼에 해당 입력 없음',
  'opportunity.ownedEquipment':'등록부·API 메타데이터는 있으나 현재 기회 폼에 해당 입력 없음',
  'opportunity.treatmentFeeInfo':'등록부·API 메타데이터는 있으나 현재 기회 폼에 해당 입력 없음',
  'opportunity.installmentMonths':'등록부·API 메타데이터는 있으나 현재 기회 폼에 해당 입력 없음',
  'home.newLeadCount':'현재 홈은 collections counts를 일반 표로 표시하며 신규 리드 집계 전용 값과 의미가 다름',
  'home.todayActivityCount':'현재 홈의 전체 activities 건수와 오늘 활동 건수를 같은 값으로 간주할 수 없음',
  'home.pipelineAmount':'현재 홈에 파이프라인 금액 전용 표시 없음',
  'ops.checkedAt':'등록부 apiField at와 현재 운영 화면 표시 항목 불일치; 확인 시각 미표시'
};
function sectionScreen(field){return baseline.standard.sections.find(s=>s.sectionKey===field.sectionKey)?.screenKey;}
const fields=baseline.standard.fields.map(f=>{
  const screenKey=sectionScreen(f), candidates=screenSources[screenKey]??[];
  const row={fieldKey:f.fieldKey,screenKey,sectionKey:f.sectionKey,label:f.label,registryTranslationKey:f.labelKey,apiField:f.current.apiField??null,dbField:f.current.dbField??null,
    settings:{visible:f.visible,readOnly:f.readOnly,requiredRule:f.requiredRule,locked:f.locked,overridePolicy:f.overridePolicy},permissions:{read:f.readPermissions,write:f.writePermissions},
    actionKeys:baseline.standard.actions.filter(a=>a.inputFieldKeys.includes(f.fieldKey)).map(a=>a.actionKey),
    runtimeStatus:'NOT_INDIVIDUALLY_TESTED',configurationStatus:'PARTIAL_OR_NOT_PROVEN',sourceEvidence:[],uiTranslationKeys:[],status:'NO_RENDER_BINDING_FOUND',reason:''};
  if(absentReasons[f.fieldKey]){row.reason=absentReasons[f.fieldKey];row.status='REGISTRY_UI_GAP';return row;}
  const array=f.entity==='lead'?LEAD_FIELDS:f.entity==='contact'?CONTACT_FIELDS:f.fieldKey.startsWith('account.')?HOSPITAL_FIELDS:[];
  const def=array.find(d=>d.key===f.current.apiField);
  if(def){row.status='DYNAMIC_FIELD_BOUND';row.reason='CustomerField 정의 → HqFields → payload/policy 연결. required는 정적 정의라 법인별 필수 설정 완료 아님';
    row.sourceEvidence=references(H+'customer-model.ts',`key: '${def.key}'`);row.sourceEvidence.push(...references(H+'customer-shared.tsx','export function HqFields'));
    row.uiTranslationKeys=[`hqCustomer.fields.${def.key}`];row.dynamicDefinition=def;return row;}
  if(f.fieldKey.startsWith('account.erp.')){const code=f.fieldKey.slice('account.erp.'.length),def=ACCOUNT_INTERFACE_FIELDS.find(x=>x.code===code);
    if(def){row.status='DYNAMIC_INTERFACE_FIELD_BOUND';row.reason='ACCOUNT_INTERFACE_FIELDS → FORM_SECTIONS/fieldsByCodes → fieldInput/interfaceDisplay 연결. 현재 폼 label은 field.nameKo 직접 표시: 번역 적용 누락';row.dynamicDefinition=def;row.sourceEvidence=[...references('packages/contracts/src/account-interface.ts',`code: '${code}'`),...references('frontend/src/AccountsPage.tsx','const fieldInput ='),...references('frontend/src/AccountsPage.tsx','fieldsByCodes(section.codes)'),...references('frontend/src/AccountsPage.tsx','{field.nameKo}')];row.translationGap='FIXED_KOREAN_METADATA_LABEL';return row;}}
  const alias=aliases[f.fieldKey];
  for(const file of candidates.filter(x=>x.endsWith('.tsx')&&!x.endsWith('customer-shared.tsx'))){
    const owner=file.endsWith('HqActivityPages.tsx')||file.endsWith('HqSalesPages.tsx')||file.endsWith('HqH06Pages.tsx')||file.endsWith('HqH07Pages.tsx')?ownerByScreen[screenKey]:undefined;
    const needles=alias?[alias]:[f.current.apiField?`value={create.${f.current.apiField}}`:null,f.current.apiField?`value={edit.${f.current.apiField}}`:null,f.current.apiField?`value={value.${f.current.apiField}}`:null,f.current.apiField?`value={row.${f.current.apiField}}`:null,f.current.apiField?`value={product.${f.current.apiField}}`:null,
      f.current.dbField?`current.${f.current.dbField}`:null,f.current.dbField?`row.${f.current.dbField}`:null,f.current.dbField?`selected.${f.current.dbField}`:null,f.current.dbField?`key: '${f.current.dbField}'`:null].filter(Boolean);
    for(const needle of needles)row.sourceEvidence.push(...references(file,needle,owner));
  }
  if(row.sourceEvidence.length){row.status=alias&&['activity.latitude','activity.longitude','activity.calendarFrom','activity.calendarTo','directWork.reassignStep','contact.accountPublicId'].includes(f.fieldKey)?'DERIVED_OR_DEVICE_VALUE':'SOURCE_BINDING_PRESENT';row.reason='명시한 UI 값/표시식 또는 소스 속성 대응. 전체 런타임·필드 설정 완료 판정 아님';
    row.uiTranslationKeys=[...new Set(row.sourceEvidence.flatMap(e=>[...e.excerpt.matchAll(/\bt\('([^']+)'/g)].map(m=>m[1])))];
  }else{row.reason=`현재 ${screenKey} 연결 소스에서 해당 필드 renderer를 확인하지 못함. 구현 누락 또는 별도 매핑 필요`;row.searchedFiles=candidates;}
  return row;
});
// Explicit handler/navigation exceptions for endpoints assembled from variables.
const actionAliases={
 'HOME.refresh':[H+'HqH07Pages.tsx',"('home', '/api/hq/home')"], 'OPS.refresh':[H+'HqH07Pages.tsx','void data.refetch()'],
 'ADM.SCR-ADM-001.read':[H+'HqH07Pages.tsx',"('users', '/api/hq/admin/users')"], 'ADM.SCR-ADM-002.read':[H+'HqH07Pages.tsx',"('roles','/api/hq/admin/roles')"],
 'ADM.SCR-ADM-003.read':[H+'HqH07Pages.tsx',"('codes','/api/hq/admin/common-codes')"], 'ADM.SCR-ADM-004.read':[H+'HqH07Pages.tsx',"('interfaces','/api/interface-logs')"], 'ADM.SCR-ADM-005.read':[H+'HqH07Pages.tsx',"('audit','/api/audit-logs')"],
 'ACC.open':['frontend/src/AccountsPage.tsx','setSelectedId('], 'ACC.fromLead':['frontend/src/hq-mock/HqLeadsPage.tsx','conversion-account-link'], 'ACC360.open':[H+'HqAccountDetail.tsx','/customer-detail'],
 'ACT.checkIn':[H+'HqActivityPages.tsx',"check(selected, 'check-in'"], 'ACT.checkOut':[H+'HqActivityPages.tsx',"check(selected, 'check-out'"],
 'REP.approveBranch':[H+'HqActivityPages.tsx',"decision('approve')"], 'REP.approveDivision':[H+'HqActivityPages.tsx',"decision('approve')"],
 'REP.commentBranch':[H+'HqActivityPages.tsx',"decision('comment')"], 'REP.commentDivision':[H+'HqActivityPages.tsx',"decision('comment')"],
 'REP.rejectBranch':[H+'HqActivityPages.tsx',"decision('reject')"], 'REP.rejectDivision':[H+'HqActivityPages.tsx',"decision('reject')"],
 'DW.decision.branch':[H+'HqActivityPages.tsx',"decide('APPROVE')"], 'DW.decision.division':[H+'HqActivityPages.tsx',"decide('APPROVE')"],
 'CONTACT.create':[H+'HqAccountDetail.tsx','`/api/accounts/${account.public_id}/contacts`'],
 'ADM.SCR-ADM-005.inspect':[H+'HqH07Pages.tsx','JSON.stringify(row.details'], 'ADM.SCR-ADM-001.edit':[H+'HqH07Pages.tsx','`/api/hq/admin/users/${userId}`'],
 'ADM.users.save':[H+'HqH07Pages.tsx','`/api/hq/admin/users/${userId}`'], 'ADM.organizations.save':[H+'HqH07Pages.tsx','`/api/hq/admin/organizations/${orgId}`'],
 'ADM.SCR-ADM-002.edit':[H+'HqH07Pages.tsx','`/api/hq/admin/roles/${roleKey}`'], 'ADM.permissions.save':[H+'HqH07Pages.tsx','`/api/hq/admin/roles/${roleKey}`']
};
const norm=s=>s.replace(/^['"`]|['"`]$/g,'').replace(/\$\{[^}]+\}/g,':param').replace(/:[A-Za-z][A-Za-z0-9_]*/g,':param').split('?')[0];
const methods={apiGet:'GET',apiPost:'POST',apiPatch:'PATCH',apiDelete:'DELETE',apiDownload:'GET',apiPostDownload:'POST'};
const actions=baseline.standard.actions.map(a=>{
  const candidates=screenSources[a.screenKey]??[], parts=(a.endpoint??'').split(' '), expected=norm(parts.slice(1).join(' '));
  const matches=baseline.calls.filter(c=>candidates.includes(c.file)).filter(c=>{
    const isCommand=['command.run','hqCommand.run'].includes(c.callee);
    const method=isCommand?c.arguments[0]?.replace(/['"]/g,''):methods[c.callee];const url=c.arguments[isCommand?1:0]??'';
    const contactAlias=a.actionKey==='CONTACT.create'&&c.file===H+'HqAccountDetail.tsx'&&norm(url)==='/api/accounts/:param/contacts';
    return method===parts[0]&&(norm(url)===expected||contactAlias)&&!(a.screenKey==='HQ_ACCOUNT'&&c.owner==='HqAccount360Page');
  });
  const manual=actionAliases[a.actionKey], sourceEvidence=manual?references(...manual):matches.map(c=>({file:c.file,line:c.line,needle:c.arguments.join(', '),excerpt:c.arguments.join(', ').slice(0,600)}));
  const row={actionKey:a.actionKey,screenKey:a.screenKey,label:a.label,registryTranslationKey:a.labelKey,endpoint:a.endpoint,permissions:a.permissions,inputFieldKeys:a.inputFieldKeys,sourceEvidence,
    actualCalls:matches, status:sourceEvidence.length?'SOURCE_HANDLER_BOUND':'NO_UI_CALL_MATCH',runtimeStatus:'NOT_INDIVIDUALLY_TESTED',configurationStatus:'PARTIAL_OR_NOT_PROVEN'};
  if(manual)row.bindingNote='수동 지정한 handler/navigation 위치. 동적 경로 또는 등록부와 실제 호출의 차이는 아래 메모 참조';
  if(a.actionKey==='CONTACT.create'){row.status='ENDPOINT_ALIAS_DIFFERENCE';row.bindingNote='등록부 POST /api/contacts, UI POST /api/accounts/:id/contacts. 서버에 양쪽 경로가 있으므로 통합 계약에서 별칭/단일 경로 결정 필요';}
  if(a.actionKey==='ACC360.open'){row.status='ENDPOINT_DIFFERENCE';row.bindingNote='등록부 /api/analytics/accounts/:id/360, HQ 화면 HqAccountDetail은 /api/accounts/:id/customer-detail 소비';}
  if(a.actionKey==='ACC.open'){row.bindingNote='목록에서 선택한 행을 detail로 넘긴 후 customer-detail 조회. 등록부 GET /api/accounts/:id와 동일한 클릭→API 관계로 단정하지 않음';}
  if(a.actionKey==='ACC.fromLead')row.bindingNote='전환 결과 링크로 /accounts?record=... 이동. 별도 API 버튼이 아님';
  row.triggerControls=baseline.controls.filter(c=>candidates.includes(c.file)&&['button','form','input','select'].includes(c.tag)).filter(c=>{
    const event=c.attributes.onClick??c.attributes.onSubmit??c.attributes.onChange??'';
    return matches.some(m=>m.file===c.file&&outerAt(m.file,m.line)===outerAt(c.file,c.line)&&(
      (!m.owner.startsWith('Hq')&&m.owner!=='AccountsPage'&&new RegExp(`\\b${m.owner}\\b`).test(event))||(event.includes(m.callee)&&(!['command.run','hqCommand.run'].includes(m.callee)||event.includes(m.arguments[0]))&&m.arguments.some(arg=>arg.startsWith('`/api/')||arg.startsWith("'/api/")?event.includes(arg):false))))
      ||manual&&manual[0]===c.file&&event.includes(manual[1]);
  }).map(c=>({id:c.id,file:c.file,line:c.line,tag:c.tag,behaviour:c.attributes.onClick??c.attributes.onSubmit??c.attributes.onChange,label:uiLabel(c)}));
  row.triggerStatus=row.triggerControls.length?'EXPLICIT_EVENT_BINDING':'AUTO_QUERY_OR_NAVIGATION_OR_INLINE_HANDLER';
  return row;
});
const popupDefinitions=[
 ['POP.LEAD.CREATE','HQ_LEAD','신규 리드',H+'HqLeadsPage.tsx','setCreating(true)','creating &&','LEAD.create'],
 ['POP.LEAD.OWNER','HQ_LEAD','소유자 변경',H+'HqLeadsPage.tsx','setOwnerOpen(true)','ownerOpen &&','LEAD.assignOwner'],
 ['POP.LEAD.CONVERT','HQ_LEAD','리드 전환',H+'HqLeadsPage.tsx','setConvertOpen(true)','function LeadConversion','LEAD.convert'],
 ['POP.ACC.CONTACT','HQ_ACCOUNT','연락처 등록·수정',H+'HqAccountDetail.tsx','setOpen(true)','function ContactEditor','CONTACT.create,CONTACT.save,CONTACT.delete'],
 ['POP.ACC.BULK','HQ_ACCOUNT','관리대장 다중행',H+'HqAccountTools.tsx',"setMode('ledger')",'function AccountLedger','ACC.bulkSave'],
 ['POP.ACC.MERGE','HQ_ACCOUNT','거래처 병합',H+'HqAccountTools.tsx',"setMode('merge')",'function AccountMerge','ACC.merge'],
 ['POP.DATASET.RESET','SHARED_HQ','목업 초기화',H+'HqMockControls.tsx','void previewReset()','<dialog','MOCK_RESET_NOT_BUSINESS_ACTION']
];
const popups=popupDefinitions.map(([id,screenKey,label,file,trigger,component,actionKeys])=>({id,screenKey,label,file,trigger,component,actionKeys:actionKeys.split(','),triggerEvidence:references(file,trigger),componentEvidence:references(file,component),
  runtimeStatus:id==='POP.LEAD.CREATE'?'OPEN_CLOSE_ONLY_PASS_PC_MOBILE':'NOT_REEXECUTED',saveCancelErrorStatus:'NOT_EXHAUSTIVELY_VERIFIED',registryPopupId:'NOT_REGISTERED_AS_DISTINCT_POPUP'}));
const hqFiles=new Set([...Object.values(screenSources).flat(),H+'HqMockControls.tsx',H+'customer-shared.tsx']);
const controls=baseline.controls.filter(c=>hqFiles.has(c.file)).map(c=>{
  const fieldIds=fields.filter(f=>f.sourceEvidence.some(e=>e.file===c.file&&e.line===c.line)).map(f=>f.fieldKey);
  const actionIds=actions.filter(a=>a.sourceEvidence.some(e=>e.file===c.file&&e.line===c.line)).map(a=>a.actionKey);
  const behaviour=c.attributes.onClick??c.attributes.onSubmit??c.attributes.onChange??c.attributes.onClose??null;
  const translations=[...new Set([...JSON.stringify({label:c.labelExpression,attrs:c.attributes}).matchAll(/\bt\('([^']+)'/g)].map(m=>m[1]))];
  return {...c,relatedFieldIds:fieldIds,relatedActionIds:actionIds,relationMethod:'SOURCE_LINE_GROUP_NOT_ONE_TO_ONE',behaviour,translationKeys:translations,
    uiLabel:uiLabel(c),
    semanticMapping:fieldIds.length||actionIds.length?'RELATED_REGISTRY_SOURCE_GROUP':behaviour?'UI_BEHAVIOUR_WITHOUT_DISTINCT_REGISTRY_BINDING':'PRESENTATION_OR_DYNAMIC_CONTAINER',
    disposition:fieldIds.length||actionIds.length?'소스 행의 등록부 관련 요소. 동일 행의 개별 컨트롤 확정은 아님':behaviour?'이동·선택·닫기 등 UI 동작 또는 미등록 기능. handler 원문을 보존하고 설정 대상 추가 여부는 설계에서 결정':'폼/탭/표시 컨테이너 또는 동적 공통 renderer'};
});
const dynamicFields=[['LEAD_FIELDS','HQ_LEAD',LEAD_FIELDS],['HOSPITAL_FIELDS','HQ_ACCOUNT',HOSPITAL_FIELDS],['CONTACT_FIELDS','HQ_ACCOUNT',CONTACT_FIELDS],['LEDGER_FIELDS','HQ_ACCOUNT',LEDGER_FIELDS]].flatMap(([definition,screenKey,defs])=>defs.map(d=>({definition,screenKey,...d,
  fieldIds:baseline.standard.fields.filter(f=>f.current.apiField===d.key&&(definition==='CONTACT_FIELDS'?f.entity==='contact':definition==='LEAD_FIELDS'?f.entity==='lead':f.entity==='account')).map(f=>f.fieldKey),translationKey:`hqCustomer.fields.${d.key}`,translation:Object.fromEntries(Object.entries(locales).map(([l,o])=>[l,lookup(o,`hqCustomer.fields.${d.key}`)??null]))})));
const tabs=[{screenKey:'HQ_LEAD',source:H+'HqLeadsPage.tsx',actualTabs:['basic','keyman','hospital','exclusions','hira','marketing','history','activities']},{screenKey:'HQ_ACCOUNT',source:H+'HqAccountDetail.tsx',actualTabs:['basic','erp','hospital','contacts','sales','order','service','timeline','analytics']},{screenKey:'HQ_ACTIVITY',source:H+'HqActivityPages.tsx',actualTabs:['day','month','map']}].map(x=>({...x,registryTabs:baseline.standard.tabs.filter(t=>t.screenKey===x.screenKey).map(t=>t.tabKey),status:'ACTUAL_TAB_IDS_DIFFER_FROM_REGISTRY_MAIN_TAB'}));
const result={schemaVersion:1,stage:'C00',reportDateKst:'2026-10-24',method:'Explicit aliases + dynamic definitions expanded + source handler/API normalization. No complete runtime PASS claims.',
  limits:['Source-line grouping may relate multiple controls; exact one-to-one requires JSX element IDs during implementation.','Matched references establish code binding, not correctness under every setting/role/language.','GLOBAL/legacy independent execution paths remain outside HQ semantic baseline; preserved in baseline.json.'],
  fields,actions,popups,tabs,dynamicFields,controls,unregisteredUi:controls.filter(c=>c.semanticMapping==='UI_BEHAVIOUR_WITHOUT_DISTINCT_REGISTRY_BINDING')};
fs.writeFileSync(path.join(out,'semantic-map.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({fields:fields.length,fieldStates:fields.reduce((o,x)=>(o[x.status]=(o[x.status]??0)+1,o),{}),actions:actions.length,unmatchedActions:actions.filter(x=>x.status==='NO_UI_CALL_MATCH').map(x=>x.actionKey),unmatchedFields:fields.filter(x=>x.status==='NO_RENDER_BINDING_FOUND').map(x=>x.fieldKey),popupMissingEvidence:popups.filter(x=>!x.triggerEvidence.length||!x.componentEvidence.length).map(x=>x.id),controls:controls.length,dynamicFields:dynamicFields.length},null,2));
