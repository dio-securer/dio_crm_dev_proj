// Form state of the generic form: every input holds text (or a boolean for a checkbox); values become API values only
// when the form is sent. The form sends what the user changed and nothing else; the server decides what is valid.
import type { EngineUiModel, FieldValue, Failure, RecordData, UiField } from './types';
import type { FormMode, PlacedTab } from './layout';
import { errorText, fieldOf } from './text';

export type InputValue = string | boolean;
export type FormState = Record<string, InputValue>;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');
/**
 * An ISO instant as the value of a datetime-local input, in the user's own time zone. Seconds and milliseconds are
 * written only when they are not zero, so the instant always comes back exactly (old dates have zone offsets with seconds).
 */
export function toLocalInput(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const seconds = at.getSeconds(), ms = at.getMilliseconds();
  const tail = ms !== 0 ? `:${pad(seconds)}.${pad(ms, 3)}` : seconds !== 0 ? `:${pad(seconds)}` : '';
  return `${pad(at.getFullYear(), 4)}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}${tail}`;
}

export function toInput(field: UiField, value: FieldValue | undefined): InputValue {
  if (field.type === 'boolean') return value === true;
  if (value === null || value === undefined) return '';
  return field.type === 'datetime' ? toLocalInput(String(value)) : String(value);
}

/** What the input holds, as the API value. Text that is not a number or a date is sent as it is: the server names the error. */
export function fromInput(field: UiField, input: InputValue): FieldValue {
  if (field.type === 'boolean') return input === true;
  const text = String(input);
  if (text.trim() === '') return null;
  if (field.type === 'integer' || field.type === 'decimal') { const n = Number(text); return Number.isFinite(n) ? n : text; }
  if (field.type === 'datetime') { const at = new Date(text); return Number.isNaN(at.getTime()) ? text : at.toISOString(); }
  return text;
}

/** Fields of the form the user may write: on the screen, visible, and read-only neither on the screen nor for the API. */
export function editableFields(tabs: readonly PlacedTab[]): UiField[] {
  return tabs.flatMap(t => t.sections).flatMap(s => s.fields).filter(f => !f.screen.readOnly && !f.field.readOnly).map(f => f.field);
}

export function initialState(tabs: readonly PlacedTab[], record?: RecordData): FormState {
  const state: FormState = {};
  for (const { field } of tabs.flatMap(t => t.sections).flatMap(s => s.fields)) state[field.key] = toInput(field, record?.values[field.key]);
  return state;
}

/** The request body: on create every filled field, on edit every field whose input differs from what was loaded. */
export function payloadOf(tabs: readonly PlacedTab[], mode: FormMode, state: FormState, initial: FormState): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  for (const field of editableFields(tabs)) {
    const now = state[field.key] ?? toInput(field, null), before = initial[field.key] ?? toInput(field, null);
    if (now === before) continue;
    out[field.key] = fromInput(field, now);
  }
  if (mode === 'create') for (const key of Object.keys(out)) if (out[key] === null) delete out[key];
  return out;
}

export interface FormErrors { form: string[]; fields: Record<string, string[]> }
export const NO_ERRORS: FormErrors = { form: [], fields: {} };

/**
 * A refused save as texts: field errors under their field when the form shows it, everything else on top
 * (the general message of the failure, and errors of fields this form does not show, named by their label).
 */
export function mapErrors(model: EngineUiModel, tabs: readonly PlacedTab[], failure: Failure): FormErrors {
  const shown = new Set(tabs.flatMap(t => t.sections).flatMap(s => s.fields).map(f => f.field.key));
  const out: FormErrors = { form: [errorText(model, failure.code)], fields: {} };
  for (const e of failure.errors) {
    const message = errorText(model, e.code);
    if (e.field !== undefined && shown.has(e.field)) (out.fields[e.field] ??= []).push(message);
    else out.form.push(e.field === undefined ? message : `${fieldOf(model, e.field)?.label ?? e.field}: ${message}`);
  }
  return out;
}
