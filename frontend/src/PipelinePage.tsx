import React, { useEffect, useState } from 'react';
import { apiGet } from './api';

type FunnelRow = { stage: string; opportunity_count: number; amount: number; weighted_amount: number };
type ForecastRow = { forecast_category: string; opportunity_count: number; amount: number };
type Pipeline = { byStage: FunnelRow[]; forecast: ForecastRow[] };
const names: Record<string,string> = { NEEDS_ANALYSIS:'니즈파악', PROPOSAL:'제안', NEGOTIATION:'협상', CLOSED_WON:'수주성공', CLOSED_LOST:'수주실패' };

export function PipelinePage() {
  const [data,setData] = useState<Pipeline>({byStage:[],forecast:[]});
  const [message,setMessage] = useState('');
  useEffect(()=>{ apiGet<Pipeline>('/api/opportunities/pipeline/funnel').then(setData).catch(e=>setMessage(String(e))); },[]);
  return <section>
    <h2>Pipeline / Funnel</h2>
    <p style={{color:'#667085'}}>Stage별 기회건수, 제안금액, 확률가중 금액을 조회합니다.</p>
    {message && <div>{message}</div>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10,marginBottom:20}}>
      {data.byStage.map(x=><div key={x.stage} style={{border:'1px solid #dde3ea',borderRadius:10,padding:14}}><b>{names[x.stage]??x.stage}</b><div style={{fontSize:24,marginTop:8}}>{Number(x.opportunity_count)}</div><div>{Number(x.amount||0).toLocaleString()}원</div><small>Weighted {Number(x.weighted_amount||0).toLocaleString()}원</small></div>)}
    </div>
    <h3>Forecast Category</h3>
    <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>Category</th><th>건수</th><th>금액</th></tr></thead><tbody>{data.forecast.map(x=><tr key={x.forecast_category}><td style={{padding:8,borderBottom:'1px solid #eee'}}>{x.forecast_category}</td><td>{Number(x.opportunity_count)}</td><td>{Number(x.amount||0).toLocaleString()}원</td></tr>)}</tbody></table>
  </section>;
}
