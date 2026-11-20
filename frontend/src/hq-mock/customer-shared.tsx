import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createHqPolicy, type HqCapabilities, type HqContext, type HqStandard } from '@dio-crm/contracts';
import { apiDelete, apiGet, apiPatch, apiPost } from '../api';
import { useHqMock } from './HqMockProvider';
import { displayValue, type CustomerField, type CustomerForm, type CustomerRecord } from './customer-model';
import { accountSystemOptions } from './account-editor-guard';
import { configAnchor, customerFieldId } from './config-anchor';
import { PlacementContext } from '../customization/PlacementContext';
import { GridDensityContext,GridColumnWidthContext,GridColumnAlignmentContext } from '../customization/GridDensityContext';
import {leadColumnStyle} from '../customization/lead-column-width';
import '../customization/grid-density.css';
import {PopupPresentationContext} from '../customization/PopupPresentationContext';
import '../customization/popup-size.css';
import './customer.css';

export function HqError({ error }: { error: unknown }) {
  return error ? <p className="hq-customer-error" role="alert">{error instanceof Error ? error.message : String(error)}</p> : null;
}
export function HqModal({ title, onClose, children, busy = false, wide = false, configId }: { title: string; onClose: () => void; children: React.ReactNode; busy?: boolean; wide?: boolean; configId?: string }) {
  const { t } = useTranslation();
  const presentation=React.useContext(PopupPresentationContext),override=configId==='POP.LEAD.CREATE'?presentation:{};
  const ref = useRef<HTMLDialogElement>(null);
  const label = React.useId();
  useEffect(() => { const element = ref.current; const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null; if (element && !element.open) element.showModal(); return () => { element?.close(); if (trigger?.isConnected) trigger.focus(); }; }, []);
  return <dialog ref={ref} className={`hq-customer-modal${configId === 'POP.LEAD.CREATE' ? ' lead-create-modal' : ''}${wide ? ' wide' : ''}${override.size?` crm-popup-size-${override.size}`:''}`} aria-labelledby={label} {...(configId ? configAnchor(configId, `${configId}.0`) : {})}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><h2 id={label}>{override.title??title}</h2><button type="button" onClick={onClose} disabled={busy} aria-label={t('app.close')}>×</button></header>
    {children}
  </dialog>;
}
export function HqTabs({ tabs, active, onChange, configScreen }: { tabs: { key: string; label: string }[]; active: string; onChange: (key: string) => void; configScreen?: 'HQ_LEAD' | 'HQ_ACCOUNT' }) {
  return <div className="hq-customer-tabs" role="tablist">{tabs.map(tab => <button key={tab.key} type="button" role="tab"
    aria-selected={active === tab.key} data-tab-key={tab.key} {...(configScreen ? configAnchor(`tab:${configScreen}.${tab.key}`, `tab:${configScreen}.${tab.key}.0`) : {})} onClick={() => onChange(tab.key)}>{tab.label}</button>)}</div>;
}
export function HqFields({ fields, form, onChange, disabled = false, prefix = '', entity, row = {}, configInstance }: { fields: CustomerField[]; form: CustomerForm; onChange: (form: CustomerForm) => void; disabled?: boolean; prefix?: string; entity?: 'lead' | 'account' | 'contact'; row?: Record<string, unknown>; configInstance?: string }) {
  const { t } = useTranslation();
  const policy = useHqCustomerPolicy();
  const [leadTouched, setLeadTouched] = useState<Record<string, boolean>>({});
  const fieldErrorPrefix = React.useId();
  const placementOrders = React.useContext(PlacementContext);
  const order = entity && configInstance ? placementOrders[`${entity}.${configInstance}`] : undefined;
  const ordered = order && entity ? [...fields].sort((a,b)=>order.indexOf(customerFieldId(entity,a.key))-order.indexOf(customerFieldId(entity,b.key))) : fields;
  const visible = entity ? ordered.filter(field => policy.visible(entity, field.key, row)) : ordered;
  const readOnly = (field: CustomerField) => disabled || Boolean(entity && !policy.writable(entity, field.key, row));
  return <div className="hq-customer-fields">{visible.map(field => <label key={field.key} className={field.type === 'textarea' ? 'full' : ''} {...(entity && configInstance ? configAnchor(customerFieldId(entity, field.key), `${configInstance}.${field.key}`) : {})}>
    <span>{t(`hqCustomer.fields.${field.key}`)}{field.required && <><span className="lead-required-asterisk"> *</span>{entity === 'lead' && <span className="lead-required-label">필수</span>}</>}</span>
    {entity === 'account' && ['mainSystem', 'subSystem'].includes(field.key) ? <select data-field-key={`${prefix}${field.key}`} value={String(form[field.key] ?? '')} disabled={readOnly(field)} onChange={event => onChange({ ...form, [field.key]: event.target.value })}>{accountSystemOptions(String(form[field.key] ?? '')).map(value => <option key={value} value={value}>{value || '미확인'}</option>)}</select>
      : field.type === 'textarea' ? <textarea data-field-key={`${prefix}${field.key}`} value={String(form[field.key] ?? '')} disabled={readOnly(field)}
      onChange={event => onChange({ ...form, [field.key]: event.target.value })} rows={3} />
      : field.type === 'triState' ? <select data-field-key={`${prefix}${field.key}`} value={form[field.key] === true ? 'yes' : form[field.key] === false ? 'no' : ''} disabled={readOnly(field)} onChange={event => onChange({ ...form, [field.key]: event.target.value === '' ? null : event.target.value === 'yes' })}><option value="">미확인</option><option value="yes">보유</option><option value="no">미보유</option></select>
      : field.type === 'checkbox' ? <input type="checkbox" data-field-key={`${prefix}${field.key}`} checked={Boolean(form[field.key])} disabled={readOnly(field)}
        onChange={event => onChange({ ...form, [field.key]: event.target.checked })} />
      : <input type={field.type ?? 'text'} data-field-key={`${prefix}${field.key}`} value={String(form[field.key] ?? '')} disabled={readOnly(field)} required={field.required} aria-invalid={entity === 'lead' && field.required && leadTouched[field.key] && !String(form[field.key] ?? '').trim() ? true : undefined} aria-describedby={entity === 'lead' && field.required && leadTouched[field.key] && !String(form[field.key] ?? '').trim() ? `${fieldErrorPrefix}-${field.key}` : undefined} onBlur={() => { if (entity === 'lead' && field.required) setLeadTouched(current => ({ ...current, [field.key]: true })); }} onInvalid={() => { if (entity === 'lead' && field.required) setLeadTouched(current => ({ ...current, [field.key]: true })); }}
        min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? field.integer ? 1 : 'any' : undefined}
        onChange={event => onChange({ ...form, [field.key]: event.target.value })} />}
    {entity === 'lead' && field.required && leadTouched[field.key] && !String(form[field.key] ?? '').trim() && <small className="lead-field-error" id={`${fieldErrorPrefix}-${field.key}`} role="alert">{t(`hqCustomer.fields.${field.key}`)}을(를) 입력해 주세요.</small>}
  </label>)}</div>;
}
export function HqRecordSummary({ row, fields, configFields }: { row: Record<string, unknown>; fields: { key: string; label: string }[]; configFields?: Record<string, { id: string; instance: string }> }) {
  return <dl className="hq-customer-summary">{fields.map(field => <div key={field.key} {...(configFields?.[field.key] ? configAnchor(configFields[field.key].id, configFields[field.key].instance) : {})}><dt>{field.label}</dt><dd>{displayValue(row[field.key])}</dd></div>)}</dl>;
}
export function HqRows({ rows, columns:sourceColumns, configInstance,columnOrder,gridAnchor }: { rows: CustomerRecord[]; columns: { key: string; label: string; configId?: string; configName?: string; headerConfig?: boolean; render?: (row: CustomerRecord) => React.ReactNode }[]; configInstance?: string;columnOrder?:string[];gridAnchor?:{id:string;instance:string;label:string} }) {
  const columns=columnOrder?[...sourceColumns].sort((a,b)=>columnOrder.indexOf(a.configId??'')-columnOrder.indexOf(b.configId??'')):sourceColumns;
  const { t } = useTranslation();
  const density=React.useContext(GridDensityContext);
  const widths=React.useContext(GridColumnWidthContext),alignments=React.useContext(GridColumnAlignmentContext),styleFor=(column:typeof columns[number])=>gridAnchor&&column.configId?leadColumnStyle(widths[column.configId],alignments[column.configId]):undefined;
  return rows.length ? <div className={`hq-customer-table${gridAnchor ? ` crm-grid-density grid-density-${density}` : ''}`}><table {...(gridAnchor?{...configAnchor(gridAnchor.id,gridAnchor.instance),'aria-label':gridAnchor.label}:{})}><colgroup>{columns.map(column=><col key={column.key} style={styleFor(column)}/>)}</colgroup><thead><tr>{columns.map(column => <th key={column.key} style={styleFor(column)} {...(column.configId && configInstance ? configAnchor(column.configId, `${configInstance}.header.${column.configName ?? column.key}`) : {})}>{column.label}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={row.public_id ?? String(row.id ?? row.requestId ?? index)}>{columns.map(column => <td key={column.key} style={styleFor(column)} {...(column.configId && configInstance ? configAnchor(column.configId, `${configInstance}.${column.configName ?? column.key}.${row.public_id ?? index}`) : {})}>{column.render ? column.render(row) : displayValue(row[column.key])}</td>)}</tr>)}</tbody>
  </table></div> : <p className="hq-customer-empty">{t('common.noData')}</p>;
}
export function useHqCommand() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const last = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
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
    visible: (entity: string, apiField: string, row?: Record<string, unknown>) => {
      const field = query.data?.standard.fields.find(item => item.entity === entity && item.current.apiField === apiField);
      const current = context(row); return Boolean(field && policy && current && policy.fieldVisible(field.fieldKey, current));
    },
    writable: (entity: string, apiField: string, row?: Record<string, unknown>) => {
      const field = query.data?.standard.fields.find(item => item.entity === entity && item.current.apiField === apiField);
      const current = context(row); return Boolean(field && policy && current && policy.fieldWritable(field.fieldKey, current));
    },
    writablePayload: (entity: string, input: Record<string, unknown>, row?: Record<string, unknown>) => {
      const current = context(row, input);
      return Object.fromEntries(Object.entries(input).filter(([key, value]) => {
        const field = query.data?.standard.fields.find(item => item.entity === entity && item.current.apiField === key);
        if (!field || !current || !policy || !policy.fieldWritable(field.fieldKey, current)) return false;
        const db = field.current.dbField;
        // An unchanged projected/masked value must never replace the stored original.
        if (row && db && Object.hasOwn(row, db) && String(row[db] ?? '') === String(value ?? '')) return false;
        return true;
      }));
    },
    has: (permission: string) => Boolean(session?.user.permissions.includes(permission)),
    owns: (row: Record<string, unknown>, management: string) => row.shared_access === 'READ' ? false : row.shared_access === 'EDIT' ? true : row.owner_user_id === session?.user.userId || Boolean(session?.user.permissions.includes(management))
  };
}
