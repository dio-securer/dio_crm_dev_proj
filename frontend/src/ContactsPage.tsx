import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listSandboxAccounts } from './account-sandbox';
import { AccountActivityQuickAdd } from './features/account/AccountActivityQuickAdd';
import { addAccountContact, listAccountActivities, listAccountContacts, type AccountMockContact } from './features/account/account-relations-mock';
import {
  AbActivityTimeline,
  AbDataList,
  AbDetailHeader,
  AbEmptyState,
  AbEntityBadges,
  AbInfoGrid,
  AbListToolbar,
  AbMobileFab,
  AbPagination,
  AbQuickActions,
  AbQuickCreate,
  AbWorkspace,
  type AbDataColumn
} from './ui/ab-workspace';
import './styles/lead-workspace.css';
import './styles/entity-workspaces.css';

type ContactRow = AccountMockContact & { accountName: string; ownerName: string };

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function ContactsPage() {
  const { t, i18n } = useTranslation();
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [draft, setDraft] = useState({ accountId: '', name: '', role: '', phone: '', email: '' });
  const [message, setMessage] = useState('');

  const accounts = useMemo(() => listSandboxAccounts('', 'all'), [tick]);
  const rows = useMemo<ContactRow[]>(() => accounts.flatMap(account => listAccountContacts(account.public_id).map(contact => ({
    ...contact,
    accountName: account.account_name,
    ownerName: account.owner_name ?? '-'
  }))), [accounts, tick]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return rows.filter(row => accountFilter === 'ALL' || row.accountId === accountFilter)
      .filter(row => sourceFilter === 'ALL' || row.source === sourceFilter)
      .filter(row => !q || [row.name, row.accountName, row.role, row.phone ?? '', row.email ?? ''].some(value => value.toLocaleLowerCase().includes(q)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [rows, search, accountFilter, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = rows.find(row => row.id === selectedId) ?? null;
  const selectedAccount = selected ? accounts.find(row => row.public_id === selected.accountId) ?? null : null;
  const activities = selected ? listAccountActivities(selected.accountId) : [];

  const columns: AbDataColumn[] = [
    { key: 'name', label: t('contactWorkspace.name'), width: 'minmax(150px,1.35fr)', mobileRole: 'primary' },
    { key: 'account', label: t('contactWorkspace.account'), width: 'minmax(150px,1.2fr)' },
    { key: 'role', label: t('contactWorkspace.role'), width: '100px' },
    { key: 'phone', label: t('contactWorkspace.phone'), width: '120px' },
    { key: 'source', label: t('contactWorkspace.source'), width: '90px', mobileRole: 'badge' }
  ];

  const reset = () => { setSearch(''); setAccountFilter('ALL'); setSourceFilter('ALL'); setPage(1); };
  const select = (row: ContactRow) => { setSelectedId(row.id); setMobileDetailOpen(true); };
  const create = () => {
    if (!draft.accountId || !draft.name.trim()) { setMessage(t('contactWorkspace.required')); return; }
    const created = addAccountContact(draft.accountId, { name: draft.name, role: draft.role, phone: draft.phone, email: draft.email });
    setTick(value => value + 1);
    setSelectedId(created.id);
    setMobileDetailOpen(true);
    setQuickOpen(false);
    setDraft({ accountId: '', name: '', role: '', phone: '', email: '' });
    setMessage(t('contactWorkspace.created'));
  };

  const list = <>
    <div className="lead-v2-list-header"><div><strong>{t('contactWorkspace.listTitle')}</strong><span>{t('contactWorkspace.count', { count: filtered.length })}</span></div></div>
    <AbDataList
      columns={columns}
      rows={paged}
      rowKey={row => row.id}
      selectedKey={selectedId ?? undefined}
      onRowClick={select}
      ariaLabel={t('contactWorkspace.listTitle')}
      empty={<AbEmptyState title={t('contactWorkspace.empty')} />}
      renderCells={row => [
        <span className="ab-primary-stack"><strong>{row.name}</strong><small>{row.email || row.phone || '-'}</small></span>,
        <span>{row.accountName}</span>,
        <span>{row.role || '-'}</span>,
        <span>{row.phone || '-'}</span>,
        <span className="account-list-pill tone-neutral">{row.source === 'LEAD_CONVERSION' ? t('contactWorkspace.leadConversion') : t('contactWorkspace.manual')}</span>
      ]}
    />
    <AbPagination page={currentPage} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} rowsPerPageLabel={t('account.pagination.rowsPerPage')} previousLabel={t('account.pagination.previous')} nextLabel={t('account.pagination.next')} pageStatus={t('account.pagination.pageStatus', { page: currentPage, pages: totalPages, count: filtered.length })} />
  </>;

  const detail = <article className="lead-v2-detail-pane">
    {!selected && <div className="lead-v2-empty-detail">{t('contactWorkspace.select')}</div>}
    {selected && <>
      <button type="button" className="lead-v2-mobile-back" onClick={() => setMobileDetailOpen(false)}>← {t('account.back')}</button>
      <AbDetailHeader
        eyebrow={selected.id}
        title={selected.name}
        subtitle={selected.accountName}
        badges={<AbEntityBadges badges={[{ label: selected.source === 'LEAD_CONVERSION' ? t('contactWorkspace.leadConversion') : t('contactWorkspace.manual'), tone: selected.source === 'LEAD_CONVERSION' ? 'info' : 'neutral' }]} />}
        meta={<div className="ab-detail-meta-list">
          <div className="ab-detail-meta-item"><span>{t('contactWorkspace.role')}</span><strong>{selected.role || '-'}</strong></div>
          <div className="ab-detail-meta-item"><span>{t('contactWorkspace.phone')}</span><strong>{selected.phone || '-'}</strong></div>
          <div className="ab-detail-meta-item"><span>{t('contactWorkspace.email')}</span><strong>{selected.email || '-'}</strong></div>
          <div className="ab-detail-meta-item"><span>{t('contactWorkspace.createdAt')}</span><strong>{formatDate(selected.createdAt, i18n.language)}</strong></div>
        </div>}
        actions={<AbQuickActions actions={[
          { id: 'call', label: t('account.actions.call'), icon: '☎', href: selected.phone ? `tel:${selected.phone}` : undefined, disabled: !selected.phone },
          { id: 'email', label: t('account.actions.email'), icon: '✉', href: selected.email ? `mailto:${selected.email}` : undefined, disabled: !selected.email },
          { id: 'activity', label: t('contactWorkspace.addActivity'), icon: '＋', onClick: () => setActivityOpen(true), tone: 'primary' }
        ]} />}
      />
      <div className="lead-v2-detail-content entity-detail-stack">
        <AbInfoGrid columns={2} items={[
          { label: t('contactWorkspace.account'), value: selected.accountName },
          { label: t('account.owner'), value: selectedAccount?.owner_name ?? '-' },
          { label: t('contactWorkspace.phone'), value: selected.phone || '-' },
          { label: t('contactWorkspace.email'), value: selected.email || '-' }
        ]} />
        <div className="entity-section-card"><div className="entity-section-title"><strong>{t('contactWorkspace.activity')}</strong><small>{t('contactWorkspace.accountActivityHint')}</small></div><AbActivityTimeline items={activities.slice(0, 8).map(item => ({ id: item.id, typeLabel: t(`account.activityTypes.${item.type}`), timeLabel: formatDate(item.occurredAt, i18n.language), title: item.subject, summary: item.note || undefined, owner: item.ownerName }))} empty={<AbEmptyState title={t('activityWorkspace.empty')} />} /></div>
      </div>
    </>}
  </article>;

  return <section className={`lead-v2 ab-workspace${mobileDetailOpen ? ' mobile-detail-open' : ''}`}>
    <header className="lead-v2-page-header"><div><div className="lead-v2-title-line"><span className="lead-v2-kicker">CRM · CONTACT</span></div><h2>{t('contactWorkspace.title')}</h2><p>{t('contactWorkspace.subtitle')}</p></div><div className="lead-v2-header-actions"><button type="button" className="lead-v2-button primary" onClick={() => setQuickOpen(true)}>+ {t('contactWorkspace.new')}</button></div></header>
    <AbListToolbar searchValue={search} onSearchChange={value => { setSearch(value); setPage(1); }} searchPlaceholder={t('contactWorkspace.searchPlaceholder')} onReset={reset} resetLabel={t('account.filters.reset')} resultSummary={t('contactWorkspace.count', { count: filtered.length })} filters={<><select value={accountFilter} onChange={event => { setAccountFilter(event.target.value); setPage(1); }}><option value="ALL">{t('contactWorkspace.allAccounts')}</option>{accounts.map(account => <option key={account.public_id} value={account.public_id}>{account.account_name}</option>)}</select><select value={sourceFilter} onChange={event => { setSourceFilter(event.target.value); setPage(1); }}><option value="ALL">{t('contactWorkspace.allSources')}</option><option value="MANUAL">{t('contactWorkspace.manual')}</option><option value="LEAD_CONVERSION">{t('contactWorkspace.leadConversion')}</option></select></>} />
    <AbWorkspace list={list} detail={detail} />
    <AbMobileFab label={t('contactWorkspace.new')} onClick={() => setQuickOpen(true)} />
    <AbQuickCreate open={quickOpen} title={t('contactWorkspace.quickTitle')} help={t('contactWorkspace.quickHelp')} closeLabel={t('app.close')} onClose={() => setQuickOpen(false)} footer={<div className="lead-v2-drawer-actions"><button type="button" className="lead-v2-button ghost" onClick={() => setQuickOpen(false)}>{t('common.cancel')}</button><button type="button" className="lead-v2-button primary" onClick={create}>{t('common.save')}</button></div>}><div className="lead-v2-form"><label><span>{t('contactWorkspace.account')} *</span><select value={draft.accountId} onChange={event => setDraft(previous => ({ ...previous, accountId: event.target.value }))}><option value="">{t('common.selectNone')}</option>{accounts.map(account => <option key={account.public_id} value={account.public_id}>{account.account_name}</option>)}</select></label><label><span>{t('contactWorkspace.name')} *</span><input value={draft.name} onChange={event => setDraft(previous => ({ ...previous, name: event.target.value }))} /></label><label><span>{t('contactWorkspace.role')}</span><input value={draft.role} onChange={event => setDraft(previous => ({ ...previous, role: event.target.value }))} /></label><label><span>{t('contactWorkspace.phone')}</span><input value={draft.phone} onChange={event => setDraft(previous => ({ ...previous, phone: event.target.value }))} /></label><label><span>{t('contactWorkspace.email')}</span><input value={draft.email} onChange={event => setDraft(previous => ({ ...previous, email: event.target.value }))} /></label></div></AbQuickCreate>
    {selected && <AccountActivityQuickAdd open={activityOpen} accountId={selected.accountId} ownerName={selectedAccount?.owner_name ?? '-'} onClose={() => setActivityOpen(false)} onSaved={() => setTick(value => value + 1)} />}
    {message && <div className="lead-v2-toast" role="status">✓ {message}</div>}
  </section>;
}
