import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createHqPolicy, type HqCapabilities, type HqContext, type HqStandard } from '@dio-crm/contracts';
import { apiDelete, apiGet, apiPatch, apiPost } from '../api';
import { useHqMock } from './HqMockProvider';
import { displayValue, type CustomerField, type CustomerForm, type CustomerRecord } from './customer-model';
import './customer.css';

export function HqError({ error }: { error: unknown }) {
  return error ? <p className="hq-customer-error" role="alert">{error instanceof Error ? error.message : String(error)}</p> : null;
}
export function HqModal({ title, onClose, children, busy = false, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; busy?: boolean; wide?: boolean }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const label = React.useId();
  useEffect(() => { const element = ref.current; if (element && !element.open) element.showModal(); return () => element?.close(); }, []);
  return <dialog ref={ref} className={`hq-customer-modal${wide ? ' wide' : ''}`} aria-labelledby={label}
    onCancel={event => { if (busy) event.preventDefault(); else onClose(); }}>
    <header><h2 id={label}>{title}</h2><button type="button" onClick={onClose} disabled={busy} aria-label={t('app.close')}>×</button></header>
    {children}
  </dialog>;
}
export function HqTabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (key: string) => void }) {
  return <div className="hq-customer-tabs" role="tablist">{tabs.map(tab => <button key={tab.key} type="button" role="tab"
    aria-selected={active === tab.key} data-tab-key={tab.key} onClick={() => onChange(tab.key)}>{tab.label}</button>)}</div>;
}
export function HqFields({ fields, form, onChange, disabled = false, prefix = '' }: { fields: CustomerField[]; form: CustomerForm; onChange: (form: CustomerForm) => void; disabled?: boolean; prefix?: string }) {
  const { t } = useTranslation();
  return <div className="hq-customer-fields">{fields.map(field => <label key={field.key} className={field.type === 'textarea' ? 'full' : ''}>
    <span>{t(`hqCustomer.fields.${field.key}`)}{field.required ? ' *' : ''}</span>
    {field.type === 'textarea' ? <textarea data-field-key={`${prefix}${field.key}`} value={String(form[field.key] ?? '')} disabled={disabled}
      onChange={event => onChange({ ...form, [field.key]: event.target.value })} rows={3} />
      : field.type === 'checkbox' ? <input type="checkbox" data-field-key={`${prefix}${field.key}`} checked={Boolean(form[field.key])} disabled={disabled}
        onChange={event => onChange({ ...form, [field.key]: event.target.checked })} />
      : <input type={field.type ?? 'text'} data-field-key={`${prefix}${field.key}`} value={String(form[field.key] ?? '')} disabled={disabled} required={field.required}
        min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? field.integer ? 1 : 'any' : undefined}
        onChange={event => onChange({ ...form, [field.key]: event.target.value })} />}
  </label>)}</div>;
}
export function HqRecordSummary({ row, fields }: { row: Record<string, unknown>; fields: { key: string; label: string }[] }) {
  return <dl className="hq-customer-summary">{fields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{displayValue(row[field.key])}</dd></div>)}</dl>;
}
export function HqRows({ rows, columns }: { rows: CustomerRecord[]; columns: { key: string; label: string; render?: (row: CustomerRecord) => React.ReactNode }[] }) {
  const { t } = useTranslation();
  return rows.length ? <div className="hq-customer-table"><table><thead><tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={row.public_id ?? String(row.id ?? row.requestId ?? index)}>{columns.map(column => <td key={column.key}>{column.render ? column.render(row) : displayValue(row[column.key])}</td>)}</tr>)}</tbody>
  </table></div> : <p className="hq-customer-empty">{t('common.noData')}</p>;
}
export function useHqCommand() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const last = useRef<{ fingerprint: string; key: string }>();
  const run = async <T,>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body: Record<string, unknown> = {}): Promise<T> => {
    const fingerprint = JSON.stringify([method, path, body]);
    if (last.current?.fingerprint !== fingerprint) last.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true); setError(null);
    try {
      const payload = { ...body, idempotencyKey: last.current.key };
      const result = method === 'PATCH' ? await apiPatch<T>(path, payload) : method === 'DELETE' ? await apiDelete<T>(path, payload) : await apiPost<T>(path, payload);
      last.current = undefined;
      return result;
    } catch (reason) { setError(reason); throw reason; }
    finally { setBusy(false); }
  };
  return { run, busy, error, clearError: () => setError(null) };
}

export function useHqCustomerPolicy() {
  const { session, enabled } = useHqMock();
  const query = useQuery({ queryKey: ['hq-customer-policy', session?.user.userId, session?.dataset.generation],
    queryFn: () => apiGet<{ standard: HqStandard; capabilities: HqCapabilities; context: HqContext }>('/api/hq/policy'), enabled, retry: false });
  const policy = useMemo(() => {
    if (!query.data) return undefined;
    try { return createHqPolicy(query.data.standard, query.data.capabilities); } catch { return undefined; }
  }, [query.data]);
  const context = (row: Record<string, unknown> = {}, input: Record<string, unknown> = {}): HqContext | undefined => {
    if (!query.data) return undefined;
    const values: Record<string, unknown> = {};
    for (const field of query.data.standard.fields) {
      const leaf = field.fieldKey.split('.').at(-1)!;
      const keys = [field.fieldKey, field.current.apiField, field.current.dbField, leaf, leaf.replace(/[A-Z]/g, match => `_${match.toLowerCase()}`)].filter((key): key is string => Boolean(key));
      const supplied = keys.find(key => Object.hasOwn(input, key));
      const existing = keys.find(key => Object.hasOwn(row, key));
      if (supplied !== undefined) values[field.fieldKey] = input[supplied];
      else if (existing !== undefined) values[field.fieldKey] = row[existing];
      else if (field.defaultValue !== undefined) values[field.fieldKey] = field.defaultValue;
    }
    return { ...query.data.context, values, device: typeof window !== 'undefined' && window.matchMedia('(max-width: 920px)').matches ? 'mobile' : 'desktop' };
  };
  return {
    ready: Boolean(policy), error: query.error,
    can: (action: string, row?: Record<string, unknown>, input?: Record<string, unknown>) => {
      const current = context(row, input); return Boolean(policy && current && policy.actionAllowed(action, current));
    },
    fieldWritable: (field: string, row?: Record<string, unknown>) => {
      const current = context(row); return Boolean(policy && current && policy.fieldWritable(field, current));
    },
    writable: (entity: string, apiField: string, row?: Record<string, unknown>) => {
      const field = query.data?.standard.fields.find(item => item.entity === entity && item.current.apiField === apiField);
      const current = context(row); return Boolean(field && policy && current && policy.fieldWritable(field.fieldKey, current));
    },
    writablePayload: (entity: string, input: Record<string, unknown>, row?: Record<string, unknown>) => {
      const current = context(row, input);
      return Object.fromEntries(Object.entries(input).filter(([key]) => {
        const field = query.data?.standard.fields.find(item => item.entity === entity && item.current.apiField === key);
        return Boolean(field && current && policy && policy.fieldWritable(field.fieldKey, current));
      }));
    },
    has: (permission: string) => Boolean(session?.user.permissions.includes(permission)),
    owns: (row: Record<string, unknown>, management: string) => row.owner_user_id === session?.user.userId || Boolean(session?.user.permissions.includes(management))
  };
}
