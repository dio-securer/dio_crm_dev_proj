import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../api';
import { useHqMock } from './HqMockProvider';
import { HqError, HqFields, HqModal, HqRecordSummary, HqRows, HqTabs, useHqCommand, useHqCustomerPolicy } from './customer-shared';
import { LEAD_FIELDS, LEAD_STAGES, displayValue, formFromRecord, formPayload, recordLabel, type ConversionOptions, type ConversionResult, type CustomerForm, type CustomerOwner, type CustomerRecord } from './customer-model';

export function HqLeadsPage() {
  const { t } = useTranslation();
  const { session } = useHqMock();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('recent');
  const [stage, setStage] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CustomerForm>(() => formFromRecord(LEAD_FIELDS));
  const policy = useHqCustomerPolicy();
  const command = useHqCommand();
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ['hq-leads', search, scope, stage], retry: false,
    queryFn: () => apiGet<CustomerRecord[]>(`/api/leads?search=${encodeURIComponent(search)}&scope=${scope}${stage ? `&status=${stage}` : ''}`) });
  const clock = useQuery({ queryKey: ['hq-clock'], queryFn: () => apiGet<{ now: string }>('/api/hq/status'), retry: false });
  const dateInSeoul = (value: unknown) => { const date = new Date(String(value ?? '')); return Number.isFinite(date.valueOf()) ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date) : ''; };
  const today = dateInSeoul(clock.data?.now);
  const recentTime = (row: CustomerRecord) => String(row.updated_at ?? row.created_at ?? row.source_updated_at ?? '');
  const rows = (query.data ?? []).filter(row => (scope !== 'mine' || row.owner_user_id === session?.user.userId) && (scope !== 'today' || Boolean(today && dateInSeoul(row.created_at) === today)) && (!stage || row.status === stage)).sort((a, b) => recentTime(b).localeCompare(recentTime(a)) || a.public_id.localeCompare(b.public_id));
  const selectedId = params.get('lead');
  const open = (id: string) => setParams(previous => { const next = new URLSearchParams(previous); next.set('lead', id); return next; });
  const close = () => setParams(previous => { const next = new URLSearchParams(previous); next.delete('lead'); return next; });
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const result = await command.run<CustomerRecord>('POST', '/api/leads', policy.writablePayload('lead', formPayload(LEAD_FIELDS, form)));
      await cache.invalidateQueries({ queryKey: ['hq-leads'] }); setCreating(false); open(result.public_id);
    } catch { /* Input remains available for correction and retry. */ }
  };
  if (selectedId) return <HqLeadDetail key={selectedId} publicId={selectedId} onBack={close} />;
  return <section className="hq-customer-page hq-lead-list">
    <div className="page-header"><div><span className="page-kicker">CRM · LEAD</span><h2>{t('lead.title')}</h2><p>{t('hqCustomer.leadIntro')}</p></div>
      <button type="button" className="button-primary" disabled={!policy.has('LEAD.WRITE') || !policy.ready} onClick={() => { setForm(formFromRecord(LEAD_FIELDS)); command.clearError(); setCreating(true); }}>{t('hqCustomer.newLead')}</button></div>
    <div className="hq-customer-toolbar"><input aria-label={t('lead.search')} placeholder={t('lead.search')} value={search} onChange={event => setSearch(event.target.value)} />
      <select aria-label={t('hqCustomer.scope')} value={scope} onChange={event => setScope(event.target.value)}><option value="recent">{t('hqCustomer.recent')}</option><option value="today">{t('hqCustomer.today')}</option><option value="managed">{t('hqCustomer.managed')}</option><option value="mine">{t('hqCustomer.mine')}</option></select>
      <select aria-label={t('common.status')} value={stage} onChange={event => setStage(event.target.value)}><option value="">{t('hqCustomer.allStages')}</option>{LEAD_STAGES.map(value => <option key={value} value={value}>{t(`status.${value}`)}</option>)}</select>
    </div>
    <p className="hq-customer-filter-note">{t('hqCustomer.recentRule', { date: today || '—' })}</p>
    <HqError error={query.error ?? policy.error ?? clock.error} />
    <HqRows rows={rows} columns={[
      { key: 'hospital_name', label: t('lead.hospital'), render: row => <button className="hq-record-link" type="button" data-lead-id={row.public_id} onClick={() => open(row.public_id)}>{recordLabel(row)}</button> },
      { key: 'status', label: t('common.status'), render: row => t(`status.${row.status}`) },
      { key: 'owner_name', label: t('lead.owner'), render: row => displayValue(row.owner_name ?? row.owner_user_id) },
      { key: 'phone', label: t('lead.phone') }, { key: 'business_no', label: t('lead.businessNo') }
    ]} />
    {creating && <HqModal title={t('hqCustomer.newLead')} onClose={() => setCreating(false)} busy={command.busy} wide><form onSubmit={event => void create(event)}>
      {['basic', 'keyman', 'hospital', 'exclusions'].map(group => <fieldset key={group}><legend>{t(`hqCustomer.tabs.${group}`)}</legend><HqFields entity="lead" fields={LEAD_FIELDS.filter(field => field.group === group)} form={form} onChange={setForm} disabled={command.busy} /></fieldset>)}
      <HqError error={command.error} /><footer><button type="button" onClick={() => setCreating(false)} disabled={command.busy}>{t('common.cancel')}</button><button type="submit" className="button-primary" disabled={command.busy || !policy.can('LEAD.create', {}, formPayload(LEAD_FIELDS, form))}>{t('common.create')}</button></footer>
    </form></HqModal>}
  </section>;
}

