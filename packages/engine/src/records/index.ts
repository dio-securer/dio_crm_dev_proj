// Records (F2-4): write checks for the automatic API. The data layer (SQL) is in the backend's database folder.
export { validateWrite, readOnlyFields, withOwnerDefault } from './validate';
export { checkValue } from './values';
export { MANAGED_FIELDS, TEXT_DEFAULT_MAX, CODE_MAX, DECIMAL_DEFAULT } from './types';
export type { RecordValue, RecordError, RecordErrorCode, WriteCheck, WriteMode } from './types';
