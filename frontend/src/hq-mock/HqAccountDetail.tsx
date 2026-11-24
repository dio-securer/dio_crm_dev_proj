import { AccountLogisticsPanel } from './AccountLogisticsPanel';
import { AccountServicePanel } from './AccountServicePanel';
import { AccountSharingPanel } from './AccountSharingPanel';
import { AccountRelatedPanel } from './AccountRelatedPanel';
﻿import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Building2, Phone, UserRound, UsersRound, BriefcaseBusiness, FileSignature, ShoppingCart, CalendarCheck, WalletCards, BadgeCheck, ChartNoAxesCombined } from 'lucide-react';
import { missingErpAccountFields } from '@dio-crm/contracts';
import { apiGet, apiPost } from '../api';
import { CONTACT_FIELDS, HOSPITAL_FIELDS, displayValue, formFromRecord, formPayload, recordLabel, type CustomerDetail, type CustomerForm, type CustomerRecord } from './customer-model';
import { HqError, HqFields, HqModal, HqRecordSummary, HqRows, HqTabs, useHqCommand, useHqCustomerPolicy } from './customer-shared';
import { ACCOUNT_PRODUCTS, hasProductUsage, toggleProductUsage } from './product-usage';
import { configAnchor } from './config-anchor';
import { canLeaveAccountEditor, activateAccountHistoryGuard, hasRestrictedAccountChanges } from './account-editor-guard';

const AccountEditorGuard = createContext<React.MutableRefObject<(() => boolean) | null> | null>(null);
const metricIcons: Record<string, typeof Building2> = { contactCount: UsersRound, opportunityCount: BriefcaseBusiness, contractCount: FileSignature, orderCount: ShoppingCart, activityCount: CalendarCheck, salesAmount: WalletCards, collectionAmount: WalletCards, outstandingAmount: WalletCards, orderAmount: ShoppingCart, erpApproved: BadgeCheck, orderAllowed: BadgeCheck };
export function useAccountEditorGuard(dirty: boolean, busy: boolean) {
  const guard = useContext(AccountEditorGuard);
  const allowLeave = () => canLeaveAccountEditor({ dirty, busy }, () => window.confirm('저장하지 않은 입력을 버리고 이동하시겠습니까?'));
  useLayoutEffect(() => {
    if (guard) guard.current = allowLeave;
    const releaseHistory = dirty || busy ? activateAccountHistoryGuard(allowLeave) : () => {};
    const unload = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest('a[href]');
      if (link && !allowLeave()) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    return () => { releaseHistory(); if (guard) guard.current = null; window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); };
  }, [dirty, busy, guard]);
  return allowLeave;
}


