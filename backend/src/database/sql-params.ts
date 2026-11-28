// Typed SQL parameters. The mssql driver guesses the legacy DATETIME type for a JavaScript Date (dates before 1753
// fail, milliseconds are rounded to 1/300 s). A date or a date-time therefore travels as a TypedParam, and every place
// that hands parameters to the driver (DatabaseService, scripts/meta-db/db.mjs) binds through bindParams.
//
// A TypedParam reaches the driver as ISO text (NVARCHAR), not as a Date with the DATETIME2 / DATE type: the driver
// (mssql 11 / tedious 18) checks the year of such a Date in the machine's own time zone although it sends UTC, so
// 9999-12-31T23:59:59.999Z was refused (EPARAM "Out of range.") east of UTC and 0001-01-01 west of it. The text
// `YYYY-MM-DDTHH:mm:ss.fff` / `YYYY-MM-DD` means the same on every machine, and SQL Server converts it to the column's
// type (ISO 8601, whatever the session language or date format).
export type SqlParamKind = 'datetime2' | 'date';
export interface TypedParam { readonly sqlParam: SqlParamKind; readonly value: Date | null }
/** The part of the mssql module bindParams needs. */
export interface SqlTypes { NVarChar(length: number): unknown }
export interface ParamSink { input(name: string, ...rest: unknown[]): unknown }

const toDate = (value: Date | string): Date => {
  const at = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(at.getTime())) throw new Error('SQL_PARAM_BAD_DATE');
  return at;
};
/** A date-time parameter: any year from 0001 to 9999 (UTC), exact milliseconds. */
export const dateTimeParam = (value: Date | string | null | undefined): TypedParam =>
  ({ sqlParam: 'datetime2', value: value === null || value === undefined ? null : toDate(value) });
/** A date parameter from `YYYY-MM-DD` (kept as UTC midnight). */
export const dateParam = (value: string | null | undefined): TypedParam =>
  ({ sqlParam: 'date', value: value === null || value === undefined ? null : toDate(`${value.slice(0, 10)}T00:00:00.000Z`) });

export const isTypedParam = (value: unknown): value is TypedParam =>
  typeof value === 'object' && value !== null && !(value instanceof Date)
  && ((value as TypedParam).sqlParam === 'datetime2' || (value as TypedParam).sqlParam === 'date');

const DATE_LENGTH = 10, DATETIME_LENGTH = 23;
/** The text the driver gets: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss.fff` (UTC, no zone suffix), or null. */
export function paramText(param: TypedParam): string | null {
  if (param.value === null) return null;
  const iso = param.value.toISOString();
  // toISOString writes years outside 0000-9999 with a sign and six digits; SQL Server has no such dates.
  if (iso.length !== DATETIME_LENGTH + 1 || iso.startsWith('0000')) throw new Error('SQL_PARAM_BAD_DATE');
  return param.sqlParam === 'date' ? iso.slice(0, DATE_LENGTH) : iso.slice(0, DATETIME_LENGTH);
}

/** Binds every parameter. Only a TypedParam gets an explicit type; any other value is bound as before (driver's guess). */
export function bindParams(request: ParamSink, params: Record<string, unknown>, types: SqlTypes): void {
  for (const [name, value] of Object.entries(params)) {
    if (isTypedParam(value)) request.input(name, types.NVarChar(value.sqlParam === 'date' ? DATE_LENGTH : DATETIME_LENGTH), paramText(value));
    else request.input(name, value);
  }
}
