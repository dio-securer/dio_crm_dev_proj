import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'packages/contracts/catalogs/hq-codes-review.json'), 'utf8')).catalog;
const semantic = JSON.parse(fs.readFileSync(path.join(root, 'docs/admin-platform/customization/evidence/semantic-map.json'), 'utf8'));
const screens = ['HQ_LEAD', 'HQ_ACCOUNT'];
const source = new Map();
function lines(file) {
  if (!source.has(file)) source.set(file, fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/));
  return source.get(file);
}
function ref(file, line, needle) {
  const actual = lines(file)[line - 1] ?? '';
  return { file, line, needle, currentLineMatches: Boolean(needle && actual.includes(needle)) };
}
const lead = 'frontend/src/hq-mock/HqLeadsPage.tsx';
const account = 'frontend/src/AccountsPage.tsx';
const detail = 'frontend/src/hq-mock/HqAccountDetail.tsx';
const tools = 'frontend/src/hq-mock/HqAccountTools.tsx';
const shared = 'frontend/src/hq-mock/customer-shared.tsx';
const model = 'frontend/src/hq-mock/customer-model.ts';
const sections = {
  'section:lead.list': ['list', ref(lead, 40, 'hq-lead-list')],
  'section:lead.basic': ['detail.basic; create.basic', ref(lead, 118, "'basic'")],
  'section:lead.keyman': ['detail.keyman; create.keyman', ref(lead, 118, "'keyman'")],
  'section:lead.hospital': ['detail.hospital; create.hospital', ref(lead, 118, "'hospital'")],
  'section:lead.exclusion': ['detail.exclusions; create.exclusions', ref(lead, 118, "'exclusions'")],
  'section:lead.hira': ['detail.hira', ref(lead, 122, "active === 'hira'")],
  'section:lead.marketing': ['detail.marketing', ref(lead, 125, "active === 'marketing'")],
  'section:lead.history': ['detail.history', ref(lead, 128, "active === 'history'")],
  'section:lead.conversion': ['detail.convert popup', ref(lead, 176, 'hq-conversion-form')],
  'section:account.basic': ['detail.basic; create/edit.form', ref(detail, 27, "active === 'basic'")],
  'section:account.hospital': ['detail.hospital', ref(detail, 31, "active === 'hospital'")],
  'section:account.contacts': ['detail.contacts', ref(detail, 32, "active === 'contacts'")],
  'section:account.merge': ['list.merge popup', ref(tools, 50, 'mergeAccounts')],
  'section:account.profile.identity': ['create/edit.form', ref(account, 310, 'FORM_SECTIONS.map')],
  'section:account.profile.hira': ['create/edit.form', ref(account, 310, 'FORM_SECTIONS.map')],
  'section:account.profile.address': ['create/edit.form', ref(account, 310, 'FORM_SECTIONS.map')],
  'section:account.profile.basic': ['create/edit.form', ref(account, 310, 'FORM_SECTIONS.map')],
  'section:account.profile.erp': ['create/edit.form', ref(account, 310, 'FORM_SECTIONS.map')],
  'section:account.profile.manage': ['create/edit.form', ref(account, 310, 'FORM_SECTIONS.map')],
};
const tabSource = { HQ_LEAD: [lead, 117], HQ_ACCOUNT: [detail, 22] };
const popupSource = {
  'POP.LEAD.CREATE': ['list.create popup', ref(lead, 55, 'creating &&')],
  'POP.LEAD.OWNER': ['detail.owner popup', ref(lead, 133, 'ownerOpen &&')],
  'POP.LEAD.CONVERT': ['detail.convert popup', ref(lead, 175, 'HqModal')],
  'POP.ACC.CONTACT': ['detail.contacts popup', ref(detail, 84, 'HqModal')],
  'POP.ACC.BULK': ['list.bulk popup', ref(tools, 33, 'HqModal')],
  'POP.ACC.MERGE': ['list.merge popup', ref(tools, 50, 'HqModal')],
};
const specialFields = {
  'lead.search': ['list.toolbar', ref(lead, 43, 'value={search}')],
  'lead.scope': ['list.toolbar', ref(lead, 44, 'value={scope}')],
  'lead.statusFilter': ['list.toolbar', ref(lead, 45, 'value={stage}')],
  'lead.ownerName': ['list.table.owner; detail.header', ref(lead, 52, "key: 'owner_name'")],
  'lead.convertAccountMode': ['detail.convert popup.account', ref(lead, 178, 'conversion-account-mode')],
  'lead.convertAccountPublicId': ['detail.convert popup.account', ref(lead, 179, 'conversion-account-id')],
  'account.search': ['list.search pc/mobile', ref(account, 443, 'value={search}')],
  'account.scope': ['list.filters pc/mobile', ref(account, 447, 'pc-filter-row')],
  'account.crmName': ['create/edit.form', ref(account, 298, 'data-hq-field')],
  'account.ownerName': ['list.table.owner', ref(account, 480, 'owner_name')],
};
const semFields = new Map(semantic.fields.map(item => [item.fieldKey, item]));
const semActions = new Map(semantic.actions.map(item => [item.actionKey, item]));
const semPopups = new Map(semantic.popups.map(item => [item.id, item]));
const output = [];
for (const entry of catalog.entries.filter(item => screens.includes(item.screenId) && item.kind !== 'CODE')) {
  const item = { id: entry.id, kind: entry.kind, screenId: entry.screenId, support: entry.support,
    parentId: entry.parentId ?? null, placement: null, placementBasis: null, evidence: [],
    mappingStatus: 'UNRESOLVED', notes: [] };
  if (entry.kind === 'MENU') {
    item.placement = 'app.navigation'; item.placementBasis = 'SCREEN_RELATION_ONLY';
    item.notes.push('메뉴 실제 렌더 위치와 ID anchor는 별도 대조 필요');
  } else if (entry.kind === 'SECTION') {
    const known = sections[entry.id];
    if (known) { item.placement = known[0]; item.placementBasis = 'SOURCE_REGION'; item.evidence.push(known[1]); item.mappingStatus = 'REGION_MATCH'; }
  } else if (entry.kind === 'TAB') {
    const key = entry.id.split('.').at(-1);
    if (key === 'main') item.notes.push('실제 main 탭 없음. 카탈로그도 unsupported');
    else {
      const [file, line] = tabSource[entry.screenId];
      item.placement = `detail.tabs.${key}`; item.placementBasis = 'SOURCE_KEY';
      item.evidence.push(ref(file, line, key)); item.mappingStatus = 'SOURCE_KEY_MATCH';
    }
  } else if (entry.kind === 'POPUP') {
    const known = popupSource[entry.id];
    if (known) { item.placement = known[0]; item.placementBasis = 'SOURCE_TRIGGER_AND_COMPONENT'; item.evidence.push(known[1]); item.mappingStatus = 'SOURCE_KEY_MATCH'; }
    const sem = semPopups.get(entry.id);
    for (const e of [...(sem?.triggerEvidence ?? []), ...(sem?.componentEvidence ?? [])]) item.evidence.push(ref(e.file, e.line, e.needle));
  } else if (entry.kind === 'FIELD') {
    const sem = semFields.get(entry.id);
    const known = specialFields[entry.id];
    if (known) { item.placement = known[0]; item.placementBasis = 'EXPLICIT_CONTROL'; item.evidence.push(known[1]); item.mappingStatus = 'SOURCE_CONTROL_MATCH'; }
    else if (entry.parentId && sections[entry.parentId]) {
      item.placement = sections[entry.parentId][0]; item.placementBasis = 'CATALOG_PARENT_REGION'; item.mappingStatus = 'REGION_ONLY';
    }
    if (sem) {
      item.semanticStatus = sem.status;
      for (const e of sem.sourceEvidence ?? []) item.evidence.push(ref(e.file, e.line, e.needle));
      if (sem.dynamicDefinition) { item.dynamicKey = sem.dynamicDefinition.key; item.dynamicGroup = sem.dynamicDefinition.group; }
      if (!item.placement && sem.sectionKey && sections[`section:${sem.sectionKey}`]) {
        item.placement = sections[`section:${sem.sectionKey}`][0]; item.placementBasis = 'SEMANTIC_SECTION_REGION'; item.mappingStatus = 'REGION_ONLY';
      }
      if (item.mappingStatus === 'REGION_ONLY' && sem.status === 'DYNAMIC_FIELD_BOUND') item.mappingStatus = 'DYNAMIC_DEFINITION_REGION';
    }
    if (!sem) item.notes.push('의미 대응표에 필드 없음');
    if (item.placementBasis !== 'EXPLICIT_CONTROL') item.notes.push('실제 DOM의 개별 위치 및 반복 인스턴스 미확정');
  } else if (entry.kind === 'ACTION') {
    const sem = semActions.get(entry.id);
    if (sem) {
      item.placement = sem.triggerControls?.length ? 'trigger control (see semantic map)' : 'handler or automatic query';
      item.placementBasis = 'SEMANTIC_HANDLER'; item.mappingStatus = 'HANDLER_ONLY';
      for (const e of sem.sourceEvidence ?? []) item.evidence.push(ref(e.file, e.line, e.needle));
      item.notes.push('버튼 자체 위치는 handler 증거만으로 확정하지 않음');
    }
  }
  item.evidence = [...new Map(item.evidence.map(e => [`${e.file}:${e.line}:${e.needle}`, e])).values()];
  if (item.evidence.some(e => !e.currentLineMatches)) item.notes.push('이전 의미 대응표의 소스 줄이 현재 코드와 어긋남. 위치 재확인 필요');
  if (entry.support !== 'supported') item.mappingStatus = 'UNSUPPORTED';
  if (entry.id === 'lead.statusFilter') item.notes.push('실제 제어 값은 stage이며 lead.stageFilter와 중복 후보. ID 정책 결정 필요');
  if (entry.id === 'lead.scope' || entry.id === 'lead.stageFilter') item.notes.push('화면에 대응하는 제어가 있으나 카탈로그 support=unsupported');
  if (entry.id === 'account.scope') item.notes.push('PC/모바일에 반복 표시. instance ID 분리 필요');
  output.push(item);
}
const summary = {};
if (new Set(output.map(item => item.id)).size !== output.length) throw new Error('Duplicate case-sensitive catalog ID in scope');
for (const item of output) {
  const key = `${item.screenId}/${item.kind}/${item.mappingStatus}`;
  summary[key] = (summary[key] ?? 0) + 1;
}
const result = {
  schemaVersion: 1, purpose: 'First visual editor source-location and catalog ID reconciliation',
  sourceCatalog: 'packages/contracts/catalogs/hq-codes-review.json',
  sourceSemanticMap: 'docs/admin-platform/customization/evidence/semantic-map.json',
  screens, method: 'Static JSX/source and catalog comparison; no DOM anchor or runtime interaction verification',
  limits: ['A region match does not prove that an individual field is rendered there.', 'A source handler match does not prove the trigger button is mapped one-to-one.', 'PC/mobile and repeated create/detail instances require separate DOM anchor verification.'],
  summary, entries: output,
};
const target = path.join(root, 'docs/admin-platform/customization/evidence/lead-account-element-map.json');
fs.writeFileSync(target, JSON.stringify(result, null, 2) + '\n');
console.log(`Wrote ${path.relative(root, target)}: ${output.length} entries`);
console.log(summary);
