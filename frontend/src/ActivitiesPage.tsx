import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addUnifiedActivity,
  listUnifiedActivities,
  listUnifiedActivityTargets,
  type UnifiedActivity,
  type UnifiedActivitySource,
  type UnifiedActivityType
} from './features/activity/activity-workspace-mock';
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
  AbQuickCreate,
  AbWorkspace,
  type AbDataColumn
} from './ui/ab-workspace';
import './styles/lead-workspace.css';
import './styles/entity-workspaces.css';

const ACTIVITY_TYPES: UnifiedActivityType[] = ['CALL', 'EMAIL', 'MEETING', 'VISIT', 'NOTE'];

type DateFilter = 'ALL' | 'TODAY' | '7';

function localDateTimeValue(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

function matchesDate(value: string, filter: DateFilter) {
  if (filter === 'ALL') return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (filter === 'TODAY') return date.toDateString() === now.toDateString();
  return now.getTime() - date.getTime() <= 7 * 86400000;
}

export function ActivitiesPage() {
  const { t, i18n } = useTranslation();
  const [tick, setTick] = useState(0);
  const [sourceFilter, setSourceFilter] = useState<'ALL' | UnifiedActivitySource>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | UnifiedActivityType>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState({ source: 'ACCOUNT' as UnifiedActivitySource, targetId: '', type: 'CALL' as UnifiedActivityType, occurredAt: localDateTimeValue(), subject: '', note: '' });

  const targets = useMemo(() => listUnifiedActivityTargets(), [tick]);
  const rows = useMemo(() => listUnifiedActivities(), [tick]);
  const selected = rows.find(row => row.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return rows
      .filter(row => sourceFilter === 'ALL' || row.source === sourceFilter)
      .filter(row => typeFilter === 'ALL' || row.type === typeFilter)
      .filter(row => matchesDate(row.occurredAt, dateFilter))
      .filter(row => !q || [row.targetName, row.subject, row.ownerName, row.note || ''].some(value => value.toLocaleLowerCase().includes(q)));
  }, [rows, sourceFilter, typeFilter, dateFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const availableTargets = targets.filter(target => target.source === draft.source);

  const columns: AbDataColumn[] = [
    { key: 'subject', label: t('activityWorkspace.subject'), width: 'minmax(180px,1.5fr)', mobileRole: 'primary' },
    { key: 'target', label: t('activityWorkspace.target'), width: 'minmax(140px,1.1fr)' },
    { key: 'source', label: t('activityWorkspace.source'), width: '86px', mobileRole: 'badge' },
    { key: 'type', label: t('activityWorkspace.type'), width: '80px' },
    { key: 'owner', label: t('activityWorkspace.owner'), width: '90px' },
    { key: 'date', label: t('activityWorkspace.occurredAt'), width: '128px' }
  ];

  const select = (row: UnifiedActivity) => {
    setSelectedId(row.id);
    setMobileDetailOpen(true);
  };

  const reset = () => {
    setSearch(''); setSourceFilter('ALL'); setTypeFilter('ALL'); setDateFilter('ALL'); setPage(1);
  };

  const create = () => {
    if (!draft.targetId || !draft.subject.trim()) {
      setMessage(t('activityWorkspace.required'));
      return;
    }
    try {
      const created = addUnifiedActivity({
        source: draft.source,
        targetId: draft.targetId,
        type: draft.type,
        subject: draft.subject,
        note: draft.note,
        occurredAt: new Date(draft.occurredAt).toISOString()
      });
      setTick(value => value + 1);
      setSelectedId(created.id);
      setMobileDetailOpen(true);
      setQuickOpen(false);
      setDraft({ source: draft.source, targetId: '', type: 'CALL', occurredAt: localDateTimeValue(), subject: '', note: '' });
      setMessage(t('activityWorkspace.created'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const list = <>
    <div className="lead-v2-list-header"><div><strong>{t('activityWorkspace.listTitle')}</strong><span>{t('activityWorkspace.count', { count: filtered.length })}</span></div></div>
    <AbDataList
      columns={columns}
      rows={paged}
      rowKey={row => row.id}
      selectedKey={selectedId ?? undefined}
      onRowClick={select}
      ariaLabel={t('activityWorkspace.listTitle')}
      empty={<AbEmptyState title={t('activityWorkspace.empty')} />}
      renderCells={row => [
        <span className="ab-primary-stack"><strong>{row.subject}</strong><small>{row.note || '-'}</small></span>,
        <span>{row.targetName}</span>,
        <span className={`account-list-pill tone-${row.source === 'LEAD' ? 'info' : 'neutral'}`}>{row.source === 'LEAD' ? t('activityWorkspace.lead') : t('activityWorkspace.account')}</span>,
        <span>{t(`account.activityTypes.${row.type}`)}</span>,
        <span>{row.ownerName}</span>,
        <span>{formatDateTime(row.occurredAt, i18n.language)}</span>
      ]}
    />
    <AbPagination page={currentPage} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} rowsPerPageLabel={t('account.pagination.rowsPerPage')} previousLabel={t('account.pagination.previous')} nextLabel={t('account.pagination.next')} pageStatus={t('account.pagination.pageStatus', { page: currentPage, pages: totalPages, count: filtered.length })} />
  </>;

  const detail = <article className="lead-v2-detail-pane">
    {!selected && <div className="lead-v2-empty-detail">{t('activityWorkspace.select')}</div>}
    {selected && <>
      <button type="button" className="lead-v2-mobile-back" onClick={() => setMobileDetailOpen(false)}>← {t('account.back')}</button>
      <AbDetailHeader
        eyebrow={selected.id}
        title={selected.subject}
        subtitle={selected.targetName}
        badges={<AbEntityBadges badges={[
          { label: selected.source === 'LEAD' ? t('activityWorkspace.sourceLead') : t('activityWorkspace.sourceAccount'), tone: selected.source === 'LEAD' ? 'info' : 'neutral' },
          { label: t(`account.activityTypes.${selected.type}`), tone: 'success' }
        ]} />}
        meta={<div className="ab-detail-meta-list">
          <div className="ab-detail-meta-item"><span>{t('activityWorkspace.target')}</span><strong>{selected.targetName}</strong></div>
          <div className="ab-detail-meta-item"><span>{t('activityWorkspace.owner')}</span><strong>{selected.ownerName}</strong></div>
          <div className="ab-detail-meta-item"><span>{t('activityWorkspace.occurredAt')}</span><strong>{formatDateTime(selected.occurredAt, i18n.language)}</strong></div>
          <div className="ab-detail-meta-item"><span>{t('activityWorkspace.type')}</span><strong>{t(`account.activityTypes.${selected.type}`)}</strong></div>
        </div>}
      />
      <div className="lead-v2-detail-content entity-detail-stack">
        <AbInfoGrid columns={2} items={[
          { label: t('activityWorkspace.source'), value: selected.source === 'LEAD' ? t('activityWorkspace.lead') : t('activityWorkspace.account') },
          { label: t('activityWorkspace.target'), value: selected.targetName },
          { label: t('activityWorkspace.owner'), value: selected.ownerName },
          { label: t('activityWorkspace.occurredAt'), value: formatDateTime(selected.occurredAt, i18n.language) }
        ]} />
        <div className="entity-section-card"><div className="entity-section-title"><strong>{t('activityWorkspace.note')}</strong></div><p>{selected.note || '-'}</p></div>
        <div className="entity-section-card"><div className="entity-section-title"><strong>{t('activityWorkspace.timelineSection')}</strong></div><AbActivityTimeline items={rows.filter(row => row.source === selected.source && row.targetId === selected.targetId).slice(0, 10).map(row => ({ id: row.id, typeLabel: t(`account.activityTypes.${row.type}`), timeLabel: formatDateTime(row.occurredAt, i18n.language), title: row.subject, summary: row.note || undefined, owner: row.ownerName }))} /></div>
      </div>
    </>}
  </article>;

  return <section className={`lead-v2 ab-workspace${mobileDetailOpen ? ' mobile-detail-open' : ''}`}>
    <header className="lead-v2-page-header"><div><div className="lead-v2-title-line"><span className="lead-v2-kicker">CRM · ACTIVITY</span></div><h2>{t('activityWorkspace.title')}</h2><p>{t('activityWorkspace.subtitle')}</p></div><div className="lead-v2-header-actions"><button type="button" className="lead-v2-button primary" onClick={() => setQuickOpen(true)}>+ {t('activityWorkspace.new')}</button></div></header>
    <div className="entity-toolbar-tabs">{(['ALL', 'LEAD', 'ACCOUNT'] as const).map(source => <button type="button" key={source} className={`lead-v2-button secondary${sourceFilter === source ? ' active' : ''}`} onClick={() => { setSourceFilter(source); setPage(1); }}>{source === 'ALL' ? t('activityWorkspace.all') : source === 'LEAD' ? t('activityWorkspace.lead') : t('activityWorkspace.account')}</button>)}</div>
    <AbListToolbar searchValue={search} onSearchChange={value => { setSearch(value); setPage(1); }} searchPlaceholder={t('activityWorkspace.searchPlaceholder')} onReset={reset} resetLabel={t('account.filters.reset')} resultSummary={t('activityWorkspace.count', { count: filtered.length })} filters={<><select value={typeFilter} onChange={event => { setTypeFilter(event.target.value as 'ALL' | UnifiedActivityType); setPage(1); }}><option value="ALL">{t('activityWorkspace.allTypes')}</option>{ACTIVITY_TYPES.map(type => <option key={type} value={type}>{t(`account.activityTypes.${type}`)}</option>)}</select><select value={dateFilter} onChange={event => { setDateFilter(event.target.value as DateFilter); setPage(1); }}><option value="ALL">{t('activityWorkspace.allDates')}</option><option value="TODAY">{t('activityWorkspace.today')}</option><option value="7">{t('activityWorkspace.recent7')}</option></select></>} />
    <AbWorkspace list={list} detail={detail} />
    <AbMobileFab label={t('activityWorkspace.new')} onClick={() => setQuickOpen(true)} />
    <AbQuickCreate open={quickOpen} title={t('activityWorkspace.quickTitle')} help={t('activityWorkspace.quickHelp')} closeLabel={t('app.close')} onClose={() => setQuickOpen(false)} footer={<div className="lead-v2-drawer-actions"><button type="button" className="lead-v2-button ghost" onClick={() => setQuickOpen(false)}>{t('common.cancel')}</button><button type="button" className="lead-v2-button primary" onClick={create}>{t('common.save')}</button></div>}><div className="entity-quick-form"><label><span>{t('activityWorkspace.source')} *</span><select value={draft.source} onChange={event => setDraft(previous => ({ ...previous, source: event.target.value as UnifiedActivitySource, targetId: '' }))}><option value="LEAD">{t('activityWorkspace.lead')}</option><option value="ACCOUNT">{t('activityWorkspace.account')}</option></select></label><label><span>{t('activityWorkspace.target')} *</span><select value={draft.targetId} onChange={event => setDraft(previous => ({ ...previous, targetId: event.target.value }))}><option value="">{t('common.selectNone')}</option>{availableTargets.map(target => <option key={`${target.source}-${target.id}`} value={target.id}>{target.name}</option>)}</select></label><label><span>{t('activityWorkspace.type')}</span><select value={draft.type} onChange={event => setDraft(previous => ({ ...previous, type: event.target.value as UnifiedActivityType }))}>{ACTIVITY_TYPES.map(type => <option key={type} value={type}>{t(`account.activityTypes.${type}`)}</option>)}</select></label><label><span>{t('activityWorkspace.occurredAt')}</span><input type="datetime-local" value={draft.occurredAt} onChange={event => setDraft(previous => ({ ...previous, occurredAt: event.target.value }))} /></label><label className="full"><span>{t('activityWorkspace.subject')} *</span><input value={draft.subject} onChange={event => setDraft(previous => ({ ...previous, subject: event.target.value }))} /></label><label className="full"><span>{t('activityWorkspace.note')}</span><textarea rows={4} value={draft.note} onChange={event => setDraft(previous => ({ ...previous, note: event.target.value }))} /></label></div></AbQuickCreate>
    {message && <div className="lead-v2-toast" role="status">✓ {message}</div>}
  </section>;
}