function HqLeadDetail({ publicId, onBack }: { publicId: string; onBack: () => void }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const policy = useHqCustomerPolicy();
  const command = useHqCommand();
  const [active, setActive] = useState('basic');
  const [form, setForm] = useState<CustomerForm | null>(null);
  const [baseline, setBaseline] = useState<CustomerRecord | null>(null);
  const [selectedStage, setSelectedStage] = useState('');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);
  const query = useQuery({ queryKey: ['hq-lead', publicId], queryFn: () => apiGet<CustomerRecord>(`/api/leads/${publicId}`), retry: false });
  const history = useQuery({ queryKey: ['hq-lead-history', publicId], queryFn: () => apiGet<CustomerRecord[]>(`/api/leads/${publicId}/history`), retry: false });
  const options = useQuery({ queryKey: ['hq-lead-options'], queryFn: () => apiGet<{ owners: CustomerOwner[]; statuses: string[] }>('/api/leads/options'), retry: false });
  const row = query.data;
  useEffect(() => { if (row && form === null) { setForm(formFromRecord(LEAD_FIELDS, row)); setBaseline(row); setSelectedStage(String(row.status)); setOwnerUserId(String(row.owner_user_id)); } }, [row, form]);
  const refresh = async () => { await Promise.all([query.refetch(), history.refetch(), cache.invalidateQueries({ queryKey: ['hq-leads'] })]); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!row || !form || !baseline) return;
    try { const saved = await command.run<CustomerRecord>('PATCH', `/api/leads/${publicId}`, { ...policy.writablePayload('lead', formPayload(LEAD_FIELDS, form), baseline), expectedVersion: baseline.version }); setForm(formFromRecord(LEAD_FIELDS, saved)); setBaseline(saved); await refresh(); setNotice(t('hqCustomer.saved')); } catch { /* Preserve edited fields. */ }
  };
  const saveStage = async () => {
    if (!row) return;
    try { const saved = await command.run<CustomerRecord>('POST', `/api/leads/${publicId}/status`, { toStatus: selectedStage, reason, expectedVersion: row.version }); setSelectedStage(String(saved.status)); setReason(''); setBaseline(current => current?.version === row.version ? { ...current, version: saved.version, status: saved.status } : current); await refresh(); setNotice(t('hqCustomer.stageSaved')); } catch { /* A selected stage is not the persisted stage. */ }
  };
  const assign = async (event: React.FormEvent) => {
    event.preventDefault(); if (!row) return;
    try { const saved = await command.run<CustomerRecord>('POST', `/api/leads/${publicId}/assign-owner`, { ownerUserId: Number(ownerUserId), expectedVersion: row.version }); setBaseline(current => current?.version === row.version ? { ...current, version: saved.version, owner_user_id: saved.owner_user_id } : current); await refresh(); setOwnerOpen(false); setNotice(t('hqCustomer.saved')); } catch { /* Keep selection on failure. */ }
  };
  const remove = async () => { if (!row || !window.confirm(t('hqCustomer.deleteConfirm'))) return; try { await command.run('DELETE', `/api/leads/${publicId}`, { expectedVersion: row.version }); await cache.invalidateQueries({ queryKey: ['hq-leads'] }); onBack(); } catch { /* Show API refusal. */ } };
  if (!row || !form) return <section className="hq-customer-page"><button onClick={onBack}>{t('account.back')}</button><HqError error={query.error} />{query.isLoading && <p>{t('common.loading')}</p>}</section>;
  const editable = row.status !== 'CONVERTED' && policy.owns(row, 'LEAD.MANAGE') && policy.has('LEAD.WRITE');
  const forward: Record<string, string[]> = { NEW: ['FIRST_VISIT', 'CONTACT_EXCLUDED'], FIRST_VISIT: ['KEYMAN_MEETING', 'CONTACT_EXCLUDED'], KEYMAN_MEETING: ['CONTACT_EXCLUDED'], CONTACT_EXCLUDED: [], CONVERTED: [] };
  const reverse = selectedStage !== row.status && !(forward[String(row.status)] ?? []).includes(selectedStage);
  const stageInput = { toStatus: selectedStage, reason };
  const conversion = row.conversion as ConversionResult | undefined;
  return <section className="hq-customer-page hq-lead-detail" data-record-id={publicId}>
    <div className="hq-customer-toolbar"><button type="button" onClick={onBack}>{t('account.back')}</button><span className="hq-record-id">{publicId}</span></div>
    <div className="page-header"><div><h2>{recordLabel(row)}</h2><p>{t('lead.owner')}: {displayValue(row.owner_name ?? row.owner_user_id)}</p></div><div className="page-actions">
      {policy.can('LEAD.assignOwner', row) && editable && <button type="button" onClick={() => setOwnerOpen(true)}>{t('hqCustomer.assignOwner')}</button>}
      {policy.can('LEAD.convert', row, { accountMode: 'NEW', contactMode: 'SKIP', opportunityMode: 'SKIP' }) && editable && <button className="button-primary" type="button" onClick={() => setConvertOpen(true)}>{t('hqCustomer.convert')}</button>}
      {editable && row.status === 'NEW' && policy.can('LEAD.delete', row) && <button type="button" onClick={() => void remove()}>{t('hqCustomer.delete')}</button>}
    </div></div>
    <section className="hq-stage-panel"><p><strong>{t('hqCustomer.savedStage')}: <span data-testid="saved-lead-stage">{t(`status.${row.status}`)}</span></strong></p>
      <div className="hq-stage-buttons">{LEAD_STAGES.filter(value => value !== 'CONVERTED').map(value => <button type="button" key={value} aria-pressed={selectedStage === value} disabled={!editable || command.busy} onClick={() => { setSelectedStage(value); setNotice(''); }}>{t(`status.${value}`)}</button>)}</div>
      {editable && <div className="hq-customer-toolbar"><label>{t('hqCustomer.stageReason')}<input data-testid="stage-reason" value={reason} onChange={event => setReason(event.target.value)} /></label>
        <button type="button" data-testid="save-stage" className="button-primary" disabled={command.busy || selectedStage === row.status || !policy.can(reverse ? 'LEAD.reverse' : 'LEAD.changeStage', row, stageInput) || ((reverse || selectedStage === 'CONTACT_EXCLUDED') && !reason.trim())} onClick={() => void saveStage()}>{t('hqCustomer.saveStage')}</button>
        <small>{t('hqCustomer.selectedStage', { stage: t(`status.${selectedStage}`) })}</small></div>}
    </section>
    {conversion && <ConversionLinks result={conversion} />}
    {baseline && baseline.version !== row.version && <p className="notice warning">{t('hqCustomer.changedElsewhere')} <button type="button" onClick={() => { if (window.confirm(t('hqCustomer.discardReload'))) { setForm(formFromRecord(LEAD_FIELDS, row)); setBaseline(row); command.clearError(); } }}>{t('hqCustomer.reloadLatest')}</button></p>}
    {notice && <p className="hq-customer-success" role="status">{notice}</p>}<HqError error={command.error ?? policy.error} />
    <HqTabs active={active} onChange={setActive} tabs={['basic', 'keyman', 'hospital', 'exclusions', 'hira', 'marketing', 'history', 'activities'].map(key => ({ key, label: t(`hqCustomer.tabs.${key}`) }))} />
    {['basic', 'keyman', 'hospital', 'exclusions'].includes(active) && <form onSubmit={event => void save(event)} className="hq-customer-panel">
      <HqFields entity="lead" row={row} fields={LEAD_FIELDS.filter(field => field.group === active)} form={form} onChange={setForm} disabled={!editable || command.busy} />
      {editable && <footer><button type="submit" className="button-primary" disabled={command.busy || !policy.can('LEAD.save', row, formPayload(LEAD_FIELDS, form))}>{t('common.save')}</button></footer>}
    </form>}
    {active === 'hira' && <div className="hq-customer-panel"><p>{t('hqCustomer.sourceReadOnly')}</p><HqRecordSummary row={row} fields={[
      { key: 'provider_no', label: t('hqCustomer.fields.providerNo') }, { key: 'encrypted_provider_no', label: t('hqCustomer.fields.encryptedProviderNo') }, { key: 'source_system', label: t('hqCustomer.fields.source') }, { key: 'source_updated_at', label: t('hqCustomer.fields.sourceUpdatedAt') }, { key: 'hira_sync_exclude_yn', label: t('hqCustomer.fields.hiraExcluded') }, { key: 'manual_fields', label: t('hqCustomer.fields.manualFields') }
    ]} /></div>}
    {active === 'marketing' && <div className="hq-customer-panel"><p>{t('hqCustomer.unconfirmedCalculation')}</p><HqRecordSummary row={row} fields={[
      { key: 'engagement_score', label: t('hqCustomer.fields.engagementScore') }, { key: 'hira_check_needed', label: t('hqCustomer.fields.hiraCheckNeeded') }, { key: 'calculation_status', label: t('hqCustomer.fields.calculationStatus') }
    ]} /></div>}
    {active === 'history' && <div className="hq-customer-panel"><HqError error={history.error} /><HqRows rows={history.data ?? []} columns={[
      { key: 'at', label: t('common.date') }, { key: 'action', label: t('hqCustomer.action') }, { key: 'user_id', label: t('lead.owner') },
      { key: 'changes', label: t('hqCustomer.changes'), render: item => displayValue(item.changes ?? { from: item.from_status ?? item.from_owner_user_id, to: item.to_status ?? item.to_owner_user_id, reason: item.reason, conversion: item.conversion }) }
    ]} /></div>}
    {active === 'activities' && <LeadActivities publicId={publicId} />}
    {ownerOpen && <HqModal title={t('hqCustomer.assignOwner')} onClose={() => setOwnerOpen(false)} busy={command.busy}><form onSubmit={event => void assign(event)}><label>{t('lead.owner')}<select data-testid="lead-owner-select" value={ownerUserId} onChange={event => setOwnerUserId(event.target.value)}>{options.data?.owners.map(owner => <option key={owner.userId} value={owner.userId}>{owner.name}</option>)}</select></label><HqError error={command.error ?? options.error} /><footer><button type="submit" disabled={command.busy || !ownerUserId}>{t('common.save')}</button></footer></form></HqModal>}
    {convertOpen && <LeadConversion row={row} onClose={() => setConvertOpen(false)} onConverted={refresh} />}
  </section>;
}

