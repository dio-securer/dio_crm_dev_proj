export type DateRange = { from: string; to: string };

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function previousMonthRange(now = new Date()): DateRange {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));
  return { from: isoDate(first), to: isoDate(last) };
}

export function validateStatementRange(from: string, to: string) {
  const min = '2018-01-01';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { allowed: false as const, error: 'Date range must use YYYY-MM-DD' };
  }
  if (from < min) return { allowed: false as const, error: 'Statement start date cannot be earlier than 2018-01-01' };
  if (to < from) return { allowed: false as const, error: 'Statement end date must be on or after start date' };
  return { allowed: true as const };
}

export function statementFilename(periodTo: string, contractNo?: string | null, general = false) {
  const ym = /^\d{4}-\d{2}/.test(periodTo) ? periodTo.slice(0, 7) : 'unknown';
  const raw = general ? 'GENERAL' : (contractNo || 'CONTRACT');
  const safe = raw.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 80);
  return `${ym}_월합_거래명세서_${safe}.pdf`;
}

export function ledgerFilename(accountName: string, contractNo?: string | null, general = false) {
  const scope = general ? 'GENERAL' : (contractNo || 'CONTRACT');
  const safeAccount = accountName.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 80);
  const safeScope = scope.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 80);
  return `${safeAccount}_패키지원장_${safeScope}.xlsx`;
}
