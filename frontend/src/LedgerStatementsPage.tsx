import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AccountSummary, MonthlyStatement, PackageLedger } from '@dio-crm/contracts';
import { apiDownload, apiGet, apiPostDownload, saveBlob } from './api';
import { useGlobalization } from './market/globalization-context';
import { formatCurrency } from './formatting/currency';
import { formatDate } from './formatting/datetime';

type ContractOption = { public_id:string; contract_name:string; erp_contract_no?:string|null; contract_date?:string|null; contract_amount:number; status:string; };

function previousMonth() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { from: first.toISOString().slice(0,10), to: last.toISOString().slice(0,10) };
}

export function LedgerStatementsPage() {
  const { t } = useTranslation();
  const { globalization, featureEnabled } = useGlobalization();
  const money=(value:number)=>formatCurrency(Number(value||0),globalization.locale,globalization.currencyCode);
  const date=(value:string)=>formatDate(`${value}T00:00:00Z`,globalization.locale,globalization.timezone);
  const statementEnabled=featureEnabled('MONTHLY_STATEMENT');
  const defaults = useMemo(previousMonth, []);
  const [accounts,setAccounts] = useState<AccountSummary[]>([]);
  const [contracts,setContracts] = useState<ContractOption[]>([]);
  const [accountId,setAccountId] = useState('');
  const [contractId,setContractId] = useState('');
  const [general,setGeneral] = useState(false);
  const [from,setFrom] = useState(defaults.from);
  const [to,setTo] = useState(defaults.to);
  const [ledger,setLedger] = useState<PackageLedger|null>(null);
  const [statement,setStatement] = useState<MonthlyStatement|null>(null);
  const [selected,setSelected] = useState<string[]>([]);
  const [message,setMessage] = useState('');
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

  useEffect(() => { void apiGet<AccountSummary[]>('/api/accounts').then(x => { setAccounts(x); if (x[0]) setAccountId(x[0].public_id); }).catch(e=>setMessage(String(e))); }, []);
  useEffect(() => {
    if (!accountId) return;
    void apiGet<ContractOption[]>(`/api/analytics/accounts/${accountId}/contracts`).then(x => { setContracts(x); setContractId(x[0]?.public_id ?? ''); }).catch(e=>setMessage(String(e)));
  }, [accountId]);

  const qs = () => {
    const p = new URLSearchParams({ from, to });
    if (general) p.set('general','true'); else if (contractId) p.set('contractPublicId',contractId);
    return p.toString();
  };
  const ready = Boolean(accountId && (general || contractId));

  const loadLedger = async () => {
    if (!ready) return setMessage(t('ledger.selectScope'));
    try { setLedger(await apiGet<PackageLedger>(`/api/analytics/accounts/${accountId}/ledger?${qs()}`)); setMessage(t('ledger.ledgerDone')); }
    catch(e){ setMessage(String(e)); }
  };
  const loadStatement = async () => {
    if (!ready) return setMessage(t('ledger.selectScope'));
    try { const x=await apiGet<MonthlyStatement>(`/api/analytics/accounts/${accountId}/statements?${qs()}`); setStatement(x); setSelected([]); setMessage(t('ledger.statementFound',{count:x.summary.lineCount})); }
    catch(e){ setMessage(String(e)); }
  };
  const excel = async () => {
    if (!ready) return;
    try { const out=await apiDownload(`/api/analytics/accounts/${accountId}/ledger.xlsx?${qs()}`); saveBlob(out.blob,out.filename??'package-ledger.xlsx'); }
    catch(e){ setMessage(String(e)); }
  };
  const pdf = async () => {
    if (!ready) return;
    try {
      const out=await apiPostDownload(`/api/analytics/accounts/${accountId}/statements/pdf`,{ contractPublicId:general?undefined:contractId, general, from, to, salesPublicIds: mobile || selected.length===0 ? undefined : selected });
      saveBlob(out.blob,out.filename??'statement.pdf');
    } catch(e){ setMessage(String(e)); }
  };

  return <section>
    <h2>{t('ledger.title')}</h2>
    <p style={{color:'#667085'}}>{t('ledger.subtitle')}</p>
    <div style={{display:'grid',gridTemplateColumns:'2fr 2fr 1fr 1fr',gap:8,alignItems:'end'}}>
      <label>{t('common.account')}<select value={accountId} onChange={e=>setAccountId(e.target.value)} style={{width:'100%',padding:8}}>{accounts.map(a=><option key={a.public_id} value={a.public_id}>{a.account_name}</option>)}</select></label>
      <label>{t('ledger.packageContract')}<select value={contractId} disabled={general} onChange={e=>setContractId(e.target.value)} style={{width:'100%',padding:8}}>{contracts.map(c=><option key={c.public_id} value={c.public_id}>{c.contract_name} {c.erp_contract_no?`(${c.erp_contract_no})`:''}</option>)}</select></label>
      <label>{t('ledger.from')}<input type="date" min="2018-01-01" value={from} onChange={e=>setFrom(e.target.value)} style={{width:'100%',padding:8,boxSizing:'border-box'}}/></label>
      <label>{t('ledger.to')}<input type="date" min="2018-01-01" value={to} onChange={e=>setTo(e.target.value)} style={{width:'100%',padding:8,boxSizing:'border-box'}}/></label>
    </div>
    <label style={{display:'block',margin:'10px 0'}}><input type="checkbox" checked={general} onChange={e=>setGeneral(e.target.checked)}/> {t('ledger.general')}</label>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={loadLedger}>{t('ledger.ledgerSearch')}</button><button onClick={excel}>{t('ledger.excel')}</button>{statementEnabled&&<><button onClick={loadStatement}>{t('ledger.statementSearch')}</button><button onClick={pdf}>{t('ledger.pdf')}</button></>}</div>
    {message&&<p style={{background:'#f6f8fa',padding:10}}>{message}</p>}
    {ledger&&<div style={{marginTop:18}}><h3>{t('ledger.detail')}</h3><p>{t('common.sales')} {money(ledger.summary.salesAmount)} / {t('common.collection')} {money(ledger.summary.collectionAmount)} / {t('ledger.returnCount')} {ledger.summary.returnExchangeCount}</p>
      <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>{t('common.date')}</th><th>{t('fulfillment.type')}</th><th>{t('ledger.reference')}</th><th>{t('common.item')}</th><th>{t('common.quantity')}</th><th>{t('common.amount')}</th><th>{t('common.status')}</th></tr></thead><tbody>{ledger.rows.map(r=><tr key={`${r.txn_type}-${r.public_id}`}><td>{r.txn_date?date(r.txn_date):'-'}</td><td>{r.txn_type}</td><td>{r.reference_no??'-'}</td><td>{r.item_name??r.item_code??'-'}</td><td>{r.quantity??'-'}</td><td>{r.amount==null?'-':money(r.amount)}</td><td>{r.status??'-'}</td></tr>)}</tbody></table>
    </div>}
    {statementEnabled&&statement&&<div style={{marginTop:22}}><h3>{t('ledger.preview')}</h3><p>{date(statement.period.from)} ~ {date(statement.period.to)} · {statement.summary.lineCount} · {money(statement.summary.totalAmount)}</p>
      {mobile&&<p style={{color:'#667085'}}>{t('ledger.mobileHint')}</p>}
      <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{!mobile&&<th>{t('ledger.select')}</th>}<th>{t('ledger.salesDate')}</th><th>{t('ledger.erpSalesNo')}</th><th>{t('common.item')}</th><th>{t('common.quantity')}</th><th>{t('common.amount')}</th></tr></thead><tbody>{statement.rows.map(r=><tr key={r.public_id}>{!mobile&&<td><input type="checkbox" checked={selected.includes(r.public_id)} onChange={e=>setSelected(e.target.checked?[...selected,r.public_id]:selected.filter(x=>x!==r.public_id))}/></td>}<td>{date(r.sales_date)}</td><td>{r.erp_sales_no}</td><td>{r.item_name??r.item_code??'-'}</td><td>{r.quantity??'-'}</td><td>{money(r.amount)}</td></tr>)}</tbody></table>
    </div>}
  </section>;
}
