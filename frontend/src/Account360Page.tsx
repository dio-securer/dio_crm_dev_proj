import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Account360, AccountSummary } from '@dio-crm/contracts';
import { apiGet } from './api';
import { useGlobalization } from './market/globalization-context';
import { formatCurrency } from './formatting/currency';

function Box({title,children}:{title:string;children:React.ReactNode}) { return <div style={{border:'1px solid #dfe4ea',borderRadius:10,padding:14,background:'#fff'}}><h3>{title}</h3>{children}</div>; }

export function Account360Page() {
  const { t } = useTranslation();
  const { globalization } = useGlobalization();
  const money=(value:number)=>formatCurrency(Number(value||0),globalization.locale,globalization.currencyCode);
  const [accounts,setAccounts]=useState<AccountSummary[]>([]);
  const [accountId,setAccountId]=useState('');
  const [data,setData]=useState<Account360|null>(null);
  const [message,setMessage]=useState('');
  useEffect(()=>{void apiGet<AccountSummary[]>('/api/accounts').then(x=>{setAccounts(x);if(x[0])setAccountId(x[0].public_id);}).catch(e=>setMessage(String(e)));},[]);
  const load=async()=>{if(!accountId)return;try{setData(await apiGet<Account360>(`/api/analytics/accounts/${accountId}/360`));setMessage(t('account360.done'));}catch(e){setMessage(String(e));}};
  return <section>
    <h2>{t('account360.title')}</h2>
    <p style={{color:'#667085'}}>{t('account360.subtitle')}</p>
    <div style={{display:'flex',gap:8,marginBottom:14}}><select value={accountId} onChange={e=>setAccountId(e.target.value)} style={{minWidth:300,padding:8}}>{accounts.map(a=><option key={a.public_id} value={a.public_id}>{a.account_name}</option>)}</select><button onClick={load}>{t('account360.search')}</button></div>
    {message&&<p style={{background:'#f6f8fa',padding:10}}>{message}</p>}
    {data&&<>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
        <Box title={t('account360.opportunity')}><b>{data.analysis.opportunityCount}</b></Box><Box title={t('account360.contract')}><b>{data.analysis.contractCount}</b></Box><Box title={t('account360.sales')}><b>{money(data.analysis.salesTotal)}</b></Box><Box title={t('account360.collection')}><b>{money(data.analysis.collectionTotal)}</b></Box>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Box title="Sales"><p>Opportunity {data.sales.opportunities.length} / Contract {data.sales.contracts.length}</p><p>{t('account360.sales')} {data.sales.sales.length} / {t('account360.collection')} {data.sales.collections.length}</p><p>{t('account360.observedOutstanding')} {money(data.analysis.outstandingObserved)}</p></Box>
        <Box title="Order"><p>{t('account360.orders')} {data.order.orders.length} / {t('account360.delivery')} {data.order.deliveries.length} / {t('account360.returnExchange')} {data.order.returns.length}</p></Box>
        <Box title={t('account360.activity')}><p>{t('account360.activity')} {data.analysis.activityCount}</p>{data.activity.slice(0,5).map((x:any)=><div key={String(x.public_id)} style={{borderTop:'1px solid #eee',padding:'6px 0'}}>{String(x.planned_at??'')} · {String(x.visit_purpose??'')} · {String(x.status??'')}</div>)}</Box>
        <Box title={t('account360.service')}><p>{data.service.available?t('account360.connected'):t('account360.notImplemented')}</p><small>{data.service.reason}</small></Box>
      </div>
      <div style={{marginTop:14}}><Box title={t('account360.recentSales')}><table style={{width:'100%'}}><thead><tr><th>{t('common.date')}</th><th>{t('account360.salesNo')}</th><th>{t('common.item')}</th><th>{t('common.amount')}</th></tr></thead><tbody>{data.sales.sales.slice(0,20).map((x:any)=><tr key={String(x.public_id)}><td>{String(x.sales_date??'')}</td><td>{String(x.erp_sales_no??'')}</td><td>{String(x.item_name??x.item_code??'')}</td><td>{money(Number(x.amount??0))}</td></tr>)}</tbody></table></Box></div>
    </>}
  </section>;
}
