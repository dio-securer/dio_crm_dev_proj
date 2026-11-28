// Typed SQL parameters. The mssql driver guesses the legacy DATETIME type for a JavaScript Date (dates before 1753
// fail, milliseconds are rounded to 1/300 s). A date or a date-time therefore travels as a TypedParam, and every place
// that hands parameters to the driver (DatabaseService, scripts/meta-db/db.mjs) binds through bindParams.
export type SqlParamKind = 'datetime2' | 'date';
export interface TypedParam { readonly sqlParam: SqlParamKind; readonly value: Date | null }
/** The part of the mssql module bindParams needs. */
export interface SqlTypes { DateTime2(scale: number): unknown; Date: unknown }
export interface ParamSink { input(name: string, ...rest: unknown[]): unknown }

const toDate = (value: Date | string): Date => {
  const at = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(at.getTime())) throw new Error('SQL_PARAM_BAD_DATE');
  return at;
};
/** A DATETIME2(3) parameter: any year from 0001 to 9999, exact milliseconds. */
export const dateTimeParam = (value: Date | string | null | undefined): TypedParam =>
  ({ sqlParam: 'datetime2', value: value === null || value === undefined ? null : toDate(value) });
/** A DATE parameter from `YYYY-MM-DD` (read as UTC midnight; the driver sends UTC). */
export const dateParam = (value: string | null | undefined): TypedParam =>
  ({ sqlParam: 'date', value: value === null || value === undefined ? null : toDate(`${value.slice(0, 10)}T00:00:00.000Z`) });

export const isTypedParam = (value: unknown): value is TypedParam =>
  typeof value === 'object' && value !== null && !(value instanceof Date)
  && ((value as TypedParam).sqlParam === 'datetime2' || (value as TypedParam).sqlParam === 'date');

/** Binds every parameter. Only a TypedParam gets an explicit type; any other value is bound as before (driver's guess). */
export function bindParams(request: ParamSink, params: Record<string, unknown>, types: SqlTypes): void {
  for (const [name, value] of Object.entries(params)) {
    if (isTypedParam(value)) request.input(name, value.sqlParam === 'date' ? types.Date : types.DateTime2(3), value.value);
    else request.input(name, value);
  }
}
