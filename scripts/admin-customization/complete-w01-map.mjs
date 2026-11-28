import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const file = path.join(root, 'docs/admin-platform/customization/evidence/lead-account-element-map.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'packages/contracts/catalogs/hq-codes-review.json'), 'utf8')).catalog;
const byId = new Map(catalog.entries.map(entry => [entry.id, entry]));
const lead = 'frontend/src/hq-mock/HqLeadsPage.tsx';
const account = 'frontend/src/AccountsPage.tsx';
const accountDetail = 'frontend/src/hq-mock/HqAccountDetail.tsx';
const tools = 'frontend/src/hq-mock/HqAccountTools.tsx';
const shared = 'frontend/src/hq-mock/customer-shared.tsx';
const configuredLead = 'frontend/src/customization/ConfiguredLeads.tsx';
const model = 'frontend/src/account-model.ts';
const sourceCache = new Map();
function evidence(fileName, text, nth = 0) {
  if (!sourceCache.has(fileName)) sourceCache.set(fileName, fs.readFileSync(path.join(root, fileName), 'utf8').split(/\r?\n/));
  const matches = sourceCache.get(fileName).flatMap((line, index) => line.includes(text) ? [index + 1] : []);
  if (!matches[nth]) throw new Error(`Missing source: ${fileName} ${text} #${nth}`);
  return { file: fileName, line: matches[nth], needle: text, currentLineMatches: true };
}
function loc(variant, instanceId, source, needle, condition = 'always') {
  return { variant, instanceId, devices: variant.includes('mobile') ? ['mobile'] : variant.includes('pc') ? ['pc'] : ['pc', 'mobile'], condition, stateFixtureId: 'HQ_DEMO_ADMIN', source: evidence(source, needle) };
}
const info = {
  'lead.status': [loc('list', 'list.table.status', lead, "key: 'status'"), loc('detail', 'detail.stage.saved', lead, 'saved-lead-stage')],
  'lead.targetStatus': [loc('detail', 'detail.stage.choice', lead, 'hq-stage-buttons')],
  'lead.ownerUserId': [loc('popup:owner', 'owner.select', lead, 'lead-owner-select')],
  'lead.reason': [loc('detail', 'detail.stage.reason', lead, 'stage-reason')],
  'lead.hiraCheckNeeded': [loc('detail', 'detail.marketing.hiraCheckNeeded', lead, "key: 'hira_check_needed'")],
  'lead.engagementScore': [loc('detail', 'detail.marketing.engagementScore', lead, "key: 'engagement_score'")],
  'lead.history': [loc('detail', 'detail.history.table', lead, "active === 'history'")],
  'lead.providerNo': [loc('detail', 'detail.hira.providerNo', lead, "key: 'provider_no'")],
  'lead.encryptedProviderNo': [loc('detail', 'detail.hira.encryptedProviderNo', lead, "key: 'encrypted_provider_no'")],
  'lead.hiraExcluded': [loc('create', 'create.exclusions.hiraExcluded', lead, "['basic', 'keyman', 'hospital', 'exclusions'].map"), loc('detail', 'detail.exclusions.hiraExcluded', lead, 'LEAD_FIELDS.filter'), loc('detail', 'detail.hira.hiraExcludedSummary', lead, "key: 'hira_sync_exclude_yn'")],
  'conversion.accountMode': [loc('popup:convert', 'convert.account.mode', lead, 'conversion-account-mode')],
  'conversion.existingAccountPublicId': [loc('popup:convert', 'convert.account.existing', lead, 'conversion-account-id', 'accountMode=EXISTING')],
  'conversion.contactMode': [loc('popup:convert', 'convert.contact.mode', lead, 'conversion-contact-mode')],
  'conversion.existingContactPublicId': [loc('popup:convert', 'convert.contact.existing', lead, 'conversion-contact-id', 'contactMode=EXISTING')],
  'conversion.contactName': [loc('popup:convert', 'convert.contact.name', lead, 'conversion-contact-name', 'contactMode=NEW')],
  'conversion.opportunityMode': [loc('popup:convert', 'convert.opportunity.mode', lead, 'conversion-opportunity-mode')],
  'conversion.existingOpportunityPublicId': [loc('popup:convert', 'convert.opportunity.existing', lead, 'conversion-opportunity-id', 'opportunityMode=EXISTING')],
  'conversion.opportunityName': [loc('popup:convert', 'convert.opportunity.name', lead, 'conversion-opportunity-name', 'opportunityMode=NEW')],
  'conversion.ownerUserId': [loc('popup:convert', 'convert.owner', lead, 'conversion-owner')],
  'lead.search': [loc('list', 'list.search', lead, "aria-label={t('lead.search')}")],
  'lead.scope': [loc('list', 'list.scope', lead, "aria-label={t('hqCustomer.scope')}")],
  'lead.statusFilter': [loc('list', 'list.stageFilter', lead, "aria-label={t('common.status')}")],
  'lead.stageFilter': [loc('list', 'list.stageFilter', lead, "aria-label={t('common.status')}")],
  'lead.ownerName': [loc('list', 'list.table.owner', lead, "key: 'owner_name'"), loc('detail', 'detail.header.owner', lead, "{t('lead.owner')}: {displayValue")],
  'account.accountStatus': [loc('create', 'create.accountStatus', account, "{t('account.crmStatus')}"), loc('edit', 'edit.accountStatus', account, "{t('account.crmStatus')}"), loc('list:pc', 'pc.table.status', account, 'row.account_status')],
  'account.accountGrade': [loc('create', 'create.accountGrade', account, "{t('account.grade')}"), loc('edit', 'edit.accountGrade', account, "{t('account.grade')}"), loc('list:pc', 'pc.table.grade', account, 'row.account_grade')],
  'account.erpApprovedYn': [loc('detail', 'detail.erp.approved', accountDetail, "key: 'erp_approved_yn'")],
  'account.integrationStatus': [loc('list:pc', 'pc.table.integration', account, 'row.integration_status'), loc('detail', 'detail.erp.integration', accountDetail, "key: 'integration_status'")],
  'account.crmName': [loc('create', 'create.crmName', account, 'data-hq-field={hqMock'), loc('edit', 'edit.crmName', account, 'data-hq-field={hqMock'), loc('list:pc', 'pc.table.crmName', account, 'row.account_name'), loc('list:mobile', 'mobile.row.crmName', account, '<strong>{row.account_name}</strong>'), loc('popup:bulk', 'bulk.row.<publicId>.crmName', tools, 'data-ledger-row={draft.row.public_id}', 'per selected row')],
  'account.crmAddress': [loc('list:pc', 'pc.table.address', account, "row.hospital_address || row.address"), loc('list:mobile', 'mobile.row.address', account, "row.hospital_address || row.address")],
  'account.ownerName': [loc('list:pc', 'pc.table.owner', account, 'row.owner_name')],
  'account.erpCustomerCode': [loc('list:pc', 'pc.table.erpCode', account, 'row.erp_customer_code'), loc('detail', 'detail.erp.customerCode', accountDetail, "key: 'erp_customer_code'")],
  'account.search': [loc('list:pc', 'pc.search', account, 'className="search-input"'), loc('list:mobile', 'mobile.search', account, 'className="mob-search"')],
  'account.scope': [loc('list:pc', 'pc.scope', account, 'className="pc-filter-row"'), loc('list:mobile', 'mobile.scope', account, 'className="mob-filters"')],
  'account.bulkRows': [loc('popup:bulk', 'bulk.row.<publicId>.fields', tools, 'data-ledger-row={draft.row.public_id}', 'per eligible row')],
  'merge.primaryPublicId': [loc('popup:merge', 'merge.primary', tools, 'data-testid="merge-primary"')],
  'merge.duplicatePublicIds': [loc('popup:merge', 'merge.duplicate.<publicId>', tools, 'data-merge-id={row.public_id}', 'per account row')],
  'merge.fieldSources': [loc('popup:merge', 'merge.source.<fieldKey>', tools, 'data-source-field={field.key}', 'per LEDGER_FIELDS field')],
  'merge.businessNo': [loc('popup:merge', 'merge.candidate.<publicId>.businessNo', tools, 'row.business_no', 'per candidate row')],
  'account.contactName': [loc('detail', 'detail.contacts.table.name', accountDetail, 'contact_name')],
};
for (const id of ['account.hospitalSize', 'account.mainSystem', 'account.subSystem', 'account.dioProductUsage']) {
  const key = id.slice('account.'.length);
  info[id] = [loc('detail', `detail.hospital.${key}`, accountDetail, 'fields={HOSPITAL_FIELDS}')];
}
for (const id of ['contact.contactName','contact.contactType','contact.mobile','contact.email','contact.isKeyman','contact.school','contact.cohort','contact.major','contact.note']) {
  info[id] = [loc('popup:contact', `contact.form.${id.slice('contact.'.length)}`, accountDetail, 'fields={CONTACT_FIELDS}')];
}
const configuredOnly = {
  'lead.ownerFilter': [configuredLead, "p('lead.ownerFilter')?.readable"],
  'lead.updatedAt': [configuredLead, "['updatedAt','updated_at'"],
  'lead.sido': [configuredLead, "['sido','sido'"],
  'lead.sigungu': [configuredLead, "['sigungu','sigungu'"],
  'lead.convertAccountMode': [configuredLead, "p('lead.convertAccountMode')?.writable"],
  'lead.convertAccountPublicId': [configuredLead, "p('lead.convertAccountPublicId')?.writable"],
};
const nonvisual = {
  'lead.latitude': 'map/plan source; no field in HQ lead JSX',
  'lead.longitude': 'map/plan source; no field in HQ lead JSX',
  'account.latitude': 'map/plan source; no field in HQ account JSX',
  'account.longitude': 'map/plan source; no field in HQ account JSX',
  'account.ownerUserId': 'permission/assignment data; HQ UI displays owner name only',
  'account.updatedAt': 'record timestamp; no date column or field on the selected HQ account screen',
  'lead.version': 'optimistic concurrency token; never a displayed input',
  'account.hospitalVersion': 'optimistic concurrency token for hospital save',
  'account.bulkVersion': 'optimistic concurrency token per bulk row',
  'contact.accountPublicId': 'parent reference supplied by contacts flow',
  'analyticsSource.leadCreatedAt': 'server analytics date source',
  'lead.leadSource': 'source metadata; no displayed HQ field',
  'lead.eupmyeondong': 'HIRA location data; no displayed HQ field',
  'lead.openDate': 'HIRA source data; no displayed HQ field',
};
for (const id of ['lead.providerNo','lead.encryptedProviderNo']) delete nonvisual[id];
const actions = {
  'LEAD.search': [loc('list', 'list.search.query', lead, "queryKey: ['hq-leads'", 'automatic query on filter change')],
  'LEAD.open': [loc('list', 'list.table.open.<publicId>', lead, 'data-lead-id={row.public_id}')],
  'LEAD.create': [loc('list', 'list.create', lead, 'setCreating(true)'), loc('popup:create', 'create.submit', lead, "policy.can('LEAD.create'")],
  'LEAD.save': [loc('detail', 'detail.form.save', lead, "policy.can('LEAD.save'")],
  'LEAD.changeStage': [loc('detail:forward', 'detail.stage.save', lead, "policy.can(reverse ? 'LEAD.reverse'", 'forward transition')],
  'LEAD.reverse': [loc('detail:reverse', 'detail.stage.save', lead, "policy.can(reverse ? 'LEAD.reverse'", 'reverse transition')],
  'LEAD.assignOwner': [loc('detail', 'detail.owner.open', lead, 'setOwnerOpen(true)'), loc('popup:owner', 'owner.submit', lead, 'onSubmit={event => void assign(event)}')],
  'LEAD.convert': [loc('detail', 'detail.convert.open', lead, 'setConvertOpen(true)'), loc('popup:convert', 'convert.submit', lead, 'data-testid="confirm-conversion"')],
  'LEAD.delete': [loc('detail', 'detail.delete', lead, "policy.can('LEAD.delete'")],
  'ACC.search': [loc('list:pc', 'pc.search.query', account, 'className="search-input"'), loc('list:mobile', 'mobile.search.query', account, 'className="mob-search"')],
  'ACC.open': [loc('list:pc', 'pc.table.open.<publicId>', account, 'onClick={() => openDetail(row)}'), loc('list:mobile', 'mobile.row.open.<publicId>', account, 'className="mob-account-row"')],
  'ACC.create': [loc('list:pc', 'pc.create', account, 'onClick={openCreate}'), loc('create', 'create.submit', account, "selectedId ? 'ACC.save' : 'ACC.create'")],
  'ACC.save': [loc('edit', 'edit.submit', account, "selectedId ? 'ACC.save' : 'ACC.create'")],
  'ACC.erpRequest': [loc('list:pc', 'pc.table.erpRequest.<publicId>', account, "hqPolicy.can('ACC.erpRequest'"), loc('detail', 'detail.erp.request', accountDetail, 'data-testid="request-erp"')],
  'ACC.hospitalSave': [loc('detail', 'detail.hospital.save', accountDetail, "policy.can('ACC.hospitalSave'")],
  'ACC.bulkSave': [loc('list:pc', 'pc.bulk.open', tools, 'data-testid="open-account-ledger"'), loc('popup:bulk', 'bulk.submit', tools, 'data-testid="save-ledger"')],
  'ACC.merge': [loc('list:pc', 'pc.merge.open', tools, 'data-testid="open-account-merge"'), loc('popup:merge', 'merge.submit', tools, 'data-testid="confirm-merge"')],
  'CONTACT.create': [loc('detail', 'detail.contacts.create', accountDetail, 'data-testid="new-contact"'), loc('popup:contact:new', 'contact.submit', accountDetail, "row ? 'CONTACT.save' : 'CONTACT.create'")],
  'CONTACT.save': [loc('popup:contact:edit', 'contact.submit', accountDetail, "row ? 'CONTACT.save' : 'CONTACT.create'")],
  'CONTACT.delete': [loc('popup:contact', 'contact.delete', accountDetail, "policy.can('CONTACT.delete'")],
};
function dynamicLocations(item) {
  if (!item.dynamicKey) return [];
  if (item.id.startsWith('lead.')) {
    const group = item.dynamicGroup;
    const locations = [loc('create', `create.${group}.${item.dynamicKey}`, lead, 'fields={LEAD_FIELDS.filter'), loc('detail', `detail.${group}.${item.dynamicKey}`, lead, 'LEAD_FIELDS.filter')];
    if (item.id === 'lead.hospitalName') locations.push(loc('list', 'list.table.hospitalName', lead, "key: 'hospital_name'"));
    if (item.id === 'lead.phone') locations.push(loc('list', 'list.table.phone', lead, "key: 'phone'"));
    if (item.id === 'lead.businessNo') locations.push(loc('list', 'list.table.businessNo', lead, "key: 'business_no'"));
    return locations;
  }
  return [];
}
const summary = {};
for (const item of data.entries) {
  const entry = byId.get(item.id);
  item.labelKey = entry.labelKey;
  item.capabilities = entry.capabilities ?? [];
  item.permissions = { all: entry.permissions ?? [], read: entry.readPermissions ?? [], write: entry.writePermissions ?? [] };
  item.bindingKind = entry.bindingKind ?? null;
  item.apiField = entry.apiField ?? null;
  item.w01 = { disposition: '', locations: [], reason: '' };
  if (item.kind === 'FIELD') {
    if (info[item.id]) item.w01.locations = info[item.id];
    else if (item.id.startsWith('account.erp.')) {
      const code = item.id.slice('account.erp.'.length);
      const section = item.parentId?.split('.').at(-1) ?? 'form';
      item.w01.locations = [loc('create:pc', `pc.create.${section}.${code}`, account, 'fieldsByCodes(section.codes)'), loc('edit:pc', `pc.edit.${section}.${code}`, account, 'fieldsByCodes(section.codes)'), loc('create:mobile', `mobile.create.${section}.${code}`, account, 'fieldsByCodes(section.codes)'), loc('edit:mobile', `mobile.edit.${section}.${code}`, account, 'fieldsByCodes(section.codes)')];
    } else if (item.id.startsWith('hiraInput.')) {
      item.w01.disposition = 'SERVER_ONLY'; item.w01.reason = 'HIRA ingestion payload; no HQ customer screen control';
    } else if (nonvisual[item.id]) {
      item.w01.disposition = 'NONVISUAL'; item.w01.reason = nonvisual[item.id];
    } else if (configuredOnly[item.id]) {
      const variant = item.id.startsWith('lead.convert') ? 'configured:popup:convert' : 'configured:list';
      item.w01.disposition = 'CONFIGURED_ONLY'; item.w01.locations = [loc(variant, `${variant}.${item.id}`, ...configuredOnly[item.id])]; item.w01.reason = 'Separate configured screen, absent from HQ mock JSX';
    } else if (item.dynamicKey) item.w01.locations = dynamicLocations(item);
    else if (item.id.startsWith('account.') && ['accountStatus','accountGrade','crmAddress'].includes(item.id.slice(8))) item.w01.locations = info[item.id] ?? [];
    else if (item.id.startsWith('lead.') && ['history'].includes(item.id.slice(5))) item.w01.locations = info[item.id] ?? [];
    else if (item.id === 'contact.accountPublicId') item.w01.disposition = 'NONVISUAL';
    if (!item.w01.disposition) {
      item.w01.disposition = item.w01.locations.length ? (item.support === 'supported' ? 'HQ_VISIBLE' : 'UNSUPPORTED_VISIBLE') : 'NO_HQ_RENDER';
      if (!item.w01.locations.length) item.w01.reason = 'No matching field control in the selected HQ screen path; catalog parent alone is insufficient';
    }
    if (item.id === 'lead.statusFilter') item.w01.reason = 'HQ stage select uses status query; unsupported lead.stageFilter names the same control. Keep statusFilter as candidate config ID.';
    if (item.id === 'lead.stageFilter') item.w01.reason = 'Duplicate alias of lead.statusFilter; unsupported catalog item remains non-editable.';
    if (item.id === 'lead.scope') item.w01.reason = 'Visible HQ scope select but catalog marks it unsupported; read-only until catalog contract is decided.';
    if (item.id === 'merge.fieldSources') item.w01.reason = 'Visible per-field source selector but catalog marks it unsupported; read-only until contract is decided.';
  } else if (item.kind === 'ACTION') {
    item.w01.locations = actions[item.id] ?? [];
    item.w01.disposition = item.w01.locations.length ? 'HQ_VISIBLE_OR_QUERY' : 'SERVER_ONLY';
    if (!item.w01.locations.length) item.w01.reason = 'No HQ screen trigger; service entry point only';
  } else if (item.kind === 'TAB' && item.support !== 'supported') {
    item.w01.disposition = 'UNSUPPORTED_NO_RENDER'; item.w01.reason = 'No main tab in actual screen';
  } else if (item.kind === 'MENU') {
    item.w01.disposition = 'ROUTE_REGISTERED'; item.w01.locations = [loc('navigation', `navigation.${item.screenId}`, 'frontend/src/app/screen-registry.tsx', `[\'${item.screenId}\',`)];
    item.w01.reason = 'Route registration confirmed; navigation anchor is W02 work';
  } else {
    item.w01.disposition = 'HQ_STRUCTURE';
    const placements = (item.placement ?? '').split(';').map(part => part.trim()).filter(Boolean);
    // The second account basic branch is replaced by basicForm in the routed HQ account page.
    item.w01.locations = (item.id === 'section:account.basic' ? placements.slice(0, 1) : placements).map((part, index) => ({ variant: part, instanceId: `${item.id}.${index}`, devices: ['pc', 'mobile'], condition: 'screen state', stateFixtureId: 'HQ_DEMO_ADMIN', source: item.evidence.find(value => value.currentLineMatches) ?? null }));
  }
  summary[item.w01.disposition] = (summary[item.w01.disposition] ?? 0) + 1;
}
data.w01 = { status: 'SOURCE_RECONCILED', scope: 'HQ mock lead/account source; configured route separately classified', head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), method: 'Every catalog candidate has a rendered, configured-only, server-only, or unsupported disposition. Instance IDs are proposed source positions, not verified DOM anchors.', summary };
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify(summary));
