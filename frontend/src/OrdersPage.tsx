import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPatch, apiPost } from './api';
import type { OrderProductSummary, OrderSummary } from '@dio-crm/contracts';

type EligibleContract = { public_id:string; contract_name:string; contract_amount:number; erp_contract_no?:string|null; account_name:string; address?:string|null };
type OrderDetail = OrderSummary & { items:Array<{ public_id:string; item_name:string; quantity:number; unit_price:number; line_amount:number }> };

export function OrdersPage() {
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
    if (!contractId) return setMessage('ERP 승인 계약을 선택하세요.');
    try {
      const r = await apiPost<{publicId:string}>('/api/orders',{contractPublicId:contractId});
      setOrderId(r.publicId); setMessage('주문 Draft 생성 완료'); await load();
    } catch(e){ setMessage(String(e)); }
  };

  const addItem = async () => {
    if (!orderId || !productId) return setMessage('주문과 품목을 선택하세요.');
    try { await apiPost(`/api/orders/${orderId}/items`,{productPublicId:productId,quantity:qty}); setMessage('품목 반영 완료'); await load(); }
    catch(e){ setMessage(String(e)); }
  };

  const saveDelivery = async (type:'ACCOUNT'|'DIRECT') => {
    if (!orderId) return;
    try {
      await apiPatch(`/api/orders/${orderId}/delivery`,{deliveryAddressType:type,deliveryAddress:type==='DIRECT'?directAddress:undefined,expressYn,note:null});
      setMessage('배송정보 저장 완료'); await load();
    } catch(e){ setMessage(String(e)); }
  };

  const submit = async () => {
    if (!orderId) return;
    try { await apiPost(`/api/orders/${orderId}/submit`); setMessage('ERP 주문요청 Queue 생성 완료'); await load(); }
    catch(e){ setMessage(String(e)); }
  };

  return <section>
    <h2>주문 / Order</h2>
    <p style={{color:'#667085'}}>ERP 승인되고 마감되지 않은 Contract만 주문할 수 있습니다. 실제 ERP Transport 연결 전에는 요청 Queue까지만 생성합니다.</p>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
      <div style={{border:'1px solid #dde3ea',padding:14,borderRadius:10}}>
        <h3>1. 주문 Draft</h3>
        <select value={contractId} onChange={e=>setContractId(e.target.value)} style={{width:'100%',padding:8}}>
          {contracts.map(c=><option key={c.public_id} value={c.public_id}>{c.account_name} · {c.contract_name}</option>)}
        </select>
        <button onClick={createDraft} style={{marginTop:8}}>Draft 생성</button>
      </div>
      <div style={{border:'1px solid #dde3ea',padding:14,borderRadius:10}}>
        <h3>2. 품목 / 수량</h3>
        <select value={productId} onChange={e=>setProductId(e.target.value)} style={{width:'100%',padding:8}}>
          {products.map(p=><option key={p.public_id} value={p.public_id}>{p.item_name} · {Number(p.unit_price||0).toLocaleString()}원 · 재고 {p.stock_qty ?? '-'}</option>)}
        </select>
        <input type="number" min={1} value={qty} onChange={e=>setQty(Number(e.target.value)||1)} style={{width:90,marginTop:8}}/>
        <button onClick={addItem} style={{marginLeft:8}}>품목 반영</button>
      </div>
    </div>
    <div style={{border:'1px solid #dde3ea',padding:14,borderRadius:10,marginBottom:16}}>
      <h3>3. 배송 / 특송</h3>
      <label><input type="checkbox" checked={expressYn} onChange={e=>setExpressYn(e.target.checked)}/> 특송</label>
      <button onClick={()=>saveDelivery('ACCOUNT')} style={{marginLeft:10}}>거래처 주소 사용</button>
      <input value={directAddress} onChange={e=>setDirectAddress(e.target.value)} placeholder="직접 배송지" style={{marginLeft:10,minWidth:280}}/>
      <button onClick={()=>saveDelivery('DIRECT')} style={{marginLeft:6}}>직접 주소 저장</button>
      <button onClick={submit} style={{marginLeft:10}}>ERP 주문 요청</button>
    </div>
    {message && <div style={{padding:10,background:'#f6f8fa',marginBottom:12}}>{message}</div>}
    <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>Account</th><th>Contract</th><th>상태</th><th>ERP 주문번호</th><th>품목</th><th>금액</th><th>배송</th></tr></thead><tbody>
      {orders.map(o=><tr key={o.public_id} onClick={()=>setOrderId(o.public_id)} style={{cursor:'pointer',background:selected?.public_id===o.public_id?'#eef4fb':'transparent'}}>
        <td>{o.account_name}</td><td>{o.contract_name}</td><td>{o.status}</td><td>{o.erp_order_no??'-'}</td><td>{o.item_count}</td><td>{Number(o.order_amount||0).toLocaleString()}</td><td>{o.express_yn?'특송':'일반'}</td>
      </tr>)}
    </tbody></table>
  </section>;
}
