// Texts and value display. Every text comes from the screen model (metadata terms in the user's language); a key
// without a translation is shown as the key, so a missing term is visible instead of silently blank.
import type { EngineUiModel, Failure, FieldValue, UiField } from './types';

export const TEXT = {
  create: 'engine.action.new', save: 'engine.action.save', cancel: 'engine.action.cancel', edit: 'engine.action.edit', back: 'engine.action.back',
  prev: 'engine.action.prev', next: 'engine.action.next', retry: 'engine.action.retry', empty: 'engine.list.empty', view: 'engine.list.view',
  page: 'engine.list.page', loading: 'engine.loading', yes: 'engine.yes', no: 'engine.no', relatedEmpty: 'engine.related.empty', required: 'engine.form.required',
  errorPrefix: 'engine.error.', unknownError: 'engine.error.UNKNOWN',
} as const;

export const textOf = (model: Pick<EngineUiModel, 'texts'>, key: string): string => model.texts[key] ?? key;
/** The message of an error code; an unknown code gets the general message followed by the code. */
export function errorText(model: Pick<EngineUiModel, 'texts'>, code: string): string {
  return model.texts[`${TEXT.errorPrefix}${code}`] ?? `${textOf(model, TEXT.unknownError)} (${code})`;
}

export const fieldOf = (model: EngineUiModel, key: string): UiField | undefined => model.fields.find(f => f.key === key);

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export interface DisplayOptions { timeZone?: string }
/** A stored value as the user reads it: code labels, yes / no, numbers, dates and date-times in the model's language. */
export function displayValue(model: EngineUiModel, field: UiField | undefined, value: FieldValue | undefined, options: DisplayOptions = {}): string {
  if (value === null || value === undefined || value === '') return '';
  if (!field) return String(value);
  switch (field.type) {
    case 'enum': return field.options?.find(o => o.code === value)?.label ?? String(value);
    case 'boolean': return textOf(model, value ? TEXT.yes : TEXT.no);
    case 'integer': case 'decimal': return typeof value === 'number' ? new Intl.NumberFormat(model.locale, { maximumFractionDigits: 18 }).format(value) : String(value);
    case 'date': {
      // A calendar day has no time zone: it is read and written as UTC so the day never shifts.
      const text = String(value), at = DAY.test(text) ? new Date(`${text}T00:00:00.000Z`) : new Date(NaN);
      if (Number.isNaN(at.getTime())) return text;
      return new Intl.DateTimeFormat(model.locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(at);
    }
    case 'datetime': {
      const at = new Date(String(value));
      if (Number.isNaN(at.getTime())) return String(value);
      return new Intl.DateTimeFormat(model.locale, { dateStyle: 'medium', timeStyle: 'short', ...(options.timeZone ? { timeZone: options.timeZone } : {}) }).format(at);
    }
    default: return String(value);
  }
}

/** Anything a client threw, as a Failure. Reads the usual spellings (status / statusCode, code / errorCode, errors / details). */
export function failureOf(error: unknown): Failure {
  const e = (typeof error === 'object' && error !== null ? error : {}) as Record<string, unknown>;
  const status = [e.status, e.statusCode].find(v => typeof v === 'number') as number | undefined;
  const code = [e.code, e.errorCode].find(v => typeof v === 'string' && v !== '') as string | undefined;
  const list = [e.errors, e.details].find(Array.isArray) as unknown[] | undefined;
  const errors = (list ?? []).filter((x): x is { code: string; field?: unknown } => typeof x === 'object' && x !== null && typeof (x as { code?: unknown }).code === 'string')
    .map(x => (typeof x.field === 'string' ? { code: x.code, field: x.field } : { code: x.code }));
  return { status: status ?? 0, code: code ?? 'UNKNOWN', errors };
}
