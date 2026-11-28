// Names and column types of the record tables of metadata objects (F2-4). Every SQL identifier the record layer writes
// comes from here: a metadata key checked again against the key pattern, never text from a request.
import type { FieldDef } from '@dio-crm/contracts/metadata';

const KEY = /^[a-z][a-z0-9_]{0,99}$/;
export const OBJECT_TABLE_PREFIX = 'crm_obj_';
/** Columns the record layer owns. Field columns are `f_<key>`, so a field key can never collide with these. */
export const MANAGED_COLUMNS = ['id', 'company_id', 'created_at', 'created_by', 'updated_at', 'updated_by'] as const;
/** System fields served from a managed column instead of a field column. */
export const MANAGED_FIELD_COLUMN: Readonly<Record<string, string>> = { created_at: 'created_at', created_by: 'created_by', updated_at: 'updated_at', updated_by: 'updated_by' };

export function safeKey(key: string): string {
  if (!KEY.test(key)) throw new Error(`CRM_OBJ_BAD_IDENTIFIER ${JSON.stringify(key).slice(0, 40)}`);
  return key;
}
export const tableName = (objectKey: string) => `${OBJECT_TABLE_PREFIX}${safeKey(objectKey)}`;
/** The column of a field: a managed column for the managed system fields, otherwise f_<key>. */
export function columnOf(field: Pick<FieldDef, 'key' | 'system'>): string {
  return field.system && MANAGED_FIELD_COLUMN[field.key] ? MANAGED_FIELD_COLUMN[field.key] : `f_${safeKey(field.key)}`;
}
export const quote = (identifier: string) => `[${identifier.replace(/[^a-z0-9_]/g, '')}]`;

export interface SqlType { dataType: string; text: string; length?: number; precision?: number; scale?: number }
export function sqlTypeOf(field: FieldDef): SqlType {
  switch (field.type) {
    case 'text': { const length = field.maxLength ?? 4000; return { dataType: 'nvarchar', text: `NVARCHAR(${length})`, length }; }
    case 'enum': case 'reference': return { dataType: 'nvarchar', text: 'NVARCHAR(100)', length: 100 };
    case 'integer': return { dataType: 'bigint', text: 'BIGINT' };
    case 'decimal': {
      const precision = field.precision ?? 18, scale = field.scale ?? 4;
      return { dataType: 'decimal', text: `DECIMAL(${precision},${scale})`, precision, scale };
    }
    case 'boolean': return { dataType: 'bit', text: 'BIT' };
    case 'date': return { dataType: 'date', text: 'DATE' };
    case 'datetime': return { dataType: 'datetime2', text: 'DATETIME2(3)' };
    default: throw new Error(`CRM_OBJ_UNKNOWN_TYPE ${field.type}`);
  }
}

/** Fields that have their own column (every field except the managed system fields). */
export const fieldColumns = (fields: readonly FieldDef[]) => fields.filter(f => columnOf(f).startsWith('f_'));
