import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listSandboxAccounts } from './account-sandbox';
import { useGlobalization } from './market/globalization-context';
import { formatCurrency } from './formatting/currency';
import { AccountActivityQuickAdd } from './features/account/AccountActivityQuickAdd';
import { listAccountActivities } from './features/account/account-relations-mock';
import {
  addMockOpportunity,
  listMockOpportunities,
  OPPORTUNITY_STAGES,
  updateMockOpportunity,
  type OpportunityMockRecord,
  type OpportunityStage
} from './features/opportunity/opportunity-mock';
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
  AbSectionAccordion,
  AbStepProgress,
  AbWorkspace,
  type AbDataColumn
} from './ui/ab-workspace';
import './styles/lead-workspace.css';
import './styles/entity-workspaces.css';

type OpportunityTab = 'overview' | 'stage' | 'activity';

const MAIN_STAGE_FLOW: OpportunityStage[] = ['IDENTIFIED', 'QUALIFIED', 'ANALYSIS', 'PROPOSAL', 'REVIEW', 'NEGOTIATION', 'WON'];

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function stageTone(stage: OpportunityStage) {
  if (stage === 'WON') return 'success' as const;
  if (stage === 'LOST') return 'neutral' as const;
  if (stage === 'HOLD') return 'warning' as const;
  return 'info' as const;
}

