// Records of metadata objects (F2-4): the shapes shared by the write checks and the data layer. No IO here.
export type RecordValue = string | number | boolean | null;
export type WriteMode = 'create' | 'update';

export type RecordErrorCode =
  | 'NOT_OBJECT' | 'EMPTY' | 'UNKNOWN_FIELD' | 'DUPLICATE_FIELD' | 'SYSTEM_FIELD' | 'READ_ONLY_FIELD'
  | 'FIELD_FORBIDDEN' | 'REQUIRED' | 'TYPE' | 'TOO_LONG' | 'OUT_OF_RANGE' | 'BAD_ENUM';
export interface RecordError { code: RecordErrorCode; field?: string }

export type WriteCheck =
  | { ok: true; values: Record<string, RecordValue> }
  | { ok: false; errors: RecordError[] };

/** System fields the data layer fills itself; every other system field is never written through the API. */
export const MANAGED_FIELDS: readonly string[] = ['created_at', 'created_by', 'updated_at', 'updated_by'];
export const TEXT_DEFAULT_MAX = 4000;
export const CODE_MAX = 100;
export { DECIMAL_DEFAULT } from '@dio-crm/contracts/metadata';
