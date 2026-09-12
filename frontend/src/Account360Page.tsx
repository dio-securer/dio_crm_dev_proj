import React, { useEffect, useState } from 'react';
import type { Account360, AccountSummary } from '@dio-crm/contracts';
import { apiGet } from './api';

function Box({title,children}:{title:string;children:React.ReactNode}) { return <div style={{border:'1px solid #dfe4ea',borderRadius:10,padding:14,background:'#fff'}}><h3>{title}</h3>{children}</div>; }

export function Account360Page() {
  const [accounts,setAccounts]=useState<AccountSummary[]>([]);
  const [accountId,setAccountId]=useState('');
  const [data,setData]=useState<Account360|null>(null);
  const [message,setMessage]=useState('');
  useEffect(()=>{void apiGet<AccountSummary[]>('/api/accounts').then(x=>{setAccounts(x);if(x[0])setAccountId(x[0].public_id);}).catch(e=>setMessage(String(e)));},[]);
  const load=async()=>{if(!accountId)return;try{setData(await apiGet<Account360>(`/api/analytics/accounts/${accountId}/360`));setMessage('거래처 360 조회 완료');}catch(e){setMessage(String(e));}};
  return <section>
    <h2>거래처 360</h2>
    <p style={{color:'#667085'}}>Sales / Order / Activity / 현황분석을 거래처 한 화면에서 통합 조회합니다. Customer Center/Service는 현재 구현 범위 밖이므로 상태를 명시적으로 표시합니다.</p>
    <div style={{display:'flex',gap:8,marginBottom:14}}><select value={accountId} onChange={e=>setAccountId(e.target.value)} style={{minWidth:300,padding:8}}>{accounts.map(a=><option key={a.public_id} value={a.public_id}>{a.account_name}</option>)}</select><button onClick={load}>360 조회</button></div>
    {message&&<p style={{background:'#f6f8fa',padding:10}}>{message}</p>}
    {data&&<>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
        <Box title="기회"><b>{data.analysis.opportunityCount}</b>건</Box><Box title="계약"><b>{data.analysis.contractCount}</b>건</Box><Box title="매출"><b>{Number(data.analysis.salesTotal).toLocaleString()}</b>원</Box><Box title="수금"><b>{Number(data.analysis.collectionTotal).toLocaleString()}</b>원</Box>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Box title="Sales"><p>Opportunity {data.sales.opportunities.length}건 / Contract {data.sales.contracts.length}건</p><p>매출 {data.sales.sales.length}건 / 수금 {data.sales.collections.length}건</p><p>관측 미수 {Number(data.analysis.outstandingObserved).toLocaleString()}원</p></Box>
        <Box title="Order"><p>주문 {data.order.orders.length}건 / 납품 {data.order.deliveries.length}건 / 반품·교환 {data.order.returns.length}건</p></Box>
        <Box title="Activity"><p>활동 {data.analysis.activityCount}건</p>{data.activity.slice(0,5).map((x:any)=><div key={String(x.public_id)} style={{borderTop:'1px solid #eee',padding:'6px 0'}}>{String(x.planned_at??'')} · {String(x.visit_purpose??'')} · {String(x.status??'')}</div>)}</Box>
        <Box title="Service"><p>{data.service.available?'연결됨':'미구현'}</p><small>{data.service.reason}</small></Box>
      </div>
      <div style={{marginTop:14}}><Box title="최근 매출"><table style={{width:'100%'}}><thead><tr><th>일자</th><th>매출번호</th><th>품목</th><th>금액</th></tr></thead><tbody>{data.sales.sales.slice(0,20).map((x:any)=><tr key={String(x.public_id)}><td>{String(x.sales_date??'')}</td><td>{String(x.erp_sales_no??'')}</td><td>{String(x.item_name??x.item_code??'')}</td><td>{Number(x.amount??0).toLocaleString()}</td></tr>)}</tbody></table></Box></div>
    </>}
  </section>;
}
