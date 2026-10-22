import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { missingErpAccountFields } from '@dio-crm/contracts';
import { apiGet, apiPost } from '../api';
import { CONTACT_FIELDS, HOSPITAL_FIELDS, displayValue, formFromRecord, formPayload, recordLabel, type CustomerDetail, type CustomerForm, type CustomerRecord } from './customer-model';
import { HqError, HqFields, HqModal, HqRecordSummary, HqRows, HqTabs, useHqCommand, useHqCustomerPolicy } from './customer-shared';

export function HqAccountDetail({ publicId, basicForm, onChanged }: { publicId: string; basicForm?: React.ReactNode; onChanged?: () => void }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [active, setActive] = useState(() => params.get('tab') ?? (basicForm ? 'basic' : 'analytics'));
  const query = useQuery({ queryKey: ['hq-account-detail', publicId], retry: false,
    queryFn: () => apiGet<CustomerDetail>(`/api/accounts/${publicId}/customer-detail`),
    refetchInterval: current => current.state.data?.account.integration_status === 'REQUESTING' ? 500 : false });
  const data = query.data;
  const cache = useQueryClient();
  const version = data?.account.version;
  useEffect(() => { if (version !== undefined) onChanged?.(); }, [version]);
  const refresh = async () => { await Promise.all([query.refetch(), cache.invalidateQueries({ queryKey: ['accounts'] })]); onChanged?.(); };
  const tabs = ['basic', 'erp', 'hospital', 'contacts', 'sales', 'order', 'service', 'timeline', 'analytics'];
  return <section className="hq-account-workspace" data-account-id={publicId}>
    <HqTabs active={active} onChange={setActive} tabs={tabs.map(key => ({ key, label: key === 'contacts' && data ? `${t('hqCustomer.tabs.contacts')} (${data.contacts.length})` : t(`hqCustomer.tabs.${key}`) }))} />
    <HqError error={query.error} />
    {!data && query.isLoading && <p>{t('common.loading')}</p>}
    {active === 'basic' && (basicForm ?? (data && <div className="hq-customer-panel"><HqRecordSummary row={data.account} fields={[
      { key: 'account_name', label: t('account.name') }, { key: 'business_no', label: t('lead.businessNo') }, { key: 'phone', label: t('account.phone') }, { key: 'hospital_address', label: t('hqCustomer.fields.address') }, { key: 'owner_name', label: t('account.owner') }
    ]} /><Link to={`/accounts?record=${publicId}`}>{t('account.edit')}</Link></div>)))}
    {data && active === 'erp' && <AccountErp data={data} onChanged={refresh} />}
    {data && active === 'hospital' && <AccountHospital key={publicId} row={data.account} onChanged={refresh} />}
    {data && active === 'contacts' && <AccountContacts key={publicId} account={data.account} contacts={data.contacts} contactId={params.get('contact')} onChanged={refresh} />}
    {data && active === 'sales' && <div className="hq-customer-panel"><h3>{t('nav.opportunity')}</h3><HqRows rows={data.opportunities} columns={[
      { key: 'opportunity_name', label: t('opportunity.name'), render: row => <Link to={`/opportunities?record=${row.public_id}`}>{recordLabel(row)}</Link> }, { key: 'stage', label: t('common.status') }, { key: 'amount', label: t('common.amount') }, { key: 'erp_customer_code', label: t('account.fields.erpCode') }
    ]} /><h3>{t('common.contract')}</h3><HqRows rows={data.contracts} columns={[{ key: 'contract_name', label: t('common.contract') }, { key: 'status', label: t('common.status') }, { key: 'contract_amount', label: t('common.amount') }]} />
      <h3>{t('common.sales')}</h3><HqRows rows={data.sales} columns={[{ key: 'sales_date', label: t('common.date') }, { key: 'erp_sales_no', label: t('account360.salesNo') }, { key: 'item_name', label: t('common.item') }, { key: 'amount', label: t('common.amount') }]} />
    </div>}
    {data && active === 'order' && <div className="hq-customer-panel"><p data-testid="order-allowed">{t('hqCustomer.orderAllowed')}: <strong>{t(data.analytics.orderAllowed ? 'hqCustomer.allowed' : 'hqCustomer.notAllowed')}</strong></p><HqRows rows={data.orders} columns={[{ key: 'order_no', label: t('nav.order') }, { key: 'status', label: t('common.status') }, { key: 'erp_order_no', label: t('order.erpOrderNo') }, { key: 'order_amount', label: t('common.amount') }]} /></div>}
    {data && active === 'service' && <div className="hq-customer-panel"><HqRows rows={data.services} columns={[{ key: 'subject', label: t('common.item') }, { key: 'status', label: t('common.status') }, { key: 'start_at', label: t('common.date') }, { key: 'consultation_content', label: t('activity.consultation') }]} /></div>}
    {data && active === 'timeline' && <div className="hq-customer-panel"><HqRows rows={data.timeline} columns={[{ key: 'at', label: t('common.date') }, { key: 'action', label: t('hqCustomer.action') }, { key: 'status', label: t('common.status') }, { key: 'changes', label: t('hqCustomer.changes'), render: row => displayValue(row.changes ?? row.subject ?? row.interfaceCode ?? row.reason ?? row.requestId) }]} /></div>}
    {data && active === 'analytics' && <div className="hq-customer-panel hq-customer-metrics">{Object.entries(data.analytics).map(([key, value]) => <article key={key} data-metric={key}><span>{t(`hqCustomer.metrics.${key}`)}</span><strong>{typeof value === 'boolean' ? t(value ? 'hqCustomer.allowed' : 'hqCustomer.notAllowed') : value.toLocaleString()}</strong></article>)}</div>}
  </section>;
}

