import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPatch, apiPost } from './api';
import type { OrderProductSummary, OrderSummary } from '@dio-crm/contracts';
import { useGlobalization } from './market/globalization-context';
import { formatCurrency } from './formatting/currency';

type EligibleContract = { public_id:string; contract_name:string; contract_amount:number; erp_contract_no?:string|null; account_name:string; address?:string|null };

export function OrdersPage() {
  const { t } = useTranslation();
  const { globalization } = useGlobalization();
  const money=(value:number)=>formatCurrency(Number(value||0),globalization.locale,globalization.currencyCode);
  const [contracts,setContracts] = useState<EligibleContract[]>([]);
  const [products,setProducts] = useState<OrderProductSummary[]>([]);
  const [orders,setOrders] = useState<OrderSummary[]>([]);
  const [contractId,setContractId] = useState('');
  const [orderId,setOrderId] = useState('');
  const [productId,setProductId] = useState('');
  const [qty,setQty] = useState(1);
  const [directAddress,setDirectAddress] = useState('');
  const [expressYn,setExpressYn] = useState(false);
  const [message,setMessage] = useState('');

  const load = async () => {
    try {
      const [c,p,o] = await Promise.all([
        apiGet<EligibleContract[]>('/api/orders/eligible-contracts'),
        apiGet<OrderProductSummary[]>('/api/order-products'),
        apiGet<OrderSummary[]>('/api/orders')
      ]);
      setContracts(c); setProducts(p); setOrders(o);
      if (!contractId && c[0]) setContractId(c[0].public_id);
      if (!productId && p[0]) setProductId(p[0].public_id);
      if (!orderId && o[0]) setOrderId(o[0].public_id);
    } catch (e) { setMessage(String(e)); }
  };
  useEffect(() => { void load(); }, []);

  const selected = useMemo(() => orders.find(x=>x.public_id===orderId),[orders,orderId]);

  const createDraft = async () => {
    if (!contractId) return setMessage(t('order.selectApproved'));
    try {
      const r = await apiPost<{publicId:string}>('/api/orders',{contractPublicId:contractId});
      setOrderId(r.publicId); setMessage(t('order.draftDone')); await load();
    } catch(e){ setMessage(String(e)); }
  };

  const addItem = async () => {
    if (!orderId || !productId) return setMessage(t('order.selectOrderItem'));
    try { await apiPost(`/api/orders/${orderId}/items`,{productPublicId:productId,quantity:qty}); setMessage(t('order.itemDone')); await load(); }
    catch(e){ setMessage(String(e)); }
  };

  const saveDelivery = async (type:'ACCOUNT'|'DIRECT') => {
    if (!orderId) return;
    try {
      await apiPatch(`/api/orders/${orderId}/delivery`,{deliveryAddressType:type,deliveryAddress:type==='DIRECT'?directAddress:undefined,expressYn,note:null});
      setMessage(t('order.deliverySaved')); await load();
    } catch(e){ setMessage(String(e)); }
  };

  const submit = async () => {
    if (!orderId) return;
    try { await apiPost(`/api/orders/${orderId}/submit`); setMessage(t('order.erpQueued')); await load(); }
    catch(e){ setMessage(String(e)); }
  };

  return <section>
    <h2>{t('order.title')}</h2>
    <p style={{color:'#667085'}}>{t('order.subtitle')}</p>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
      <div style={{border:'1px solid #dde3ea',padding:14,borderRadius:10}}>
        <h3>{t('order.draft')}</h3>
        <select value={contractId} onChange={e=>setContractId(e.target.value)} style={{width:'100%',padding:8}}>
          {contracts.map(c=><option key={c.public_id} value={c.public_id}>{c.account_name} · {c.contract_name}</option>)}
        </select>
        <button onClick={createDraft} style={{marginTop:8}}>{t('order.draftCreate')}</button>
      </div>
      <div style={{border:'1px solid #dde3ea',padding:14,borderRadius:10}}>
        <h3>{t('order.itemQty')}</h3>
        <select value={productId} onChange={e=>setProductId(e.target.value)} style={{width:'100%',padding:8}}>
          {products.map(p=><option key={p.public_id} value={p.public_id}>{p.item_name} · {money(p.unit_price||0)} · {t('order.stock')} {p.stock_qty ?? '-'}</option>)}
        </select>
        <input type="number" min={1} value={qty} onChange={e=>setQty(Number(e.target.value)||1)} style={{width:90,marginTop:8}}/>
        <button onClick={addItem} style={{marginLeft:8}}>{t('order.itemApply')}</button>
      </div>
    </div>
    <div style={{border:'1px solid #dde3ea',padding:14,borderRadius:10,marginBottom:16}}>
      <h3>{t('order.delivery')}</h3>
      <label><input type="checkbox" checked={expressYn} onChange={e=>setExpressYn(e.target.checked)}/> {t('order.express')}</label>
      <button onClick={()=>saveDelivery('ACCOUNT')} style={{marginLeft:10}}>{t('order.accountAddress')}</button>
      <input value={directAddress} onChange={e=>setDirectAddress(e.target.value)} placeholder={t('order.directAddress')} style={{marginLeft:10,minWidth:280}}/>
      <button onClick={()=>saveDelivery('DIRECT')} style={{marginLeft:6}}>{t('order.saveDirect')}</button>
      <button onClick={submit} style={{marginLeft:10}}>{t('order.erpRequest')}</button>
    </div>
    {message && <div style={{padding:10,background:'#f6f8fa',marginBottom:12}}>{message}</div>}
    <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>Account</th><th>Contract</th><th>{t('common.status')}</th><th>{t('order.erpOrderNo')}</th><th>{t('common.item')}</th><th>{t('common.amount')}</th><th>{t('order.delivery')}</th></tr></thead><tbody>
      {orders.map(o=><tr key={o.public_id} onClick={()=>setOrderId(o.public_id)} style={{cursor:'pointer',background:selected?.public_id===o.public_id?'#eef4fb':'transparent'}}>
        <td>{o.account_name}</td><td>{o.contract_name}</td><td>{o.status}</td><td>{o.erp_order_no??'-'}</td><td>{o.item_count}</td><td>{money(o.order_amount)}</td><td>{o.express_yn?t('order.express'):t('order.normal')}</td>
      </tr>)}
    </tbody></table>
  </section>;
}
