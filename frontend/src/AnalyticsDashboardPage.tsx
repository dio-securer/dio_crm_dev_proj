import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AnalyticsDashboard } from '@dio-crm/contracts';
import { apiGet } from './api';
import { useGlobalization } from './market/globalization-context';
import { formatCurrency } from './formatting/currency';

function Card({title,value,sub}:{title:string;value:string|number;sub?:string}) { return <div style={{background:'#fff',border:'1px solid #dfe4ea',borderRadius:10,padding:14}}><div style={{color:'#667085',fontSize:13}}>{title}</div><div style={{fontSize:24,fontWeight:700,marginTop:4}}>{value}</div>{sub&&<small>{sub}</small>}</div>; }

export function AnalyticsDashboardPage() {
  const { t } = useTranslation();
  const { globalization } = useGlobalization();
  const money=(value:number)=>formatCurrency(Number(value||0),globalization.locale,globalization.currencyCode);
  const [from,setFrom]=useState(''); const [to,setTo]=useState(''); const [data,setData]=useState<AnalyticsDashboard|null>(null); const [message,setMessage]=useState('');
  const load=async()=>{try{const p=new URLSearchParams();if(from)p.set('from',from);if(to)p.set('to',to);setData(await apiGet<AnalyticsDashboard>(`/api/analytics/dashboard?${p}`));setMessage(t('analytics.done'));}catch(e){setMessage(String(e));}};
  const sum=(rows:Array<{count:number}>)=>rows.reduce((s,x)=>s+Number(x.count||0),0);
  return <section>
    <h2>{t('analytics.title')}</h2>
    <p style={{color:'#667085'}}>{t('analytics.subtitle')}</p>
    <div style={{display:'flex',gap:8,alignItems:'end',marginBottom:14}}><label>{t('analytics.from')}<input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{display:'block',padding:8}}/></label><label>{t('analytics.to')}<input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{display:'block',padding:8}}/></label><button onClick={load}>{t('common.search')}</button><button onClick={()=>{setFrom('');setTo('');}}>{t('analytics.resetPeriod')}</button></div>
    {message&&<p style={{background:'#f6f8fa',padding:10}}>{message}</p>}
    {data&&<>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}><Card title="Lead" value={sum(data.leads)}/><Card title="Activity" value={sum(data.activities)}/><Card title="Sales" value={money(data.sales.amount)} sub={`${Number(data.sales.count||0)} ${t('analytics.count')}`}/><Card title="Collection" value={money(data.collections.amount)} sub={`${Number(data.collections.count||0)} ${t('analytics.count')}`}/></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginTop:16}}>
        <div><h3>Pipeline / Funnel</h3><table style={{width:'100%'}}><thead><tr><th>{t('common.status')}</th><th>{t('analytics.count')}</th><th>{t('common.amount')}</th><th>{t('analytics.weighted')}</th></tr></thead><tbody>{data.pipeline.map(x=><tr key={x.stage}><td>{t(`opportunity.stages.${x.stage}`,{defaultValue:x.stage})}</td><td>{x.opportunity_count}</td><td>{money(x.amount)}</td><td>{money(x.weighted_amount)}</td></tr>)}</tbody></table></div>
        <div><h3>{t('analytics.topAccounts')}</h3><table style={{width:'100%'}}><thead><tr><th>{t('common.account')}</th><th>{t('common.sales')}</th></tr></thead><tbody>{data.topAccounts.map(x=><tr key={x.account_public_id}><td>{x.account_name}</td><td>{money(x.sales_amount)}</td></tr>)}</tbody></table></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginTop:16}}>
        <div><h3>{t('analytics.leadStatus')}</h3>{data.leads.map(x=><div key={x.status}>{t(`status.${x.status}`,{defaultValue:x.status})}: {x.count}</div>)}</div>
        <div><h3>{t('analytics.contractStatus')}</h3>{data.contracts.map(x=><div key={x.status}>{x.status}: {x.count} / {money(x.amount)}</div>)}</div>
        <div><h3>{t('analytics.orderStatus')}</h3>{data.orders.map(x=><div key={x.status}>{x.status}: {x.count}</div>)}</div>
      </div>
    </>}
  </section>;
}
