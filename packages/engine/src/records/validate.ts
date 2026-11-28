// validateWrite: a create or update body against the object's metadata. Pure; every error is reported, not only the first.
import type { FieldDef } from '@dio-crm/contracts/metadata';
import type { RuntimeModel } from '../model';
import type { Actor, RowAccessRule } from '../row-access';
import type { FieldAccessOf } from '../security/permissions';
import { checkValue } from './values';
import { RecordError, RecordValue, WriteCheck, WriteMode } from './types';

/** Fields that some screen of the object shows as read-only. The API refuses to write them (the stricter reading). */
export function readOnlyFields(model: RuntimeModel, objectKey: string): Set<string> {
  const out = new Set<string>();
  for (const screen of model.object(objectKey)?.screens ?? []) {
    for (const f of screen.fields.fields) if (f.readOnly) out.add(model.field(objectKey, f.key)?.key ?? f.key);
  }
  return out;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const isBlank = (v: unknown) => v === null || v === undefined || v === '';

function activeCodes(model: RuntimeModel, field: FieldDef): string[] {
  return field.enumCodeGroup ? model.codeValues(field.enumCodeGroup).filter(c => c.active).map(c => c.code) : [];
}

/** `access` (F2-7): a field the actor may not read is FIELD_FORBIDDEN (its existence is not confirmed), one it may only read is READ_ONLY_FIELD. */
export function validateWrite(model: RuntimeModel, objectKey: string, input: unknown, mode: WriteMode, access?: FieldAccessOf): WriteCheck {
  const object = model.object(objectKey);
  if (!object || !isPlainObject(input)) return { ok: false, errors: [{ code: 'NOT_OBJECT' }] };
  const errors: RecordError[] = [];
  const values: Record<string, RecordValue> = Object.create(null);
  const seen = new Set<string>();
  const readOnly = readOnlyFields(model, objectKey);
  for (const name of Object.keys(input)) {
    const field = model.field(objectKey, name);
    if (!field) { errors.push({ code: 'UNKNOWN_FIELD', field: name }); continue; }
    if (seen.has(field.key)) { errors.push({ code: 'DUPLICATE_FIELD', field: field.key }); continue; }
    seen.add(field.key);
    if (field.system) { errors.push({ code: 'SYSTEM_FIELD', field: field.key }); continue; }
    const allowed = access?.(field.key);
    if (allowed && !allowed.read) { errors.push({ code: 'FIELD_FORBIDDEN', field: name }); continue; }
    if (readOnly.has(field.key) || (allowed && !allowed.edit)) { errors.push({ code: 'READ_ONLY_FIELD', field: field.key }); continue; }
    const raw = input[name];
    if (isBlank(raw)) {
      if (field.required) errors.push({ code: 'REQUIRED', field: field.key }); else values[field.key] = null;
      continue;
    }
    const checked = checkValue(field, raw, activeCodes(model, field));
    if ('error' in checked) errors.push({ code: checked.error, field: field.key }); else values[field.key] = checked.value;
  }
  if (mode === 'create') {
    for (const f of object.object.fields) if (f.required && !f.system && !seen.has(f.key)) errors.push({ code: 'REQUIRED', field: f.key });
  } else if (seen.size === 0 && errors.length === 0) {
    errors.push({ code: 'EMPTY' });
  }
  return errors.length ? { ok: false, errors } : { ok: true, values: { ...values } };
}

/** On create, an applicable `own` rule whose owner field was not sent is filled with the actor, so the creator keeps the row. */
export function withOwnerDefault(rules: readonly RowAccessRule[], actor: Actor, values: Record<string, RecordValue>): Record<string, RecordValue> {
  const out = { ...values };
  for (const rule of rules) {
    if (rule.kind !== 'own' || (rule.permission !== undefined && !actor.permissions.includes(rule.permission))) continue;
    if (out[rule.ownerField] === undefined || out[rule.ownerField] === null) out[rule.ownerField] = actor.userId;
  }
  return out;
}