function AccountHospital({ row, onChanged }: { row: CustomerRecord; onChanged: () => Promise<void> }) {
  const { t } = useTranslation();
  const policy = useHqCustomerPolicy();
  const command = useHqCommand();
  const [form, setForm] = useState<CustomerForm>(() => formFromRecord(HOSPITAL_FIELDS, row));
  const [notice, setNotice] = useState('');
  const editable = policy.has('ACCOUNT.WRITE') && policy.owns(row, 'ACCOUNT.MERGE');
  const save = async (event: React.FormEvent) => { event.preventDefault(); try { await command.run('PATCH', `/api/accounts/${row.public_id}/hospital`, { ...formPayload(HOSPITAL_FIELDS, form), expectedVersion: row.version }); await onChanged(); setNotice(t('hqCustomer.saved')); } catch { /* Keep the hospital draft. */ } };
  return <form className="hq-customer-panel" onSubmit={event => void save(event)}><HqFields fields={HOSPITAL_FIELDS} form={form} onChange={setForm} disabled={!editable || command.busy} />
    <HqError error={command.error} />{notice && <p className="hq-customer-success" role="status">{notice}</p>}
    {editable && <footer><button type="submit" className="button-primary" disabled={command.busy || !policy.can('ACC.hospitalSave', row, formPayload(HOSPITAL_FIELDS, form))}>{t('common.save')}</button></footer>}
  </form>;
}

