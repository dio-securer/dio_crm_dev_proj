import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPatch, apiPost } from './api';
import { useGlobalization } from './market/globalization-context';
import { formatCurrency } from './formatting/currency';

type Opportunity = {
  public_id: string; opportunity_name: string; stage: string; record_type: string; amount: number;
  expected_close_date?: string | null; success_probability?: number | null; forecast_category?: string | null;
  account_name: string; account_public_id: string; erp_approved_yn: boolean; contract_created_yn: boolean;
};
type Account = { public_id: string; account_name: string };
type Catalog = { public_id: string; item_type: string; item_name: string; base_price: number };

const stages = ['NEEDS_ANALYSIS','PROPOSAL','NEGOTIATION','CLOSED_WON','CLOSED_LOST'];

export function OpportunitiesPage() {
  const { t } = useTranslation();
  const { globalization } = useGlobalization();
  const money = (value:number) => formatCurrency(Number(value||0),globalization.locale,globalization.currencyCode);
  const stageName = (stage:string) => t(`opportunity.stages.${stage}`,{defaultValue:stage});
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [catalog, setCatalog] = useState<Catalog[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [accountPublicId, setAccountPublicId] = useState('');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [productId, setProductId] = useState('');
  const [price, setPrice] = useState('0');
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const [o, a, c] = await Promise.all([
        apiGet<Opportunity[]>('/api/opportunities'), apiGet<Account[]>('/api/accounts'), apiGet<Catalog[]>('/api/product-packages')
      ]);
      setRows(o); setAccounts(a); setCatalog(c);
      if (!accountPublicId && a[0]) setAccountPublicId(a[0].public_id);
      if (!selected && o[0]) setSelected(o[0].public_id);
      if (!productId && c[0]) { setProductId(c[0].public_id); setPrice(String(c[0].base_price ?? 0)); }
    } catch (e) { setMessage(String(e)); }
  };
  useEffect(() => { void load(); }, []);

  const current = useMemo(() => rows.find(x => x.public_id === selected), [rows, selected]);

  const create = async () => {
    if (!accountPublicId || !name.trim()) return setMessage(t('opportunity.selectAccount'));
    try { await apiPost('/api/opportunities', { accountPublicId, opportunityName: name, recordType: 'EXISTING' }); setName(''); setMessage(t('opportunity.createDone')); await load(); }
    catch (e) { setMessage(String(e)); }
  };
  const move = async (toStage: string) => {
    if (!selected) return;
    try { await apiPost(`/api/opportunities/${selected}/stage`, { toStage, reason: reason || undefined }); setReason(''); setMessage(t('opportunity.stageDone',{stage:stageName(toStage)})); await load(); }
    catch (e) { setMessage(String(e)); }
  };
  const addProduct = async () => {
    if (!selected || !productId) return;
    try { await apiPost(`/api/opportunities/${selected}/products`, { packagePublicId: productId, quantity: 1, proposedUnitPrice: Number(price) || 0 }); setMessage(t('opportunity.productDone')); await load(); }
    catch (e) { setMessage(String(e)); }
  };
  const saveNegotiation = async () => {
    if (!selected) return;
    try { await apiPatch(`/api/opportunities/${selected}`, { forecastCategory: 'PIPELINE', successProbability: current?.stage === 'NEGOTIATION' ? 70 : 30 }); setMessage(t('opportunity.forecastSaved')); await load(); }
    catch (e) { setMessage(String(e)); }
  };

  return <section>
    <h2>{t('opportunity.title')}</h2>
    <p style={{color:'#667085'}}>{t('opportunity.subtitle')}</p>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:18}}>
      <div style={{border:'1px solid #dde3ea',padding:14,borderRadius:10}}>
        <h3>{t('opportunity.new')}</h3>
        <select value={accountPublicId} onChange={e=>setAccountPublicId(e.target.value)} style={{width:'100%',padding:8,marginBottom:8}}>{accounts.map(a=><option key={a.public_id} value={a.public_id}>{a.account_name}</option>)}</select>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder={t('opportunity.name')} style={{width:'100%',boxSizing:'border-box',padding:8,marginBottom:8}}/>
        <button onClick={create}>{t('common.create')}</button>
      </div>
      <div style={{border:'1px solid #dde3ea',padding:14,borderRadius:10}}>
        <h3>{t('opportunity.work')}</h3>
        <div>{current ? `${current.opportunity_name} / ${stageName(current.stage)} / ${money(current.amount)}` : t('common.selectNone')}</div>
        <input value={reason} onChange={e=>setReason(e.target.value)} placeholder={t('opportunity.reason')} style={{width:'100%',boxSizing:'border-box',padding:8,margin:'8px 0'}}/>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{stages.map(s=><button key={s} onClick={()=>move(s)}>{stageName(s)}</button>)}</div>
        <button onClick={saveNegotiation} style={{marginTop:8}}>{t('opportunity.forecastSample')}</button>
      </div>
    </div>
    <div style={{border:'1px solid #dde3ea',padding:14,borderRadius:10,marginBottom:18}}>
      <h3>{t('opportunity.products')}</h3>
      <select value={productId} onChange={e=>{setProductId(e.target.value); const x=catalog.find(c=>c.public_id===e.target.value); if(x) setPrice(String(x.base_price||0));}}>{catalog.map(c=><option key={c.public_id} value={c.public_id}>{c.item_type} · {c.item_name}</option>)}</select>
      <input type="number" value={price} onChange={e=>setPrice(e.target.value)} style={{marginLeft:8,width:140}}/>
      <button onClick={addProduct} style={{marginLeft:8}}>{t('opportunity.add')}</button>
    </div>
    {message && <div style={{padding:10,background:'#f6f8fa',marginBottom:12}}>{message}</div>}
    <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>Opportunity</th><th>Account</th><th>{t('common.status')}</th><th>{t('common.amount')}</th><th>{t('opportunity.erpApproved')}</th><th>{t('opportunity.expectedClose')}</th></tr></thead><tbody>
      {rows.map(r=><tr key={r.public_id} onClick={()=>setSelected(r.public_id)} style={{cursor:'pointer',background:selected===r.public_id?'#eef4fb':'transparent'}}>
        <td style={{padding:8,borderBottom:'1px solid #eee'}}>{r.opportunity_name}</td><td>{r.account_name}</td><td>{stageName(r.stage)}</td><td>{money(r.amount)}</td><td>{r.erp_approved_yn?'Y':'N'}</td><td>{r.expected_close_date??'-'}</td>
      </tr>)}
    </tbody></table>
  </section>;
}