function LeadActivities({ publicId }: { publicId: string }) {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['hq-lead-activities', publicId], queryFn: () => apiGet<CustomerRecord[]>(`/api/activities?relatedType=LEAD&relatedPublicId=${publicId}`), retry: false });
  const rows = (query.data ?? []).filter(row => row.related_type === 'LEAD' && row.related_public_id === publicId);
  return <div className="hq-customer-panel"><HqError error={query.error} /><HqRows rows={rows} columns={[{ key: 'subject', label: t('common.item') }, { key: 'start_at', label: t('common.date') }, { key: 'status', label: t('common.status') }, { key: 'consultation_content', label: t('activity.consultation') }]} /></div>;
}

export function ConversionLinks({ result }: { result: ConversionResult }) {
  const { t } = useTranslation();
  return <div className="hq-conversion-result" data-testid="conversion-result"><strong>{t('hqCustomer.conversionDone')}</strong><dl>
    <div><dt>{t('common.account')}</dt><dd><Link data-testid="conversion-account-link" to={`/accounts?record=${result.accountPublicId}`}>{result.accountPublicId}</Link></dd></div>
    {result.contactPublicId && <div><dt>{t('hqCustomer.tabs.contacts')}</dt><dd><Link data-testid="conversion-contact-link" to={`/accounts?record=${result.accountPublicId}&tab=contacts&contact=${result.contactPublicId}`}>{result.contactPublicId}</Link></dd></div>}
    {result.opportunityPublicId ? <div><dt>{t('nav.opportunity')}</dt><dd><Link data-testid="conversion-opportunity-link" to={`/opportunities?record=${result.opportunityPublicId}`}>{result.opportunityPublicId}</Link></dd></div> : <div><dt>{t('nav.opportunity')}</dt><dd>{t('hqCustomer.skipped')}</dd></div>}
  </dl></div>;
}
function LeadConversion({ row, onClose, onConverted }: { row: CustomerRecord; onClose: () => void; onConverted: () => Promise<void> }) {
  const { t } = useTranslation();
  const policy = useHqCustomerPolicy();
  const command = useHqCommand();
  const query = useQuery({ queryKey: ['hq-lead-conversion', row.public_id], queryFn: () => apiGet<ConversionOptions>(`/api/leads/${row.public_id}/conversion-options`), retry: false });
  const [accountMode, setAccountMode] = useState('NEW');
  const [accountId, setAccountId] = useState('');
  const [contactMode, setContactMode] = useState('NEW');
  const [contactId, setContactId] = useState('');
  const [contactName, setContactName] = useState(String(row.keyman_name ?? ''));
  const [opportunityMode, setOpportunityMode] = useState('NEW');
  const [opportunityId, setOpportunityId] = useState('');
  const [opportunityName, setOpportunityName] = useState(String(row.hospital_name));
  const [ownerUserId, setOwnerUserId] = useState(String(row.owner_user_id));
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const contacts = (query.data?.contacts ?? []).filter(item => item.account_public_id === accountId);
  const opportunities = (query.data?.opportunities ?? []).filter(item => item.account_public_id === accountId);
  const payload = { accountMode, ...(accountMode === 'EXISTING' ? { existingAccountPublicId: accountId } : {}), contactMode,
    ...(contactMode === 'EXISTING' ? { existingContactPublicId: contactId } : contactMode === 'NEW' ? { contactName } : {}), opportunityMode,
    ...(opportunityMode === 'EXISTING' ? { existingOpportunityPublicId: opportunityId } : opportunityMode === 'NEW' ? { opportunityName } : {}), ownerUserId: Number(ownerUserId), simulateFailure, expectedVersion: row.version };
  const submit = async (event: React.FormEvent) => { event.preventDefault(); try { const response = await command.run<ConversionResult>('POST', `/api/leads/${row.public_id}/convert`, payload); setResult(response); await onConverted(); } catch { /* Keep all conversion choices on transactional failure. */ } };
  return <HqModal title={t('hqCustomer.convert')} onClose={onClose} busy={command.busy} wide>
    {result ? <><ConversionLinks result={result} /><footer><button type="button" onClick={onClose}>{t('app.close')}</button></footer></> : <form className="hq-conversion-form" onSubmit={event => void submit(event)}>
      {Boolean(query.data?.duplicates.length) && <div className="notice warning" data-testid="conversion-duplicates"><strong>{t('hqCustomer.duplicatesFound')}</strong><ul>{query.data!.duplicates.map(item => <li key={item.public_id}>{recordLabel(item)} · {displayValue(item.business_no)}</li>)}</ul></div>}
      <fieldset><legend>{t('common.account')}</legend><label>{t('hqCustomer.accountMode')}<select data-testid="conversion-account-mode" value={accountMode} onChange={event => { setAccountMode(event.target.value); setAccountId(''); setContactId(''); setOpportunityId(''); if (event.target.value === 'NEW') { setContactMode('NEW'); setOpportunityMode('NEW'); } }}><option value="NEW">{t('hqCustomer.createNew')}</option><option value="EXISTING">{t('hqCustomer.useExisting')}</option></select></label>
        {accountMode === 'EXISTING' && <label>{t('hqCustomer.existingAccount')}<select data-testid="conversion-account-id" required value={accountId} onChange={event => { setAccountId(event.target.value); setContactId(''); setOpportunityId(''); }}><option value="">{t('common.selectNone')}</option>{query.data?.accounts.map(item => <option key={item.public_id} value={item.public_id}>{recordLabel(item)}</option>)}</select></label>}
      </fieldset>
      <fieldset><legend>{t('hqCustomer.tabs.contacts')}</legend><label>{t('hqCustomer.contactMode')}<select data-testid="conversion-contact-mode" value={contactMode} onChange={event => setContactMode(event.target.value)}><option value="NEW">{t('hqCustomer.createNew')}</option><option value="EXISTING" disabled={accountMode !== 'EXISTING'}>{t('hqCustomer.useExisting')}</option><option value="SKIP">{t('hqCustomer.skip')}</option></select></label>
        {contactMode === 'NEW' && <label>{t('hqCustomer.fields.contactName')}<input data-testid="conversion-contact-name" required value={contactName} onChange={event => setContactName(event.target.value)} /></label>}
        {contactMode === 'EXISTING' && <label>{t('hqCustomer.existingContact')}<select data-testid="conversion-contact-id" required value={contactId} onChange={event => setContactId(event.target.value)}><option value="">{t('common.selectNone')}</option>{contacts.map(item => <option key={item.public_id} value={item.public_id}>{recordLabel(item)}</option>)}</select></label>}
      </fieldset>
      <fieldset><legend>{t('nav.opportunity')}</legend><label>{t('hqCustomer.opportunityMode')}<select data-testid="conversion-opportunity-mode" value={opportunityMode} onChange={event => setOpportunityMode(event.target.value)}><option value="NEW">{t('hqCustomer.createNew')}</option><option value="EXISTING" disabled={accountMode !== 'EXISTING'}>{t('hqCustomer.useExisting')}</option><option value="SKIP">{t('hqCustomer.skip')}</option></select></label>
        {opportunityMode === 'NEW' && <label>{t('opportunity.name')}<input data-testid="conversion-opportunity-name" required value={opportunityName} onChange={event => setOpportunityName(event.target.value)} /></label>}
        {opportunityMode === 'EXISTING' && <label>{t('hqCustomer.existingOpportunity')}<select data-testid="conversion-opportunity-id" required value={opportunityId} onChange={event => setOpportunityId(event.target.value)}><option value="">{t('common.selectNone')}</option>{opportunities.map(item => <option key={item.public_id} value={item.public_id}>{recordLabel(item)}</option>)}</select></label>}
      </fieldset>
      <label>{t('lead.owner')}<select data-testid="conversion-owner" value={ownerUserId} onChange={event => setOwnerUserId(event.target.value)}>{query.data?.owners.map(owner => <option key={owner.userId} value={owner.userId}>{owner.name}</option>)}</select></label>
      <label className="hq-checkbox-row"><input type="checkbox" data-testid="conversion-simulate-failure" checked={simulateFailure} onChange={event => setSimulateFailure(event.target.checked)} />{t('hqCustomer.simulateConversionFailure')}</label>
      <HqError error={command.error ?? query.error} />
      <footer><button type="button" onClick={onClose} disabled={command.busy}>{t('common.cancel')}</button><button type="submit" data-testid="confirm-conversion" className="button-primary" disabled={command.busy || !query.data || !policy.can('LEAD.convert', row, payload)}>{t('hqCustomer.confirmConversion')}</button></footer>
    </form>}
  </HqModal>;
}
