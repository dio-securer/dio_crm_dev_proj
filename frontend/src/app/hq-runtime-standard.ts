import type { HqAction, HqCondition, HqField, HqStandard, HqTransition } from '@dio-crm/contracts';

/** H01 is the immutable survey baseline. Executable stages explicitly extend it here. */
export function extendHqRuntimeStandard(baseline: HqStandard): HqStandard {
  const s: HqStandard = structuredClone(baseline);
  s.version = '1.4.0';
  const evidence = 'RUNTIME.H03';
  s.evidence.push({ evidenceKey: evidence, kind: 'assumption', source: 'docs/hq-standard/implementation/H03-report.md', analysisIds: [],
    note: 'H03 executable customer contract. Existing-code rules are retained; new linking choices, optional hospital attributes and CRM/source ownership are explicit mock assumptions.' });
  s.evidenceKeys.push(evidence);
  const yes: HqCondition = { kind: 'constant', value: true };
  const no: HqCondition = { kind: 'constant', value: false };
  const eq = (fieldKey: string, value: string): HqCondition => ({ kind: 'equals', fieldKey, value });
  const field = (key: string) => s.fields.find(f => f.fieldKey === key)!;
  const action = (key: string) => s.actions.find(a => a.actionKey === key)!;
  const installField = (fieldKey: string, sectionKey: string, apiField: string, dbField: string, permission: string, options: Partial<HqField> = {}) => {
    const existing = field(fieldKey);
    const entry: HqField = {
      fieldKey, entity: fieldKey.split('.')[0], label: fieldKey, labelKey: `hq.field.${fieldKey}`, sectionKey,
      uiType: 'text', valueRule: { type: 'string', maxLength: 4000 }, observedRequired: 'unknown', requiredRule: no,
      visible: true, readOnly: false, readPermissions: [], writePermissions: [permission], source: 'CRM', masking: 'none',
      locked: false, overridePolicy: 'restrict', evidenceKeys: [evidence],
      current: { read: true, write: true, apiField, dbField, note: 'Persisted by the H03 isolated customer repository.' },
      notes: 'H03 optional input; no unobserved mandatory requirement is inferred.', ...options
    };
    if (existing) Object.assign(existing, entry, { label: existing.label, labelKey: existing.labelKey });
    else s.fields.push(entry);
    const section = s.sections.find(x => x.sectionKey === sectionKey)!;
    if (!section.fieldKeys.includes(fieldKey)) section.fieldKeys.push(fieldKey);
    return field(fieldKey);
  };
  const installAction = (actionKey: string, screenKey: string, processKey: string, permission: string[], inputs: string[], endpoint: string, options: Partial<HqAction> = {}) => {
    const entry: HqAction = {
      actionKey, label: actionKey, labelKey: `hq.action.${actionKey}`, screenKey, processKey, enabled: true, support: 'current',
      inputFieldKeys: inputs, requiredFieldKeys: [], transitionKeys: [], condition: yes, endpoint, permissions: permission, features: [],
      result: 'Persisted state and related counts are returned from the same HQ dataset.', errors: ['VALIDATION', 'PERMISSION_DENIED', 'VERSION_CONFLICT'],
      notes: 'Registered H03 operation. HTTP handlers also enforce entity ownership, relation membership and atomic transactions.', evidenceKeys: [evidence], ...options
    };
    const existing = action(actionKey);
    if (existing) Object.assign(existing, entry); else s.actions.push(entry);
    const screen = s.screens.find(x => x.screenKey === screenKey)!;
    if (!screen.actionKeys.includes(actionKey)) screen.actionKeys.push(actionKey);
    return action(actionKey);
  };

  for (const [key, section, api, db] of [
    ['keymanNote', 'lead.keyman', 'keymanNote', 'keyman_note'],
    ['exclusionDetail', 'lead.exclusion', 'exclusionDetail', 'exclusion_detail']
  ]) installField(`lead.${key}`, section, api, db, 'LEAD.WRITE');
  for (const [key, section, db] of [['mapExcluded', 'lead.exclusion', 'map_excluded_yn'], ['hiraExcluded', 'lead.hira', 'hira_sync_exclude_yn']]) {
    installField(`lead.${key}`, section, key, db, 'LEAD.WRITE', { uiType: 'checkbox', valueRule: { type: 'boolean' } });
  }
  for (const [key, db] of [['hospitalSize', 'hospital_size'], ['doctorCount', 'doctor_count'], ['chairCount', 'chair_count']]) {
    installField(`lead.${key}`, 'lead.hospital', key, db, 'LEAD.WRITE', { uiType: 'number', valueRule: { type: 'number', min: 0, integer: true } });
  }
  installField('lead.reason', 'lead.basic', 'reason', 'reason', 'LEAD.WRITE');
  for (const [key, db] of [['hiraCheckNeeded', 'hira_check_needed'], ['engagementScore', 'engagement_score'], ['history', 'history']]) {
    const f = field(`lead.${key}`); f.visible = true; f.readOnly = true; f.current = { read: true, write: false, dbField: db, note: 'H03 read model; unknown score/check values are explicitly null and not fabricated.' };
    f.source = 'DERIVED'; f.evidenceKeys = [evidence]; f.notes = key === 'history' ? 'Actual persisted audit history.' : 'Source/calculation is unconfirmed; display unknown until an authoritative input exists.';
  }
  field('lead.keymanSurname').notes = 'Design assumption: existing keymanName holds the full name; no artificial surname split.';
  const leadFields = s.fields.filter(f => f.entity === 'lead' && f.current.write && !['lead.search', 'lead.status', 'lead.targetStatus', 'lead.ownerUserId', 'lead.reason'].includes(f.fieldKey)).map(f => f.fieldKey);
  installAction('LEAD.create', 'HQ_LEAD', 'HQ.LEAD', ['LEAD.WRITE'], leadFields, 'POST /api/leads', { requiredFieldKeys: ['lead.hospitalName'], condition: { kind: 'not', condition: eq('lead.status', 'CONVERTED') } });
  action('LEAD.save').inputFieldKeys = leadFields;
  action('LEAD.save').support = 'current'; action('LEAD.save').notes = 'CRM input changes and their history are persisted; converted records are immutable.';
  installAction('LEAD.delete', 'HQ_LEAD', 'HQ.LEAD', ['LEAD.WRITE'], [], 'DELETE /api/leads/:id', { condition: { kind: 'not', condition: eq('lead.status', 'CONVERTED') } });
  installAction('LEAD.reverse', 'HQ_LEAD', 'HQ.LEAD', ['LEAD.WRITE', 'LEAD.STATUS.REVERSE'], ['lead.targetStatus', 'lead.reason'], 'POST /api/leads/:id/status', { requiredFieldKeys: ['lead.targetStatus', 'lead.reason'], condition: { kind: 'not', condition: eq('lead.status', 'CONVERTED') } });
  for (const target of ['NEW', 'FIRST_VISIT', 'KEYMAN_MEETING', 'CONTACT_EXCLUDED']) {
    const transition: HqTransition = { transitionKey: `LEAD.reverseTo.${target}`, processKey: 'HQ.LEAD', actionKey: 'LEAD.reverse', stateFieldKey: 'lead.status', targetFieldKey: 'lead.targetStatus',
      fromStates: ['NEW', 'FIRST_VISIT', 'KEYMAN_MEETING', 'CONTACT_EXCLUDED'].filter(x => x !== target), toState: target,
      requiredFieldKeys: ['lead.targetStatus', 'lead.reason'], condition: eq('lead.targetStatus', target), evidenceKeys: [evidence] };
    s.transitions.push(transition); action('LEAD.reverse').transitionKeys.push(transition.transitionKey);
    s.processes.find(p => p.processKey === 'HQ.LEAD')!.transitionKeys.push(transition.transitionKey);
  }
  for (const key of ['contactMode', 'opportunityMode']) installField(`conversion.${key}`, 'lead.conversion', key, key, 'LEAD.CONVERT', {
    uiType: 'select', valueRule: { type: 'string', options: ['NEW', 'EXISTING', 'SKIP'] }, defaultValue: 'NEW'
  });
  for (const [key, parent] of [['existingContactPublicId', 'contactMode'], ['existingOpportunityPublicId', 'opportunityMode']]) {
    installField(`conversion.${key}`, 'lead.conversion', key, key, 'LEAD.CONVERT', { uiType: 'reference', valueRule: { type: 'reference' }, requiredRule: eq(`conversion.${parent}`, 'EXISTING') });
  }
  installField('conversion.contactName', 'lead.conversion', 'contactName', 'contactName', 'LEAD.CONVERT', { valueRule: { type: 'string', maxLength: 200 } });
  installField('conversion.ownerUserId', 'lead.conversion', 'ownerUserId', 'owner_user_id', 'LEAD.CONVERT', { valueRule: { type: 'number', min: 1, integer: true } });
  action('LEAD.convert').inputFieldKeys = s.fields.filter(f => f.entity === 'conversion').map(f => f.fieldKey);
  action('LEAD.convert').support = 'current'; action('LEAD.convert').notes = 'Atomic new/existing account, new/existing/skipped contact and opportunity; membership, owner permission and duplicate guards are evaluated by the server.';
  field('conversion.opportunityName').notes = 'Used only for NEW; EXISTING links an accessible opportunity on the selected account and SKIP creates none.';

  installField('account.monthlyRevenue', 'account.hospital', 'monthlyRevenue', 'monthly_revenue', 'ACCOUNT.WRITE', { uiType: 'number', valueRule: { type: 'number', min: 0 }, notes: 'Account sandbox hospital survey, 2026-11-10; optional input.' });
  installField('account.payDoctorCount', 'account.hospital', 'payDoctorCount', 'pay_doctor_count', 'ACCOUNT.WRITE', { uiType: 'number', valueRule: { type: 'number', min: 0, integer: true }, notes: 'Account sandbox hospital survey, 2026-11-10; optional input.' });
  installField('account.staffCount', 'account.hospital', 'staffCount', 'staff_count', 'ACCOUNT.WRITE', { uiType: 'number', valueRule: { type: 'number', min: 0, integer: true }, notes: 'Account sandbox hospital survey, 2026-11-10; optional input.' });
  installField('account.chairCount', 'account.hospital', 'chairCount', 'chair_count', 'ACCOUNT.WRITE', { uiType: 'number', valueRule: { type: 'number', min: 0, integer: true }, notes: 'Account sandbox hospital survey, 2026-11-10; optional input.' });
  installField('account.monthlyImplants', 'account.hospital', 'monthlyImplants', 'monthly_implants', 'ACCOUNT.WRITE', { uiType: 'number', valueRule: { type: 'number', min: 0, integer: true }, notes: 'Account sandbox hospital survey, 2026-11-10; optional input.' });
  installField('account.competitorShare', 'account.hospital', 'competitorShare', 'competitor_share', 'ACCOUNT.WRITE', { uiType: 'textarea', valueRule: { type: 'string', maxLength: 4000 }, notes: 'Account sandbox hospital survey, 2026-11-10; optional input.' });
  installField('account.hospitalNotes', 'account.hospital', 'hospitalNotes', 'hospital_notes', 'ACCOUNT.WRITE', { uiType: 'textarea', valueRule: { type: 'string', maxLength: 4000 }, notes: 'Account sandbox hospital survey, 2026-11-10; optional input.' });
  for (const [key, db] of [['hospitalSize', 'hospital_size'], ['mainSystem', 'main_system'], ['subSystem', 'sub_system'], ['dioProductUsage', 'dio_product_usage']]) {
    installField(`account.${key}`, 'account.hospital', key, db, 'ACCOUNT.WRITE', key === 'hospitalSize' ? { valueRule: { type: 'number', min: 0, integer: true } } : {});
  }
  for (const [key, db] of [['ctOwned','ct_owned_yn'],['oralScannerOwned','oral_scanner_owned_yn'],['printer3dOwned','printer_3d_owned_yn'],['millingMachineOwned','milling_machine_owned_yn'],['activatorOwned','activator_owned_yn'],['dentalLabOwned','dental_lab_owned_yn']]) {
    installField(`account.${key}`, 'account.hospital', key, db, 'ACCOUNT.WRITE', { uiType: 'select', valueRule: { type: 'boolean' }, notes: 'Observed equipment ownership; optional null means unconfirmed, false means confirmed not owned.' });
  }
  installField('account.contactName', 'account.contacts', 'contactName', 'contact_name', 'CONTACT.WRITE', { valueRule: { type: 'string', maxLength: 200 }, notes: 'Contact form input; persists in the related contact entity, not an account column.' });
  for (const f of s.fields.filter(f => f.fieldKey.startsWith('account.erp.'))) {
    if (f.source === 'ERP' || f.source === 'DERIVED') {
      f.current.write = false; f.readOnly = true; f.locked = true; f.overridePolicy = 'locked';
      f.notes = 'H03 ERP inbound/derived source fields are read-only in both HTTP and UI.';
    } else if (f.current.apiField) {
      f.readOnly = false; f.locked = false; f.overridePolicy = 'restrict';
      f.notes = 'H03 CRM outbound/request values remain editable; successful ERP approval does not silently turn all CRM values into inbound fields.';
    }
  }
  // The catalog's cust_nm is inbound. Keep its identity and introduce a distinct editable CRM name.
  const erpName = field('account.erp.cust_nm');
  erpName.current = { read: true, write: false, dbField: 'erp_account_name', note: 'ERP name is the request snapshot acknowledged by the adapter; it is separate from the current CRM display name.' };
  erpName.requiredRule = no;
  installField('account.crmName', 'account.basic', 'accountName', 'account_name', 'ACCOUNT.WRITE', { requiredRule: yes, valueRule: { type: 'string', minLength: 1, maxLength: 300 }, notes: 'Explicit H03 assumption: CRM display name is editable; ERP cust_nm remains read-only and changes only on a correlated ERP result.' });
  installField('account.crmAddress', 'account.basic', 'address', 'address', 'ACCOUNT.WRITE', { valueRule: { type: 'string', maxLength: 500 }, notes: 'Legacy CRM address accepted by H02; separate from HIRA/ERP structured address fields.' });
  installField('account.ownerName', 'account.basic', 'ownerName', 'owner_name', 'ACCOUNT.WRITE', {
    label: '담당자', readOnly: true, source: 'DERIVED', readPermissions: ['ACCOUNT.READ'], writePermissions: [],
    current: { read: true, write: false, dbField: 'owner_name', note: 'Derived from the same-company account owner; projected through field visibility.' }
  });
  const accountFields = s.fields.filter(f => f.entity === 'account' && f.current.write && f.fieldKey !== 'account.contactName').map(f => f.fieldKey);
  action('ACC.create').inputFieldKeys = accountFields; action('ACC.save').inputFieldKeys = accountFields;
  action('ACC.save').notes = 'H03 saves writable CRM fields. Inbound ERP code, approval and trading state cannot be submitted by a client.';
  installAction('ACC.hospitalSave', 'HQ_ACCOUNT', 'HQ.ACCOUNT', ['ACCOUNT.WRITE'], s.fields.filter(f => f.sectionKey === 'account.hospital').map(f => f.fieldKey), 'PATCH /api/accounts/:id/hospital');
  installField('account.bulkRows', 'account.basic', 'rows', 'rows', 'ACCOUNT.WRITE', { uiType: 'grid', valueRule: { type: 'rows', minLength: 1, maxLength: 100 }, current: { read: false, write: true, apiField: 'rows', note: 'Management register batch; each row retains its own validation result and draft input.' } });
  installAction('ACC.bulkSave', 'HQ_ACCOUNT', 'HQ.ACCOUNT', ['ACCOUNT.WRITE'], ['account.bulkRows'], 'POST /api/accounts/bulk-update', { requiredFieldKeys: ['account.bulkRows'] });
  for (const [key, db] of [['contactName', 'contact_name'], ['accountPublicId', 'account_public_id'], ['contactType', 'contact_type'], ['mobile', 'mobile'], ['email', 'email'], ['isKeyman', 'is_keyman'], ['school', 'school'], ['cohort', 'cohort'], ['major', 'major'], ['note', 'note']]) {
    installField(`contact.${key}`, 'account.contacts', key, db, 'CONTACT.WRITE', {
      valueRule: key === 'accountPublicId' ? { type: 'reference' } : key === 'isKeyman' ? { type: 'boolean' } : { type: 'string', maxLength: key === 'note' ? 4000 : 200 }
    });
  }
  const contactFields = s.fields.filter(f => f.entity === 'contact').map(f => f.fieldKey);
  contactFields.push('account.contactName');
  installAction('CONTACT.create', 'HQ_ACCOUNT', 'HQ.ACCOUNT', ['CONTACT.WRITE'], contactFields, 'POST /api/contacts', { requiredFieldKeys: ['contact.contactName', 'contact.accountPublicId'] });
  installAction('CONTACT.save', 'HQ_ACCOUNT', 'HQ.ACCOUNT', ['CONTACT.WRITE'], contactFields, 'PATCH /api/contacts/:id', { requiredFieldKeys: ['contact.contactName', 'contact.accountPublicId'] });
  installAction('CONTACT.delete', 'HQ_ACCOUNT', 'HQ.ACCOUNT', ['CONTACT.WRITE'], [], 'DELETE /api/contacts/:id');
  for (const a of s.actions.filter(a => a.screenKey && ['HQ_LEAD', 'HQ_ACCOUNT', 'HQ_ACCOUNT360'].includes(a.screenKey))) {
    if (a.support !== 'planned') a.support = 'current';
  }
  // Recompute ownership edges after promotion, preserving all original stable IDs.
  for (const section of s.sections) section.actionKeys = s.actions.filter(a => a.screenKey === section.screenKey && (a.inputFieldKeys.some(k => section.fieldKeys.includes(k)) || s.sections.find(x => x.screenKey === section.screenKey)?.sectionKey === section.sectionKey)).map(a => a.actionKey);
  for (const f of s.fields.filter(f => f.current.write && f.sectionKey && ['lead', 'account', 'contact', 'conversion'].includes(f.entity))) {
    f.writeActionKeys = s.actions.filter(a => a.enabled && a.inputFieldKeys.includes(f.fieldKey)).map(a => a.actionKey);
  }
  for (const row of s.coverage.filter(c => c.implementationStage === 'H03')) {
    row.fieldKeys = s.fields.filter(f => !!f.sectionKey && row.sectionKeys.includes(f.sectionKey)).map(f => f.fieldKey);
    row.actionKeys = [...new Set([...row.actionKeys, ...s.actions.filter(a => a.screenKey && row.screenKeys.includes(a.screenKey) && a.inputFieldKeys.some(k => row.fieldKeys.includes(k))).map(a => a.actionKey)])];
    row.status = 'partial'; row.notes = 'H03 executable implementation; exact acceptance evidence is maintained in implementation/H03-report.md.';
  }
  const h04Evidence = 'RUNTIME.H04';
  s.evidence.push({ evidenceKey: h04Evidence, kind: 'assumption', source: 'docs/hq-standard/implementation/H04-report.md', analysisIds: [],
    note: 'H04 mock follows P0 activity fields and existing activity service. Report rejection and resubmission are explicit design assumptions pending HQ policy confirmation.' });
  s.evidenceKeys.push(h04Evidence);
  for (const key of ['ACT.planOne', 'ACT.planBulk', 'ACT.map', 'ACT.calendar', 'ACT.checkIn', 'ACT.consultation', 'ACT.checkOut',
    'REP.prepare', 'REP.edit', 'REP.request', 'REP.approveBranch', 'REP.approveDivision', 'DW.request', 'DW.decision.branch', 'DW.decision.division']) {
    action(key).support = 'current'; action(key).evidenceKeys = [...new Set([...action(key).evidenceKeys, h04Evidence])];
  }
  field('report.status').valueRule = { type: 'string', options: ['DRAFT', 'REQUESTED', 'BRANCH_APPROVED', 'FINAL_APPROVED', 'BRANCH_REJECTED', 'DIVISION_REJECTED'] };
  field('report.status').notes = 'Branch/division rejection and resubmission are H04 mock design assumptions, not confirmed HQ policy.';
  action('REP.request').condition = { kind: 'oneOf', fieldKey: 'report.status', values: ['DRAFT', 'BRANCH_REJECTED', 'DIVISION_REJECTED'] };
  action('REP.edit').condition = { kind: 'oneOf', fieldKey: 'report.status', values: ['DRAFT', 'BRANCH_REJECTED', 'DIVISION_REJECTED'] };
  installAction('REP.commentBranch', 'HQ_ACTIVITY_REPORT', 'HQ.REPORT', ['ACTIVITY.REPORT.APPROVE.BRANCH'], ['report.branchComment'],
    'POST /api/activity-reports/:id/comment/branch', { features: ['ACTIVITY_APPROVAL'], condition: eq('report.status', 'REQUESTED'), evidenceKeys: [h04Evidence], notes: 'Comment-only save preserves approval state.' });
  installAction('REP.commentDivision', 'HQ_ACTIVITY_REPORT', 'HQ.REPORT', ['ACTIVITY.REPORT.APPROVE.DIVISION'], ['report.divisionComment'],
    'POST /api/activity-reports/:id/comment/division', { features: ['ACTIVITY_APPROVAL'], condition: eq('report.status', 'BRANCH_APPROVED'), evidenceKeys: [h04Evidence], notes: 'Comment-only save preserves approval state.' });
  installAction('REP.rejectBranch', 'HQ_ACTIVITY_REPORT', 'HQ.REPORT', ['ACTIVITY.REPORT.APPROVE.BRANCH'], ['report.branchComment'],
    'POST /api/activity-reports/:id/reject/branch', { features: ['ACTIVITY_APPROVAL'], condition: eq('report.status', 'REQUESTED'), evidenceKeys: [h04Evidence], notes: 'H04 design assumption: branch rejection returns to reporter for correction and resubmission.' });
  installAction('REP.rejectDivision', 'HQ_ACTIVITY_REPORT', 'HQ.REPORT', ['ACTIVITY.REPORT.APPROVE.DIVISION'], ['report.divisionComment'],
    'POST /api/activity-reports/:id/reject/division', { features: ['ACTIVITY_APPROVAL'], condition: eq('report.status', 'BRANCH_APPROVED'), evidenceKeys: [h04Evidence], notes: 'H04 design assumption: division rejection restarts the approval route after correction.' });
  installField('directWork.reassignStep', 'directWork.detail', 'step', 'reassign_step', 'DIRECT_WORK.MANAGE',
    { uiType: 'select', valueRule: { type: 'string', options: ['BRANCH', 'DIVISION'] }, evidenceKeys: [h04Evidence] });
  installField('directWork.approverUserId', 'directWork.detail', 'approverUserId', 'approver_user_id', 'DIRECT_WORK.MANAGE',
    { uiType: 'reference', valueRule: { type: 'number', min: 1, integer: true }, evidenceKeys: [h04Evidence] });
  installField('directWork.reassignReason', 'directWork.detail', 'reason', 'reassign_reason', 'DIRECT_WORK.MANAGE',
    { valueRule: { type: 'string', minLength: 1, maxLength: 500 }, evidenceKeys: [h04Evidence] });
  installAction('DW.reassign', 'HQ_DIRECT_WORK', 'HQ.DIRECT_WORK', ['DIRECT_WORK.MANAGE'],
    ['directWork.reassignStep', 'directWork.approverUserId', 'directWork.reassignReason'], 'POST /api/direct-work/:id/reassign',
    { features: ['DIRECT_WORK'], requiredFieldKeys: ['directWork.reassignStep', 'directWork.approverUserId', 'directWork.reassignReason'],
      condition: { kind: 'oneOf', fieldKey: 'directWork.status', values: ['REQUESTED', 'BRANCH_APPROVED'] }, evidenceKeys: [h04Evidence], notes: 'H04 mock design assumption: only an authorized manager may reassign the current approval step.' });
  installAction('DW.erpRetry', 'HQ_DIRECT_WORK', 'HQ.DIRECT_WORK', ['DIRECT_WORK.APPROVE.DIVISION'], [], 'POST /api/direct-work/:id/erp/retry',
    { features: ['DIRECT_WORK'], condition: { kind: 'all', conditions: [eq('directWork.status', 'DIVISION_APPROVED'),
      { kind: 'oneOf', fieldKey: 'directWork.erpStatus', values: ['FAILED', 'TIMED_OUT'] }] }, evidenceKeys: [h04Evidence] });
  for (const row of s.coverage.filter(c => c.implementationStage === 'H04')) {
    row.status = 'partial'; row.notes = 'H04 executable HQ mock; browser and worker B evidence is recorded in implementation/H04-report.md.';
  }
  const h05Evidence = 'RUNTIME.H05';
  s.evidence.push({ evidenceKey: h05Evidence, kind: 'assumption', source: 'docs/hq-standard/implementation/H05-report.md', analysisIds: [],
    note: 'H05 isolated HQ sales mock follows the existing opportunity and contract rules. Contract type remains an unresolved candidate; package classification is stored separately.' });
  s.evidenceKeys.push(h05Evidence);
  for (const [key, max] of [['interestProduct', 500], ['description', 4000], ['specialTerms', 4000], ['paymentMethod', 100], ['competitorUsage', 2000], ['ownedEquipment', 2000], ['treatmentFeeInfo', 2000], ['stockStatus', 2000], ['paymentStatus', 2000], ['paymentDate', 10]] as const) {
    installField(`opportunity.${key}`, 'opportunity.basic', key, key.replace(/[A-Z]/g, x => `_${x.toLowerCase()}`), 'OPPORTUNITY.WRITE',
      { valueRule: { type: 'string', maxLength: max }, evidenceKeys: [h05Evidence], notes: 'H05 optional opportunity input.' });
  }
  installField('opportunity.recordType', 'opportunity.basic', 'recordType', 'record_type', 'OPPORTUNITY.WRITE', { uiType: 'select', valueRule: { type: 'string', options: ['NEW', 'EXISTING', 'RECONTRACT'] }, evidenceKeys: [h05Evidence], notes: 'Salesforce new/renewal change observed; EXISTING retained for legacy local records. Changing type does not delete renewal values.' });
  installField('opportunity.installmentMonths', 'opportunity.basic', 'installmentMonths', 'installment_months', 'OPPORTUNITY.WRITE',
    { uiType: 'number', valueRule: { type: 'number', integer: true, min: 0, max: 120 }, evidenceKeys: [h05Evidence] });
  installField('opportunity.priceListCode', 'opportunity.basic', 'priceListCode', 'price_list_code', 'OPPORTUNITY.WRITE',
    { uiType: 'select', valueRule: { type: 'string', options: ['ERP_STANDARD', 'CUSTOM_QUOTE'] }, evidenceKeys: [h05Evidence],
      notes: 'H05 mock assumption: selecting ERP_STANDARD reprices existing lines to the current ERP catalog base price; CUSTOM_QUOTE preserves current quoted prices. Contracted opportunities are locked.' });
  installField('contract.contractName', 'contract.basic', 'contractName', 'contract_name', 'CONTRACT.WRITE',
    { valueRule: { type: 'string', minLength: 1, maxLength: 200 }, evidenceKeys: [h05Evidence] });
  installField('contract.packageClassification', 'contract.basic', 'packageClassification', 'package_classification', 'CONTRACT.WRITE',
    { valueRule: { type: 'string', maxLength: 100 }, evidenceKeys: [h05Evidence], notes: 'Package classification is not assumed to equal the unresolved contract type.' });
  installField('contract.description', 'contract.basic', 'description', 'description', 'CONTRACT.WRITE', {uiType:'textarea',valueRule:{type:'string',maxLength:4000},evidenceKeys:[h05Evidence]});
  installAction('CON.save', 'HQ_CONTRACT', action('CON.create').processKey, ['CONTRACT.WRITE'], ['contract.contractName','contract.contractDate','contract.packageClassification','contract.productAmount','contract.goodsAmount','contract.terms','contract.description'], 'PATCH /api/contracts/:publicId', {label:'계약 수정',evidenceKeys:[h05Evidence],notes:'Isolated mock only; amounts are independent fields and version is required.'});
  for (const key of ['OPP.create', 'OPP.stage', 'OPP.saveNegotiation', 'OPP.product.add', 'OPP.product.edit', 'OPP.product.remove', 'CON.create', 'CON.erpRequest', 'COL.planOriginal', 'COL.planChange', 'PIPELINE.refresh']) {
    const entry = action(key); entry.support = 'current'; entry.evidenceKeys = [...new Set([...entry.evidenceKeys, h05Evidence])];
  }
  installAction('OPP.delete', 'HQ_OPPORTUNITY', action('OPP.saveNegotiation').processKey, ['OPPORTUNITY.WRITE'], [], 'DELETE /api/opportunities/:publicId', { label: '기회 삭제', evidenceKeys: [h05Evidence], notes: 'Local safety policy: referenced opportunities cannot be deleted; expectedVersion is mandatory.' });
  action('OPP.saveNegotiation').inputFieldKeys = [...new Set([...action('OPP.saveNegotiation').inputFieldKeys, ...s.fields.filter(f => f.fieldKey.startsWith('opportunity.') && f.evidenceKeys.includes(h05Evidence)).map(f => f.fieldKey)])];
  action('OPP.create').inputFieldKeys = [...new Set([...action('OPP.create').inputFieldKeys, ...s.fields.filter(f => f.fieldKey.startsWith('opportunity.') && f.evidenceKeys.includes(h05Evidence) && f.fieldKey !== 'opportunity.priceListCode').map(f => f.fieldKey)])];
  const productMetadataKeys: string[] = [];
  for (const [key, db] of [['productAmount','product_amount'],['goodsAmount','goods_amount'],['surchargeRate','surcharge_rate'],['discountRate','discount_rate']] as const) {
    installField(`opportunity.${key}`, 'opportunity.products', key, db, 'OPPORTUNITY.PRODUCT.WRITE', { uiType: 'number', valueRule: { type: 'number', min: 0, max: key.endsWith('Rate') ? 100 : 1e12 }, evidenceKeys: [h05Evidence], notes: 'Observed independent product metadata; no additional percentage calculation is inferred.' }); productMetadataKeys.push(`opportunity.${key}`);
  }
  installField('opportunity.productDescription', 'opportunity.products', 'description', 'description', 'OPPORTUNITY.PRODUCT.WRITE', { valueRule: {type:'string',maxLength:4000}, evidenceKeys:[h05Evidence] }); productMetadataKeys.push('opportunity.productDescription');
  for (const key of ['OPP.product.add','OPP.product.edit']) action(key).inputFieldKeys = [...new Set([...action(key).inputFieldKeys,...productMetadataKeys])];
  action('CON.create').inputFieldKeys = [...new Set([...action('CON.create').inputFieldKeys, 'contract.contractName', 'contract.packageClassification'])];
  for (const row of s.coverage.filter(c => c.implementationStage === 'H05')) {
    row.status = 'partial'; row.notes = 'H05 executable HQ mock; HTTP and PC/390px browser evidence is recorded in implementation/H05-report.md.';
  }
  const h06Evidence = 'RUNTIME.H06';
  s.evidence.push({ evidenceKey: h06Evidence, kind: 'assumption', source: 'docs/hq-standard/implementation/H06-report.md', analysisIds: [],
    note: 'H06 isolated order and evidence workflow. Catalog price is ERP owned. Search requires three characters; LAB choices use an account scoped mock fixture.' });
  s.evidenceKeys.push(h06Evidence);
  installField('order.category', 'order.items', 'category', 'category', 'PRODUCT_ORDER.READ',
    { uiType: 'select', valueRule: { type: 'string', maxLength: 100 }, evidenceKeys: [h06Evidence], notes: 'Optional ERP catalog category filter.' });
  installField('order.labPublicId', 'order.delivery', 'labPublicId', 'lab_public_id', 'ORDER.WRITE',
    { uiType: 'reference', valueRule: { type: 'reference' }, evidenceKeys: [h06Evidence], notes: 'Required only for LAB delivery.' });
  for (const key of ['ORD.catalog', 'ORD.draft', 'ORD.items.add', 'ORD.items.remove', 'ORD.delivery', 'ORD.submit', 'FUL.open', 'LED.search', 'LED.export', 'STM.search', 'STM.export', 'ANL.search']) {
    const entry = action(key); entry.support = 'current'; entry.evidenceKeys = [...new Set([...entry.evidenceKeys, h06Evidence])];
  }
  action('ORD.items.add').inputFieldKeys = ['order.productPublicId', 'order.quantity'];
  installAction('ORD.items.update', 'HQ_ORDER', action('ORD.items.add').processKey, ['ORDER.WRITE'], ['order.quantity'],
    'PATCH /api/orders/:publicId/items/:itemId', { label: '주문 품목 수량 변경', condition: action('ORD.items.add').condition,
      evidenceKeys: [h06Evidence], notes: 'DOCX S518/S618/S714: quantity changes retain the ERP unit price and recalculate the order total.' });
  action('ORD.delivery').inputFieldKeys.push('order.labPublicId');
  field('order.deliveryAddressType').valueRule = { type: 'string', options: ['ACCOUNT', 'DIRECT', 'LAB'] };
  field('order.unitPrice').readOnly = true; field('order.unitPrice').source = 'ERP'; field('order.unitPrice').current.write = false;
  for (const row of s.coverage.filter(c => c.implementationStage === 'H06')) {
    row.status = 'partial'; row.notes = 'H06 executable HQ mock; HTTP and browser evidence is recorded in implementation/H06-report.md.';
  }
  const h07Evidence = 'RUNTIME.H07';
  s.evidence.push({ evidenceKey: h07Evidence, kind: 'assumption', source: 'docs/hq-standard/implementation/H07-report.md', analysisIds: [],
    note: 'H07 isolated HQ home, administration and published-standard routing. The external admin branch is compared, not silently merged.' });
  s.evidenceKeys.push(h07Evidence);
  const h07Screens = [
    ['HQ_HOME', '홈', 'home', '/', 'HQ.HOME', 'HOME.READ', 'SCR-HOME-001'],
    ['HQ_ADMIN_USERS', '사용자·조직', 'adminUsers', '/hq-admin/users', 'HQ.ADMIN', 'USER.READ', 'SCR-ADM-001'],
    ['HQ_ADMIN_PERMISSIONS', '권한', 'adminPermissions', '/hq-admin/permissions', 'HQ.ADMIN', 'ADMIN.READ', 'SCR-ADM-002'],
    ['HQ_ADMIN_CODES', '공통코드', 'adminCodes', '/hq-admin/codes', 'HQ.ADMIN', 'ADMIN.READ', 'SCR-ADM-003'],
    ['HQ_ADMIN_INTERFACES', '연계 모니터', 'adminInterfaces', '/hq-admin/interfaces', 'HQ.ADMIN', 'INTERFACE.READ', 'SCR-ADM-004'],
    ['HQ_ADMIN_AUDIT', '감사', 'adminAudit', '/hq-admin/audit', 'HQ.ADMIN', 'AUDIT.READ', 'SCR-ADM-005']
  ] as const;
  const adminReadEndpoints: Record<string, string> = {
    'SCR-ADM-001': 'GET /api/hq/admin/users',
    'SCR-ADM-002': 'GET /api/hq/admin/roles',
    'SCR-ADM-003': 'GET /api/hq/admin/common-codes',
    'SCR-ADM-004': 'GET /api/interface-logs',
    'SCR-ADM-005': 'GET /api/audit-logs'
  };
  const adminEditEndpoints: Record<string, string> = {
    'SCR-ADM-001': 'PATCH /api/hq/admin/users/:id',
    'SCR-ADM-002': 'PATCH /api/hq/admin/roles/:id',
    'SCR-ADM-003': 'POST /api/hq/admin/common-codes',
    'SCR-ADM-004': 'POST /api/hq/interfaces/retry',
    'SCR-ADM-005': 'GET /api/audit-logs'
  };
  for (const [screenKey, label, routeKey, path, processKey, permission, catalogId] of h07Screens) {
    const sectionKey = `h07.${routeKey}`; const tabKey = `${screenKey}.main`;
    const fields = s.fields.filter(f => f.plannedCatalogId === catalogId);
    for (const field of fields) { delete field.plannedCatalogId; field.sectionKey = sectionKey; field.visible = true; field.readOnly = true;
      field.current = { ...field.current, read: true, note: 'H07 HQ mock administration read model.' }; field.evidenceKeys.push(h07Evidence); }
    s.sections.push({ sectionKey, screenKey, tabKey, label, labelKey: `hq.section.${sectionKey}`, kind: 'section', enabled: true, order: 1000,
      fieldKeys: fields.map(f => f.fieldKey), actionKeys: [], evidenceKeys: [h07Evidence] });
    s.tabs.push({ tabKey, screenKey, label: '기본', labelKey: 'hq.tab.main', enabled: true, order: 10, sectionKeys: [sectionKey], evidenceKeys: [h07Evidence] });
    const readAction = catalogId === 'SCR-HOME-001' ? action('HOME.refresh') : action(`ADM.${catalogId}.read`);
    delete readAction.plannedCatalogId; readAction.screenKey = screenKey; readAction.enabled = true; readAction.support = 'current';
    readAction.permissions = [permission]; readAction.endpoint = catalogId === 'SCR-HOME-001' ? 'GET /api/hq/home' : adminReadEndpoints[catalogId];
    readAction.evidenceKeys.push(h07Evidence);
    s.screens.push({ screenKey, label, labelKey: `hq.screen.${screenKey}`, routeKey, path, kind: catalogId === 'SCR-HOME-001' ? 'dashboard' : 'page',
      devices: ['desktop', 'mobile'], enabled: true, processKeys: [processKey], permissions: [permission], features: [], tabKeys: [tabKey],
      sectionKeys: [sectionKey], actionKeys: [readAction.actionKey], evidenceKeys: [h07Evidence] });
    s.menus.push({ menuKey: `menu.${screenKey}`, parentKey: null, screenKey, label, labelKey: `hq.screen.${screenKey}`,
      enabled: true, order: catalogId === 'SCR-HOME-001' ? 1 : 300 + h07Screens.findIndex(x => x[0] === screenKey) * 10,
      permissions: [], features: [], evidenceKeys: [h07Evidence] });
    s.sections.at(-1)!.actionKeys.push(readAction.actionKey);
    for (const candidate of s.actions.filter(a => a.plannedCatalogId === catalogId)) {
      delete candidate.plannedCatalogId; candidate.screenKey = screenKey; candidate.enabled = true; candidate.support = 'current';
      candidate.permissions = [catalogId === 'SCR-ADM-004' ? 'INTERFACE.MANAGE' : catalogId === 'SCR-ADM-005' ? 'AUDIT.READ' : 'ADMIN.WRITE'];
      candidate.endpoint = adminEditEndpoints[catalogId];
      candidate.evidenceKeys.push(h07Evidence); s.screens.at(-1)!.actionKeys.push(candidate.actionKey); s.sections.at(-1)!.actionKeys.push(candidate.actionKey);
    }
    const process = s.processes.find(p => p.processKey === processKey)!; process.enabled = true; process.screenKeys.push(screenKey);
    const coverage = s.coverage.find(c => c.catalogId === catalogId)!; coverage.screenKeys = [screenKey]; coverage.sectionKeys = [sectionKey];
    coverage.fieldKeys = fields.map(f => f.fieldKey);
    coverage.actionKeys = s.actions.filter(a => a.screenKey === screenKey).map(a => a.actionKey);
    coverage.planned = false; coverage.enabled = true; coverage.status = 'partial';
    coverage.notes = 'H07 HQ mock screen; acceptance evidence is recorded in implementation/H07-report.md.'; coverage.evidenceKeys.push(h07Evidence);
  }
  for (const [key, screenKey, endpoint, permission] of [
    ['ADM.users.save', 'HQ_ADMIN_USERS', 'PATCH /api/hq/admin/users/:id', 'USER.WRITE'],
    ['ADM.organizations.save', 'HQ_ADMIN_USERS', 'PATCH /api/hq/admin/organizations/:id', 'ORG.WRITE'],
    ['ADM.permissions.save', 'HQ_ADMIN_PERMISSIONS', 'PATCH /api/hq/admin/roles/:id', 'ADMIN.WRITE'],
    ['ADM.codes.save', 'HQ_ADMIN_CODES', 'POST /api/hq/admin/common-codes', 'ADMIN.WRITE'],
    ['ADM.interfaces.retry', 'HQ_ADMIN_INTERFACES', 'POST /api/hq/interfaces/retry', 'INTERFACE.MANAGE'],
    ['ADM.standard.publish', 'HQ_ADMIN_PERMISSIONS', 'POST /api/hq/admin/standard/publish', 'STANDARD.PUBLISH']
  ] as const) installAction(key, screenKey, 'HQ.ADMIN', [permission], [], endpoint, { evidenceKeys: [h07Evidence] });
  return s;
}
