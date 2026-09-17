import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AccountSummary } from '@dio-crm/contracts';
import { accountTypeName } from '@dio-crm/contracts';
import type { AccountScope } from '../../account-model';
import {
  AbDataList,
  AbEmptyState,
  AbListToolbar,
  AbPagination,
  AbWorkspace,
  countryFlag,
  type AbDataColumn
} from '../../ui/ab-workspace';
import {
  EMPTY_ACCOUNT_LIST_FILTERS,
  accountCountry,
  accountLastActivity,
  filterAccountList,
  type AccountLastActivityFilter,
  type AccountListFilters
} from './account-list-model';
import { loadAccountListState, saveAccountListState } from './account-view-state';
import '../../styles/account-list-workspace.css';

type Props = {
  rows: AccountSummary[];
  loading?: boolean;
  selectedId?: string | null;
  scope: AccountScope;
  onScopeChange: (scope: AccountScope) => void;
  onSelect: (row: AccountSummary) => void;
  detail: React.ReactNode;
  stateStorageKey?: string;
};

function formatDate(value: string | undefined, locale: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function statusTone(status: string) {
  if (status === 'ACTIVE' || status === 'NEW') return 'success';
  if (status === 'CHURN_RISK' || status === 'NON_TRADING_OPP') return 'warning';
  if (status === 'CHURNED' || status === 'CLOSED') return 'danger';
  return 'neutral';
}

function erpTone(status: string) {
  if (status === 'SUCCESS') return 'success';
  if (status === 'REQUESTING' || status === 'REVIEWING') return 'warning';
  if (status === 'FAILED') return 'danger';
  return 'neutral';
}

export function AccountListPanel({ rows, loading = false, selectedId, scope, onScopeChange, onSelect, detail, stateStorageKey }: Props) {
  const { t, i18n } = useTranslation();
  const initialState = React.useMemo(() => loadAccountListState(stateStorageKey), [stateStorageKey]);
  const [filters, setFilters] = useState<AccountListFilters>(() => ({ ...initialState.filters }));
  const [page, setPage] = useState(initialState.page);
  const [pageSize, setPageSize] = useState(initialState.pageSize);
  const scrollTopRef = useRef(initialState.scrollTop);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const countries = useMemo(() => [...new Set(rows.map(accountCountry))].sort(), [rows]);
  const types = useMemo(() => [...new Set(rows.map(row => row.account_type).filter((value): value is string => Boolean(value)))].sort(), [rows]);
  const grades = useMemo(() => [...new Set(rows.map(row => row.account_grade || 'GENERAL'))].sort(), [rows]);
  const statuses = useMemo(() => [...new Set(rows.map(row => row.account_status))].sort(), [rows]);
  const erpStatuses = useMemo(() => [...new Set(rows.map(row => row.integration_status))].sort(), [rows]);

  const filteredRows = useMemo(() => filterAccountList(rows, filters), [rows, filters]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const persist = React.useCallback((next?: Partial<{ filters: AccountListFilters; page: number; pageSize: number; scrollTop: number }>) => {
    saveAccountListState(stateStorageKey, {
      filters: next?.filters ?? filters,
      page: next?.page ?? page,
      pageSize: next?.pageSize ?? pageSize,
      scrollTop: next?.scrollTop ?? scrollTopRef.current
    });
  }, [filters, page, pageSize, stateStorageKey]);

  React.useEffect(() => {
    persist();
  }, [filters, page, pageSize, persist]);

  React.useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = scrollTopRef.current;
  }, [scope, currentPage]);

  React.useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);

  const setFilter = <K extends keyof AccountListFilters>(key: K, value: AccountListFilters[K]) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    setPage(1);
    scrollTopRef.current = 0;
    persist({ filters: next, page: 1, scrollTop: 0 });
  };

  const resetFilters = () => {
    const next = { ...EMPTY_ACCOUNT_LIST_FILTERS };
    setFilters(next);
    setPage(1);
    scrollTopRef.current = 0;
    persist({ filters: next, page: 1, scrollTop: 0 });
  };

  const columns: AbDataColumn[] = [
    { key: 'account', label: t('account.columns.accountName'), width: 'minmax(170px,1.55fr)', mobileRole: 'primary', className: 'primary-cell' },
    { key: 'country', label: t('account.columns.country'), width: '76px', mobileRole: 'hide' },
    { key: 'type', label: t('account.columns.type'), width: '94px', mobileRole: 'hide' },
    { key: 'grade', label: t('account.columns.grade'), width: '66px', mobileRole: 'hide' },
    { key: 'status', label: t('account.columns.status'), width: '88px', mobileRole: 'hide' },
    { key: 'owner', label: t('account.columns.owner'), width: '86px', mobileRole: 'hide' },
    { key: 'activity', label: t('account.columns.lastActivity'), width: '88px', mobileRole: 'hide' },
    { key: 'erp', label: t('account.columns.erpStatus'), width: '92px', mobileRole: 'badge' }
  ];

  const list = <>
    <div className="lead-v2-list-header"><div><strong>{t('account.listTitle')}</strong><span>{t('account.count', { count: filteredRows.length })}</span></div></div>
    {loading ? <AbEmptyState tone="loading" title={t('common.loading')} /> : (
      <AbDataList
        columns={columns}
        rows={pagedRows}
        rowKey={row => row.public_id}
        selectedKey={selectedId ?? undefined}
        onRowClick={onSelect}
        ariaLabel={t('account.listTitle')}
        bodyRef={bodyRef}
        onBodyScroll={event => {
          scrollTopRef.current = event.currentTarget.scrollTop;
          persist({ scrollTop: scrollTopRef.current });
        }}
        empty={<AbEmptyState title={filters.search ? t('account.empty.search') : t('account.empty.list')} />}
        renderCells={row => {
          const country = accountCountry(row);
          const lastActivity = accountLastActivity(row);
          const accountType = accountTypeName(row.account_type) || row.account_type || '-';
          const accountStatus = t(`account.statuses.${row.account_status}`, { defaultValue: row.account_status });
          const accountCode = row.erp_customer_code || row.business_no || '-';
          return [
            <span className="account-card-primary" title={`${row.account_name} · ${row.erp_customer_code || row.business_no || row.public_id}`}>
              <strong className="account-card-name">{row.account_name}</strong>
              <span className="account-card-contact-line">
                <span>{row.phone || '-'}</span>
                <span className="account-mobile-dot">·</span>
                <span>{row.owner_name ?? '-'}</span>
                <span className="account-mobile-dot">·</span>
                <span>{formatDate(lastActivity, i18n.language)}</span>
              </span>
              <small className="account-card-desktop-code">{accountCode}</small>
              <em className="account-card-desktop-id">{row.business_no || row.public_id}</em>
            </span>,
            <span className="ab-list-country"><i>{countryFlag(country)}</i>{country}</span>,
            <span title={row.account_type || ''}>{accountType}</span>,
            <span>{t(`account.grades.${row.account_grade || 'GENERAL'}`, { defaultValue: row.account_grade || '-' })}</span>,
            <span className={`account-list-pill tone-${statusTone(row.account_status)}`}>{accountStatus}</span>,
            <span>{row.owner_name ?? '-'}</span>,
            <span>{formatDate(lastActivity, i18n.language)}</span>,
            <span className={`account-list-pill tone-${erpTone(row.integration_status)}`}>{t(`account.integrationStatus.${row.integration_status}`, { defaultValue: row.integration_status })}</span>
          ];
        }}
      />
    )}
    <AbPagination
      page={currentPage}
      pageSize={pageSize}
      totalItems={filteredRows.length}
      onPageChange={value => { setPage(value); scrollTopRef.current = 0; persist({ page: value, scrollTop: 0 }); }}
      onPageSizeChange={size => { setPageSize(size); setPage(1); scrollTopRef.current = 0; persist({ pageSize: size, page: 1, scrollTop: 0 }); }}
      rowsPerPageLabel={t('account.pagination.rowsPerPage')}
      previousLabel={t('account.pagination.previous')}
      nextLabel={t('account.pagination.next')}
      pageStatus={t('account.pagination.pageStatus', { page: currentPage, pages: totalPages, count: filteredRows.length })}
    />
  </>;

  return (
    <>
      <div className="lead-v2-filter-tabs account-scope-tabs">
        {(['managed', 'mine', 'all'] as AccountScope[]).map(value => (
          <button type="button" key={value} className={scope === value ? 'active' : ''} onClick={() => onScopeChange(value)}>{t(`account.filters.${value}`)}</button>
        ))}
      </div>
      <AbListToolbar
        searchValue={filters.search}
        onSearchChange={value => setFilter('search', value)}
        searchPlaceholder={t('account.searchPlaceholder')}
        onReset={resetFilters}
        resetLabel={t('account.filters.reset')}
        resultSummary={t('account.count', { count: filteredRows.length })}
        filters={<>
          <select value={filters.country} onChange={event => setFilter('country', event.target.value)}><option value="ALL">{t('account.filters.allCountry')}</option>{countries.map(country => <option key={country} value={country}>{country}</option>)}</select>
          <select value={filters.accountType} onChange={event => setFilter('accountType', event.target.value)}><option value="ALL">{t('account.filters.allType')}</option>{types.map(type => <option key={type} value={type}>{accountTypeName(type) || type}</option>)}</select>
          <select value={filters.grade} onChange={event => setFilter('grade', event.target.value)}><option value="ALL">{t('account.filters.allGrade')}</option>{grades.map(grade => <option key={grade} value={grade}>{t(`account.grades.${grade}`, { defaultValue: grade })}</option>)}</select>
          <select value={filters.status} onChange={event => setFilter('status', event.target.value)}><option value="ALL">{t('account.filters.allStatus')}</option>{statuses.map(status => <option key={status} value={status}>{t(`account.statuses.${status}`, { defaultValue: status })}</option>)}</select>
          <select value={filters.erpStatus} onChange={event => setFilter('erpStatus', event.target.value)}><option value="ALL">{t('account.filters.allErp')}</option>{erpStatuses.map(status => <option key={status} value={status}>{t(`account.integrationStatus.${status}`, { defaultValue: status })}</option>)}</select>
          <select value={filters.lastActivity} onChange={event => setFilter('lastActivity', event.target.value as AccountLastActivityFilter)}><option value="ALL">{t('account.filters.allLastActivity')}</option><option value="7">{t('account.filters.last7Days')}</option><option value="30">{t('account.filters.last30Days')}</option><option value="NONE">{t('account.filters.noActivity')}</option></select>
        </>}
      />
      <AbWorkspace list={list} detail={detail} />
    </>
  );
}