function AccountContacts({ account, contacts, contactId, onChanged }: { account: CustomerRecord; contacts: CustomerRecord[]; contactId: string | null; onChanged: () => Promise<void> }) {
  const { t } = useTranslation();
  const policy = useHqCustomerPolicy();
  const [selected, setSelected] = useState<CustomerRecord | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (contactId) { const current = contacts.find(item => item.public_id === contactId); if (current) { setSelected(current); setOpen(true); } } }, [contactId]);
  return <div className="hq-customer-panel"><div className="hq-customer-toolbar"><strong data-testid="contact-count">{t('hqCustomer.relatedCount', { count: contacts.length })}</strong>
    {policy.has('CONTACT.WRITE') && policy.owns(account, 'ACCOUNT.MERGE') && <button type="button" data-testid="new-contact" onClick={() => { setSelected(null); setOpen(true); }}>{t('hqCustomer.newContact')}</button>}
  </div><HqRows rows={contacts} columns={[
    { key: 'contact_name', label: t('hqCustomer.fields.contactName'), render: row => <button type="button" className="hq-record-link" data-contact-id={row.public_id} onClick={() => { setSelected(row); setOpen(true); }}>{recordLabel(row)}</button> },
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
  const editable = policy.has('CONTACT.WRITE') && policy.owns(row ?? account, 'ACCOUNT.MERGE');
  const input = { ...formPayload(CONTACT_FIELDS, form), accountPublicId: account.public_id };
  const save = async (event: React.FormEvent) => { event.preventDefault(); try { if (row) await command.run('PATCH', `/api/contacts/${row.public_id}`, { ...formPayload(CONTACT_FIELDS, form), expectedVersion: row.version }); else await command.run('POST', `/api/accounts/${account.public_id}/contacts`, formPayload(CONTACT_FIELDS, form)); await onChanged(); onClose(); } catch { /* Preserve contact inputs. */ } };
  const remove = async () => { if (!row || !window.confirm(t('hqCustomer.deleteConfirm'))) return; try { await command.run('DELETE', `/api/contacts/${row.public_id}`, { expectedVersion: row.version }); await onChanged(); onClose(); } catch { /* Server remains authoritative. */ } };
  return <HqModal title={t(row ? 'hqCustomer.editContact' : 'hqCustomer.newContact')} onClose={onClose} busy={command.busy}><form onSubmit={event => void save(event)}>
    {row && <p className="hq-record-id">{row.public_id}</p>}<HqFields fields={CONTACT_FIELDS} form={form} onChange={setForm} disabled={!editable || command.busy} />
    <HqError error={command.error} /><footer>{row && editable && policy.can('CONTACT.delete', row) && <button type="button" onClick={() => void remove()} disabled={command.busy}>{t('hqCustomer.delete')}</button>}<button type="button" onClick={onClose} disabled={command.busy}>{t('app.close')}</button>
      {editable && <button type="submit" className="button-primary" disabled={command.busy || !policy.can(row ? 'CONTACT.save' : 'CONTACT.create', row ?? account, input)}>{t('common.save')}</button>}
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
    <HqRecordSummary row={account} fields={[
      { key: 'erp_customer_code', label: t('account.fields.erpCode') }, { key: 'erp_account_name', label: t('hqCustomer.fields.erpAccountName') }, { key: 'erp_approved_yn', label: t('opportunity.erpApproved') }, { key: 'integration_status', label: t('account.integration') },
      { key: 'erp_trade_code', label: t('hqCustomer.fields.erpTradeCode') }, { key: 'erp_approval_code', label: t('hqCustomer.fields.erpApprovalCode') }, { key: 'use_yn', label: t('hqCustomer.fields.useYn') }, { key: 'account_stat_code', label: t('hqCustomer.fields.accountStatCode') }
    ]} />
    <p data-testid="erp-order-ready">{t('hqCustomer.orderAllowed')}: <strong>{t(data.analytics.orderAllowed ? 'hqCustomer.allowed' : 'hqCustomer.notAllowed')}</strong></p>
    {missing.length > 0 && <p className="notice warning" data-testid="erp-missing">{t('account.erpMissing', { fields: missing.join(', ') })}</p>}
    {policy.has('ERP_ACCOUNT.REQUEST') && <button type="button" data-testid="request-erp" className="button-primary" disabled={!canRequest || missing.length > 0 || command.busy} onClick={() => void request()}>{t(account.integration_status === 'FAILED' ? 'hqCustomer.retryErp' : 'account.actions.erp')}</button>}
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
  const [params, setParams] = useSearchParams();
  const query = useQuery({ queryKey: ['hq-account360-options'], queryFn: () => apiGet<CustomerRecord[]>('/api/accounts'), retry: false });
  const publicId = params.get('record') ?? query.data?.[0]?.public_id ?? '';
  return <section className="hq-customer-page"><h2>{t('account360.title')}</h2><label>{t('common.account')}<select value={publicId} onChange={event => setParams({ record: event.target.value })}>{query.data?.map(row => <option key={row.public_id} value={row.public_id}>{recordLabel(row)}</option>)}</select></label><HqError error={query.error} />{publicId && <HqAccountDetail key={publicId} publicId={publicId} />}</section>;
}
