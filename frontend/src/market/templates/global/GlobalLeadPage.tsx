import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccountSummary, LeadStatus, LeadSummary } from '@dio-crm/contracts';
import { apiGet, apiPost } from '../../../api';

const STATUS_FLOW: LeadStatus[] = ['NEW', 'FIRST_VISIT', 'KEYMAN_MEETING'];

export function GlobalLeadPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState('');
  const [existingAccountId, setExistingAccountId] = useState('');
  const [opportunityName, setOpportunityName] = useState('');
  const [message, setMessage] = useState('');

  const leads = useQuery({
    queryKey: ['global-leads', search],
    queryFn: () => apiGet<LeadSummary[]>(`/api/leads${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    retry: false
  });
  const accounts = useQuery({
    queryKey: ['global-lead-accounts'],
    queryFn: () => apiGet<AccountSummary[]>('/api/accounts?scope=managed'),
    retry: false
  });

  const selected = useMemo(() => (leads.data ?? []).find(row => row.public_id === selectedId) ?? null, [leads.data, selectedId]);

  async function move(toStatus: LeadStatus) {
    if (!selected) return;
    try {
      await apiPost(`/api/leads/${selected.public_id}/status`, {
        toStatus,
        reason: toStatus === 'CONTACT_EXCLUDED' ? reason || undefined : undefined
      });
      setMessage(`Lead status changed to ${toStatus}.`);
      setReason('');
      await qc.invalidateQueries({ queryKey: ['global-leads'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function convert(mode: 'NEW' | 'EXISTING') {
    if (!selected) return;
    if (mode === 'EXISTING' && !existingAccountId) {
      setMessage('Select an existing Account before conversion.');
      return;
    }
    try {
      const result = await apiPost<{ accountPublicId: string; contactId: number | null; opportunityPublicId: string }>(
        `/api/leads/${selected.public_id}/convert`,
        {
          accountMode: mode,
          existingAccountPublicId: mode === 'EXISTING' ? existingAccountId : undefined,
          opportunityName: opportunityName.trim() || undefined
        }
      );
      setMessage(`Converted: Account ${result.accountPublicId} / Opportunity ${result.opportunityPublicId}`);
      setOpportunityName('');
      setExistingAccountId('');
      await qc.invalidateQueries({ queryKey: ['global-leads'] });
      await qc.invalidateQueries({ queryKey: ['global-lead-accounts'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section className="workspace-page">
      <div className="page-header">
        <div>
          <span className="page-kicker">GLOBAL · SALES</span>
          <h2>Lead</h2>
          <small>New registration → First visit → Keyman meeting → Convert / Contact excluded</small>
        </div>
        <div className="page-actions">
          <input className="search-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search lead" />
        </div>
      </div>

      <div className="data-card">
        <div className="table-scroll">
          <table>
            <thead><tr><th>Hospital / Business</th><th>Status</th><th>Owner</th><th>Phone</th><th>Business No.</th></tr></thead>
            <tbody>
              {leads.isLoading && <tr><td colSpan={5}>Loading...</td></tr>}
              {!leads.isLoading && !(leads.data ?? []).length && <tr><td colSpan={5}>No data</td></tr>}
              {(leads.data ?? []).map(row => (
                <tr key={row.public_id} onClick={() => setSelectedId(row.public_id)} style={{ cursor: 'pointer', background: selectedId === row.public_id ? '#eef4fb' : undefined }}>
                  <td><strong>{row.hospital_name}</strong></td>
                  <td>{row.status}</td>
                  <td>{row.owner_name ?? '-'}</td>
                  <td>{row.phone ?? '-'}</td>
                  <td>{row.business_no ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="data-card" style={{ marginTop: 16, padding: 16 }}>
          <h3>{selected.hospital_name}</h3>
          <p style={{ color: '#667085' }}>Current status: <strong>{selected.status}</strong></p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {STATUS_FLOW.map(status => <button key={status} type="button" onClick={() => void move(status)} disabled={selected.status === 'CONVERTED'}>{status}</button>)}
            <button type="button" onClick={() => void move('CONTACT_EXCLUDED')} disabled={selected.status === 'CONVERTED'}>CONTACT_EXCLUDED</button>
          </div>
          <input value={reason} onChange={event => setReason(event.target.value)} placeholder="Contact exclusion reason" style={{ minWidth: 280, marginBottom: 12 }} />

          {selected.status === 'KEYMAN_MEETING' && (
            <div style={{ borderTop: '1px solid #eef1f5', paddingTop: 12 }}>
              <h4>Lead conversion</h4>
              <p style={{ color: '#667085' }}>Conversion creates/links Account, creates Contact when keyman information exists, and creates Opportunity.</p>
              <input value={opportunityName} onChange={event => setOpportunityName(event.target.value)} placeholder="Opportunity name" style={{ minWidth: 280, marginRight: 8 }} />
              <button type="button" onClick={() => void convert('NEW')}>Convert to new Account</button>
              <div style={{ marginTop: 8 }}>
                <select value={existingAccountId} onChange={event => setExistingAccountId(event.target.value)} style={{ minWidth: 280, marginRight: 8 }}>
                  <option value="">Select existing Account</option>
                  {(accounts.data ?? []).map(account => <option key={account.public_id} value={account.public_id}>{account.account_name}</option>)}
                </select>
                <button type="button" onClick={() => void convert('EXISTING')}>Convert to existing Account</button>
              </div>
            </div>
          )}
        </div>
      )}
      {message && <p className="notice info">{message}</p>}
    </section>
  );
}
