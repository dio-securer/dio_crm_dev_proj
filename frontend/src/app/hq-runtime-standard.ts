import type { HqAction, HqCondition, HqField, HqStandard, HqTransition } from '@dio-crm/contracts';

/** H01 is the immutable survey baseline. Executable stages explicitly extend it here. */
export function extendHqRuntimeStandard(baseline: HqStandard): HqStandard {
  const s: HqStandard = structuredClone(baseline);
  s.version = '1.3.0';
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

  for (const [key, db] of [['hospitalSize', 'hospital_size'], ['mainSystem', 'main_system'], ['subSystem', 'sub_system'], ['dioProductUsage', 'dio_product_usage']]) {
    installField(`account.${key}`, 'account.hospital', key, db, 'ACCOUNT.WRITE', key === 'hospitalSize' ? { valueRule: { type: 'number', min: 0, integer: true } } : {});
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
  return s;
}
