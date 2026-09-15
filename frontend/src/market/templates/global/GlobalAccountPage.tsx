import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccountInterfaceField, AccountSummary } from '@dio-crm/contracts';
import { ACCOUNT_STAT_CODES, ACCOUNT_TYPE_CODES, tradeStatusName } from '@dio-crm/contracts';
import { apiGet, apiPatch, apiPost } from '../../../api';
import {
  ACCOUNT_STATUSES,
  CRM_FORM_KEY,
  emptyForm,
  formFromAccount,
  toWritePayload,
  type AccountFormInput
} from '../../../account-model';
import { GLOBAL_ACCOUNT_FIELD_PROFILE } from '../../field-profiles/GLOBAL_ACCOUNT';
import { effectiveAccountFields, visibleAccountSections } from '../../field-profiles/field-profile-resolver';

export function GlobalAccountPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountFormInput>(emptyForm());
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');

  const query = useQuery({
    queryKey: ['global-accounts', search],
    queryFn: () => apiGet<AccountSummary[]>(`/api/accounts?scope=managed${search ? `&search=${encodeURIComponent(search)}` : ''}`),
    retry: false
  });

  const rows = query.data ?? [];
  const selected = useMemo(() => rows.find(row => row.public_id === selectedId) ?? null, [rows, selectedId]);
  const sections = visibleAccountSections(GLOBAL_ACCOUNT_FIELD_PROFILE);

  function select(row: AccountSummary) {
    setSelectedId(row.public_id);
    setForm(formFromAccount(row));
    setEditing(false);
    setMessage('');
  }

  function createNew() {
    setSelectedId(null);
    setForm(emptyForm());
    setEditing(true);
    setMessage('');
  }

  function setField(key: keyof AccountFormInput, value: string) {
    setForm(previous => ({ ...previous, [key]: value }));
  }

  function displayValue(row: AccountSummary, field: AccountInterfaceField) {
    if (field.code === 'co_cd') return row.company_code || '-';
    if (field.code === 'trade_bc_nm') return tradeStatusName(row.erp_trade_code) || '-';
    if (!field.crmField) return '-';
    const value = row[field.crmField];
    if (value == null || value === '') return '-';
    return typeof value === 'boolean' ? (value ? 'Y' : 'N') : String(value);
  }

  function fieldControl(field: AccountInterfaceField, readonly: boolean) {
    if (readonly || !field.crmField || !CRM_FORM_KEY[field.crmField]) {
      return <div className="readonly-value">{selected ? displayValue(selected, field) : '-'}</div>;
    }
    const key = CRM_FORM_KEY[field.crmField]!;
    const value = form[key];
    if (key === 'accountType') {
      return <select value={value} onChange={event => setField(key, event.target.value)}>{Object.entries(ACCOUNT_TYPE_CODES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select>;
    }
    if (key === 'useYn') {
      return <select value={value} onChange={event => setField(key, event.target.value)}><option value="1">Yes</option><option value="0">No</option></select>;
    }
    if (key === 'churnRiskYn') {
      return <select value={value} onChange={event => setField(key, event.target.value)}><option value="0">No</option><option value="1">Yes</option></select>;
    }
    if (key === 'accountStatCode') {
      return <select value={value} onChange={event => setField(key, event.target.value)}>{Object.entries(ACCOUNT_STAT_CODES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select>;
    }
    return <input value={value} onChange={event => setField(key, event.target.value)} />;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.accountName.trim()) {
      setMessage('Account name is required.');
      return;
    }
    try {
      if (selectedId) await apiPatch(`/api/accounts/${selectedId}`, toWritePayload(form));
      else await apiPost('/api/accounts', toWritePayload(form));
      setMessage(selectedId ? 'Account updated.' : 'Account created.');
      setEditing(false);
      await qc.invalidateQueries({ queryKey: ['global-accounts'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section className="workspace-page">
      <div className="page-header">
        <div>
          <span className="page-kicker">GLOBAL · SALES</span>
          <h2>Account</h2>
          <small>Summary · Basic information · Trade status · Management · Address · ERP integration status</small>
        </div>
        <div className="page-actions">
          <input className="search-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search Account" />
          <button type="button" className="button-primary" onClick={createNew}>New Account</button>
        </div>
      </div>

      <div className="data-card">
        <div className="table-scroll">
          <table>
            <thead><tr><th>Account</th><th>Business No.</th><th>Phone</th><th>Address</th><th>ERP Status</th><th>Owner</th></tr></thead>
            <tbody>
              {query.isLoading && <tr><td colSpan={6}>Loading...</td></tr>}
              {!query.isLoading && !rows.length && <tr><td colSpan={6}>No data</td></tr>}
              {rows.map(row => (
                <tr key={row.public_id} onClick={() => select(row)} style={{ cursor: 'pointer', background: selectedId === row.public_id ? '#eef4fb' : undefined }}>
                  <td><strong>{row.account_name}</strong></td>
                  <td>{row.business_no || '-'}</td>
                  <td>{row.phone || '-'}</td>
                  <td>{row.hospital_address || row.address || '-'}</td>
                  <td>{row.integration_status}</td>
                  <td>{row.owner_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(selected || editing) && (
        <form onSubmit={event => void save(event)} className="data-card" style={{ marginTop: 16, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <h3>{selected ? selected.account_name : 'New Account'}</h3>
            {selected && !editing && <button type="button" onClick={() => setEditing(true)}>Edit</button>}
          </div>
          <div className="account-form-grid">
            <label>Account name<input value={form.accountName} disabled={!editing} onChange={event => setField('accountName', event.target.value)} required /></label>
            <label>CRM status<select value={form.accountStatus} disabled={!editing} onChange={event => setField('accountStatus', event.target.value)}>{ACCOUNT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}</select></label>
            <label>Grade<input value={form.accountGrade} disabled={!editing} onChange={event => setField('accountGrade', event.target.value)} /></label>
          </div>

          {sections.map(section => (
            <fieldset key={section.code} style={{ marginTop: 14 }}>
              <legend>{section.code.toUpperCase()}</legend>
              <div className="account-form-grid">
                {effectiveAccountFields(section).map(({ field, rule }) => (
                  <label key={field.code} className={field.group === 'address' && field.code !== 'zip_cd' ? 'full' : ''}>
                    {field.nameEn}{rule.required ? ' *' : ''}
                    {editing ? fieldControl(field, rule.readonly) : <div className="readonly-value">{selected ? displayValue(selected, field) : '-'}</div>}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {editing && <div style={{ marginTop: 14, display: 'flex', gap: 8 }}><button type="submit" className="button-primary">Save</button><button type="button" onClick={() => { setEditing(false); if (selected) setForm(formFromAccount(selected)); }}>Cancel</button></div>}
          {selected && <p style={{ color: '#667085', marginTop: 12 }}>ERP registration remains governed by the Integration Profile; M7 does not invent country-specific ERP required-field rules.</p>}
        </form>
      )}
      {message && <p className="notice info">{message}</p>}
    </section>
  );
}