export function HqAccountDetail({ publicId, basicForm, onChanged, navigationGuard }: { publicId: string; basicForm?: React.ReactNode; onChanged?: () => void; navigationGuard?: React.MutableRefObject<(() => boolean) | null> }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [active, setActive] = useState(() => params.get('tab') ?? (basicForm ? 'basic' : 'analytics'));
  const query = useQuery({ queryKey: ['hq-account-detail', publicId], retry: false,
    queryFn: () => apiGet<CustomerDetail>(`/api/accounts/${publicId}/customer-detail`),
    refetchInterval: current => current.state.data?.account.integration_status === 'REQUESTING' ? 500 : false });
  const data = query.data;
  const policy = useHqCustomerPolicy();
  const cache = useQueryClient();
  const version = data?.account.version;
  useEffect(() => { if (version !== undefined) onChanged?.(); }, [version]);
  const refresh = async () => { await Promise.all([query.refetch(), cache.invalidateQueries({ queryKey: ['accounts'] })]); onChanged?.(); };
  const localEditorGuard = useRef<(() => boolean) | null>(null);
  const editorGuard = navigationGuard ?? localEditorGuard;
  const tabs = ['basic', 'erp', 'hospital', 'contacts', 'sales', 'order', 'service', 'timeline', 'analytics', 'files', 'sharing', 'activities', 'destinations', 'rentals'];
  return <AccountEditorGuard.Provider value={editorGuard}><section className="hq-account-workspace" data-account-id={publicId}>
    {data && <div className="hq-account-glance"><span className="hq-account-glance-icon"><Building2 size={20} aria-hidden="true" /></span><div><strong>{recordLabel(data.account)}</strong><div className="hq-account-glance-meta">{policy.visible('account', 'ownerName', data.account) && <span><UserRound size={15} aria-hidden="true" />{displayValue(data.account.owner_name)}</span>}{policy.visible('account', 'phone', data.account) && data.account.phone != null && <span><Phone size={15} aria-hidden="true" />{displayValue(data.account.phone)}</span>}</div></div></div>}
    <HqTabs configScreen="HQ_ACCOUNT" active={active} onChange={next => { if (next !== active && (!editorGuard.current || editorGuard.current())) setActive(next); }} tabs={tabs.map(key => ({ key, label: key === 'destinations' ? '직송지' : key === 'rentals' ? '렌탈장비' : key === 'activities' ? '활동내역' : key === 'sharing' ? '공유 및 팀' : key === 'files' ? '파일' : key === 'contacts' && data ? `${t('hqCustomer.tabs.contacts')} (${data.contacts.length})` : t(`hqCustomer.tabs.${key}`) }))} />
    <div className="hq-customer-toolbar"><Link to={`/ledger-statements?account=${publicId}`}>원장·거래명세서 조회</Link></div>
    <HqError error={query.error} />
    {!data && query.isLoading && <p>{t('common.loading')}</p>}
    {active === 'basic' && (basicForm ?? (data && <div className="hq-customer-panel" {...configAnchor('section:account.basic', 'section:account.basic.1')}><HqRecordSummary row={data.account} configFields={{ account_name: { id: 'account.crmName', instance: 'detail.basic.crmName' }, hospital_address: { id: 'account.crmAddress', instance: 'detail.basic.address' }, owner_name: { id: 'account.ownerName', instance: 'detail.basic.owner' } }} fields={[
      { key: 'account_name', label: t('account.name') }, { key: 'business_no', label: t('lead.businessNo') }, { key: 'phone', label: t('account.phone') }, { key: 'hospital_address', label: t('hqCustomer.fields.address') }, { key: 'owner_name', label: t('account.owner') }
    ]} /><Link to={`/accounts?record=${publicId}`}>{t('account.edit')}</Link></div>))}
    {data && (active === 'destinations' || active === 'rentals') && <AccountLogisticsPanel key={publicId + active} kind={active} account={data.account} onChanged={refresh} />}
    {data && active === 'sharing' && <AccountSharingPanel key={publicId} publicId={publicId} account={data.account} onChanged={refresh} />}
    {data && active === 'files' && <AccountRelatedPanel key={publicId} account={data.account} onChanged={refresh} />}
    {data && active === 'erp' && <AccountErp data={data} onChanged={refresh} />}
    {data && active === 'hospital' && <AccountHospital key={publicId} row={data.account} onChanged={refresh} />}
    {data && active === 'contacts' && <AccountContacts key={publicId} account={data.account} contacts={data.contacts} contactId={params.get('contact')} onChanged={refresh} />}
    {data && active === 'sales' && <div className="hq-customer-panel"><h3>{t('nav.opportunity')}</h3><HqRows rows={data.opportunities} columns={[
      { key: 'opportunity_name', label: t('opportunity.name'), render: row => <Link to={`/opportunities?record=${row.public_id}`}>{String(row.opportunity_name || recordLabel(row))}</Link> }, { key: 'stage', label: t('common.status') }, { key: 'amount', label: t('common.amount') }, { key: 'erp_customer_code', label: t('account.fields.erpCode') }
    ]} /><h3>{t('common.contract')}</h3><HqRows rows={data.contracts} columns={[{ key: 'contract_name', label: t('common.contract'), render: row => <Link to={`/contracts?record=${row.public_id}`}>{recordLabel(row)}</Link> }, { key: 'status', label: t('common.status') }, { key: 'contract_amount', label: t('common.amount') }]} />
      <h3>{t('common.sales')}</h3><HqRows rows={data.sales} columns={[{ key: 'sales_date', label: t('common.date') }, { key: 'erp_sales_no', label: t('account360.salesNo') }, { key: 'item_name', label: t('common.item') }, { key: 'amount', label: t('common.amount') }]} />
    </div>}
    {data && active === 'order' && <div className="hq-customer-panel"><p data-testid="order-allowed">{t('hqCustomer.orderAllowed')}: <strong>{t(data.analytics.orderAllowed ? 'hqCustomer.allowed' : 'hqCustomer.notAllowed')}</strong></p><HqRows rows={data.orders} columns={[{ key: 'order_no', label: t('nav.order'), render: row => <Link to={`/orders?record=${row.public_id}`}>{String(row.order_no || row.erp_order_no || row.public_id)}</Link> }, { key: 'status', label: t('common.status') }, { key: 'erp_order_no', label: t('order.erpOrderNo') }, { key: 'order_amount', label: t('common.amount') }]} /></div>}
    {data && active === 'service' && <AccountServicePanel key={publicId} account={data.account} onChanged={refresh} />}
    {data && active === 'activities' && <div className="hq-customer-panel"><h3>활동내역</h3><HqRows rows={data.activities ?? []} columns={[{key:'subject',label:'활동',render:row=><Link to={`/activities?record=${row.public_id}`}>{String(row.subject ?? row.public_id)}</Link>},{key:'activity_type',label:'유형'},{key:'visit_purpose',label:'방문목적'},{key:'start_at',label:'시작일'},{key:'status',label:'상태'}]}/></div>}
    {data && active === 'timeline' && <div className="hq-customer-panel"><HqRows rows={data.timeline} columns={[{ key: 'at', label: t('common.date') }, { key: 'action', label: t('hqCustomer.action') }, { key: 'status', label: t('common.status') }, { key: 'changes', label: t('hqCustomer.changes'), render: row => displayValue(row.caseChanges ?? row.changes ?? row.subject ?? row.interfaceCode ?? row.reason ?? row.requestId) }]} /></div>}
    {data && active === 'analytics' && <div className="hq-customer-panel hq-customer-metrics">{Object.entries(data.analytics).map(([key, value]) => { const Icon = metricIcons[key] ?? ChartNoAxesCombined; return <article key={key} data-metric={key}><span className="hq-metric-label"><Icon size={18} aria-hidden="true" />{t(`hqCustomer.metrics.${key}`)}</span><strong>{value == null ? '확인 불가' : typeof value === 'boolean' ? t(value ? 'hqCustomer.allowed' : 'hqCustomer.notAllowed') : value.toLocaleString()}</strong></article>; })}</div>}
  </section></AccountEditorGuard.Provider>;
}

