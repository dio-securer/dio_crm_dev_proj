// The generic create / edit form (F2-5): the screen's sections and fields as inputs by field type. The server checks
// the values; a refused save comes back as errors that are shown under their fields.
import { FormEvent, useState } from 'react';
import type { EngineUiModel, FieldValue, RecordData, UiField } from './types';
import { FormMode, PlacedField, formScreen, placeScreen } from './layout';
import { FormErrors, FormState, InputValue, NO_ERRORS, initialState, payloadOf } from './form-values';
import { TEXT, textOf } from './text';

export interface RecordFormProps {
  model: EngineUiModel; mode: FormMode;
  /** The record being edited (edit only). */
  record?: RecordData;
  errors?: FormErrors; busy?: boolean;
  onSubmit: (values: Record<string, FieldValue>) => void;
  onCancel: () => void;
  /** Starting input values, over the record's (used by tests and to keep input after a refused save). */
  initialInput?: FormState;
}

const INPUT_TYPE: Record<string, string> = { integer: 'number', decimal: 'number', date: 'date', datetime: 'datetime-local' };

function FieldInput({ field, id, value, disabled, invalid, describedBy, required, onChange }: {
  field: UiField; id: string; value: InputValue; disabled: boolean; invalid: boolean; describedBy?: string; required: boolean; onChange: (value: InputValue) => void;
}) {
  const common = { id, name: field.key, disabled, required, 'aria-invalid': invalid || undefined, 'aria-describedby': describedBy };
  if (field.type === 'boolean') return <input {...common} required={false} type="checkbox" checked={value === true} onChange={e => onChange(e.target.checked)} />;
  if (field.type === 'enum') {
    const options = field.options ?? [], current = String(value);
    return (
      <select {...common} value={current} onChange={e => onChange(e.target.value)}>
        <option value="" />
        {/* A stored code that is no longer active stays selectable, so opening the form does not silently change it. */}
        {current !== '' && !options.some(o => o.code === current) && <option value={current}>{current}</option>}
        {options.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
      </select>
    );
  }
  const step = field.type === 'decimal' ? 'any' : field.type === 'integer' ? 1 : undefined;
  return <input {...common} type={INPUT_TYPE[field.type] ?? 'text'} step={step} maxLength={field.type === 'text' ? field.maxLength : undefined} value={String(value)} onChange={e => onChange(e.target.value)} />;
}

export function RecordForm({ model, mode, record, errors = NO_ERRORS, busy = false, onSubmit, onCancel, initialInput }: RecordFormProps) {
  const screen = formScreen(model, mode);
  const tabs = screen ? placeScreen(model, screen) : [];
  const [initial] = useState<FormState>(() => initialState(tabs, record));
  const [state, setState] = useState<FormState>(() => ({ ...initial, ...initialInput }));
  const submit = (event: FormEvent) => { event.preventDefault(); if (!busy) onSubmit(payloadOf(tabs, mode, state, initial)); };
  const title = mode === 'create' ? `${model.object.label} · ${textOf(model, TEXT.create)}` : `${model.object.label} · ${textOf(model, TEXT.edit)}`;
  const cell = ({ screen: placed, field }: PlacedField) => {
    const id = `engine-field-${field.key}`, messages = errors.fields[field.key] ?? [];
    const disabled = busy || placed.readOnly || field.readOnly, required = !disabled && (placed.required || field.required);
    return (
      <div key={field.key} className={`engine-cell${messages.length ? ' engine-invalid' : ''}`} data-field={field.key}>
        <label htmlFor={id}>{placed.label}{required && <span className="engine-required" title={textOf(model, TEXT.required)}> *</span>}</label>
        <FieldInput field={field} id={id} value={state[field.key] ?? ''} disabled={disabled} required={required} invalid={messages.length > 0}
          describedBy={messages.length ? `${id}-error` : undefined} onChange={value => setState(s => ({ ...s, [field.key]: value }))} />
        {messages.length > 0 && <p id={`${id}-error`} className="engine-error" role="alert">{messages.join(' ')}</p>}
      </div>
    );
  };
  return (
    <form className="engine-page" data-engine="form" data-mode={mode} data-object={model.object.key} noValidate onSubmit={submit}>
      <header className="engine-header">
        <h1>{title}</h1>
        <div className="engine-actions">
          <button type="button" className="engine-button" onClick={onCancel} disabled={busy}>{textOf(model, TEXT.cancel)}</button>
          <button type="submit" className="engine-button engine-primary" disabled={busy}>{textOf(model, TEXT.save)}</button>
        </div>
      </header>
      {errors.form.length > 0 && <div className="engine-banner" role="alert">{errors.form.map((message, i) => <p key={i}>{message}</p>)}</div>}
      {tabs.map(tab => (
        <fieldset key={tab.id} className="engine-tab-group" data-tab={tab.id}>
          {tabs.length > 1 && <legend>{tab.label}</legend>}
          {tab.sections.map(section => (
            <section key={section.id} className="engine-section" data-section={section.id}>
              <h2>{section.title}</h2>
              <div className="engine-grid" style={{ gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))` }}>{section.fields.map(cell)}</div>
            </section>
          ))}
        </fieldset>
      ))}
    </form>
  );
}
