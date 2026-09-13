import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet } from './api';
import type { DeliverySummary, OrderSummary, ReturnExchangeSummary, SalesSummary } from '@dio-crm/contracts';
import { useGlobalization } from './market/globalization-context';
import { formatCurrency } from './formatting/currency';

type Fulfillment = { order:OrderSummary; deliveries:DeliverySummary[]; sales:SalesSummary[]; returnExchanges:ReturnExchangeSummary[] };

export function FulfillmentPage() {
  const { t } = useTranslation();
  const { globalization } = useGlobalization();
  const money=(value:number)=>formatCurrency(Number(value||0),globalization.locale,globalization.currencyCode);
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
    <h2>{t('fulfillment.title')}</h2>
    <p style={{color:'#667085'}}>{t('fulfillment.subtitle')}</p>
    {message && <div style={{padding:10,background:'#fff4e5',marginBottom:12}}>{message}</div>}
    <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:14}}>
      <div style={{border:'1px solid #dde3ea',borderRadius:10,padding:12}}>
        <h3>{t('fulfillment.orders')}</h3>
        {orders.map(o=><button key={o.public_id} onClick={()=>void open(o.public_id)} style={{display:'block',width:'100%',textAlign:'left',padding:8,marginBottom:6,background:selected===o.public_id?'#eef4fb':'white',border:'1px solid #ddd'}}>
          {o.account_name} · {o.status} · {o.erp_order_no??t('fulfillment.erpWaiting')}
        </button>)}
      </div>
      <div>
        <div style={{border:'1px solid #dde3ea',borderRadius:10,padding:12,marginBottom:12}}>
          <h3>{t('fulfillment.delivery')}</h3>
          <table style={{width:'100%'}}><thead><tr><th>{t('fulfillment.erpDeliveryNo')}</th><th>{t('common.status')}</th><th>{t('fulfillment.shipped')}</th><th>{t('fulfillment.delivered')}</th></tr></thead><tbody>
            {(detail?.deliveries??[]).map(x=><tr key={x.public_id}><td>{x.erp_delivery_no}</td><td>{x.delivery_status}</td><td>{x.shipped_at??'-'}</td><td>{x.delivered_at??'-'}</td></tr>)}
          </tbody></table>
        </div>
        <div style={{border:'1px solid #dde3ea',borderRadius:10,padding:12,marginBottom:12}}>
          <h3>{t('fulfillment.orderSales')}</h3>
          <table style={{width:'100%'}}><thead><tr><th>{t('fulfillment.erpSalesNo')}</th><th>{t('common.date')}</th><th>{t('common.item')}</th><th>{t('common.amount')}</th></tr></thead><tbody>
            {(detail?.sales??[]).map(x=><tr key={x.public_id}><td>{x.erp_sales_no}</td><td>{x.sales_date}</td><td>{x.item_name??x.item_code??'-'}</td><td>{money(x.amount)}</td></tr>)}
          </tbody></table>
        </div>
        <div style={{border:'1px solid #dde3ea',borderRadius:10,padding:12}}>
          <h3>{t('fulfillment.returnExchange')}</h3>
          <table style={{width:'100%'}}><thead><tr><th>{t('fulfillment.type')}</th><th>{t('fulfillment.erpReference')}</th><th>{t('common.status')}</th><th>{t('common.item')}</th><th>{t('common.quantity')}</th></tr></thead><tbody>
            {(detail?.returnExchanges??[]).map(x=><tr key={x.public_id}><td>{x.transaction_type}</td><td>{x.erp_reference_no}</td><td>{x.status}</td><td>{x.item_code??'-'}</td><td>{x.quantity??'-'}</td></tr>)}
          </tbody></table>
        </div>
      </div>
    </div>
    <h3 style={{marginTop:20}}>{t('fulfillment.allSales')}</h3>
    <table style={{width:'100%'}}><thead><tr><th>Account</th><th>{t('fulfillment.erpSalesNo')}</th><th>{t('common.date')}</th><th>{t('common.item')}</th><th>{t('common.amount')}</th></tr></thead><tbody>
      {sales.map(x=><tr key={x.public_id}><td>{x.account_name}</td><td>{x.erp_sales_no}</td><td>{x.sales_date}</td><td>{x.item_name??x.item_code??'-'}</td><td>{money(x.amount)}</td></tr>)}
    </tbody></table>
  </section>;
}