function AccountHospital({ row, onChanged }: { row: CustomerRecord; onChanged: () => Promise<void> }) {
  const { t } = useTranslation();
  const policy = useHqCustomerPolicy();
  const command = useHqCommand();
  const [form, setForm] = useState<CustomerForm>(() => formFromRecord(HOSPITAL_FIELDS, row));
  const [baseline, setBaseline] = useState(row);
  const [notice, setNotice] = useState('');
  const [permissionError, setPermissionError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  useAccountEditorGuard(JSON.stringify(form) !== JSON.stringify(formFromRecord(HOSPITAL_FIELDS, baseline)), command.busy || saving);
  const editable = policy.has('ACCOUNT.WRITE') && policy.owns(row, 'ACCOUNT.MERGE');
  const save = async (event: React.FormEvent) => { event.preventDefault(); if (saving || command.busy) return; if (hasRestrictedAccountChanges(form, formFromRecord(HOSPITAL_FIELDS, baseline), key => policy.writable('account', key, row))) { setPermissionError(new Error('변경한 항목의 편집 권한이 없습니다. 입력은 유지됩니다. 권한을 확인해 주세요.')); return; } setPermissionError(null); setSaving(true); setNotice(''); try { const saved = await command.run<CustomerRecord>('PATCH', `/api/accounts/${row.public_id}/hospital`, { ...policy.writablePayload('account', formPayload(HOSPITAL_FIELDS, form), baseline), expectedVersion: baseline.version }); setBaseline(saved); setForm(formFromRecord(HOSPITAL_FIELDS, saved)); await onChanged(); setNotice(t('hqCustomer.saved')); } catch { /* Keep the hospital draft. */ } finally { setSaving(false); } };
  return <form className="hq-customer-panel" {...configAnchor('section:account.hospital', 'section:account.hospital.0')} onSubmit={event => void save(event)}>{baseline.version !== row.version && <p className="notice warning">{t('hqCustomer.changedElsewhere')} <button type="button" disabled={command.busy || saving} onClick={() => { if (window.confirm(t('hqCustomer.discardReload'))) { setBaseline(row); setForm(formFromRecord(HOSPITAL_FIELDS, row)); } }}>{t('hqCustomer.reloadLatest')}</button></p>}<HqFields entity="account" configInstance="detail.hospital" row={row} fields={HOSPITAL_FIELDS} form={form} onChange={setForm} disabled={!editable || (command.busy || saving)} />
    {policy.visible('account', 'dioProductUsage', row) && <fieldset disabled={!editable || command.busy || saving || !policy.writable('account', 'dioProductUsage', row)}><legend>{t('hqCustomer.fields.dioProductUsage')}</legend><div className="hq-product-flags">{ACCOUNT_PRODUCTS.map(product => <label key={product}><input type="checkbox" checked={hasProductUsage(String(form.dioProductUsage ?? ''), product)} onChange={event => setForm(current => ({ ...current, dioProductUsage: toggleProductUsage(String(current.dioProductUsage ?? ''), product, event.target.checked) }))} />{product}</label>)}</div></fieldset>}
    <HqError error={permissionError ?? command.error} />{notice && <p className="hq-customer-success" role="status">{notice}</p>}
    {editable && <footer><button type="submit" {...configAnchor('ACC.hospitalSave', 'detail.hospital.save')} className="button-primary" disabled={command.busy || saving || !policy.can('ACC.hospitalSave', row, formPayload(HOSPITAL_FIELDS, form))}>{t('common.save')}</button></footer>}
  </form>;
}

function AccountContacts({ account, contacts, contactId, onChanged }: { account: CustomerRecord; contacts: CustomerRecord[]; contactId: string | null; onChanged: () => Promise<void> }) {
  const { t } = useTranslation();
  const policy = useHqCustomerPolicy();
  const [selected, setSelected] = useState<CustomerRecord | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (contactId) { const current = contacts.find(item => item.public_id === contactId); if (current) { setSelected(current); setOpen(true); } } }, [contactId]);
  return <div className="hq-customer-panel" {...configAnchor('section:account.contacts', 'section:account.contacts.0')}><div className="hq-customer-toolbar"><strong data-testid="contact-count">{t('hqCustomer.relatedCount', { count: contacts.length })}</strong>
    {policy.has('CONTACT.WRITE') && policy.owns(account, 'ACCOUNT.MERGE') && <button type="button" data-testid="new-contact" {...configAnchor('CONTACT.create', 'detail.contacts.create')} onClick={() => { setSelected(null); setOpen(true); }}>{t('hqCustomer.newContact')}</button>}
  </div><HqRows rows={contacts} configInstance="detail.contacts.table" columns={[
    { key: 'contact_name', label: t('hqCustomer.fields.contactName'), configId: 'account.contactName', configName: 'name', render: row => <button type="button" className="hq-record-link" data-contact-id={row.public_id} onClick={() => { setSelected(row); setOpen(true); }}>{recordLabel(row)}</button> },
    { key: 'contact_type', label: t('hqCustomer.fields.contactType') }, { key: 'mobile', label: t('hqCustomer.fields.mobile') }, { key: 'email', label: t('hqCustomer.fields.email') }, { key: 'is_keyman', label: t('hqCustomer.fields.isKeyman') }
  ]} />
    {open && <ContactEditor key={selected?.public_id ?? 'NEW'} account={account} row={selected} onClose={() => setOpen(false)} onChanged={onChanged} />}
  </div>;
}
function ContactEditor({ account, row, onClose, onChanged }: { account: CustomerRecord; row: CustomerRecord | null; onClose: () => void; onChanged: () => Promise<void> }) {
  const { t } = useTranslation();
  const command = useHqCommand();
  const policy = useHqCustomerPolicy();
  const [form, setForm] = useState<CustomerForm>(() => formFromRecord(CONTACT_FIELDS, row ?? { contact_type: 'DOCTOR' }));
  const [saving, setSaving] = useState(false);
  const [permissionError, setPermissionError] = useState<Error | null>(null);
  const allowLeave = useAccountEditorGuard(JSON.stringify(form) !== JSON.stringify(formFromRecord(CONTACT_FIELDS, row ?? { contact_type: 'DOCTOR' })), command.busy || saving);
  const close = () => { if (allowLeave()) onClose(); };
  const editable = policy.has('CONTACT.WRITE') && policy.owns(row ?? account, 'ACCOUNT.MERGE');
  const input = { ...formPayload(CONTACT_FIELDS, form), accountPublicId: account.public_id };
  const save = async (event: React.FormEvent) => { event.preventDefault(); if (saving || command.busy) return; if (hasRestrictedAccountChanges(form, formFromRecord(CONTACT_FIELDS, row ?? { contact_type: 'DOCTOR' }), key => policy.writable('contact', key, row ?? {}))) { setPermissionError(new Error('변경한 항목의 편집 권한이 없습니다. 입력은 유지됩니다. 권한을 확인해 주세요.')); return; } setPermissionError(null); setSaving(true); try { if (row) await command.run('PATCH', `/api/contacts/${row.public_id}`, { ...policy.writablePayload('contact', formPayload(CONTACT_FIELDS, form), row), expectedVersion: row.version }); else await command.run('POST', `/api/accounts/${account.public_id}/contacts`, policy.writablePayload('contact', formPayload(CONTACT_FIELDS, form))); await onChanged(); onClose(); } catch { /* Preserve contact inputs. */ } finally { setSaving(false); } };
  const remove = async () => { if (saving || command.busy || !row || !window.confirm(t('hqCustomer.deleteConfirm'))) return; setSaving(true); try { await command.run('DELETE', `/api/contacts/${row.public_id}`, { expectedVersion: row.version }); await onChanged(); onClose(); } catch { /* Server remains authoritative. */ } finally { setSaving(false); } };
  return <HqModal configId="POP.ACC.CONTACT" title={t(row ? 'hqCustomer.editContact' : 'hqCustomer.newContact')} onClose={close} busy={command.busy || saving}><form onSubmit={event => void save(event)}>
    {row && <p className="hq-record-id">{row.public_id}</p>}<HqFields entity="contact" configInstance="contact.form" row={row ?? {}} fields={CONTACT_FIELDS} form={form} onChange={setForm} disabled={!editable || command.busy || saving} />
    <HqError error={permissionError ?? command.error} /><footer>{row && editable && policy.can('CONTACT.delete', row) && <button type="button" {...configAnchor('CONTACT.delete', 'contact.delete')} onClick={() => void remove()} disabled={command.busy || saving}>{t('hqCustomer.delete')}</button>}<button type="button" onClick={close} disabled={command.busy || saving}>{t('app.close')}</button>
      {editable && <button type="submit" {...configAnchor(row ? 'CONTACT.save' : 'CONTACT.create', 'contact.submit')} className="button-primary" disabled={command.busy || saving || !policy.can(row ? 'CONTACT.save' : 'CONTACT.create', row ?? account, input)}>{t('common.save')}</button>}
    </footer></form></HqModal>;
}

