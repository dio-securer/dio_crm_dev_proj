import React, { useEffect, useState } from 'react';
import { apiGet } from './api';
import type { DeliverySummary, OrderSummary, ReturnExchangeSummary, SalesSummary } from '@dio-crm/contracts';

type Fulfillment = { order:OrderSummary; deliveries:DeliverySummary[]; sales:SalesSummary[]; returnExchanges:ReturnExchangeSummary[] };

export function FulfillmentPage() {
  const [orders,setOrders] = useState<OrderSummary[]>([]);
  const [selected,setSelected] = useState('');
  const [detail,setDetail] = useState<Fulfillment|null>(null);
  const [sales,setSales] = useState<SalesSummary[]>([]);
  const [message,setMessage] = useState('');

  const load = async () => {
    try {
      const [o,s] = await Promise.all([apiGet<OrderSummary[]>('/api/orders'),apiGet<SalesSummary[]>('/api/sales')]);
      setOrders(o); setSales(s);
      const id = selected || o[0]?.public_id || '';
      if (id) { setSelected(id); setDetail(await apiGet<Fulfillment>(`/api/orders/${id}/fulfillment`)); }
    } catch(e){ setMessage(String(e)); }
  };
  useEffect(()=>{ void load(); },[]);

  const open = async (id:string) => {
    setSelected(id);
    try { setDetail(await apiGet<Fulfillment>(`/api/orders/${id}/fulfillment`)); setMessage(''); }
    catch(e){ setMessage(String(e)); }
  };

  return <section>
    <h2>주문 / 납품 / 매출 / 반품·교환</h2>
    <p style={{color:'#667085'}}>ERP 실행결과를 CRM에서 조회하는 통합 현황입니다. 반품/교환 요청 프로세스는 미확정이므로 Phase 6에서는 ERP 결과 수신/조회만 제공합니다.</p>
    {message && <div style={{padding:10,background:'#fff4e5',marginBottom:12}}>{message}</div>}
    <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:14}}>
      <div style={{border:'1px solid #dde3ea',borderRadius:10,padding:12}}>
        <h3>주문</h3>
        {orders.map(o=><button key={o.public_id} onClick={()=>void open(o.public_id)} style={{display:'block',width:'100%',textAlign:'left',padding:8,marginBottom:6,background:selected===o.public_id?'#eef4fb':'white',border:'1px solid #ddd'}}>
          {o.account_name} · {o.status} · {o.erp_order_no??'ERP번호 대기'}
        </button>)}
      </div>
      <div>
        <div style={{border:'1px solid #dde3ea',borderRadius:10,padding:12,marginBottom:12}}>
          <h3>납품/출고</h3>
          <table style={{width:'100%'}}><thead><tr><th>ERP 납품번호</th><th>상태</th><th>출고</th><th>납품</th></tr></thead><tbody>
            {(detail?.deliveries??[]).map(x=><tr key={x.public_id}><td>{x.erp_delivery_no}</td><td>{x.delivery_status}</td><td>{x.shipped_at??'-'}</td><td>{x.delivered_at??'-'}</td></tr>)}
          </tbody></table>
        </div>
        <div style={{border:'1px solid #dde3ea',borderRadius:10,padding:12,marginBottom:12}}>
          <h3>주문 관련 매출</h3>
          <table style={{width:'100%'}}><thead><tr><th>ERP 매출번호</th><th>일자</th><th>품목</th><th>금액</th></tr></thead><tbody>
            {(detail?.sales??[]).map(x=><tr key={x.public_id}><td>{x.erp_sales_no}</td><td>{x.sales_date}</td><td>{x.item_name??x.item_code??'-'}</td><td>{Number(x.amount||0).toLocaleString()}</td></tr>)}
          </tbody></table>
        </div>
        <div style={{border:'1px solid #dde3ea',borderRadius:10,padding:12}}>
          <h3>반품 / 교환</h3>
          <table style={{width:'100%'}}><thead><tr><th>유형</th><th>ERP 참조번호</th><th>상태</th><th>품목</th><th>수량</th></tr></thead><tbody>
            {(detail?.returnExchanges??[]).map(x=><tr key={x.public_id}><td>{x.transaction_type}</td><td>{x.erp_reference_no}</td><td>{x.status}</td><td>{x.item_code??'-'}</td><td>{x.quantity??'-'}</td></tr>)}
          </tbody></table>
        </div>
      </div>
    </div>
    <h3 style={{marginTop:20}}>전체 매출</h3>
    <table style={{width:'100%'}}><thead><tr><th>Account</th><th>ERP 매출번호</th><th>일자</th><th>품목</th><th>금액</th></tr></thead><tbody>
      {sales.map(x=><tr key={x.public_id}><td>{x.account_name}</td><td>{x.erp_sales_no}</td><td>{x.sales_date}</td><td>{x.item_name??x.item_code??'-'}</td><td>{Number(x.amount||0).toLocaleString()}</td></tr>)}
    </tbody></table>
  </section>;
}
