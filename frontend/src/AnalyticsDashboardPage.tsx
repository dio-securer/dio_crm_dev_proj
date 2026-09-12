import React, { useState } from 'react';
import type { AnalyticsDashboard } from '@dio-crm/contracts';
import { apiGet } from './api';

function Card({title,value,sub}:{title:string;value:string|number;sub?:string}) { return <div style={{background:'#fff',border:'1px solid #dfe4ea',borderRadius:10,padding:14}}><div style={{color:'#667085',fontSize:13}}>{title}</div><div style={{fontSize:24,fontWeight:700,marginTop:4}}>{value}</div>{sub&&<small>{sub}</small>}</div>; }

export function AnalyticsDashboardPage() {
  const [from,setFrom]=useState(''); const [to,setTo]=useState(''); const [data,setData]=useState<AnalyticsDashboard|null>(null); const [message,setMessage]=useState('');
  const load=async()=>{try{const p=new URLSearchParams();if(from)p.set('from',from);if(to)p.set('to',to);setData(await apiGet<AnalyticsDashboard>(`/api/analytics/dashboard?${p}`));setMessage('Dashboard 조회 완료');}catch(e){setMessage(String(e));}};
  const sum=(rows:Array<{count:number}>)=>rows.reduce((s,x)=>s+Number(x.count||0),0);
  return <section>
    <h2>영업 분석 Dashboard</h2>
    <p style={{color:'#667085'}}>Lead / Activity / Pipeline / Contract / Order / Sales / Collection을 전사 관점으로 통합 조회합니다.</p>
    <div style={{display:'flex',gap:8,alignItems:'end',marginBottom:14}}><label>시작일<input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{display:'block',padding:8}}/></label><label>종료일<input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{display:'block',padding:8}}/></label><button onClick={load}>조회</button><button onClick={()=>{setFrom('');setTo('');}}>기간 초기화</button></div>
    {message&&<p style={{background:'#f6f8fa',padding:10}}>{message}</p>}
    {data&&<>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}><Card title="Lead" value={sum(data.leads)}/><Card title="Activity" value={sum(data.activities)}/><Card title="Sales" value={`${Number(data.sales.amount||0).toLocaleString()}원`} sub={`${Number(data.sales.count||0)}건`}/><Card title="Collection" value={`${Number(data.collections.amount||0).toLocaleString()}원`} sub={`${Number(data.collections.count||0)}건`}/></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginTop:16}}>
        <div><h3>Pipeline / Funnel</h3><table style={{width:'100%'}}><thead><tr><th>단계</th><th>건수</th><th>금액</th><th>가중금액</th></tr></thead><tbody>{data.pipeline.map(x=><tr key={x.stage}><td>{x.stage}</td><td>{x.opportunity_count}</td><td>{Number(x.amount||0).toLocaleString()}</td><td>{Number(x.weighted_amount||0).toLocaleString()}</td></tr>)}</tbody></table></div>
        <div><h3>Top Accounts</h3><table style={{width:'100%'}}><thead><tr><th>거래처</th><th>매출</th></tr></thead><tbody>{data.topAccounts.map(x=><tr key={x.account_public_id}><td>{x.account_name}</td><td>{Number(x.sales_amount||0).toLocaleString()}</td></tr>)}</tbody></table></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginTop:16}}>
        <div><h3>Lead 상태</h3>{data.leads.map(x=><div key={x.status}>{x.status}: {x.count}</div>)}</div>
        <div><h3>Contract 상태</h3>{data.contracts.map(x=><div key={x.status}>{x.status}: {x.count} / {Number(x.amount||0).toLocaleString()}</div>)}</div>
        <div><h3>Order 상태</h3>{data.orders.map(x=><div key={x.status}>{x.status}: {x.count}</div>)}</div>
      </div>
    </>}
  </section>;
}
