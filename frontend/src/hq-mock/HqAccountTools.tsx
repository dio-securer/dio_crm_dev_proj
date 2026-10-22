import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LEDGER_FIELDS, displayValue, formFromRecord, formPayload, recordLabel, type CustomerForm, type CustomerRecord } from './customer-model';
import { HqError, HqModal, useHqCommand, useHqCustomerPolicy } from './customer-shared';

type DraftRow = { row: CustomerRecord; form: CustomerForm; selected: boolean; result?: string; status?: string };
type BulkResult = { results: { rowKey: string; status: 'SUCCESS' | 'ERROR'; saved?: CustomerRecord; error?: { code: string; message: string }; input: unknown }[]; successCount: number; errorCount: number };

export function HqAccountTools({ rows, onChanged }: { rows: CustomerRecord[]; onChanged: () => void }) {
  const { t } = useTranslation();
  const policy = useHqCustomerPolicy();
  const [mode, setMode] = useState<'ledger' | 'merge' | null>(null);
  return <div className="hq-customer-toolbar hq-account-tools">
    {policy.has('ACCOUNT.WRITE') && <button type="button" data-testid="open-account-ledger" onClick={() => setMode('ledger')}>{t('hqCustomer.accountLedger')}</button>}
    {policy.can('ACC.merge', {}, { primaryPublicId: rows[0]?.public_id, duplicatePublicIds: rows.slice(1, 2).map(row => row.public_id) }) && <button type="button" data-testid="open-account-merge" onClick={() => setMode('merge')}>{t('hqCustomer.mergeAccounts')}</button>}
    {mode === 'ledger' && <AccountLedger rows={rows} onClose={() => setMode(null)} onChanged={onChanged} />}
    {mode === 'merge' && <AccountMerge rows={rows} onClose={() => setMode(null)} onChanged={onChanged} />}
  </div>;
}
function AccountLedger({ rows, onClose, onChanged }: { rows: CustomerRecord[]; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const policy = useHqCustomerPolicy();
  const command = useHqCommand();
  const [drafts, setDrafts] = useState<DraftRow[]>(() => rows.filter(row => policy.owns(row, 'ACCOUNT.MERGE')).map(row => ({ row, form: formFromRecord(LEDGER_FIELDS, row), selected: false })));
  const [notice, setNotice] = useState('');
  const selected = drafts.filter(row => row.selected);
  const payload = { rows: selected.map(({ row, form }) => ({ rowKey: row.public_id, publicId: row.public_id, expectedVersion: row.version, values: formPayload(LEDGER_FIELDS, form) })) };
  const save = async (event: React.FormEvent) => { event.preventDefault(); try {
    const result = await command.run<BulkResult>('POST', '/api/accounts/bulk-update', payload);
    setDrafts(current => current.map(draft => { const item = result.results.find(value => value.rowKey === draft.row.public_id); if (!item) return draft; return { ...draft, row: item.saved ?? draft.row, selected: item.status === 'ERROR', status: item.status, result: item.status === 'SUCCESS' ? t('hqCustomer.saved') : `${item.error?.code}: ${item.error?.message}` }; }));
    setNotice(t('hqCustomer.bulkResult', { success: result.successCount, failed: result.errorCount })); onChanged();
  } catch { /* Each entered row remains in the ledger. */ } };
  return <HqModal title={t('hqCustomer.accountLedger')} onClose={onClose} busy={command.busy} wide><form onSubmit={event => void save(event)}><p>{t('hqCustomer.bulkHint')}</p>
    <div className="hq-customer-table"><table><thead><tr><th>{t('hqCustomer.select')}</th>{LEDGER_FIELDS.map(field => <th key={field.key}>{t(`hqCustomer.fields.${field.key}`)}</th>)}<th>{t('hqCustomer.result')}</th></tr></thead><tbody>{drafts.map((draft, index) => <tr key={draft.row.public_id} data-ledger-row={draft.row.public_id} data-row-status={draft.status ?? ''}><td><input type="checkbox" aria-label={recordLabel(draft.row)} checked={draft.selected} onChange={event => setDrafts(current => current.map((item, i) => i === index ? { ...item, selected: event.target.checked } : item))} /></td>{LEDGER_FIELDS.map(field => <td key={field.key}><input aria-label={`${recordLabel(draft.row)} ${t(`hqCustomer.fields.${field.key}`)}`} data-field-key={field.key} value={String(draft.form[field.key] ?? '')} onChange={event => setDrafts(current => current.map((item, i) => i === index ? { ...item, form: { ...item.form, [field.key]: event.target.value }, selected: true, status: undefined, result: undefined } : item))} /></td>)}<td role={draft.status === 'ERROR' ? 'alert' : undefined}>{draft.result}</td></tr>)}</tbody></table></div>
    <HqError error={command.error} />{notice && <p role="status">{notice}</p>}<footer><button type="button" onClick={onClose}>{t('app.close')}</button><button type="submit" data-testid="save-ledger" className="button-primary" disabled={command.busy || !selected.length || !policy.can('ACC.bulkSave', {}, payload)}>{t('hqCustomer.saveSelected', { count: selected.length })}</button></footer>
  </form></HqModal>;
}
function AccountMerge({ rows, onClose, onChanged }: { rows: CustomerRecord[]; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const policy = useHqCustomerPolicy();
  const command = useHqCommand();
  const [selected, setSelected] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState('');
  const [sources, setSources] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ primaryPublicId: string; mergedPublicIds: string[]; movedCounts: Record<string, number> } | null>(null);
  const candidates = rows.filter(row => selected.includes(row.public_id));
  const toggle = (id: string, checked: boolean) => { const next = checked ? [...selected, id] : selected.filter(value => value !== id); setSelected(next); if (!next.includes(primaryId)) setPrimaryId(next[0] ?? ''); setSources({}); };
  const payload = { primaryPublicId: primaryId, duplicatePublicIds: selected.filter(id => id !== primaryId), fieldSources: Object.fromEntries(LEDGER_FIELDS.map(field => [field.key, sources[field.key] ?? primaryId])), expectedVersions: Object.fromEntries(candidates.map(row => [row.public_id, row.version])) };
  const merge = async (event: React.FormEvent) => { event.preventDefault(); try { const response = await command.run<{ primaryPublicId: string; mergedPublicIds: string[]; movedCounts: Record<string, number> }>('POST', '/api/accounts/merge', payload); setResult(response); onChanged(); } catch { /* Retain chosen primary and field sources. */ } };
  return <HqModal title={t('hqCustomer.mergeAccounts')} onClose={onClose} busy={command.busy} wide>{result ? <div className="hq-customer-panel"><h3>{t('hqCustomer.mergeDone')}</h3><p data-testid="merge-primary-result">{result.primaryPublicId}</p><pre>{JSON.stringify(result.movedCounts, null, 2)}</pre><footer><button onClick={onClose}>{t('app.close')}</button></footer></div> : <form onSubmit={event => void merge(event)}>
    <p>{t('hqCustomer.mergeHint')}</p><div className="hq-merge-candidates">{rows.map(row => <label key={row.public_id}><input type="checkbox" data-merge-id={row.public_id} checked={selected.includes(row.public_id)} disabled={command.busy || (selected.length >= 3 && !selected.includes(row.public_id))} onChange={event => toggle(row.public_id, event.target.checked)} />{recordLabel(row)} · {displayValue(row.business_no)} · {displayValue(row.erp_customer_code)}</label>)}</div>
    <label>{t('hqCustomer.primaryAccount')}<select data-testid="merge-primary" required value={primaryId} onChange={event => { setPrimaryId(event.target.value); setSources({}); }}><option value="">{t('common.selectNone')}</option>{candidates.map(row => <option key={row.public_id} value={row.public_id}>{recordLabel(row)}</option>)}</select></label>
    <div className="hq-customer-fields">{LEDGER_FIELDS.map(field => <label key={field.key}>{t(`hqCustomer.fields.${field.key}`)}<select data-source-field={field.key} value={sources[field.key] ?? primaryId} onChange={event => setSources(current => ({ ...current, [field.key]: event.target.value }))}><option value="">{t('common.selectNone')}</option>{candidates.map(row => <option key={row.public_id} value={row.public_id}>{recordLabel(row)} · {displayValue(row[field.source])}</option>)}</select></label>)}</div>
    <HqError error={command.error} /><footer><button type="button" onClick={onClose} disabled={command.busy}>{t('common.cancel')}</button><button type="submit" data-testid="confirm-merge" className="button-primary" disabled={command.busy || selected.length < 2 || !primaryId || !policy.can('ACC.merge', {}, payload)}>{t('hqCustomer.confirmMerge')}</button></footer>
  </form>}</HqModal>;
}
