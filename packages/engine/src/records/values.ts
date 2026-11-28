// One value against one field type. Returns the normalised value or the error code; null is handled by the caller.
import type { FieldDef } from '@dio-crm/contracts/metadata';
import { CODE_MAX, DECIMAL_DEFAULT, RecordErrorCode, RecordValue, TEXT_DEFAULT_MAX } from './types';

type Checked = { value: RecordValue } | { error: RecordErrorCode };
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

function realDate(text: string): boolean {
  const m = DATE.exec(text);
  if (!m) return false;
  // Years 0001-9999 only (what DATE and DATETIME2 hold). setUTCFullYear, because Date.UTC reads years 0-99 as 1900-1999.
  if (Number(m[1]) < 1) return false;
  const d = new Date(0);
  d.setUTCFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

function text(value: unknown, max: number): Checked {
  if (typeof value !== 'string') return { error: 'TYPE' };
  return value.length > max ? { error: 'TOO_LONG' } : { value };
}

function decimal(value: unknown, field: FieldDef): Checked {
  if (typeof value !== 'number' || !Number.isFinite(value)) return { error: 'TYPE' };
  const precision = field.precision ?? DECIMAL_DEFAULT.precision;
  const scale = field.scale ?? DECIMAL_DEFAULT.scale;
  const scaled = value * 10 ** scale;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-6 * Math.max(1, Math.abs(scaled))) return { error: 'OUT_OF_RANGE' };
  return Math.abs(value) >= 10 ** (precision - scale) ? { error: 'OUT_OF_RANGE' } : { value };
}

/** `activeCodes` are the active codes of the field's enum code group. */
export function checkValue(field: FieldDef, value: unknown, activeCodes: readonly string[]): Checked {
  switch (field.type) {
    case 'text': return text(value, field.maxLength ?? TEXT_DEFAULT_MAX);
    case 'reference': return text(value, CODE_MAX);
    case 'integer': return typeof value === 'number' && Number.isSafeInteger(value) ? { value } : { error: 'TYPE' };
    case 'decimal': return decimal(value, field);
    case 'boolean': return typeof value === 'boolean' ? { value } : { error: 'TYPE' };
    case 'date': return typeof value === 'string' && realDate(value) ? { value } : { error: 'TYPE' };
    case 'datetime': {
      if (typeof value !== 'string' || !DATETIME.test(value) || !realDate(value.slice(0, 10))) return { error: 'TYPE' };
      const at = new Date(value);
      // After the move to UTC the year must still be 0001-9999 (0001-01-01T00:00+01:00 is the year 0000 in UTC).
      if (Number.isNaN(at.getTime()) || at.getUTCFullYear() < 1 || at.getUTCFullYear() > 9999) return { error: 'TYPE' };
      return { value: at.toISOString() };
    }
    case 'enum':
      if (typeof value !== 'string') return { error: 'TYPE' };
      return activeCodes.includes(value) ? { value } : { error: 'BAD_ENUM' };
    default: return { error: 'TYPE' };
  }
}