function AccountErp({ data, onChanged }: { data: CustomerDetail; onChanged: () => Promise<void> }) {
  const { t } = useTranslation();
  const policy = useHqCustomerPolicy();
  const command = useHqCommand();
  const [receipt, setReceipt] = useState('');
  const [advanceError, setAdvanceError] = useState<unknown>(null);
  const [advancing, setAdvancing] = useState(false);
  const account = data.account;
  const missing = missingErpAccountFields(account);
  const canRequest = policy.can('ACC.erpRequest', account) && policy.owns(account, 'ACCOUNT.MERGE') && account.erp_approved_yn !== true && account.integration_status !== 'REQUESTING';
  const request = async () => { try { const result = await command.run<{ requestId: string }>('POST', `/api/erp-accounts/${account.public_id}/request`, { expectedVersion: account.version }); setReceipt(result.requestId); await onChanged(); } catch { /* API error displayed without success fabrication. */ } };
  const advance = async (requestId: string) => { setAdvanceError(null); setAdvancing(true); try { await apiPost('/api/hq/interfaces/advance', { requestId, scenario: 'SUCCESS' }); await onChanged(); } catch (error) { setAdvanceError(error); } finally { setAdvancing(false); } };
  return <div className="hq-customer-panel" data-testid="account-erp-panel"><p>{t('hqCustomer.sourceReadOnly')}</p>
    <HqRecordSummary row={account} configFields={{ erp_customer_code: { id: 'account.erpCustomerCode', instance: 'detail.erp.customerCode' }, erp_approved_yn: { id: 'account.erpApprovedYn', instance: 'detail.erp.approved' }, integration_status: { id: 'account.integrationStatus', instance: 'detail.erp.integration' } }} fields={[
      { key: 'erp_customer_code', label: t('account.fields.erpCode') }, { key: 'erp_account_name', label: t('hqCustomer.fields.erpAccountName') }, { key: 'erp_approved_yn', label: t('opportunity.erpApproved') }, { key: 'integration_status', label: t('account.integration') },
      { key: 'erp_trade_code', label: t('hqCustomer.fields.erpTradeCode') }, { key: 'erp_approval_code', label: t('hqCustomer.fields.erpApprovalCode') }, { key: 'use_yn', label: t('hqCustomer.fields.useYn') }, { key: 'account_stat_code', label: t('hqCustomer.fields.accountStatCode') }
    ]} />
    <p data-testid="erp-order-ready">{t('hqCustomer.orderAllowed')}: <strong>{t(data.analytics.orderAllowed ? 'hqCustomer.allowed' : 'hqCustomer.notAllowed')}</strong></p>
    {account.erp_status_conflict === true && <p className="notice warning" role="status">MOCK ERP 승인 결과와 CRM 거래처 상태가 다릅니다. 기존 CRM 상태를 유지했으므로 확인이 필요합니다.</p>}
    {missing.length > 0 && <p className="notice warning" data-testid="erp-missing">{t('account.erpMissing', { fields: missing.join(', ') })}</p>}
    {policy.has('ERP_ACCOUNT.REQUEST') && <button type="button" data-testid="request-erp" {...configAnchor('ACC.erpRequest', 'detail.erp.request')} className="button-primary" disabled={!canRequest || missing.length > 0 || command.busy} onClick={() => void request()}>{t(account.integration_status === 'FAILED' ? 'hqCustomer.retryErp' : 'account.actions.erp')}</button>}
    {receipt && <p className="hq-customer-success" role="status">{t('hqCustomer.erpReceipt', { requestId: receipt })}</p>}
    <HqError error={command.error ?? advanceError} />
    <h3>{t('hqCustomer.erpHistory')}</h3><HqRows rows={data.interfaces} columns={[
      { key: 'requestId', label: t('hqCustomer.requestId') }, { key: 'status', label: t('common.status') }, { key: 'attempt', label: t('hqCustomer.attempt') }, { key: 'requestedAt', label: t('common.date') },
      { key: 'events', label: t('hqCustomer.changes'), render: row => <details><summary>{t('hqCustomer.viewHistory')}</summary><pre>{JSON.stringify(row.events, null, 2)}</pre></details> },
      { key: 'result', label: t('hqCustomer.result'), render: row => <>{displayValue(row.result)}{policy.has('INTERFACE.MANAGE') && ['REQUESTED', 'PROCESSING', 'WAITING', 'REQUESTING', 'DELAYED'].includes(String(row.status)) && <button type="button" data-testid="advance-erp" disabled={advancing} onClick={() => void advance(String(row.requestId))}>{t('hqCustomer.receiveMockResult')}</button>}</> }
    ]} />
  </div>;
}

export function HqAccount360Page() {
  const { t } = useTranslation();
  const navigationGuard = useRef<(() => boolean) | null>(null);
  const [params, setParams] = useSearchParams();
  const query = useQuery({ queryKey: ['hq-account360-options'], queryFn: () => apiGet<CustomerRecord[]>('/api/accounts'), retry: false });
  const publicId = params.get('record') ?? query.data?.[0]?.public_id ?? '';
  return <section className="hq-customer-page hq-account360-page"><h2>{t('account360.title')}</h2><label>{t('common.account')}<select value={publicId} onChange={event => { if (!navigationGuard.current || navigationGuard.current()) setParams({ record: event.target.value }); }}>{query.data?.map(row => <option key={row.public_id} value={row.public_id}>{recordLabel(row)}</option>)}</select></label><HqError error={query.error} />{publicId && <HqAccountDetail key={publicId} publicId={publicId} navigationGuard={navigationGuard} />}</section>;
}
