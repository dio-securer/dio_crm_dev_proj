import React, { useId } from 'react';

/** Provisional presentation model: must be supplied by the current server release.
 * This component does not grant access or perform a request. */
export type ExtensionFieldView = {
  id: string;
  version: number;
  type: 'text' | 'number' | 'boolean' | 'date';
  labels: Record<string, string>;
  readable: boolean;
  writable: boolean;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
};
export type ExtensionFieldDraft = Record<string, string>;
export type ExtensionFieldValue = string | number | boolean | null;
export type ExtensionFieldErrors = Record<string, string>;

const message = (locale: string, code: 'invalid' | 'tooLong' | 'range') => {
  const ko = locale.startsWith('ko');
  if (code === 'tooLong') return ko ? '입력 길이를 확인해 주세요.' : 'Check the input length.';
  if (code === 'range') return ko ? '허용 범위를 확인해 주세요.' : 'Check the allowed range.';
  return ko ? '올바른 값을 입력해 주세요.' : 'Enter a valid value.';
};

/** Parse only edited, readable and writable fields. Server validation remains authoritative. */
export function prepareExtensionFieldChanges(fields: ExtensionFieldView[], drafts: ExtensionFieldDraft, dirtyIds: string[], locale: string): {
  values: Record<string, { definitionVersion: number; value: ExtensionFieldValue }>;
  errors: ExtensionFieldErrors;
} {
  const values: Record<string, { definitionVersion: number; value: ExtensionFieldValue }> = Object.create(null);
  const errors: ExtensionFieldErrors = Object.create(null);
  const seen = new Set<string>();
  for (const id of dirtyIds) {
    const field = fields.find(item => item.id === id);
    if (seen.has(id) || !field || fields.filter(item => item.id === id).length !== 1 || !field.readable || !field.writable || !Number.isSafeInteger(field.version) || field.version < 1 || typeof drafts[id] !== 'string') {
      errors[id] = message(locale, 'invalid');
      continue;
    }
    seen.add(id);
    const raw = drafts[id];
    let value: ExtensionFieldValue = null;
    if (raw !== '') {
      if (field.type === 'number') {
        value = Number(raw);
        if (!raw.trim() || !Number.isFinite(value)) { errors[id] = message(locale, 'invalid'); continue; }
        if ((field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max)) { errors[id] = message(locale, 'range'); continue; }
      } else if (field.type === 'boolean') {
        if (raw !== 'true' && raw !== 'false') { errors[id] = message(locale, 'invalid'); continue; }
        value = raw === 'true';
      } else if (field.type === 'date') {
        const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00Z`) : null;
        if (!date || !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== raw) { errors[id] = message(locale, 'invalid'); continue; }
        value = raw;
      } else if (field.type === 'text') {
        if (raw.length > (field.maxLength ?? 500)) { errors[id] = message(locale, 'tooLong'); continue; }
        value = raw;
      } else { errors[id] = message(locale, 'invalid'); continue; }
    }
    values[id] = { definitionVersion: field.version, value };
  }
  return { values: Object.keys(errors).length ? Object.create(null) : values, errors };
}

/** Controlled inputs keep the caller's drafts intact across failed or stale requests. */
export function ExtensionFieldInputs({ fields, drafts, errors, locale, disabled, title, onChange }: {
  fields: ExtensionFieldView[];
  drafts: ExtensionFieldDraft;
  errors: ExtensionFieldErrors;
  locale: string;
  disabled?: boolean;
  title?: string;
  onChange: (fieldId: string, rawValue: string) => void;
}) {
  const prefix = useId();
  const ko = locale.startsWith('ko');
  const readable = fields.filter(field => field.readable);
  if (!readable.length) return null;
  return <fieldset className="extension-field-inputs" disabled={disabled}>
    <legend>{title??(ko ? '추가 정보' : 'Additional information')}</legend>
    {readable.map((field, index) => {
      const inputId = `${prefix}-${index}`, errorId = `${inputId}-error`, value = drafts[field.id] ?? '';
      const common = { id: inputId, value, disabled: disabled || !field.writable, required:!!field.required, 'aria-invalid': !!errors[field.id], 'aria-describedby': errors[field.id] ? errorId : undefined, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange(field.id, event.target.value) };
      return <div key={field.id}>
        <label htmlFor={inputId}>{field.labels[locale] ?? field.labels['ko-KR'] ?? field.labels['en-US'] ?? field.id}</label>
        {field.type === 'boolean' ? <select {...common}><option value="">—</option><option value="true">{ko ? '예' : 'Yes'}</option><option value="false">{ko ? '아니요' : 'No'}</option></select>
          : <input {...common} type={field.type === 'number' ? 'text' : field.type} inputMode={field.type === 'number' ? 'decimal' : undefined} maxLength={field.type === 'text' ? field.maxLength ?? 500 : undefined} />}
        {errors[field.id] && <p id={errorId} role="alert">{errors[field.id]}</p>}
      </div>;
    })}
  </fieldset>;
}
