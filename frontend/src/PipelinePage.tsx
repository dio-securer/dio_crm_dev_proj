import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet } from './api';
import { useGlobalization } from './market/globalization-context';
import { formatCurrency } from './formatting/currency';

type FunnelRow = { stage: string; opportunity_count: number; amount: number; weighted_amount: number };
type ForecastRow = { forecast_category: string; opportunity_count: number; amount: number };
type Pipeline = { byStage: FunnelRow[]; forecast: ForecastRow[] };

export function PipelinePage() {
  const { t } = useTranslation();
  const { globalization } = useGlobalization();
  const money = (value:number) => formatCurrency(Number(value||0),globalization.locale,globalization.currencyCode);
  const [data,setData] = useState<Pipeline>({byStage:[],forecast:[]});
  const [message,setMessage] = useState('');
  useEffect(()=>{ apiGet<Pipeline>('/api/opportunities/pipeline/funnel').then(setData).catch(e=>setMessage(String(e))); },[]);
  return <section>
    <h2>{t('pipeline.title')}</h2>
    <p style={{color:'#667085'}}>{t('pipeline.subtitle')}</p>
    {message && <div>{message}</div>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10,marginBottom:20}}>
      {data.byStage.map(x=><div key={x.stage} style={{border:'1px solid #dde3ea',borderRadius:10,padding:14}}><b>{t(`opportunity.stages.${x.stage}`,{defaultValue:x.stage})}</b><div style={{fontSize:24,marginTop:8}}>{Number(x.opportunity_count)}</div><div>{money(x.amount)}</div><small>{t('pipeline.weighted')} {money(x.weighted_amount)}</small></div>)}
    </div>
    <h3>{t('pipeline.forecast')}</h3>
    <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>{t('pipeline.category')}</th><th>{t('pipeline.count')}</th><th>{t('common.amount')}</th></tr></thead><tbody>{data.forecast.map(x=><tr key={x.forecast_category}><td style={{padding:8,borderBottom:'1px solid #eee'}}>{x.forecast_category}</td><td>{Number(x.opportunity_count)}</td><td>{money(x.amount)}</td></tr>)}</tbody></table>
  </section>;
}
