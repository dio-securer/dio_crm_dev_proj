import type { AccountSummary } from '@dio-crm/contracts';
import { listAccountActivities } from './account-relations-mock';

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
 * Mock-first rule: prefer the newest Account activity stored in the relation repository.
 * Until the API exposes last_activity_at, updated_at remains the fallback timestamp.
 */
export function accountLastActivity(row: AccountSummary): string | undefined {
  const activity = listAccountActivities(row.public_id)[0]?.occurredAt;
  if (!activity) return row.updated_at || undefined;
  if (!row.updated_at) return activity;
  return activity > row.updated_at ? activity : row.updated_at;
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
