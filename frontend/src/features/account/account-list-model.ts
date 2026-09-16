import type { AccountSummary } from '@dio-crm/contracts';

export type AccountLastActivityFilter = 'ALL' | '7' | '30' | 'NONE';

export type AccountListFilters = {
  search: string;
  country: string;
  accountType: string;
  grade: string;
  status: string;
  erpStatus: string;
  lastActivity: AccountLastActivityFilter;
};

export const EMPTY_ACCOUNT_LIST_FILTERS: AccountListFilters = {
  search: '',
  country: 'ALL',
  accountType: 'ALL',
  grade: 'ALL',
  status: 'ALL',
  erpStatus: 'ALL',
  lastActivity: 'ALL'
};

export function accountCountry(row: AccountSummary): string {
  const source = [
    row.address,
    row.address_line1,
    row.address_line2,
    row.hospital_address,
    row.business_no
  ].filter(Boolean).join(' ');

  if (/[가-힣]/.test(source)) return 'KR';
  if (/\b(MX|Mexico|México|S\.L\.P\.|XAXX)\b/i.test(source)) return 'MX';
  if (/\b(USA|United States|US)\b/i.test(source)) return 'US';
  return row.company_code && row.company_code !== 'DIO' ? row.company_code : 'GLOBAL';
}

/**
 * AccountSummary does not yet expose last_activity_at.
 * During the Mock-first phase updated_at is used as the list-level activity proxy.
 * Replace only this helper when the API contract exposes the real activity timestamp.
 */
export function accountLastActivity(row: AccountSummary): string | undefined {
  return row.updated_at || undefined;
}

function matchesLastActivity(value: string | undefined, filter: AccountLastActivityFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'NONE') return !value;
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  const ageDays = (Date.now() - timestamp) / 86400000;
  return ageDays >= 0 && ageDays <= Number(filter);
}

export function filterAccountList(rows: AccountSummary[], filters: AccountListFilters): AccountSummary[] {
  const keyword = filters.search.trim().toLocaleLowerCase();
  return rows
    .filter(row => {
      if (!keyword) return true;
      return [
        row.account_name,
        row.erp_customer_code ?? '',
        row.business_no ?? '',
        row.owner_name ?? '',
        row.phone ?? '',
        accountCountry(row)
      ].some(value => value.toLocaleLowerCase().includes(keyword));
    })
    .filter(row => filters.country === 'ALL' || accountCountry(row) === filters.country)
    .filter(row => filters.accountType === 'ALL' || (row.account_type || '') === filters.accountType)
    .filter(row => filters.grade === 'ALL' || (row.account_grade || 'GENERAL') === filters.grade)
    .filter(row => filters.status === 'ALL' || row.account_status === filters.status)
    .filter(row => filters.erpStatus === 'ALL' || row.integration_status === filters.erpStatus)
    .filter(row => matchesLastActivity(accountLastActivity(row), filters.lastActivity))
    .sort((a, b) => (accountLastActivity(b) ?? '').localeCompare(accountLastActivity(a) ?? ''));
}