export function OpportunitiesPage() {
  const { t, i18n } = useTranslation();
  const { globalization } = useGlobalization();
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [tab, setTab] = useState<OpportunityTab>('overview');
  const [quickOpen, setQuickOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState({ accountId: '', name: '', expectedAmount: '', expectedCloseDate: '' });
  const [forecast, setForecast] = useState({ probability: '', expectedAmount: '', expectedCloseDate: '' });

  const accounts = useMemo(() => listSandboxAccounts('', 'all'), [tick]);
  const rows = useMemo(() => listMockOpportunities(), [tick]);
  const selected = rows.find(row => row.id === selectedId) ?? null;
  const selectedAccount = selected ? accounts.find(row => row.public_id === selected.accountId) ?? null : null;
  const accountActivities = selected ? listAccountActivities(selected.accountId) : [];

  const owners = useMemo(() => [...new Set(rows.map(row => row.ownerName))].sort(), [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return rows
      .filter(row => stageFilter === 'ALL' || row.stage === stageFilter)
      .filter(row => accountFilter === 'ALL' || row.accountId === accountFilter)
      .filter(row => ownerFilter === 'ALL' || row.ownerName === ownerFilter)
      .filter(row => !q || [row.name, row.accountName, row.ownerName].some(value => value.toLocaleLowerCase().includes(q)));
  }, [rows, search, stageFilter, accountFilter, ownerFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const money = (value: number) => formatCurrency(value, globalization.locale, globalization.currencyCode);

  const columns: AbDataColumn[] = [
    { key: 'name', label: t('opportunityWorkspace.name'), width: 'minmax(170px,1.45fr)', mobileRole: 'primary' },
    { key: 'account', label: t('opportunityWorkspace.account'), width: 'minmax(140px,1.15fr)' },
    { key: 'stage', label: t('opportunityWorkspace.stage'), width: '100px', mobileRole: 'badge' },
    { key: 'amount', label: t('opportunityWorkspace.amount'), width: '115px' },
    { key: 'owner', label: t('opportunityWorkspace.owner'), width: '90px' },
    { key: 'close', label: t('opportunityWorkspace.expectedClose'), width: '96px' }
  ];

  const reset = () => {
    setSearch(''); setStageFilter('ALL'); setAccountFilter('ALL'); setOwnerFilter('ALL'); setPage(1);
  };

  const select = (row: OpportunityMockRecord) => {
    setSelectedId(row.id);
    setTab('overview');
    setMobileDetailOpen(true);
    setForecast({ probability: String(row.probability), expectedAmount: String(row.expectedAmount), expectedCloseDate: row.expectedCloseDate || '' });
  };

  const create = () => {
    if (!draft.accountId || !draft.name.trim()) { setMessage(t('opportunityWorkspace.required')); return; }
    try {
      const created = addMockOpportunity({ accountId: draft.accountId, name: draft.name, expectedAmount: Number(draft.expectedAmount || 0), expectedCloseDate: draft.expectedCloseDate || undefined });
      setTick(value => value + 1);
      setSelectedId(created.id);
      setTab('overview');
      setMobileDetailOpen(true);
      setQuickOpen(false);
      setDraft({ accountId: '', name: '', expectedAmount: '', expectedCloseDate: '' });
      setMessage(t('opportunityWorkspace.created'));
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };

  const changeStage = (stage: OpportunityStage) => {
    if (!selected) return;
    try { updateMockOpportunity(selected.id, { stage }); setTick(value => value + 1); setMessage(t('opportunityWorkspace.stageSaved')); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };

  const saveForecast = () => {
    if (!selected) return;
    try {
      updateMockOpportunity(selected.id, { probability: Number(forecast.probability || 0), expectedAmount: Number(forecast.expectedAmount || 0), expectedCloseDate: forecast.expectedCloseDate || null });
      setTick(value => value + 1);
      setMessage(t('opportunityWorkspace.forecastSaved'));
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };

  const stageIndex = selected ? Math.max(0, MAIN_STAGE_FLOW.indexOf(selected.stage)) : 0;
  const list = <>
    <div className="lead-v2-list-header"><div><strong>{t('opportunityWorkspace.listTitle')}</strong><span>{t('opportunityWorkspace.count', { count: filtered.length })}</span></div></div>
    <AbDataList columns={columns} rows={paged} rowKey={row => row.id} selectedKey={selectedId ?? undefined} onRowClick={select} ariaLabel={t('opportunityWorkspace.listTitle')} empty={<AbEmptyState title={t('opportunityWorkspace.empty')} />} renderCells={row => [
      <span className="ab-primary-stack"><strong>{row.name}</strong><small>{row.source === 'LEAD_CONVERSION' ? t('opportunityWorkspace.sourceLead') : t('opportunityWorkspace.sourceManual')}</small></span>,
      <span>{row.accountName}</span>,
      <span className={`account-list-pill tone-${stageTone(row.stage)}`}>{t(`opportunityWorkspace.stages.${row.stage}`)}</span>,
      <span>{money(row.expectedAmount)}</span>, <span>{row.ownerName}</span>, <span>{formatDate(row.expectedCloseDate, i18n.language)}</span>
    ]} />
    <AbPagination page={currentPage} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} rowsPerPageLabel={t('account.pagination.rowsPerPage')} previousLabel={t('account.pagination.previous')} nextLabel={t('account.pagination.next')} pageStatus={t('account.pagination.pageStatus', { page: currentPage, pages: totalPages, count: filtered.length })} />
  </>;

  const detail = <article className="lead-v2-detail-pane">
    {!selected && <div className="lead-v2-empty-detail">{t('opportunityWorkspace.select')}</div>}
    {selected && <>
      <button type="button" className="lead-v2-mobile-back" onClick={() => setMobileDetailOpen(false)}>← {t('account.back')}</button>
      <AbDetailHeader eyebrow={selected.id} title={selected.name} subtitle={selected.accountName} badges={<AbEntityBadges badges={[
        { label: t(`opportunityWorkspace.stages.${selected.stage}`), tone: stageTone(selected.stage) },
        { label: selected.source === 'LEAD_CONVERSION' ? t('opportunityWorkspace.sourceLead') : t('opportunityWorkspace.sourceManual'), tone: 'neutral' }
      ]} />} meta={<div className="ab-detail-meta-list">
        <div className="ab-detail-meta-item"><span>{t('opportunityWorkspace.owner')}</span><strong>{selected.ownerName}</strong></div>
        <div className="ab-detail-meta-item"><span>{t('opportunityWorkspace.amount')}</span><strong>{money(selected.expectedAmount)}</strong></div>
        <div className="ab-detail-meta-item"><span>{t('opportunityWorkspace.probability')}</span><strong>{selected.probability}%</strong></div>
        <div className="ab-detail-meta-item"><span>{t('opportunityWorkspace.expectedClose')}</span><strong>{formatDate(selected.expectedCloseDate, i18n.language)}</strong></div>
      </div>} actions={<AbQuickActions actions={[
        { id: 'activity', label: t('account.actions.addActivity'), icon: '＋', onClick: () => setActivityOpen(true), tone: 'primary' },
        { id: 'stage', label: t('opportunityWorkspace.stageTab'), icon: '⇢', onClick: () => setTab('stage') }
      ]} />} />
      <nav className="lead-v2-tabs">{(['overview', 'stage', 'activity'] as OpportunityTab[]).map(item => <button type="button" key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{t(`opportunityWorkspace.${item === 'stage' ? 'stageTab' : item}`)}</button>)}</nav>
      <div className="lead-v2-detail-content entity-detail-stack">
        {tab === 'overview' && <><AbInfoGrid columns={2} items={[
          { label: t('opportunityWorkspace.account'), value: selected.accountName }, { label: t('opportunityWorkspace.owner'), value: selected.ownerName },
          { label: t('opportunityWorkspace.amount'), value: money(selected.expectedAmount) }, { label: t('opportunityWorkspace.probability'), value: `${selected.probability}%` },
          { label: t('opportunityWorkspace.expectedClose'), value: formatDate(selected.expectedCloseDate, i18n.language) },
          { label: t('opportunityWorkspace.source'), value: selected.source === 'LEAD_CONVERSION' ? t('opportunityWorkspace.sourceLead') : t('opportunityWorkspace.sourceManual') }
        ]} /><div className="entity-section-card"><AbStepProgress steps={MAIN_STAGE_FLOW.map(stage => ({ id: stage, label: t(`opportunityWorkspace.stages.${stage}`) }))} currentIndex={stageIndex} mobileLabel={t(`opportunityWorkspace.stages.${selected.stage}`)} /></div></>}
        {tab === 'stage' && <AbSectionAccordion id="opportunity-stage" title={t('opportunityWorkspace.stageTab')} open onToggle={() => undefined}>
          <div className="entity-stage-actions">{OPPORTUNITY_STAGES.map(stage => <button type="button" key={stage} className={`lead-v2-button secondary${selected.stage === stage ? ' active' : ''}`} onClick={() => changeStage(stage)}>{t(`opportunityWorkspace.stages.${stage}`)}</button>)}</div>
          <div className="entity-inline-form" style={{ marginTop: 14 }}><label><span>{t('opportunityWorkspace.amount')}</span><input type="number" min="0" value={forecast.expectedAmount} onChange={event => setForecast(previous => ({ ...previous, expectedAmount: event.target.value }))} /></label><label><span>{t('opportunityWorkspace.probability')}</span><input type="number" min="0" max="100" value={forecast.probability} onChange={event => setForecast(previous => ({ ...previous, probability: event.target.value }))} /></label><label><span>{t('opportunityWorkspace.expectedClose')}</span><input type="date" value={forecast.expectedCloseDate} onChange={event => setForecast(previous => ({ ...previous, expectedCloseDate: event.target.value }))} /></label></div>
          <div className="account-relation-section-actions"><button type="button" className="lead-v2-button primary" onClick={saveForecast}>{t('common.save')}</button></div>
        </AbSectionAccordion>}
        {tab === 'activity' && <div className="entity-section-card"><div className="entity-section-title"><strong>{t('opportunityWorkspace.activity')}</strong><button type="button" className="lead-v2-button secondary" onClick={() => setActivityOpen(true)}>+ {t('account.actions.addActivity')}</button></div><AbActivityTimeline items={accountActivities.map(item => ({ id: item.id, typeLabel: t(`account.activityTypes.${item.type}`), timeLabel: formatDate(item.occurredAt, i18n.language), title: item.subject, summary: item.note || undefined, owner: item.ownerName }))} empty={<AbEmptyState title={t('activityWorkspace.empty')} />} /></div>}
      </div>
    </>}
  </article>;

  return <section className={`lead-v2 ab-workspace${mobileDetailOpen ? ' mobile-detail-open' : ''}`}>
    <header className="lead-v2-page-header"><div><div className="lead-v2-title-line"><span className="lead-v2-kicker">CRM · OPPORTUNITY</span></div><h2>{t('opportunityWorkspace.title')}</h2><p>{t('opportunityWorkspace.subtitle')}</p></div><div className="lead-v2-header-actions"><button type="button" className="lead-v2-button primary" onClick={() => setQuickOpen(true)}>+ {t('opportunityWorkspace.new')}</button></div></header>
    <AbListToolbar searchValue={search} onSearchChange={value => { setSearch(value); setPage(1); }} searchPlaceholder={t('opportunityWorkspace.searchPlaceholder')} onReset={reset} resetLabel={t('account.filters.reset')} resultSummary={t('opportunityWorkspace.count', { count: filtered.length })} filters={<><select value={stageFilter} onChange={event => { setStageFilter(event.target.value); setPage(1); }}><option value="ALL">{t('opportunityWorkspace.allStages')}</option>{OPPORTUNITY_STAGES.map(stage => <option key={stage} value={stage}>{t(`opportunityWorkspace.stages.${stage}`)}</option>)}</select><select value={accountFilter} onChange={event => { setAccountFilter(event.target.value); setPage(1); }}><option value="ALL">{t('contactWorkspace.allAccounts')}</option>{accounts.map(account => <option key={account.public_id} value={account.public_id}>{account.account_name}</option>)}</select><select value={ownerFilter} onChange={event => { setOwnerFilter(event.target.value); setPage(1); }}><option value="ALL">{t('opportunityWorkspace.allOwners')}</option>{owners.map(owner => <option key={owner} value={owner}>{owner}</option>)}</select></>} />
    <AbWorkspace list={list} detail={detail} />
    <AbMobileFab label={t('opportunityWorkspace.new')} onClick={() => setQuickOpen(true)} />
    <AbQuickCreate open={quickOpen} title={t('opportunityWorkspace.quickTitle')} help={t('opportunityWorkspace.quickHelp')} closeLabel={t('app.close')} onClose={() => setQuickOpen(false)} footer={<div className="lead-v2-drawer-actions"><button type="button" className="lead-v2-button ghost" onClick={() => setQuickOpen(false)}>{t('common.cancel')}</button><button type="button" className="lead-v2-button primary" onClick={create}>{t('common.save')}</button></div>}><div className="entity-quick-form"><label className="full"><span>{t('opportunityWorkspace.account')} *</span><select value={draft.accountId} onChange={event => setDraft(previous => ({ ...previous, accountId: event.target.value }))}><option value="">{t('common.selectNone')}</option>{accounts.map(account => <option key={account.public_id} value={account.public_id}>{account.account_name}</option>)}</select></label><label className="full"><span>{t('opportunityWorkspace.name')} *</span><input value={draft.name} onChange={event => setDraft(previous => ({ ...previous, name: event.target.value }))} /></label><label><span>{t('opportunityWorkspace.amount')}</span><input type="number" min="0" value={draft.expectedAmount} onChange={event => setDraft(previous => ({ ...previous, expectedAmount: event.target.value }))} /></label><label><span>{t('opportunityWorkspace.expectedClose')}</span><input type="date" value={draft.expectedCloseDate} onChange={event => setDraft(previous => ({ ...previous, expectedCloseDate: event.target.value }))} /></label></div></AbQuickCreate>
    {selected && <AccountActivityQuickAdd open={activityOpen} accountId={selected.accountId} ownerName={selectedAccount?.owner_name ?? selected.ownerName} onClose={() => setActivityOpen(false)} onSaved={() => setTick(value => value + 1)} />}
    {message && <div className="lead-v2-toast" role="status">✓ {message}</div>}
  </section>;
}
